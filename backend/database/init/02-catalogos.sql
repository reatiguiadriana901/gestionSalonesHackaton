-- =====================================================================
--  02-catalogos.sql — Taxonomía oficial para el triaje de incidencias
--
--  La IA solo puede clasificar con los códigos de estas tablas: el
--  workflow de triaje las lee y rechaza cualquier valor fuera de ellas.
--  Para agregar una categoría basta con insertar una fila aquí.
-- =====================================================================

INSERT INTO areas_responsables (codigo, nombre, descripcion) VALUES
    ('mantenimiento',          'Mantenimiento locativo',     'Instalaciones físicas: mobiliario, aire acondicionado, iluminación, electricidad, plomería, puertas y ventanas.'),
    ('soporte_ti',             'Soporte TI',                 'Equipos de cómputo, proyectores, periféricos, software, licencias y cuentas de usuario.'),
    ('redes',                  'Redes y conectividad',       'Internet, wifi, red cableada y equipos de red.'),
    ('servicios_generales',    'Servicios generales',        'Aseo, residuos, insumos y cafetería.'),
    ('seguridad',              'Seguridad y salud',          'Emergencias, riesgos para personas, accidentes, robos y accesos no autorizados.'),
    ('bienestar',              'Bienestar estudiantil',      'Convivencia, salud, acompañamiento y atención a estudiantes.'),
    ('coordinacion_academica', 'Coordinación académica',     'Horarios, clases, solicitudes académicas y casos que no encajan en otra área.');

INSERT INTO categorias_incidencia (codigo, nombre, descripcion, area_por_defecto) VALUES
    ('infraestructura',    'Infraestructura',       'Daños o fallas en instalaciones físicas: mobiliario, aire acondicionado, iluminación, electricidad, plomería, puertas o ventanas.', 'mantenimiento'),
    ('equipo_tecnologico', 'Equipo tecnológico',    'Fallas de equipos tecnológicos: portátiles, proyectores, pantallas, cámaras, periféricos o kits.',                                 'soporte_ti'),
    ('conectividad',       'Conectividad',          'Problemas de internet, wifi, red cableada o acceso a la red.',                                                                     'redes'),
    ('software',           'Software y accesos',    'Problemas con programas, licencias, plataformas, cuentas o contraseñas.',                                                          'soporte_ti'),
    ('aseo',               'Aseo',                  'Limpieza, residuos, insumos de baño o condiciones de higiene.',                                                                    'servicios_generales'),
    ('seguridad',          'Seguridad',             'Riesgo para personas: emergencias, accidentes, incendios, cables expuestos, robos o accesos no autorizados.',                       'seguridad'),
    ('bienestar',          'Bienestar estudiantil', 'Convivencia, salud, acompañamiento o quejas de trato.',                                                                            'bienestar'),
    ('solicitud_general',  'Solicitud general',     'Solicitudes o consultas no urgentes que no son una falla.',                                                                        'coordinacion_academica');
