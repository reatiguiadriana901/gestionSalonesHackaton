/**
 * Vista: Recursos tecnológicos y préstamos (Módulo 2)
 *
 * Pestañas: inventario (estado y trazabilidad) y préstamos (registro y
 * devolución). Las reglas RN-05 a RN-08 y RN-13 las valida el backend.
 */
import { recursosApi, prestamosApi } from '../api/recursosApi.js';
import { espaciosApi } from '../api/espaciosApi.js';
import { html, render, delegarAcciones } from '../ui/dom.js';
import { bloqueCargando, bloqueError, bloqueVacio } from '../ui/estado.js';
import { campo, insignia, insigniaEstado, tabla } from '../ui/componentes.js';
import { abrirFormulario } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { ICONOS } from '../ui/iconos.js';
import { ahoraCampus, capitalizar, etiquetaEstado, formatearFechaHora, normalizar, sumarDias } from '../utils/formato.js';
import { abrirHistorial } from './historial.js';

const PESTANAS = [
  { id: 'inventario', texto: 'Inventario' },
  { id: 'prestamos', texto: 'Préstamos' },
];
const ESTADOS_RECURSO = ['disponible', 'prestado', 'mantenimiento', 'baja'];
const ESTADOS_MANUALES = ['disponible', 'mantenimiento', 'baja']; // "prestado" lo asigna un préstamo
const FILTROS_PRESTAMO = [
  { valor: 'activo', texto: 'Activos' },
  { valor: 'vencido', texto: 'Vencidos' },
  { valor: 'devuelto', texto: 'Devueltos' },
  { valor: '', texto: 'Todos' },
];

export const recursosVista = {
  titulo: 'Recursos y préstamos',

  async montar(raiz, parametros) {
    const estadoVista = {
      pestana: PESTANAS.some((p) => p.id === parametros.get('pestana')) ? parametros.get('pestana') : 'inventario',
      recursos: [],
      filtros: { texto: '', estado: '', tipo: '' },
      filtroPrestamos: 'activo',
    };

    render(
      raiz,
      html`
        <section class="vista">
          <header class="vista__encabezado">
            <div class="vista__titulo">
              <h1>Recursos y préstamos</h1>
              <p>Equipos tecnológicos con trazabilidad completa de su estado y disponibilidad.</p>
            </div>
            <div class="vista__acciones">
              <button type="button" class="boton boton--secundario" data-accion="nuevoRecurso">${ICONOS.mas} Nuevo recurso</button>
              <button type="button" class="boton boton--primario" data-accion="nuevoPrestamo">${ICONOS.prestar} Nuevo préstamo</button>
            </div>
          </header>
          <div class="pestanas" role="tablist">
            ${PESTANAS.map(
              (p) => html`<button type="button" class="pestanas__boton" role="tab" data-accion="pestana" data-id="${p.id}" aria-selected="${p.id === estadoVista.pestana}">${p.texto}</button>`,
            )}
          </div>
          <div data-panel></div>
        </section>`,
    );
    const panel = raiz.querySelector('[data-panel]');
    const recursoPorId = (id) => estadoVista.recursos.find((r) => String(r.id) === String(id));

    // ------------------------------------------------------------ datos
    async function cargarRecursos() {
      const { data } = await recursosApi.listar();
      estadoVista.recursos = data;
    }

    async function mostrarPestana() {
      raiz.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === estadoVista.pestana)));
      render(panel, bloqueCargando('Cargando recursos…'));
      try {
        await cargarRecursos();
      } catch (error) {
        render(panel, bloqueError(error));
        return;
      }
      if (estadoVista.pestana === 'inventario') render(panel, vistaInventario());
      else {
        render(panel, vistaPrestamos());
        await cargarPrestamos();
      }
    }

    async function refrescarTrasCambio() {
      await cargarRecursos();
      if (estadoVista.pestana === 'inventario') render(panel.querySelector('[data-tabla-recursos]'), tablaRecursos());
      else await cargarPrestamos();
    }

    // ---------------------------------------------------- pestaña inventario
    function recursosFiltrados() {
      const texto = normalizar(estadoVista.filtros.texto);
      return estadoVista.recursos.filter(
        (r) =>
          (!texto || normalizar(`${r.codigo} ${r.nombre} ${r.tipo} ${r.espacio_codigo ?? ''} ${r.prestado_a ?? ''}`).includes(texto)) &&
          (!estadoVista.filtros.estado || r.estado === estadoVista.filtros.estado) &&
          (!estadoVista.filtros.tipo || r.tipo === estadoVista.filtros.tipo),
      );
    }

    function vistaInventario() {
      const tipos = [...new Set(estadoVista.recursos.map((r) => r.tipo))].sort();
      const { filtros } = estadoVista;
      return html`
        <div class="herramientas">
          <input class="control herramientas__buscar" type="search" placeholder="Buscar por código, nombre, ubicación o persona" aria-label="Buscar recursos" data-filtro="texto" value="${filtros.texto}" />
          <select class="control" aria-label="Filtrar por estado" data-filtro="estado">
            <option value="">Todos los estados</option>
            ${ESTADOS_RECURSO.map((e) => html`<option value="${e}" ${filtros.estado === e ? 'selected' : ''}>${etiquetaEstado(e)}</option>`)}
          </select>
          <select class="control" aria-label="Filtrar por tipo" data-filtro="tipo">
            <option value="">Todos los tipos</option>
            ${tipos.map((t) => html`<option value="${t}" ${filtros.tipo === t ? 'selected' : ''}>${capitalizar(t)}</option>`)}
          </select>
        </div>
        <div data-tabla-recursos>${tablaRecursos()}</div>`;
    }

    function tablaRecursos() {
      if (!estadoVista.recursos.length) return bloqueVacio('Aún no hay recursos', 'Impórtalos desde la sección Datos o registra uno nuevo.');
      const lista = recursosFiltrados();
      if (!lista.length) return bloqueVacio('Ningún recurso coincide con los filtros');
      return tabla(
        ['Código', 'Recurso', 'Ubicación', 'Estado', 'Préstamo', 'Incidencias', ''],
        lista.map(
          (r) => html`
            <tr>
              <td class="mono">${r.codigo}</td>
              <td><div class="tabla__principal">${r.nombre}</div><div class="texto-xs texto-suave">${capitalizar(r.tipo)}</div></td>
              <td>${r.espacio_codigo ? `${r.espacio_codigo} · ${r.espacio_nombre}` : '—'}</td>
              <td>${insigniaEstado(r.estado, r.motivo_estado)}</td>
              <td>
                ${r.prestamo_id
                  ? html`<div>${r.prestado_a}</div>
                      <div class="texto-xs ${r.prestamo_vencido ? '' : 'texto-suave'}">
                        ${r.prestamo_vencido ? insignia('Vencido', 'peligro') : 'hasta'} ${formatearFechaHora(r.fecha_limite)}
                      </div>`
                  : '—'}
              </td>
              <td>${r.incidencias_abiertas > 0 ? insignia(`${r.incidencias_abiertas} abierta(s)`, 'peligro') : '—'}</td>
              <td>
                <div class="tabla__acciones">
                  ${r.prestamo_id
                    ? html`<button type="button" class="boton boton--secundario boton--pequeno" data-accion="devolver" data-id="${r.prestamo_id}" data-recurso="${r.id}">${ICONOS.devolver} Devolver</button>`
                    : html`<button type="button" class="boton boton--secundario boton--pequeno" data-accion="prestar" data-id="${r.id}" ${r.estado === 'disponible' ? '' : 'disabled'} title="${r.estado === 'disponible' ? 'Registrar préstamo' : `No disponible: ${etiquetaEstado(r.estado).toLowerCase()}`}">${ICONOS.prestar} Prestar</button>`}
                  <button type="button" class="boton boton--fantasma boton--pequeno" data-accion="cambiarEstado" data-id="${r.id}" aria-label="Cambiar estado de ${r.codigo}" title="Cambiar estado">${ICONOS.editar}</button>
                  <button type="button" class="boton boton--fantasma boton--pequeno" data-accion="historial" data-id="${r.id}" aria-label="Trazabilidad de ${r.codigo}" title="Trazabilidad">${ICONOS.historial}</button>
                </div>
              </td>
            </tr>`,
        ),
      );
    }

    // ----------------------------------------------------- pestaña préstamos
    function vistaPrestamos() {
      return html`
        <div class="herramientas">
          <select class="control" aria-label="Filtrar préstamos" data-filtro-prestamos>
            ${FILTROS_PRESTAMO.map((f) => html`<option value="${f.valor}" ${estadoVista.filtroPrestamos === f.valor ? 'selected' : ''}>${f.texto}</option>`)}
          </select>
        </div>
        <div data-tabla-prestamos></div>`;
    }

    async function cargarPrestamos() {
      const contenedor = panel.querySelector('[data-tabla-prestamos]');
      if (!contenedor) return;
      render(contenedor, bloqueCargando('Cargando préstamos…'));
      try {
        const { data } = await prestamosApi.listar({ estado: estadoVista.filtroPrestamos });
        render(contenedor, tablaPrestamos(data));
      } catch (error) {
        render(contenedor, bloqueError(error));
      }
    }

    function tablaPrestamos(lista) {
      if (!lista.length) return bloqueVacio('No hay préstamos para este filtro');
      return tabla(
        ['Recurso', 'Solicitante', 'Prestado', 'Devolver a más tardar', 'Devuelto', 'Estado', ''],
        lista.map(
          (p) => html`
            <tr>
              <td><span class="mono tabla__principal">${p.recurso_codigo}</span> <span class="texto-suave">${p.recurso_nombre}</span></td>
              <td>${p.solicitante}</td>
              <td>${formatearFechaHora(p.fecha_prestamo)}</td>
              <td>${formatearFechaHora(p.fecha_limite)} ${p.vencido && insignia('Vencido', 'peligro')}</td>
              <td>${p.fecha_devolucion ? formatearFechaHora(p.fecha_devolucion) : '—'} ${p.con_danio && insignia('Con daño', 'aviso', p.observaciones ?? '')}</td>
              <td>${insigniaEstado(p.estado)}</td>
              <td>
                <div class="tabla__acciones">
                  ${p.estado === 'activo' && html`<button type="button" class="boton boton--secundario boton--pequeno" data-accion="devolver" data-id="${p.id}" data-recurso="${p.recurso_id}">${ICONOS.devolver} Registrar devolución</button>`}
                </div>
              </td>
            </tr>`,
        ),
      );
    }

    // ---------------------------------------------------------- formularios
    function modalPrestamo(recursoId = '') {
      const ahora = ahoraCampus();
      const opciones = [
        { valor: '', texto: 'Selecciona un recurso' },
        ...estadoVista.recursos.map((r) => ({
          valor: r.id,
          texto: `${r.codigo} · ${r.nombre}${r.estado === 'disponible' ? '' : ` — ${etiquetaEstado(r.estado).toLowerCase()}`}`,
        })),
      ];
      abrirFormulario({
        titulo: 'Nuevo préstamo',
        intro: html`<p class="texto-sm texto-suave">El servidor valida: recurso disponible (RN-05), máximo 3 días (RN-06) y máximo 2 préstamos activos por persona, sin vencidos (RN-07).</p>`,
        campos: html`
          <div class="formulario__rejilla">
            ${campo({ nombre: 'recurso_id', etiqueta: 'Recurso', tipo: 'select', valor: recursoId, opciones, atributos: { required: true }, ancho: true })}
            ${campo({ nombre: 'solicitante', etiqueta: 'Solicitante', atributos: { required: true, maxlength: 120, placeholder: 'Nombre del estudiante o trainer' } })}
            ${campo({ nombre: 'fecha_limite', etiqueta: 'Devolver a más tardar', tipo: 'datetime-local', valor: `${sumarDias(ahora.fecha, 1)}T18:00`, atributos: { required: true } })}
          </div>`,
        textoEnviar: 'Registrar préstamo',
        textoCargando: 'Validando reglas…',
        async alEnviar(datos) {
          const { message } = await prestamosApi.crear(datos);
          toast.exito(message);
          await refrescarTrasCambio();
        },
      });
    }

    function modalDevolucion(prestamoId, recurso) {
      abrirFormulario({
        titulo: `Registrar devolución · ${recurso?.nombre ?? 'recurso'}`,
        intro: html`
          <div class="aviso aviso--ia">
            <div>Si reportas un daño, el recurso queda en mantenimiento y se crea una incidencia que la <strong>IA clasifica</strong> automáticamente (RN-08).</div>
          </div>`,
        campos: html`
          ${campo({ nombre: 'con_danio', etiqueta: 'El recurso se devolvió con daños', tipo: 'checkbox' })}
          ${campo({ nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea', ayuda: 'Si hay daño, descríbelo (mínimo 10 caracteres).', atributos: { maxlength: 1000, placeholder: 'Ej.: la pantalla tiene una grieta y no enciende' } })}`,
        textoEnviar: 'Registrar devolución',
        textoCargando: 'Registrando…',
        async alEnviar({ con_danio: conDanio, observaciones }) {
          const { data, message } = await prestamosApi.devolver(Number(prestamoId), conDanio, observaciones);
          if (data.triaje && !data.triaje.clasificada) toast.aviso(message, { titulo: 'Devolución registrada' });
          else toast.exito(message);
          await refrescarTrasCambio();
        },
      });
    }

    function modalNuevoRecurso() {
      abrirFormulario({
        titulo: 'Nuevo recurso',
        campos: html`<div class="formulario__rejilla">${camposRecurso()}</div>`,
        textoEnviar: 'Registrar recurso',
        async alEnviar(datos) {
          const { message } = await recursosApi.crear(datos);
          toast.exito(message);
          await refrescarTrasCambio();
        },
      });
      // La ubicación se completa cuando llega la lista de espacios
      espaciosApi
        .listar()
        .then(({ data }) => {
          const select = document.querySelector('dialog [name="espacio_id"]');
          if (select) select.append(...data.map((e) => new Option(`${e.codigo} · ${e.nombre}`, e.id)));
        })
        .catch(() => {});
    }

    const camposRecurso = () => html`
      ${campo({ nombre: 'codigo', etiqueta: 'Código o placa', ayuda: 'Único. Ej.: PC-010', atributos: { required: true, maxlength: 40 } })}
      ${campo({ nombre: 'nombre', etiqueta: 'Nombre', atributos: { required: true, maxlength: 120 } })}
      ${campo({ nombre: 'tipo', etiqueta: 'Tipo', atributos: { required: true, maxlength: 40, placeholder: 'portátil, proyector, tablet…' } })}
      ${campo({ nombre: 'espacio_id', etiqueta: 'Ubicación', tipo: 'select', opciones: [{ valor: '', texto: 'Sin ubicación fija' }] })}`;

    function modalEstado(recurso) {
      abrirFormulario({
        titulo: `Cambiar estado · ${recurso.nombre}`,
        intro: html`<p class="texto-sm">Estado actual: ${insigniaEstado(recurso.estado)} ${recurso.motivo_estado && html`<span class="texto-suave">— ${recurso.motivo_estado}</span>`}</p>`,
        campos: html`
          ${campo({
            nombre: 'estado',
            etiqueta: 'Nuevo estado',
            tipo: 'select',
            opciones: ESTADOS_MANUALES.filter((e) => e !== recurso.estado).map((e) => ({ valor: e, texto: etiquetaEstado(e) })),
            ayuda: '"Prestado" se asigna automáticamente al registrar un préstamo.',
            atributos: { required: true },
          })}
          ${campo({ nombre: 'motivo', etiqueta: 'Motivo', tipo: 'textarea', ayuda: 'Queda registrado en la trazabilidad.', atributos: { required: true, minlength: 5, maxlength: 300 } })}`,
        textoEnviar: 'Actualizar estado',
        async alEnviar({ estado, motivo }) {
          const { message } = await recursosApi.cambiarEstado(recurso.id, estado, motivo);
          toast.exito(message);
          await refrescarTrasCambio();
        },
      });
    }

    // -------------------------------------------------------------- eventos
    delegarAcciones(raiz, {
      pestana: ({ id }) => {
        estadoVista.pestana = id;
        mostrarPestana();
      },
      reintentar: mostrarPestana,
      nuevoPrestamo: () => modalPrestamo(),
      nuevoRecurso: modalNuevoRecurso,
      prestar: ({ id }) => modalPrestamo(id),
      devolver: ({ id, recurso }) => modalDevolucion(id, recursoPorId(recurso)),
      cambiarEstado: ({ id }) => modalEstado(recursoPorId(id)),
      historial: ({ id }) => abrirHistorial('recurso', id, recursoPorId(id)?.nombre ?? `Recurso ${id}`),
    });

    raiz.addEventListener('input', (evento) => {
      const { filtro } = evento.target.dataset;
      if (!filtro) return;
      estadoVista.filtros[filtro] = evento.target.value;
      render(panel.querySelector('[data-tabla-recursos]'), tablaRecursos());
    });

    raiz.addEventListener('change', (evento) => {
      if (!evento.target.matches('[data-filtro-prestamos]')) return;
      estadoVista.filtroPrestamos = evento.target.value;
      cargarPrestamos();
    });

    await mostrarPestana();
  },
};
