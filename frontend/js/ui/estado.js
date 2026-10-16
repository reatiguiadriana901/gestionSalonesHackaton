/**
 * Estados de la interfaz: cargando, vacío y error.
 * Toda operación asíncrona muestra uno de ellos para que el usuario sepa
 * qué está pasando.
 */
import { escapar, html } from './dom.js';

/**
 * Deshabilita el botón y muestra un indicador mientras se ejecuta la tarea.
 * @param {HTMLButtonElement} boton
 * @param {() => Promise<*>} tarea
 * @param {string} [texto] Texto mientras carga (o data-cargando del botón)
 */
export async function conCarga(boton, tarea, texto) {
  const contenidoOriginal = boton.innerHTML;
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  boton.innerHTML = `<span class="spinner" aria-hidden="true"></span>${escapar(texto ?? boton.dataset.cargando ?? 'Procesando…')}`;
  try {
    return await tarea();
  } finally {
    boton.disabled = false;
    boton.removeAttribute('aria-busy');
    boton.innerHTML = contenidoOriginal;
  }
}

export const bloqueCargando = (mensaje = 'Cargando…') => html`
  <div class="estado-bloque" role="status">
    <span class="spinner spinner--grande" aria-hidden="true"></span>
    <span>${mensaje}</span>
  </div>`;

export const bloqueVacio = (mensaje, detalle = '') => html`
  <div class="estado-bloque">
    <strong>${mensaje}</strong>
    ${detalle && html`<span class="texto-sm">${detalle}</span>`}
  </div>`;

/** Bloque de error con botón de reintento (la vista define la acción "reintentar") */
export const bloqueError = (error) => html`
  <div class="estado-bloque estado-bloque--error" role="alert">
    <strong>${error.message}</strong>
    ${error.detalles?.length > 0 && html`<span class="texto-sm">${error.detalles.map((d) => d.mensaje).join(' · ')}</span>`}
    <button type="button" class="boton boton--secundario boton--pequeno" data-accion="reintentar">Reintentar</button>
  </div>`;

/** Mensaje de error con la lista de reglas incumplidas (para formularios) */
export function contenidoError(error) {
  const detalles = (error.detalles ?? []).filter((d) => d.mensaje && d.mensaje !== error.message);
  return html`
    <div>
      <strong>${error.message}</strong>
      ${detalles.length > 0 && html`<ul>${detalles.map((d) => html`<li>${d.regla && d.regla !== 'DATOS' ? `${d.regla}: ` : ''}${d.mensaje}</li>`)}</ul>`}
    </div>`;
}
