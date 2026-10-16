-- =====================================================================
--  Campuslands · Sistema Central de Gestión Operativa
--  01-esquema.sql — Tablas, reglas de integridad y trazabilidad
--
--  PostgreSQL ejecuta este archivo automáticamente la primera vez que se
--  crea el volumen de datos (carpeta /docker-entrypoint-initdb.d).
--  Para volver a ejecutarlo: docker compose down -v && docker compose up
-- =====================================================================

-- Toda la operación usa la hora oficial del campus (Colombia, UTC-5).
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'America/Bogota');
END
$$;
SET timezone TO 'America/Bogota';

-- Necesaria para la restricción de exclusión que impide reservas solapadas.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Quién originó un cambio de estado (se guarda en el historial).
CREATE DOMAIN origen_cambio AS VARCHAR(20)
    CHECK (VALUE IN ('usuario', 'sistema', 'ia', 'importacion', 'incidencia', 'devolucion'));


-- ---------------------------------------------------------------------
--  Catálogos del triaje de incidencias (la IA solo puede elegir de aquí)
-- ---------------------------------------------------------------------
CREATE TABLE areas_responsables (
    codigo       VARCHAR(40)  PRIMARY KEY,
    nombre       VARCHAR(80)  NOT NULL,
    descripcion  TEXT         NOT NULL
);

CREATE TABLE categorias_incidencia (
    codigo            VARCHAR(40)  PRIMARY KEY,
    nombre            VARCHAR(80)  NOT NULL,
    descripcion       TEXT         NOT NULL,
    area_por_defecto  VARCHAR(40)  NOT NULL REFERENCES areas_responsables (codigo)
);


-- ---------------------------------------------------------------------
--  Módulo 1 · Espacios (aulas, cubículos, laboratorios, auditorios...)
-- ---------------------------------------------------------------------
CREATE TABLE espacios (
    id              SERIAL        PRIMARY KEY,
    codigo          VARCHAR(40)   NOT NULL,
    nombre          VARCHAR(120)  NOT NULL,
    tipo            VARCHAR(40)   NOT NULL,
    capacidad       INTEGER       NOT NULL,
    ubicacion       VARCHAR(120),
    equipamiento    TEXT[]        NOT NULL DEFAULT '{}',
    estado          VARCHAR(20)   NOT NULL DEFAULT 'disponible',
    motivo_estado   TEXT,
    origen_estado   origen_cambio NOT NULL DEFAULT 'sistema',
    creado_en       TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    actualizado_en  TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    CONSTRAINT espacios_codigo_unico       UNIQUE (codigo),
    CONSTRAINT espacios_capacidad_positiva CHECK (capacidad > 0),
    CONSTRAINT espacios_estado_valido      CHECK (estado IN ('disponible', 'mantenimiento', 'inhabilitado'))
);

CREATE TABLE reservas (
    id              SERIAL        PRIMARY KEY,
    espacio_id      INTEGER       NOT NULL REFERENCES espacios (id),
    solicitante     VARCHAR(120)  NOT NULL,
    motivo          VARCHAR(200),
    asistentes      INTEGER       NOT NULL,
    fecha           DATE          NOT NULL,
    hora_inicio     TIME(0)       NOT NULL,
    hora_fin        TIME(0)       NOT NULL,
    estado          VARCHAR(20)   NOT NULL DEFAULT 'activa',
    motivo_estado   TEXT,
    origen_estado   origen_cambio NOT NULL DEFAULT 'usuario',
    creado_en       TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    actualizado_en  TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    CONSTRAINT reservas_asistentes_positivos CHECK (asistentes > 0),
    CONSTRAINT reservas_rango_horario        CHECK (hora_fin > hora_inicio),
    CONSTRAINT reservas_estado_valido        CHECK (estado IN ('activa', 'cancelada', 'finalizada')),
    -- Garantía final contra dobles reservas, incluso con peticiones simultáneas.
    CONSTRAINT reservas_sin_solapamiento EXCLUDE USING gist (
        espacio_id WITH =,
        tsrange(fecha + hora_inicio, fecha + hora_fin, '[)') WITH &&
    ) WHERE (estado = 'activa')
);


-- ---------------------------------------------------------------------
--  Módulo 2 · Recursos tecnológicos y préstamos
-- ---------------------------------------------------------------------
CREATE TABLE recursos (
    id              SERIAL        PRIMARY KEY,
    codigo          VARCHAR(40)   NOT NULL,
    nombre          VARCHAR(120)  NOT NULL,
    tipo            VARCHAR(40)   NOT NULL,
    espacio_id      INTEGER       REFERENCES espacios (id) ON DELETE SET NULL,
    estado          VARCHAR(20)   NOT NULL DEFAULT 'disponible',
    motivo_estado   TEXT,
    origen_estado   origen_cambio NOT NULL DEFAULT 'sistema',
    creado_en       TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    actualizado_en  TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    CONSTRAINT recursos_codigo_unico  UNIQUE (codigo),
    CONSTRAINT recursos_estado_valido CHECK (estado IN ('disponible', 'prestado', 'mantenimiento', 'baja'))
);

CREATE TABLE prestamos (
    id                SERIAL        PRIMARY KEY,
    recurso_id        INTEGER       NOT NULL REFERENCES recursos (id),
    solicitante       VARCHAR(120)  NOT NULL,
    fecha_prestamo    TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    fecha_limite      TIMESTAMP(0)  NOT NULL,
    fecha_devolucion  TIMESTAMP(0),
    con_danio         BOOLEAN       NOT NULL DEFAULT false,
    observaciones     TEXT,
    estado            VARCHAR(20)   NOT NULL DEFAULT 'activo',
    motivo_estado     TEXT,
    origen_estado     origen_cambio NOT NULL DEFAULT 'usuario',
    creado_en         TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    actualizado_en    TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    CONSTRAINT prestamos_estado_valido        CHECK (estado IN ('activo', 'devuelto')),
    CONSTRAINT prestamos_limite_posterior     CHECK (fecha_limite > fecha_prestamo),
    CONSTRAINT prestamos_devolucion_coherente CHECK ((estado = 'devuelto') = (fecha_devolucion IS NOT NULL)),
    CONSTRAINT prestamos_devolucion_posterior CHECK (fecha_devolucion IS NULL OR fecha_devolucion >= fecha_prestamo)
);

-- Un recurso no puede tener dos préstamos activos al mismo tiempo.
CREATE UNIQUE INDEX prestamos_un_activo_por_recurso ON prestamos (recurso_id) WHERE estado = 'activo';


-- ---------------------------------------------------------------------
--  Módulo 3 · Incidencias y solicitudes (triaje asistido por IA)
-- ---------------------------------------------------------------------
CREATE TABLE incidencias (
    id                  SERIAL        PRIMARY KEY,
    descripcion         TEXT          NOT NULL,
    reportado_por       VARCHAR(120)  NOT NULL,
    espacio_id          INTEGER       REFERENCES espacios (id) ON DELETE SET NULL,
    recurso_id          INTEGER       REFERENCES recursos (id) ON DELETE SET NULL,
    categoria           VARCHAR(40)   REFERENCES categorias_incidencia (codigo),
    prioridad           VARCHAR(10),
    area_responsable    VARCHAR(40)   REFERENCES areas_responsables (codigo),
    -- Qué deja fuera de servicio esta incidencia mientras siga abierta (RN-10)
    bloquea_espacio     BOOLEAN       NOT NULL DEFAULT false,
    bloquea_recurso     BOOLEAN       NOT NULL DEFAULT false,
    triaje              VARCHAR(20)   NOT NULL DEFAULT 'pendiente',
    ia_resumen          TEXT,
    ia_justificacion    TEXT,
    ia_accion_sugerida  TEXT,
    ia_confianza        NUMERIC(3, 2),
    ia_modelo           VARCHAR(80),
    ia_ajustes          JSONB         NOT NULL DEFAULT '[]',
    ia_error            TEXT,
    -- De dónde salió el reporte: un usuario, una devolución con daño o el dataset
    origen              VARCHAR(20)   NOT NULL DEFAULT 'usuario',
    estado              VARCHAR(20)   NOT NULL DEFAULT 'abierta',
    motivo_estado       TEXT,
    origen_estado       origen_cambio NOT NULL DEFAULT 'usuario',
    creado_en           TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    actualizado_en      TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    resuelto_en         TIMESTAMP(0),
    CONSTRAINT incidencias_prioridad_valida CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
    CONSTRAINT incidencias_estado_valido    CHECK (estado IN ('abierta', 'en_proceso', 'resuelta', 'cerrada')),
    CONSTRAINT incidencias_triaje_valido    CHECK (triaje IN ('pendiente', 'ia', 'manual')),
    CONSTRAINT incidencias_origen_valido    CHECK (origen IN ('usuario', 'devolucion', 'importacion')),
    CONSTRAINT incidencias_confianza_rango  CHECK (ia_confianza BETWEEN 0 AND 1),
    -- Una incidencia clasificada siempre tiene categoría, prioridad y área.
    CONSTRAINT incidencias_clasificacion_completa CHECK (
        triaje = 'pendiente'
        OR (categoria IS NOT NULL AND prioridad IS NOT NULL AND area_responsable IS NOT NULL)
    )
);


-- ---------------------------------------------------------------------
--  Trazabilidad: historial de cambios de estado e importaciones
-- ---------------------------------------------------------------------
CREATE TABLE historial_estados (
    id               BIGSERIAL     PRIMARY KEY,
    entidad          VARCHAR(20)   NOT NULL,
    entidad_id       INTEGER       NOT NULL,
    estado_anterior  VARCHAR(20),
    estado_nuevo     VARCHAR(20)   NOT NULL,
    motivo           TEXT,
    origen           origen_cambio NOT NULL,
    registrado_en    TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0)
);
CREATE INDEX historial_por_entidad ON historial_estados (entidad, entidad_id, registrado_en DESC);

CREATE TABLE importaciones (
    id            SERIAL        PRIMARY KEY,
    entidad       VARCHAR(20)   NOT NULL,
    archivo       VARCHAR(200),
    total         INTEGER       NOT NULL,
    insertados    INTEGER       NOT NULL,
    rechazados    INTEGER       NOT NULL,
    detalle       JSONB         NOT NULL DEFAULT '[]',
    importado_en  TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0)
);


-- ---------------------------------------------------------------------
--  Disparadores: fecha de actualización y registro automático de estados
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_tocar_actualizado_en() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := LOCALTIMESTAMP(0);
    RETURN NEW;
END
$$;

-- Cada vez que cambia la columna "estado" queda un registro en historial_estados,
-- sin importar desde qué workflow se hizo el cambio.
CREATE FUNCTION fn_registrar_cambio_estado() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.estado IS DISTINCT FROM OLD.estado THEN
        INSERT INTO historial_estados (entidad, entidad_id, estado_anterior, estado_nuevo, motivo, origen)
        VALUES (
            TG_ARGV[0],
            NEW.id,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado END,
            NEW.estado,
            NEW.motivo_estado,
            NEW.origen_estado
        );
    END IF;
    RETURN NULL;
END
$$;

CREATE TRIGGER espacios_actualizado_en    BEFORE UPDATE ON espacios    FOR EACH ROW EXECUTE FUNCTION fn_tocar_actualizado_en();
CREATE TRIGGER reservas_actualizado_en    BEFORE UPDATE ON reservas    FOR EACH ROW EXECUTE FUNCTION fn_tocar_actualizado_en();
CREATE TRIGGER recursos_actualizado_en    BEFORE UPDATE ON recursos    FOR EACH ROW EXECUTE FUNCTION fn_tocar_actualizado_en();
CREATE TRIGGER prestamos_actualizado_en   BEFORE UPDATE ON prestamos   FOR EACH ROW EXECUTE FUNCTION fn_tocar_actualizado_en();
CREATE TRIGGER incidencias_actualizado_en BEFORE UPDATE ON incidencias FOR EACH ROW EXECUTE FUNCTION fn_tocar_actualizado_en();

CREATE TRIGGER espacios_historial    AFTER INSERT OR UPDATE OF estado ON espacios    FOR EACH ROW EXECUTE FUNCTION fn_registrar_cambio_estado('espacio');
CREATE TRIGGER reservas_historial    AFTER INSERT OR UPDATE OF estado ON reservas    FOR EACH ROW EXECUTE FUNCTION fn_registrar_cambio_estado('reserva');
CREATE TRIGGER recursos_historial    AFTER INSERT OR UPDATE OF estado ON recursos    FOR EACH ROW EXECUTE FUNCTION fn_registrar_cambio_estado('recurso');
CREATE TRIGGER prestamos_historial   AFTER INSERT OR UPDATE OF estado ON prestamos   FOR EACH ROW EXECUTE FUNCTION fn_registrar_cambio_estado('prestamo');
CREATE TRIGGER incidencias_historial AFTER INSERT OR UPDATE OF estado ON incidencias FOR EACH ROW EXECUTE FUNCTION fn_registrar_cambio_estado('incidencia');


-- ---------------------------------------------------------------------
--  Vistas de lectura (las consultan los webhooks GET de n8n)
-- ---------------------------------------------------------------------
CREATE FUNCTION prioridad_orden(prioridad TEXT) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE prioridad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 WHEN 'baja' THEN 4 ELSE 5 END
$$;

CREATE VIEW v_espacios AS
SELECT
    e.id, e.codigo, e.nombre, e.tipo, e.capacidad, e.ubicacion, e.equipamiento,
    e.estado, e.motivo_estado, e.origen_estado, e.actualizado_en,
    EXISTS (
        SELECT 1 FROM reservas r
        WHERE r.espacio_id = e.id AND r.estado = 'activa' AND r.fecha = CURRENT_DATE
          AND LOCALTIME(0) >= r.hora_inicio AND LOCALTIME(0) < r.hora_fin
    ) AS ocupado_ahora,
    (SELECT count(*) FROM reservas r
      WHERE r.espacio_id = e.id AND r.estado = 'activa' AND r.fecha = CURRENT_DATE)::INTEGER AS reservas_hoy,
    (SELECT count(*) FROM incidencias i
      WHERE i.espacio_id = e.id AND i.estado IN ('abierta', 'en_proceso'))::INTEGER AS incidencias_abiertas
FROM espacios e;

CREATE VIEW v_reservas AS
SELECT
    r.id, r.espacio_id, e.codigo AS espacio_codigo, e.nombre AS espacio_nombre, e.capacidad AS espacio_capacidad,
    r.solicitante, r.motivo, r.asistentes, r.fecha,
    to_char(r.hora_inicio, 'HH24:MI') AS hora_inicio,
    to_char(r.hora_fin, 'HH24:MI') AS hora_fin,
    r.estado,
    CASE WHEN r.estado = 'activa' AND (r.fecha + r.hora_fin) <= LOCALTIMESTAMP THEN 'finalizada' ELSE r.estado END AS estado_efectivo,
    r.motivo_estado, r.origen_estado, r.creado_en
FROM reservas r
JOIN espacios e ON e.id = r.espacio_id;

CREATE VIEW v_recursos AS
SELECT
    rc.id, rc.codigo, rc.nombre, rc.tipo, rc.espacio_id,
    e.codigo AS espacio_codigo, e.nombre AS espacio_nombre,
    rc.estado, rc.motivo_estado, rc.origen_estado, rc.actualizado_en,
    p.id AS prestamo_id, p.solicitante AS prestado_a, p.fecha_limite,
    COALESCE(p.fecha_limite < LOCALTIMESTAMP, false) AS prestamo_vencido,
    (SELECT count(*) FROM incidencias i
      WHERE i.recurso_id = rc.id AND i.estado IN ('abierta', 'en_proceso'))::INTEGER AS incidencias_abiertas
FROM recursos rc
LEFT JOIN espacios e ON e.id = rc.espacio_id
LEFT JOIN prestamos p ON p.recurso_id = rc.id AND p.estado = 'activo';

CREATE VIEW v_prestamos AS
SELECT
    p.id, p.recurso_id, rc.codigo AS recurso_codigo, rc.nombre AS recurso_nombre, rc.tipo AS recurso_tipo,
    p.solicitante, p.fecha_prestamo, p.fecha_limite, p.fecha_devolucion,
    p.con_danio, p.observaciones, p.estado,
    (p.estado = 'activo' AND p.fecha_limite < LOCALTIMESTAMP) AS vencido,
    p.motivo_estado, p.origen_estado
FROM prestamos p
JOIN recursos rc ON rc.id = p.recurso_id;

CREATE VIEW v_incidencias AS
SELECT
    i.id, i.descripcion, i.reportado_por,
    i.espacio_id, e.codigo AS espacio_codigo, e.nombre AS espacio_nombre,
    i.recurso_id, rc.codigo AS recurso_codigo, rc.nombre AS recurso_nombre,
    i.categoria, c.nombre AS categoria_nombre,
    i.prioridad, i.area_responsable, a.nombre AS area_nombre,
    i.bloquea_espacio, i.bloquea_recurso, i.triaje, i.ia_resumen, i.ia_justificacion, i.ia_accion_sugerida,
    i.ia_confianza, i.ia_modelo, i.ia_ajustes, i.ia_error, i.origen,
    i.estado, i.motivo_estado, i.origen_estado, i.creado_en, i.actualizado_en, i.resuelto_en
FROM incidencias i
LEFT JOIN espacios e ON e.id = i.espacio_id
LEFT JOIN recursos rc ON rc.id = i.recurso_id
LEFT JOIN categorias_incidencia c ON c.codigo = i.categoria
LEFT JOIN areas_responsables a ON a.codigo = i.area_responsable;
