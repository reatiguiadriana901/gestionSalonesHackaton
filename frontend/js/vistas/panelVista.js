/**
 * Vista: Panel operativo (indicadores de los tres módulos)
 */
import { panelApi } from '../api/panelApi.js';
import { html, render, delegarAcciones } from '../ui/dom.js';
import { bloqueCargando, bloqueError, bloqueVacio } from '../ui/estado.js';
import { kpi, insigniaPrioridad, insigniaTriaje } from '../ui/componentes.js';
import { ICONOS } from '../ui/iconos.js';
import {
  formatearFechaCorta,
  formatearFechaHora,
  etiquetaEstado,
  ETIQUETAS_ENTIDAD,
  ETIQUETAS_ORIGEN,
} from '../utils/formato.js';

function indicadores(d) {
  const { espacios: e, recursos: r, prestamos: p, incidencias: i } = d;
  return html`
    <div class="rejilla rejilla--kpi">
      ${kpi({ etiqueta: 'Espacios disponibles', valor: `${e.disponibles} / ${e.total}`, detalle: `${e.ocupados_ahora} ocupado(s) ahora · ${e.mantenimiento} en mantenimiento`, tono: 'exito' })}
      ${kpi({ etiqueta: 'Reservas de hoy', valor: d.reservas_hoy, detalle: 'reservas activas para hoy', tono: 'info' })}
      ${kpi({ etiqueta: 'Recursos disponibles', valor: `${r.disponibles} / ${r.total}`, detalle: `${r.prestados} prestados · ${r.mantenimiento} en mantenimiento` })}
      ${kpi({ etiqueta: 'Préstamos activos', valor: p.activos, detalle: `${p.vencidos} vencido(s)`, tono: p.vencidos ? 'peligro' : 'info' })}
      ${kpi({ etiqueta: 'Incidencias abiertas', valor: i.abiertas, detalle: `${i.criticas} críticas · ${i.altas} altas`, tono: i.criticas ? 'peligro' : 'aviso' })}
      ${kpi({ etiqueta: 'Clasificadas por IA', valor: i.clasificadas_ia, detalle: `${i.pendientes_triaje} pendiente(s) de triaje`, tono: 'ia' })}
    </div>`;
}

function incidenciasPrioritarias(lista) {
  if (!lista.length) return bloqueVacio('Sin incidencias abiertas', 'Todo está funcionando con normalidad.');
  return html`
    <ul class="lista-items">
      ${lista.map(
        (inc) => html`
          <li class="lista-items__item">
            <div class="lista-items__principal">
              <span class="lista-items__titulo">#${inc.id} · ${inc.resumen}</span>
              <span class="texto-xs texto-suave">
                ${[inc.categoria_nombre, inc.area_nombre, inc.espacio_codigo, inc.recurso_codigo].filter(Boolean).join(' · ') || 'Sin clasificar'}
              </span>
            </div>
            <div class="fila">${inc.prioridad ? insigniaPrioridad(inc.prioridad) : insigniaTriaje('pendiente')}</div>
          </li>`,
      )}
    </ul>`;
}

function prestamosVencidos(lista) {
  if (!lista.length) return bloqueVacio('Sin préstamos vencidos');
  return html`
    <ul class="lista-items">
      ${lista.map(
        (p) => html`
          <li class="lista-items__item">
            <div class="lista-items__principal">
              <span class="lista-items__titulo">${p.recurso_codigo} · ${p.recurso_nombre}</span>
              <span class="texto-xs texto-suave">${p.solicitante}</span>
            </div>
            <span class="insignia insignia--peligro" title="Fecha límite">Venció ${formatearFechaHora(p.fecha_limite)}</span>
          </li>`,
      )}
    </ul>`;
}

function proximasReservas(lista) {
  if (!lista.length) return bloqueVacio('Sin reservas próximas');
  return html`
    <ul class="lista-items">
      ${lista.map(
        (r) => html`
          <li class="lista-items__item">
            <div class="lista-items__principal">
              <span class="lista-items__titulo">${r.espacio_nombre} (${r.espacio_codigo})</span>
              <span class="texto-xs texto-suave">${r.solicitante} · ${r.asistentes} asistentes</span>
            </div>
            <span class="texto-sm">${formatearFechaCorta(r.fecha)} · ${r.hora_inicio}-${r.hora_fin}</span>
          </li>`,
      )}
    </ul>`;
}

function actividadReciente(lista) {
  if (!lista.length) return bloqueVacio('Sin actividad registrada');
  return html`
    <ol class="linea-tiempo">
      ${lista.map(
        (h) => html`
          <li class="linea-tiempo__item">
            <strong>${ETIQUETAS_ENTIDAD[h.entidad] ?? h.entidad} ${h.referencia}</strong>:
            ${h.estado_anterior ? `${etiquetaEstado(h.estado_anterior)} → ${etiquetaEstado(h.estado_nuevo)}` : `registro inicial (${etiquetaEstado(h.estado_nuevo)})`}
            <div class="texto-xs texto-tenue">
              ${formatearFechaHora(h.registrado_en)} · origen: ${ETIQUETAS_ORIGEN[h.origen] ?? h.origen}${h.motivo ? ` · ${h.motivo}` : ''}
            </div>
          </li>`,
      )}
    </ol>`;
}

function dibujar(datos) {
  return html`
    ${indicadores(datos)}
    <div class="rejilla rejilla--2">
      <section class="tarjeta">
        <div class="tarjeta__encabezado">
          <h2>Incidencias prioritarias</h2>
          <a class="boton boton--fantasma boton--pequeno" href="#/incidencias">Ver todas</a>
        </div>
        ${incidenciasPrioritarias(datos.incidencias_prioritarias)}
      </section>
      <section class="tarjeta">
        <div class="tarjeta__encabezado"><h2>Actividad reciente</h2><p>Trazabilidad de cambios de estado</p></div>
        ${actividadReciente(datos.actividad_reciente)}
      </section>
      <section class="tarjeta">
        <div class="tarjeta__encabezado">
          <h2>Próximas reservas</h2>
          <a class="boton boton--fantasma boton--pequeno" href="#/espacios?pestana=reservas">Ver reservas</a>
        </div>
        ${proximasReservas(datos.proximas_reservas)}
      </section>
      <section class="tarjeta">
        <div class="tarjeta__encabezado">
          <h2>Préstamos vencidos</h2>
          <a class="boton boton--fantasma boton--pequeno" href="#/recursos?pestana=prestamos">Ver préstamos</a>
        </div>
        ${prestamosVencidos(datos.prestamos_vencidos)}
      </section>
    </div>
    <p class="texto-xs texto-tenue">Actualizado: ${formatearFechaHora(datos.generado_en)} (hora del campus)</p>`;
}

export const panelVista = {
  titulo: 'Panel',

  async montar(raiz) {
    render(
      raiz,
      html`
        <section class="vista">
          <header class="vista__encabezado">
            <div class="vista__titulo">
              <h1>Panel operativo</h1>
              <p>Estado del campus: espacios, recursos tecnológicos e incidencias.</p>
            </div>
            <div class="vista__acciones">
              <button type="button" class="boton boton--secundario" data-accion="actualizar">${ICONOS.actualizar} Actualizar</button>
            </div>
          </header>
          <div class="pila pila--amplia" data-contenido></div>
        </section>`,
    );
    const contenido = raiz.querySelector('[data-contenido]');

    async function cargar() {
      render(contenido, bloqueCargando('Cargando indicadores…'));
      try {
        const { data } = await panelApi.indicadores();
        render(contenido, dibujar(data));
      } catch (error) {
        render(contenido, bloqueError(error));
      }
    }

    delegarAcciones(raiz, { actualizar: cargar, reintentar: cargar });
    await cargar();
  },
};
