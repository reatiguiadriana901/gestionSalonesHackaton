/**
 * Vista: Espacios y reservas (Módulo 1) con asignación asistida por IA
 *
 * Pestañas: espacios (inventario y estado), reservas y asignación con IA.
 * Las reglas de negocio (RN-01 a RN-04, RN-13) las valida el backend; aquí
 * solo se valida el formato de los campos.
 */
import { espaciosApi, reservasApi } from '../api/espaciosApi.js';
import { html, render, delegarAcciones } from '../ui/dom.js';
import { bloqueCargando, bloqueError, bloqueVacio, conCarga, contenidoError } from '../ui/estado.js';
import { campo, insignia, insigniaEstado, tabla } from '../ui/componentes.js';
import { abrirFormulario } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { ICONOS } from '../ui/iconos.js';
import { leerFormulario } from '../utils/formularios.js';
import { ahoraCampus, capitalizar, etiquetaEstado, formatearFechaCorta, normalizar } from '../utils/formato.js';
import { abrirHistorial } from './historial.js';

const PESTANAS = [
  { id: 'espacios', texto: 'Espacios' },
  { id: 'reservas', texto: 'Reservas' },
  { id: 'asignacion', texto: 'Asignación con IA' },
];
const ESTADOS_ESPACIO = ['disponible', 'mantenimiento', 'inhabilitado'];

export const espaciosVista = {
  titulo: 'Espacios y reservas',

  async montar(raiz, parametros) {
    const hoy = ahoraCampus().fecha;
    const estadoVista = {
      pestana: PESTANAS.some((p) => p.id === parametros.get('pestana')) ? parametros.get('pestana') : 'espacios',
      espacios: [],
      filtros: { texto: '', estado: '', tipo: '' },
      reservas: { modo: 'dia', fecha: hoy, estado: '' },
      ultimaSolicitud: null,
    };

    render(
      raiz,
      html`
        <section class="vista">
          <header class="vista__encabezado">
            <div class="vista__titulo">
              <h1>Espacios y reservas</h1>
              <p>Aulas, cubículos y laboratorios sin cruces de horario ni conflictos de aforo.</p>
            </div>
            <div class="vista__acciones">
              <button type="button" class="boton boton--secundario" data-accion="nuevoEspacio">${ICONOS.mas} Nuevo espacio</button>
              <button type="button" class="boton boton--primario" data-accion="nuevaReserva">${ICONOS.calendario} Nueva reserva</button>
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
    const espacioPorId = (id) => estadoVista.espacios.find((e) => String(e.id) === String(id));

    // ------------------------------------------------------------ datos
    async function cargarEspacios() {
      const { data } = await espaciosApi.listar();
      estadoVista.espacios = data;
    }

    async function mostrarPestana() {
      raiz.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === estadoVista.pestana)));
      render(panel, bloqueCargando('Cargando espacios…'));
      try {
        await cargarEspacios();
      } catch (error) {
        render(panel, bloqueError(error));
        return;
      }
      if (estadoVista.pestana === 'espacios') render(panel, vistaEspacios());
      if (estadoVista.pestana === 'reservas') {
        render(panel, vistaReservas());
        await cargarReservas();
      }
      if (estadoVista.pestana === 'asignacion') render(panel, vistaAsignacion());
    }

    async function refrescarTrasCambio() {
      await cargarEspacios();
      if (estadoVista.pestana === 'espacios') render(panel.querySelector('[data-tabla-espacios]'), tablaEspacios());
      if (estadoVista.pestana === 'reservas') await cargarReservas();
    }

    // ------------------------------------------------------ pestaña espacios
    function espaciosFiltrados() {
      const texto = normalizar(estadoVista.filtros.texto);
      return estadoVista.espacios.filter(
        (e) =>
          (!texto || normalizar(`${e.codigo} ${e.nombre} ${e.ubicacion ?? ''} ${e.tipo}`).includes(texto)) &&
          (!estadoVista.filtros.estado || e.estado === estadoVista.filtros.estado) &&
          (!estadoVista.filtros.tipo || e.tipo === estadoVista.filtros.tipo),
      );
    }

    function vistaEspacios() {
      const tipos = [...new Set(estadoVista.espacios.map((e) => e.tipo))].sort();
      const { filtros } = estadoVista;
      return html`
        <div class="herramientas">
          <input class="control herramientas__buscar" type="search" placeholder="Buscar por código, nombre o ubicación" aria-label="Buscar espacios" data-filtro="texto" value="${filtros.texto}" />
          <select class="control" aria-label="Filtrar por estado" data-filtro="estado">
            <option value="">Todos los estados</option>
            ${ESTADOS_ESPACIO.map((e) => html`<option value="${e}" ${filtros.estado === e ? 'selected' : ''}>${etiquetaEstado(e)}</option>`)}
          </select>
          <select class="control" aria-label="Filtrar por tipo" data-filtro="tipo">
            <option value="">Todos los tipos</option>
            ${tipos.map((t) => html`<option value="${t}" ${filtros.tipo === t ? 'selected' : ''}>${capitalizar(t)}</option>`)}
          </select>
        </div>
        <div data-tabla-espacios>${tablaEspacios()}</div>`;
    }

    function tablaEspacios() {
      const lista = espaciosFiltrados();
      if (!estadoVista.espacios.length) return bloqueVacio('Aún no hay espacios', 'Impórtalos desde la sección Datos o registra uno nuevo.');
      if (!lista.length) return bloqueVacio('Ningún espacio coincide con los filtros');
      return tabla(
        ['Código', 'Espacio', 'Tipo', 'Aforo', 'Estado', 'Ahora', 'Hoy', 'Incidencias', ''],
        lista.map(
          (e) => html`
            <tr>
              <td class="mono">${e.codigo}</td>
              <td>
                <div class="tabla__principal">${e.nombre}</div>
                <div class="texto-xs texto-suave">${e.ubicacion ?? 'Sin ubicación'}${e.equipamiento.length > 0 ? ` · ${e.equipamiento.join(', ')}` : ''}</div>
              </td>
              <td>${capitalizar(e.tipo)}</td>
              <td>${e.capacidad}</td>
              <td>${insigniaEstado(e.estado, e.motivo_estado)}</td>
              <td>${e.ocupado_ahora ? insignia('Ocupado', 'info') : insignia('Libre', 'exito')}</td>
              <td>${e.reservas_hoy}</td>
              <td>${e.incidencias_abiertas > 0 ? insignia(`${e.incidencias_abiertas} abierta(s)`, 'peligro') : '—'}</td>
              <td>
                <div class="tabla__acciones">
                  <button type="button" class="boton boton--secundario boton--pequeno" data-accion="reservar" data-id="${e.id}">Reservar</button>
                  <button type="button" class="boton boton--fantasma boton--pequeno" data-accion="cambiarEstado" data-id="${e.id}" aria-label="Cambiar estado de ${e.codigo}" title="Cambiar estado">${ICONOS.editar}</button>
                  <button type="button" class="boton boton--fantasma boton--pequeno" data-accion="historial" data-id="${e.id}" aria-label="Trazabilidad de ${e.codigo}" title="Trazabilidad">${ICONOS.historial}</button>
                </div>
              </td>
            </tr>`,
        ),
      );
    }

    // ------------------------------------------------------ pestaña reservas
    function vistaReservas() {
      const r = estadoVista.reservas;
      return html`
        <div class="herramientas">
          <select class="control" aria-label="Periodo" data-filtro-reservas="modo">
            <option value="dia" ${r.modo === 'dia' ? 'selected' : ''}>Reservas de un día</option>
            <option value="proximas" ${r.modo === 'proximas' ? 'selected' : ''}>Próximas reservas</option>
          </select>
          ${r.modo === 'dia' && html`<input class="control" type="date" aria-label="Fecha" data-filtro-reservas="fecha" value="${r.fecha}" />`}
          <select class="control" aria-label="Estado" data-filtro-reservas="estado">
            <option value="">Todos los estados</option>
            ${['activa', 'finalizada', 'cancelada'].map((e) => html`<option value="${e}" ${r.estado === e ? 'selected' : ''}>${etiquetaEstado(e)}</option>`)}
          </select>
        </div>
        <div data-tabla-reservas></div>`;
    }

    async function cargarReservas() {
      const contenedor = panel.querySelector('[data-tabla-reservas]');
      if (!contenedor) return;
      const r = estadoVista.reservas;
      const filtros = r.modo === 'dia' ? { fecha: r.fecha } : { desde: ahoraCampus().fecha };
      if (r.estado) filtros.estado = r.estado;
      render(contenedor, bloqueCargando('Cargando reservas…'));
      try {
        const { data } = await reservasApi.listar(filtros);
        render(contenedor, tablaReservas(data));
      } catch (error) {
        render(contenedor, bloqueError(error));
      }
    }

    function tablaReservas(lista) {
      if (!lista.length) return bloqueVacio('No hay reservas para este filtro');
      return tabla(
        ['Fecha', 'Horario', 'Espacio', 'Solicitante', 'Asistentes', 'Motivo', 'Estado', ''],
        lista.map(
          (r) => html`
            <tr>
              <td>${formatearFechaCorta(r.fecha)}</td>
              <td class="mono">${r.hora_inicio}-${r.hora_fin}</td>
              <td><span class="tabla__principal">${r.espacio_codigo}</span> <span class="texto-suave">${r.espacio_nombre}</span></td>
              <td>${r.solicitante}</td>
              <td>${r.asistentes} / ${r.espacio_capacidad}</td>
              <td>${r.motivo ?? '—'}</td>
              <td>${insigniaEstado(r.estado_efectivo, r.motivo_estado)}</td>
              <td>
                <div class="tabla__acciones">
                  ${r.estado_efectivo === 'activa' && html`<button type="button" class="boton boton--fantasma boton--pequeno" data-accion="cancelarReserva" data-id="${r.id}" data-texto="${r.espacio_nombre} · ${formatearFechaCorta(r.fecha)} ${r.hora_inicio}">${ICONOS.cancelar} Cancelar</button>`}
                </div>
              </td>
            </tr>`,
        ),
      );
    }

    // ---------------------------------------------- pestaña asignación con IA
    function vistaAsignacion() {
      const ahora = ahoraCampus();
      const previa = estadoVista.ultimaSolicitud ?? {};
      return html`
        <div class="rejilla rejilla--lateral">
          <section class="tarjeta">
            <div class="tarjeta__encabezado">
              <div>
                <h2>¿Qué espacio necesitas?</h2>
                <p>Las reglas descartan los espacios inhabilitados, sin aforo o con cruces; la IA elige el mejor según tus necesidades.</p>
              </div>
            </div>
            <form class="formulario" data-form-recomendacion novalidate>
              <div class="formulario__rejilla">
                ${campo({ nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', valor: previa.fecha ?? ahora.fecha, atributos: { required: true } })}
                ${campo({ nombre: 'hora_inicio', etiqueta: 'Desde', tipo: 'time', valor: previa.hora_inicio ?? '08:00', atributos: { required: true } })}
                ${campo({ nombre: 'hora_fin', etiqueta: 'Hasta', tipo: 'time', valor: previa.hora_fin ?? '10:00', atributos: { required: true } })}
                ${campo({ nombre: 'asistentes', etiqueta: 'Asistentes', tipo: 'number', valor: previa.asistentes ?? 20, atributos: { required: true, min: 1 } })}
                ${campo({ nombre: 'motivo', etiqueta: 'Motivo', valor: previa.motivo ?? '', atributos: { placeholder: 'Ej.: clase de JavaScript', maxlength: 200 }, ancho: true })}
                ${campo({
                  nombre: 'necesidades',
                  etiqueta: 'Necesidades',
                  tipo: 'textarea',
                  valor: previa.necesidades ?? '',
                  ayuda: 'En lenguaje natural: equipos, tipo de actividad, ubicación…',
                  atributos: { placeholder: 'Ej.: práctica de programación, necesitamos computadores y proyector', maxlength: 1000 },
                  ancho: true,
                })}
              </div>
              <div class="formulario__acciones">
                <button type="submit" class="boton boton--ia">${ICONOS.ia} Recomendar con IA</button>
              </div>
            </form>
          </section>
          <div data-resultado-ia>
            <section class="tarjeta">
              <div class="resultado-ia__titulo">${ICONOS.ia} Cómo funciona</div>
              <ol class="texto-sm texto-suave">
                <li>Se descartan los espacios que incumplen las reglas (RN-01 estado, RN-02 aforo, RN-03 cruces).</li>
                <li>La IA compara los candidatos con tus necesidades y elige el mejor y dos alternativas.</li>
                <li>Si la IA no responde, se aplica la regla de mejor ajuste de aforo y se indica claramente.</li>
              </ol>
            </section>
          </div>
        </div>`;
    }

    function tarjetaEspacio(e, principal) {
      return html`
        <div class="espacio-sugerido ${principal ? 'espacio-sugerido--principal' : ''}">
          <div class="fila fila--entre">
            <strong>${e.nombre} <span class="mono texto-suave">(${e.codigo})</span></strong>
            <button type="button" class="boton ${principal ? 'boton--primario' : 'boton--secundario'} boton--pequeno" data-accion="reservarSugerido" data-id="${e.id}">Reservar este espacio</button>
          </div>
          <span class="texto-sm texto-suave">${capitalizar(e.tipo)} · aforo ${e.capacidad} · ${e.ubicacion ?? 'sin ubicación'}</span>
          ${(e.equipamiento ?? []).length > 0 && html`<span class="texto-xs">Equipamiento: ${e.equipamiento.join(', ')}</span>`}
        </div>`;
    }

    function resultadoRecomendacion(r, mensaje) {
      if (!r.recomendado) {
        return html`
          <section class="tarjeta">
            <div class="aviso aviso--aviso">${mensaje}</div>
            ${listaDescartados(r)}
          </section>`;
      }
      const esIa = r.fuente === 'ia';
      return html`
        <section class="tarjeta resultado-ia ${esIa ? '' : 'resultado-ia--regla'}">
          <div class="fila fila--entre">
            <div class="resultado-ia__titulo">${ICONOS.ia} ${esIa ? 'Recomendación de la IA' : 'Recomendación por regla (sin IA)'}</div>
            ${esIa ? insignia(r.modelo, 'ia') : insignia('Respaldo determinista', 'aviso')}
          </div>
          ${!esIa && html`<div class="aviso aviso--aviso">${r.aviso}</div>`}
          ${tarjetaEspacio(r.recomendado, true)}
          <p class="texto-sm"><strong>Justificación:</strong> ${r.justificacion}</p>
          ${r.alternativas.length > 0 && html`<h3>Alternativas</h3><div class="pila">${r.alternativas.map((a) => tarjetaEspacio(a, false))}</div>`}
          ${listaDescartados(r)}
        </section>`;
    }

    const listaDescartados = (r) => html`
      <details class="plegable">
        <summary>Evaluación de las reglas: ${r.total_candidatos} candidato(s) válido(s), ${r.descartados.length} descartado(s)</summary>
        <div class="plegable__cuerpo">
          ${r.descartados.length
            ? html`<ul>${r.descartados.map((d) => html`<li><strong>${d.codigo}</strong> ${d.nombre}: ${d.motivos.join('; ')}</li>`)}</ul>`
            : html`<p class="texto-suave">Ningún espacio fue descartado.</p>`}
        </div>
      </details>`;

    async function recomendar(formulario) {
      if (!formulario.reportValidity()) return;
      const solicitud = leerFormulario(formulario);
      estadoVista.ultimaSolicitud = solicitud;
      const resultado = panel.querySelector('[data-resultado-ia]');
      render(resultado, html`<div class="cargando-ia" role="status"><span class="spinner"></span> La IA está evaluando los espacios disponibles…</div>`);
      try {
        const { data, message } = await conCarga(formulario.querySelector('[type="submit"]'), () => espaciosApi.recomendar(solicitud), 'Consultando…');
        render(resultado, resultadoRecomendacion(data, message));
      } catch (error) {
        render(resultado, html`<div class="aviso aviso--peligro">${contenidoError(error)}</div>`);
      }
    }

    // ---------------------------------------------------------- formularios
    function modalReserva(valores = {}) {
      const opciones = [
        { valor: '', texto: 'Selecciona un espacio' },
        ...estadoVista.espacios.map((e) => ({
          valor: e.id,
          texto: `${e.codigo} · ${e.nombre} (aforo ${e.capacidad})${e.estado === 'disponible' ? '' : ` — ${etiquetaEstado(e.estado).toLowerCase()}`}`,
        })),
      ];
      abrirFormulario({
        titulo: 'Nueva reserva',
        intro: html`<p class="texto-sm texto-suave">El servidor valida las reglas: espacio habilitado (RN-01), aforo (RN-02), sin cruces (RN-03) y horario de 06:00 a 22:00, entre 30 min y 4 h (RN-04).</p>`,
        campos: html`
          <div class="formulario__rejilla">
            ${campo({ nombre: 'espacio_id', etiqueta: 'Espacio', tipo: 'select', valor: valores.espacio_id ?? '', opciones, atributos: { required: true }, ancho: true })}
            ${campo({ nombre: 'solicitante', etiqueta: 'Solicitante', valor: valores.solicitante ?? '', atributos: { required: true, maxlength: 120 } })}
            ${campo({ nombre: 'asistentes', etiqueta: 'Asistentes', tipo: 'number', valor: valores.asistentes ?? '', atributos: { required: true, min: 1 } })}
            ${campo({ nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', valor: valores.fecha ?? ahoraCampus().fecha, atributos: { required: true } })}
            ${campo({ nombre: 'hora_inicio', etiqueta: 'Desde', tipo: 'time', valor: valores.hora_inicio ?? '', atributos: { required: true } })}
            ${campo({ nombre: 'hora_fin', etiqueta: 'Hasta', tipo: 'time', valor: valores.hora_fin ?? '', atributos: { required: true } })}
            ${campo({ nombre: 'motivo', etiqueta: 'Motivo', valor: valores.motivo ?? '', atributos: { maxlength: 200 }, ancho: true })}
          </div>`,
        textoEnviar: 'Reservar',
        textoCargando: 'Validando reglas…',
        async alEnviar(datos) {
          const { message } = await reservasApi.crear(datos);
          toast.exito(message);
          await refrescarTrasCambio();
        },
      });
    }

    function modalNuevoEspacio() {
      const tipos = [...new Set(['aula', 'cubiculo', 'laboratorio', 'auditorio', 'sala', ...estadoVista.espacios.map((e) => e.tipo)])];
      abrirFormulario({
        titulo: 'Nuevo espacio',
        campos: html`
          <div class="formulario__rejilla">
            ${campo({ nombre: 'codigo', etiqueta: 'Código', ayuda: 'Único. Ej.: A-101', atributos: { required: true, maxlength: 40 } })}
            ${campo({ nombre: 'nombre', etiqueta: 'Nombre', atributos: { required: true, maxlength: 120 } })}
            ${campo({ nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: tipos.map((t) => ({ valor: t, texto: capitalizar(t) })), atributos: { required: true } })}
            ${campo({ nombre: 'capacidad', etiqueta: 'Capacidad', tipo: 'number', atributos: { required: true, min: 1 } })}
            ${campo({ nombre: 'ubicacion', etiqueta: 'Ubicación', atributos: { maxlength: 120, placeholder: 'Ej.: Piso 2' } })}
            ${campo({ nombre: 'equipamiento', etiqueta: 'Equipamiento', ayuda: 'Separado por comas', atributos: { placeholder: 'proyector, tablero' } })}
          </div>`,
        textoEnviar: 'Registrar espacio',
        async alEnviar(datos) {
          const { message } = await espaciosApi.crear(datos);
          toast.exito(message);
          await refrescarTrasCambio();
        },
      });
    }

    function modalEstado(espacio) {
      abrirFormulario({
        titulo: `Cambiar estado · ${espacio.nombre}`,
        intro: html`<p class="texto-sm">Estado actual: ${insigniaEstado(espacio.estado)} ${espacio.motivo_estado && html`<span class="texto-suave">— ${espacio.motivo_estado}</span>`}</p>`,
        campos: html`
          ${campo({
            nombre: 'estado',
            etiqueta: 'Nuevo estado',
            tipo: 'select',
            opciones: ESTADOS_ESPACIO.filter((e) => e !== espacio.estado).map((e) => ({ valor: e, texto: etiquetaEstado(e) })),
            atributos: { required: true },
          })}
          ${campo({ nombre: 'motivo', etiqueta: 'Motivo', tipo: 'textarea', ayuda: 'Queda registrado en la trazabilidad.', atributos: { required: true, minlength: 5, maxlength: 300 } })}`,
        textoEnviar: 'Actualizar estado',
        async alEnviar({ estado, motivo }) {
          const { data, message } = await espaciosApi.cambiarEstado(espacio.id, estado, motivo);
          toast.exito(message);
          if (data.reservas_afectadas?.length) {
            toast.aviso(`Este espacio tiene ${data.reservas_afectadas.length} reserva(s) futura(s). Usa la asignación con IA para reubicarlas.`, {
              detalles: data.reservas_afectadas.map((r) => `${formatearFechaCorta(r.fecha)} ${r.hora_inicio}-${r.hora_fin} · ${r.solicitante}`),
            });
          }
          await refrescarTrasCambio();
        },
      });
    }

    function modalCancelar(id, descripcion) {
      abrirFormulario({
        titulo: 'Cancelar reserva',
        intro: html`<p class="texto-sm">${descripcion}</p>`,
        campos: campo({ nombre: 'motivo', etiqueta: 'Motivo de la cancelación', tipo: 'textarea', atributos: { required: true, minlength: 5, maxlength: 300 } }),
        textoEnviar: 'Cancelar reserva',
        claseEnviar: 'boton--peligro',
        async alEnviar({ motivo }) {
          const { message } = await reservasApi.cancelar(Number(id), motivo);
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
      nuevaReserva: () => modalReserva(),
      nuevoEspacio: modalNuevoEspacio,
      reservar: ({ id }) => modalReserva({ espacio_id: id }),
      reservarSugerido: ({ id }) => modalReserva({ ...estadoVista.ultimaSolicitud, espacio_id: id }),
      cambiarEstado: ({ id }) => modalEstado(espacioPorId(id)),
      historial: ({ id }) => abrirHistorial('espacio', id, espacioPorId(id)?.nombre ?? `Espacio ${id}`),
      cancelarReserva: ({ id, texto }) => modalCancelar(id, texto),
    });

    raiz.addEventListener('input', (evento) => {
      const { filtro } = evento.target.dataset;
      if (!filtro) return;
      estadoVista.filtros[filtro] = evento.target.value;
      render(panel.querySelector('[data-tabla-espacios]'), tablaEspacios());
    });

    raiz.addEventListener('change', (evento) => {
      const { filtroReservas } = evento.target.dataset;
      if (!filtroReservas) return;
      estadoVista.reservas[filtroReservas] = evento.target.value;
      if (filtroReservas === 'modo') render(panel, vistaReservas());
      cargarReservas();
    });

    raiz.addEventListener('submit', (evento) => {
      if (!evento.target.matches('[data-form-recomendacion]')) return;
      evento.preventDefault();
      recomendar(evento.target);
    });

    await mostrarPestana();
  },
};
