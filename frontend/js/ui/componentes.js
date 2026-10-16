/**
 * Componentes visuales reutilizables: insignias, indicadores y campos.
 */
import { html } from './dom.js';
import { etiquetaEstado, etiquetaPrioridad, ETIQUETAS_TRIAJE } from '../utils/formato.js';

const TONO_ESTADO = {
  disponible: 'exito',
  mantenimiento: 'aviso',
  inhabilitado: 'peligro',
  prestado: 'info',
  baja: 'neutro',
  activa: 'exito',
  cancelada: 'neutro',
  finalizada: 'info',
  activo: 'info',
  devuelto: 'neutro',
  abierta: 'peligro',
  en_proceso: 'aviso',
  resuelta: 'exito',
  cerrada: 'neutro',
};
const TONO_PRIORIDAD = { critica: 'peligro', alta: 'aviso', media: 'info', baja: 'exito' };
const TONO_TRIAJE = { ia: 'ia', manual: 'primario', pendiente: 'aviso' };

export const insignia = (texto, tono = 'neutro', titulo = '') =>
  html`<span class="insignia insignia--${tono}" title="${titulo}">${texto}</span>`;

/** Estado de espacios, recursos, reservas, préstamos o incidencias */
export const insigniaEstado = (estado, motivo = '') => insignia(etiquetaEstado(estado), TONO_ESTADO[estado], motivo ?? '');

export const insigniaPrioridad = (prioridad) =>
  insignia(etiquetaPrioridad(prioridad), TONO_PRIORIDAD[prioridad] ?? 'neutro', 'Prioridad');

export const insigniaTriaje = (triaje) => insignia(ETIQUETAS_TRIAJE[triaje] ?? triaje, TONO_TRIAJE[triaje] ?? 'neutro');

/** Tarjeta de indicador del panel */
export const kpi = ({ etiqueta, valor, detalle = '', tono = '' }) => html`
  <article class="kpi ${tono ? `kpi--${tono}` : ''}">
    <span class="kpi__etiqueta">${etiqueta}</span>
    <span class="kpi__valor">${valor}</span>
    ${detalle && html`<span class="kpi__detalle">${detalle}</span>`}
  </article>`;

/**
 * Campo de formulario con etiqueta, ayuda y atributos de validación.
 * @param {object} c
 * @param {string} c.nombre       name del control
 * @param {string} c.etiqueta
 * @param {string} [c.tipo]       text, number, date, time, datetime-local, select, textarea...
 * @param {Array<{valor, texto, deshabilitado?}>} [c.opciones]  para select
 * @param {object} [c.atributos]  required, min, max, minlength, placeholder...
 */
export function campo({ nombre, etiqueta, tipo = 'text', valor = '', ayuda = '', opciones = [], atributos = {}, ancho = false }) {
  const id = `campo-${nombre}-${Math.random().toString(36).slice(2, 7)}`;
  const attrs = Object.entries(atributos)
    .filter(([, v]) => v !== false && v !== null && v !== undefined)
    .map(([clave, v]) => (v === true ? html` ${clave}` : html` ${clave}="${v}"`));

  let control;
  if (tipo === 'select') {
    control = html`<select class="control" id="${id}" name="${nombre}"${attrs}>
      ${opciones.map((o) => html`<option value="${o.valor}" ${String(o.valor) === String(valor) ? 'selected' : ''} ${o.deshabilitado ? 'disabled' : ''}>${o.texto}</option>`)}
    </select>`;
  } else if (tipo === 'textarea') {
    control = html`<textarea class="control" id="${id}" name="${nombre}"${attrs}>${valor}</textarea>`;
  } else if (tipo === 'checkbox') {
    return html`<label class="casilla ${ancho ? 'campo--ancho' : ''}"><input type="checkbox" name="${nombre}" ${valor ? 'checked' : ''}${attrs} />${etiqueta}</label>`;
  } else {
    control = html`<input class="control" id="${id}" name="${nombre}" type="${tipo}" value="${valor}"${attrs} />`;
  }

  return html`
    <div class="campo ${ancho ? 'campo--ancho' : ''}">
      <label class="campo__etiqueta" for="${id}">${etiqueta}${atributos.required ? ' *' : ''}</label>
      ${control}
      ${ayuda && html`<span class="campo__ayuda">${ayuda}</span>`}
    </div>`;
}

/** Tabla con encabezados; filas es un arreglo de html`<tr>...</tr>` */
export const tabla = (encabezados, filas) => html`
  <div class="tabla-contenedor">
    <table class="tabla">
      <thead><tr>${encabezados.map((e) => html`<th scope="col">${e}</th>`)}</tr></thead>
      <tbody>${filas}</tbody>
    </table>
  </div>`;
