/**
 * Vista: Incidencias y triaje con IA (Módulo 3) — flujo vertical principal
 *
 * 1. El usuario describe el problema en lenguaje natural.
 * 2. El backend registra la incidencia y la IA la clasifica (categoría,
 *    prioridad, área responsable) con control de la respuesta (RN-09).
 * 3. Se muestran la clasificación, su justificación y los efectos en
 *    espacios y recursos (RN-10). Al resolverla se rehabilitan (RN-11).
 */
import { incidenciasApi } from '../api/incidenciasApi.js';
import { espaciosApi } from '../api/espaciosApi.js';
import { recursosApi } from '../api/recursosApi.js';
import { panelApi } from '../api/panelApi.js';
import { html, render, delegarAcciones } from '../ui/dom.js';
import { bloqueCargando, bloqueError, bloqueVacio, conCarga, contenidoError } from '../ui/estado.js';
import { campo, insignia, insigniaEstado, insigniaPrioridad, insigniaTriaje } from '../ui/componentes.js';
import { abrirFormulario, abrirModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { ICONOS } from '../ui/iconos.js';
import { leerFormulario } from '../utils/formularios.js';
import { etiquetaEstado, formatearFechaCorta, formatearFechaHora, normalizar, ETIQUETAS_PRIORIDAD } from '../utils/formato.js';
import { abrirHistorial } from './historial.js';

const ACTIVAS = ['abierta', 'en_proceso'];
const ESTADOS_INCIDENCIA = ['abierta', 'en_proceso', 'resuelta', 'cerrada'];
const FILTROS_ESTADO = [
  { valor: 'activas', texto: 'Abiertas y en proceso' },
  ...ESTADOS_INCIDENCIA.map((e) => ({ valor: e, texto: etiquetaEstado(e) })),
  { valor: '', texto: 'Todas' },
];

const recortar = (texto, maximo) => (texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto);
const ubicacion = (i) =>
  [i.espacio_codigo && `${i.espacio_codigo} · ${i.espacio_nombre}`, i.recurso_codigo && `${i.recurso_codigo} · ${i.recurso_nombre}`]
    .filter(Boolean)
    .join(' / ') || 'No indicada';

const explicacionIa = html`
  <section class="tarjeta">
    <div class="resultado-ia__titulo">${ICONOS.ia} ¿Qué hace la IA?</div>
    <ol class="texto-sm texto-suave">
      <li>Lee el reporte y lo clasifica con las categorías y áreas oficiales del campus.</li>
      <li>Asigna una prioridad y explica por qué, con una acción sugerida para el área responsable.</li>
      <li>Identifica el espacio o recurso mencionado en el texto.</li>
      <li>El sistema valida la respuesta: si no cumple los catálogos, la descarta y la incidencia queda pendiente.</li>
      <li>Si es crítica o alta, lo afectado queda en mantenimiento y no se puede reservar ni prestar.</li>
    </ol>
  </section>`;

export const incidenciasVista = {
  titulo: 'Incidencias',

  async montar(raiz) {
    const estadoVista = {
      incidencias: [],
      espacios: [],
      recursos: [],
      catalogos: null,
      filtros: { texto: '', estado: 'activas', prioridad: '', triaje: '' },
    };

    render(
      raiz,
      html`
        <section class="vista">
          <header class="vista__encabezado">
            <div class="vista__titulo">
              <h1>Incidencias y solicitudes</h1>
              <p>Reporta en lenguaje natural: la IA clasifica, prioriza y enruta al área responsable.</p>
            </div>
            <div class="vista__acciones">
              <button type="button" class="boton boton--secundario" data-accion="actualizar">${ICONOS.actualizar} Actualizar</button>
              <button type="button" class="boton boton--ia" data-accion="triajeMasivo">${ICONOS.ia} Clasificar pendientes con IA</button>
            </div>
          </header>

          <div class="rejilla rejilla--lateral">
            <section class="tarjeta">
              <div class="tarjeta__encabezado">
                <div>
                  <h2>Reportar incidencia</h2>
                  <p>Describe qué pasa, dónde y desde cuándo.</p>
                </div>
              </div>
              <form class="formulario" data-form-reporte novalidate>
                ${campo({
                  nombre: 'descripcion',
                  etiqueta: 'Descripción',
                  tipo: 'textarea',
                  atributos: { required: true, minlength: 10, maxlength: 2000, placeholder: 'Ej.: El proyector del aula A-101 no enciende y tenemos clase a las 10:00' },
                })}
                <div class="formulario__rejilla">
                  ${campo({ nombre: 'reportado_por', etiqueta: 'Reportado por', atributos: { required: true, maxlength: 120 } })}
                  ${campo({ nombre: 'espacio_id', etiqueta: 'Espacio (opcional)', tipo: 'select', opciones: [{ valor: '', texto: 'La IA lo deduce del texto' }] })}
                  ${campo({ nombre: 'recurso_id', etiqueta: 'Recurso (opcional)', tipo: 'select', opciones: [{ valor: '', texto: 'La IA lo deduce del texto' }] })}
                </div>
                <div class="formulario__acciones">
                  <button type="submit" class="boton boton--ia">${ICONOS.ia} Reportar y clasificar con IA</button>
                </div>
              </form>
            </section>
            <div data-resultado>${explicacionIa}</div>
          </div>

          <section class="tarjeta">
            <div class="tarjeta__encabezado"><h2>Incidencias registradas</h2></div>
            <div class="herramientas">
              <input class="control herramientas__buscar" type="search" placeholder="Buscar en la descripción, ubicación o persona" aria-label="Buscar incidencias" data-filtro="texto" />
              <select class="control" aria-label="Filtrar por estado" data-filtro="estado">
                ${FILTROS_ESTADO.map((f) => html`<option value="${f.valor}" ${f.valor === 'activas' ? 'selected' : ''}>${f.texto}</option>`)}
              </select>
              <select class="control" aria-label="Filtrar por prioridad" data-filtro="prioridad">
                <option value="">Todas las prioridades</option>
                ${Object.entries(ETIQUETAS_PRIORIDAD).map(([valor, texto]) => html`<option value="${valor}">${texto}</option>`)}
              </select>
              <select class="control" aria-label="Filtrar por triaje" data-filtro="triaje">
                <option value="">Cualquier triaje</option>
                <option value="ia">Clasificadas por IA</option>
                <option value="manual">Clasificadas a mano</option>
                <option value="pendiente">Pendientes de triaje</option>
              </select>
            </div>
            <div class="pila" data-lista></div>
          </section>
        </section>`,
    );
    const lista = raiz.querySelector('[data-lista]');
    const resultado = raiz.querySelector('[data-resultado]');
    const incidenciaPorId = (id) => estadoVista.incidencias.find((i) => String(i.id) === String(id));

    // ------------------------------------------------------------ datos
    async function cargar() {
      render(lista, bloqueCargando('Cargando incidencias…'));
      try {
        const [{ data }, catalogos] = await Promise.all([incidenciasApi.listar(), panelApi.catalogos()]);
        estadoVista.incidencias = data;
        estadoVista.catalogos = catalogos;
        render(lista, listaIncidencias());
      } catch (error) {
        render(lista, bloqueError(error));
      }
    }

    // Opciones de espacio y recurso del formulario (no bloquean la vista)
    async function cargarOpciones() {
      const [espacios, recursos] = await Promise.allSettled([espaciosApi.listar(), recursosApi.listar()]);
      const agregar = (nombre, filas) => {
        const select = raiz.querySelector(`[data-form-reporte] [name="${nombre}"]`);
        select.append(...filas.map((f) => new Option(`${f.codigo} · ${f.nombre}`, f.id)));
      };
      if (espacios.status === 'fulfilled') agregar('espacio_id', espacios.value.data);
      if (recursos.status === 'fulfilled') agregar('recurso_id', recursos.value.data);
    }

    // ----------------------------------------------------------- listado
    function filtradas() {
      const { texto, estado, prioridad, triaje } = estadoVista.filtros;
      const buscado = normalizar(texto);
      return estadoVista.incidencias.filter(
        (i) =>
          (!estado || (estado === 'activas' ? ACTIVAS.includes(i.estado) : i.estado === estado)) &&
          (!prioridad || i.prioridad === prioridad) &&
          (!triaje || i.triaje === triaje) &&
          (!buscado ||
            normalizar(`${i.descripcion} ${i.ia_resumen ?? ''} ${i.espacio_codigo ?? ''} ${i.recurso_codigo ?? ''} ${i.reportado_por}`).includes(buscado)),
      );
    }

    function listaIncidencias() {
      if (!estadoVista.incidencias.length) return bloqueVacio('Aún no hay incidencias', 'Reporta la primera con el formulario de arriba.');
      const visibles = filtradas();
      if (!visibles.length) return bloqueVacio('Ninguna incidencia coincide con los filtros');
      return visibles.map(tarjetaIncidencia);
    }

    function tarjetaIncidencia(i) {
      const abierta = ACTIVAS.includes(i.estado);
      const bloqueos = [i.bloquea_espacio && 'el espacio', i.bloquea_recurso && 'el recurso'].filter(Boolean);
      return html`
        <article class="incidencia incidencia--${i.prioridad ?? 'sin-prioridad'}">
          <div class="fila fila--entre">
            <strong>#${i.id} · ${recortar(i.ia_resumen ?? i.descripcion, 120)}</strong>
            <div class="fila">
              ${i.prioridad && insigniaPrioridad(i.prioridad)} ${insigniaEstado(i.estado, i.motivo_estado)} ${insigniaTriaje(i.triaje)}
            </div>
          </div>
          ${i.ia_resumen && html`<p class="incidencia__descripcion">${i.descripcion}</p>`}
          <div class="incidencia__meta">
            ${i.categoria_nombre && html`<span>Categoría: ${i.categoria_nombre}</span>`}
            ${i.area_nombre && html`<span>Área: ${i.area_nombre}</span>`}
            <span>Ubicación: ${ubicacion(i)}</span>
            <span>Reportó: ${i.reportado_por}</span>
            <span>${formatearFechaHora(i.creado_en)}</span>
          </div>
          ${abierta && bloqueos.length > 0 && html`<div class="aviso aviso--aviso texto-xs">Mientras siga abierta, ${bloqueos.join(' y ')} ${bloqueos.length > 1 ? 'quedan' : 'queda'} en mantenimiento (RN-10).</div>`}
          ${i.ia_accion_sugerida && html`<div class="texto-sm"><strong>Acción sugerida:</strong> ${i.ia_accion_sugerida}</div>`}
          ${i.triaje === 'pendiente' && i.ia_error && html`<div class="aviso aviso--aviso texto-xs">La IA no pudo clasificarla: ${i.ia_error}</div>`}
          <div class="fila">
            <button type="button" class="boton boton--secundario boton--pequeno" data-accion="detalle" data-id="${i.id}">${ICONOS.ojo} Detalle</button>
            <button type="button" class="boton boton--secundario boton--pequeno" data-accion="cambiarEstado" data-id="${i.id}">${ICONOS.editar} Cambiar estado</button>
            ${abierta && i.triaje === 'pendiente' && html`<button type="button" class="boton boton--ia boton--pequeno" data-accion="reintentarIa" data-id="${i.id}">${ICONOS.ia} Clasificar con IA</button>`}
            ${abierta && html`<button type="button" class="boton boton--fantasma boton--pequeno" data-accion="clasificarManual" data-id="${i.id}">${ICONOS.manual} Clasificar a mano</button>`}
            <button type="button" class="boton boton--fantasma boton--pequeno" data-accion="historial" data-id="${i.id}">${ICONOS.historial} Trazabilidad</button>
          </div>
        </article>`;
    }

    // -------------------------------------------- resultado del triaje con IA
    function seccionEfectos(efectos) {
      if (!efectos) return '';
      const cambios = efectos.cambios ?? [];
      const reservas = efectos.reservas_afectadas ?? [];
      if (!cambios.length && !reservas.length) return '';
      return html`
        <div class="aviso aviso--aviso">
          <div>
            <strong>Efectos en otros módulos</strong>
            <ul>${cambios.map((c) => html`<li>${c}</li>`)}</ul>
            ${reservas.length > 0 &&
            html`<p>${reservas.length} reserva(s) futura(s) en el espacio afectado:</p>
              <ul>${reservas.map((r) => html`<li>${formatearFechaCorta(r.fecha)} ${r.hora_inicio}-${r.hora_fin} · ${r.solicitante}</li>`)}</ul>
              <a class="boton boton--ia boton--pequeno" href="#/espacios?pestana=asignacion">${ICONOS.ia} Reubicar con la asignación por IA</a>`}
          </div>
        </div>`;
    }

    function resultadoTriaje(data) {
      const id = data.incidencia_id ?? data.incidencia?.id;
      if (!data.clasificada) {
        return html`
          <section class="tarjeta resultado-ia resultado-ia--regla">
            <div class="resultado-ia__titulo">${ICONOS.ia} Incidencia #${id} registrada · pendiente de triaje</div>
            <div class="aviso aviso--aviso">
              <div>La IA no pudo clasificarla: ${data.error}. El sistema nunca inventa una clasificación: puedes reintentar o clasificarla a mano.</div>
            </div>
            <div class="fila">
              <button type="button" class="boton boton--ia boton--pequeno" data-accion="reintentarIa" data-id="${id}">${ICONOS.ia} Reintentar con IA</button>
              <button type="button" class="boton boton--secundario boton--pequeno" data-accion="clasificarManual" data-id="${id}">${ICONOS.manual} Clasificar a mano</button>
            </div>
          </section>`;
      }
      const inc = data.incidencia;
      const confianza = inc.ia_confianza === null || inc.ia_confianza === undefined ? null : Math.round(Number(inc.ia_confianza) * 100);
      const porIa = data.origen !== 'manual';
      return html`
        <section class="tarjeta resultado-ia">
          <div class="fila fila--entre">
            <div class="resultado-ia__titulo">${ICONOS.ia} ${porIa ? 'Clasificación de la IA' : 'Clasificación manual'} · #${inc.id}</div>
            ${porIa && inc.ia_modelo && insignia(inc.ia_modelo, 'ia')}
          </div>
          ${inc.ia_resumen && html`<strong>${inc.ia_resumen}</strong>`}
          <dl class="lista-datos">
            <dt>Prioridad</dt>
            <dd>${insigniaPrioridad(inc.prioridad)}</dd>
            <dt>Categoría</dt>
            <dd>${inc.categoria_nombre}</dd>
            <dt>Área responsable</dt>
            <dd>${inc.area_nombre}</dd>
            <dt>Ubicación</dt>
            <dd>${ubicacion(inc)}</dd>
            ${inc.ia_justificacion && html`<dt>Justificación</dt><dd>${inc.ia_justificacion}</dd>`}
            ${inc.ia_accion_sugerida && html`<dt>Acción sugerida</dt><dd>${inc.ia_accion_sugerida}</dd>`}
            ${confianza !== null &&
            html`<dt>Confianza</dt>
              <dd>
                <div class="progreso" role="progressbar" aria-valuenow="${confianza}" aria-valuemin="0" aria-valuemax="100" aria-label="Confianza de la IA">
                  <div class="progreso__barra" style="width: ${confianza}%"></div>
                </div>
                <span class="texto-xs">${confianza}%</span>
              </dd>`}
          </dl>
          ${seccionEfectos(data.efectos)}
          ${(data.ajustes ?? []).length > 0 &&
          html`<details class="plegable">
            <summary>Control de la respuesta de la IA (${data.ajustes.length} ajuste(s))</summary>
            <div class="plegable__cuerpo"><ul>${data.ajustes.map((a) => html`<li>${a}</li>`)}</ul></div>
          </details>`}
        </section>`;
    }

    async function reportar(formulario) {
      if (!formulario.reportValidity()) return;
      const datos = leerFormulario(formulario);
      render(resultado, html`<div class="cargando-ia" role="status"><span class="spinner"></span> La IA está clasificando la incidencia…</div>`);
      try {
        const { data, message } = await conCarga(formulario.querySelector('[type="submit"]'), () => incidenciasApi.reportar(datos), 'Clasificando…');
        render(resultado, resultadoTriaje(data));
        if (data.clasificada) toast.exito(message, { titulo: 'Incidencia clasificada' });
        else toast.aviso(message, { titulo: 'Incidencia registrada' });
        formulario.reset();
        await cargar();
      } catch (error) {
        render(resultado, html`<div class="aviso aviso--peligro">${contenidoError(error)}</div>`);
      }
    }

    // ----------------------------------------------------------- acciones
    async function reintentarIa(id, boton) {
      try {
        const { data, message } = await conCarga(boton, () => incidenciasApi.reclasificarConIa(Number(id)), 'Clasificando…');
        toast.exito(message, { titulo: 'Incidencia clasificada' });
        render(resultado, resultadoTriaje(data));
        await cargar();
      } catch (error) {
        toast.errorApi(error);
      }
    }

    async function triajeMasivo(boton) {
      const pendientes = estadoVista.incidencias.filter((i) => i.triaje === 'pendiente' && ACTIVAS.includes(i.estado));
      if (!pendientes.length) {
        toast.info('No hay incidencias abiertas pendientes de triaje.');
        return;
      }
      let clasificadas = 0;
      const fallidas = [];
      await conCarga(boton, async () => {
        for (const [indice, incidencia] of pendientes.entries()) {
          boton.lastChild.textContent = ` Clasificando ${indice + 1} de ${pendientes.length}…`;
          try {
            await incidenciasApi.reclasificarConIa(incidencia.id);
            clasificadas++;
          } catch (error) {
            fallidas.push(`#${incidencia.id}: ${error.message}`);
          }
        }
      }, 'Clasificando…');
      if (fallidas.length) toast.aviso(`${clasificadas} clasificada(s) por la IA; ${fallidas.length} siguen pendientes.`, { detalles: fallidas.slice(0, 5) });
      else toast.exito(`La IA clasificó ${clasificadas} incidencia(s).`);
      await cargar();
    }

    function modalEstado(incidencia) {
      abrirFormulario({
        titulo: `Cambiar estado · incidencia #${incidencia.id}`,
        intro: html`<p class="texto-sm">Estado actual: ${insigniaEstado(incidencia.estado)}. El servidor valida las transiciones permitidas (RN-12) y, al resolver o cerrar, rehabilita lo que estaba bloqueado (RN-11).</p>`,
        campos: html`
          ${campo({
            nombre: 'estado',
            etiqueta: 'Nuevo estado',
            tipo: 'select',
            opciones: ESTADOS_INCIDENCIA.filter((e) => e !== incidencia.estado).map((e) => ({ valor: e, texto: etiquetaEstado(e) })),
            atributos: { required: true },
          })}
          ${campo({ nombre: 'comentario', etiqueta: 'Comentario', tipo: 'textarea', ayuda: 'Obligatorio para resolver o cerrar: describe la solución.', atributos: { maxlength: 500 } })}`,
        textoEnviar: 'Actualizar estado',
        async alEnviar({ estado, comentario }) {
          const { message } = await incidenciasApi.cambiarEstado(incidencia.id, estado, comentario);
          toast.exito(message);
          await cargar();
        },
      });
    }

    function modalClasificacionManual(incidencia) {
      if (!estadoVista.catalogos) {
        toast.error('No se pudieron cargar los catálogos de clasificación. Actualiza la vista e intenta de nuevo.');
        return;
      }
      const { categorias, areas, prioridades } = estadoVista.catalogos;
      const modal = abrirFormulario({
        titulo: `Clasificar a mano · incidencia #${incidencia.id}`,
        intro: html`<p class="texto-sm texto-suave">${incidencia.descripcion}</p>`,
        campos: html`
          <div class="formulario__rejilla">
            ${campo({ nombre: 'categoria', etiqueta: 'Categoría', tipo: 'select', valor: incidencia.categoria ?? '', opciones: [{ valor: '', texto: 'Selecciona' }, ...categorias.map((c) => ({ valor: c.codigo, texto: c.nombre }))], atributos: { required: true } })}
            ${campo({ nombre: 'prioridad', etiqueta: 'Prioridad', tipo: 'select', valor: incidencia.prioridad ?? '', opciones: [{ valor: '', texto: 'Selecciona' }, ...prioridades.map((p) => ({ valor: p, texto: ETIQUETAS_PRIORIDAD[p] }))], atributos: { required: true } })}
            ${campo({ nombre: 'area_responsable', etiqueta: 'Área responsable', tipo: 'select', valor: incidencia.area_responsable ?? '', opciones: [{ valor: '', texto: 'Selecciona' }, ...areas.map((a) => ({ valor: a.codigo, texto: a.nombre }))], atributos: { required: true }, ancho: true })}
          </div>`,
        textoEnviar: 'Guardar clasificación',
        async alEnviar(clasificacion) {
          const { message } = await incidenciasApi.clasificarManual(incidencia.id, clasificacion);
          toast.exito(message);
          await cargar();
        },
      });
      // Sugiere el área por defecto de la categoría elegida
      const selectCategoria = modal.dialogo.querySelector('[name="categoria"]');
      const selectArea = modal.dialogo.querySelector('[name="area_responsable"]');
      selectCategoria.addEventListener('change', () => {
        const categoria = categorias.find((c) => c.codigo === selectCategoria.value);
        if (categoria) selectArea.value = categoria.area_por_defecto;
      });
    }

    function modalDetalle(i) {
      abrirModal({
        titulo: `Incidencia #${i.id}`,
        ancho: true,
        contenido: html`
          <div class="fila">${i.prioridad && insigniaPrioridad(i.prioridad)} ${insigniaEstado(i.estado)} ${insigniaTriaje(i.triaje)}</div>
          <dl class="lista-datos">
            <dt>Descripción</dt><dd>${i.descripcion}</dd>
            <dt>Reportada por</dt><dd>${i.reportado_por} · ${formatearFechaHora(i.creado_en)}</dd>
            <dt>Origen</dt><dd>${{ usuario: 'Reporte de un usuario', devolucion: 'Devolución con daño', importacion: 'Dataset importado' }[i.origen] ?? i.origen}</dd>
            <dt>Ubicación</dt><dd>${ubicacion(i)}</dd>
            <dt>Categoría</dt><dd>${i.categoria_nombre ?? '—'}</dd>
            <dt>Área responsable</dt><dd>${i.area_nombre ?? '—'}</dd>
            <dt>Resumen (IA)</dt><dd>${i.ia_resumen ?? '—'}</dd>
            <dt>Justificación (IA)</dt><dd>${i.ia_justificacion ?? '—'}</dd>
            <dt>Acción sugerida (IA)</dt><dd>${i.ia_accion_sugerida ?? '—'}</dd>
            <dt>Confianza</dt><dd>${i.ia_confianza == null ? '—' : `${Math.round(Number(i.ia_confianza) * 100)}%`}</dd>
            <dt>Modelo</dt><dd>${i.ia_modelo ?? '—'}</dd>
            ${i.ia_error && html`<dt>Último error de la IA</dt><dd>${i.ia_error}</dd>`}
            <dt>Último cambio</dt><dd>${i.motivo_estado ?? '—'}</dd>
            ${i.resuelto_en && html`<dt>Resuelta</dt><dd>${formatearFechaHora(i.resuelto_en)}</dd>`}
          </dl>
          ${(i.ia_ajustes ?? []).length > 0 &&
          html`<div class="aviso aviso--ia"><div><strong>Ajustes del control a la respuesta de la IA</strong><ul>${i.ia_ajustes.map((a) => html`<li>${a}</li>`)}</ul></div></div>`}`,
      });
    }

    // -------------------------------------------------------------- eventos
    delegarAcciones(raiz, {
      actualizar: cargar,
      reintentar: cargar,
      triajeMasivo: (_, boton) => triajeMasivo(boton),
      reintentarIa: ({ id }, boton) => reintentarIa(id, boton),
      cambiarEstado: ({ id }) => modalEstado(incidenciaPorId(id)),
      clasificarManual: ({ id }) => modalClasificacionManual(incidenciaPorId(id) ?? { id, descripcion: '' }),
      detalle: ({ id }) => modalDetalle(incidenciaPorId(id)),
      historial: ({ id }) => abrirHistorial('incidencia', id, `incidencia #${id}`),
    });

    raiz.addEventListener('input', (evento) => {
      const { filtro } = evento.target.dataset;
      if (!filtro) return;
      estadoVista.filtros[filtro] = evento.target.value;
      render(lista, listaIncidencias());
    });

    raiz.addEventListener('submit', (evento) => {
      if (!evento.target.matches('[data-form-reporte]')) return;
      evento.preventDefault();
      reportar(evento.target);
    });

    cargarOpciones();
    await cargar();
  },
};
