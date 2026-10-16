/**
 * Módulo 3 · Incidencias y triaje con IA
 * (workflow n8n: "Módulo 3 · Incidencias y triaje con IA")
 */
import { CONFIG } from '../config.js';
import { http } from './httpClient.js';

export const incidenciasApi = {
  /** @param {{estado?, prioridad?, triaje?}} filtros */
  listar: (filtros = {}) => http.get('incidencias', filtros),

  /** Registra la incidencia y la IA la clasifica, prioriza y enruta */
  reportar: (reporte) => http.post('incidencias', reporte, { tiempoMaximo: CONFIG.api.tiempoMaximoIaMs }),

  /** Reintenta el triaje con IA (para incidencias pendientes) */
  reclasificarConIa: (id) => http.post('incidencias/triaje', { id }, { tiempoMaximo: CONFIG.api.tiempoMaximoIaMs }),

  /** Clasificación manual: pasa por el mismo control que la respuesta de la IA */
  clasificarManual: (id, clasificacion) => http.post('incidencias/triaje', { id, manual: clasificacion }),

  /** RN-12: transiciones válidas; al resolver se rehabilita lo bloqueado (RN-11) */
  cambiarEstado: (id, estado, comentario) => http.patch('incidencias/estado', { id, estado, comentario }),
};
