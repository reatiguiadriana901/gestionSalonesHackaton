/**
 * Cliente HTTP central: todas las llamadas a la API pasan por aquí.
 *
 *  - Construye la URL con la base configurada y los parámetros de consulta.
 *  - Envía y recibe JSON.
 *  - Corta la petición si supera el tiempo máximo (AbortController).
 *  - Convierte cualquier fallo (red, tiempo, HTTP, { ok: false }) en ApiError.
 *  - Si todo sale bien devuelve { data, message } del sobre de respuesta:
 *      éxito: { ok: true,  data, message }
 *      error: { ok: false, error: { code, message, details } }
 */
import { CONFIG } from '../config.js';
import { ApiError } from './ApiError.js';

function construirUrl(ruta, parametros = {}) {
  const base = CONFIG.api.baseUrl.replace(/\/+$/, '');
  const url = new URL(`${base}/${ruta.replace(/^\/+/, '')}`, window.location.origin);
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, String(valor));
  }
  return url;
}

async function leerCuerpo(respuesta) {
  const texto = await respuesta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return { textoPlano: texto };
  }
}

/**
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} metodo
 * @param {string} ruta                      Ruta relativa, p. ej. 'reservas'
 * @param {object} [opciones]
 * @param {object} [opciones.parametros]     Parámetros de consulta (?clave=valor)
 * @param {*}      [opciones.cuerpo]         Se envía como JSON
 * @param {number} [opciones.tiempoMaximo]   Milisegundos antes de cancelar
 * @param {AbortSignal} [opciones.signal]    Para cancelar desde la vista
 * @returns {Promise<{data: *, message: string}>}
 */
async function solicitar(metodo, ruta, { parametros, cuerpo, tiempoMaximo = CONFIG.api.tiempoMaximoMs, signal } = {}) {
  const controlador = new AbortController();
  let motivoCorte = null;
  const temporizador = setTimeout(() => {
    motivoCorte = 'tiempo';
    controlador.abort();
  }, tiempoMaximo);
  signal?.addEventListener(
    'abort',
    () => {
      motivoCorte = 'cancelada';
      controlador.abort();
    },
    { once: true },
  );

  let respuesta;
  let contenido;
  try {
    respuesta = await fetch(construirUrl(ruta, parametros), {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: controlador.signal,
    });
    contenido = await leerCuerpo(respuesta);
  } catch {
    if (motivoCorte === 'tiempo') throw ApiError.tiempoAgotado(tiempoMaximo);
    if (motivoCorte === 'cancelada') throw ApiError.cancelada();
    throw ApiError.sinConexion();
  } finally {
    clearTimeout(temporizador);
  }

  if (!respuesta.ok || contenido?.ok === false) throw ApiError.desdeRespuesta(respuesta.status, contenido);
  return { data: contenido?.data ?? null, message: contenido?.message ?? '' };
}

export const http = {
  get: (ruta, parametros, opciones = {}) => solicitar('GET', ruta, { ...opciones, parametros }),
  post: (ruta, cuerpo, opciones = {}) => solicitar('POST', ruta, { ...opciones, cuerpo }),
  put: (ruta, cuerpo, opciones = {}) => solicitar('PUT', ruta, { ...opciones, cuerpo }),
  patch: (ruta, cuerpo, opciones = {}) => solicitar('PATCH', ruta, { ...opciones, cuerpo }),
  delete: (ruta, opciones = {}) => solicitar('DELETE', ruta, opciones),
};
