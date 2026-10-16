/**
 * Importación del dataset oficial (workflow n8n: "Datos · Importación del dataset")
 */
import { CONFIG } from '../config.js';
import { http } from './httpClient.js';

/** Orden en que deben cargarse las entidades (por sus referencias) */
export const ORDEN_ENTIDADES = ['espacios', 'recursos', 'reservas', 'prestamos', 'incidencias'];

export const datosApi = {
  /**
   * RN-14: el backend valida cada registro y solo inserta los válidos.
   * @param {string} entidad   Una de ORDEN_ENTIDADES
   * @param {object[]} registros
   * @param {string} [archivo] Nombre del archivo de origen (queda en el historial)
   */
  importar: (entidad, registros, archivo) =>
    http.post('importar', { entidad, registros, archivo }, { tiempoMaximo: CONFIG.api.tiempoMaximoImportacionMs }),

  historial: () => http.get('importaciones'),
};
