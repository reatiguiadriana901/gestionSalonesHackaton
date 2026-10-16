/**
 * Panel, salud del sistema, historial (trazabilidad) y catálogos
 * (workflow n8n: "Panel · Indicadores, salud e historial")
 */
import { CONFIG } from '../config.js';
import { http } from './httpClient.js';

let catalogosEnMemoria = null;

export const panelApi = {
  indicadores: () => http.get('panel'),

  /** Estado de la base de datos y configuración de IA; con probarIa hace una consulta real */
  salud: ({ probarIa = false } = {}) =>
    http.get('salud', probarIa ? { ia: 1 } : {}, { tiempoMaximo: probarIa ? CONFIG.api.tiempoMaximoIaMs : 8000 }),

  /** @param {{entidad?: string, id?: number, limite?: number}} filtros */
  historial: (filtros = {}) => http.get('historial', filtros),

  /** Los catálogos cambian poco: se guardan en memoria tras la primera consulta */
  async catalogos() {
    if (!catalogosEnMemoria) catalogosEnMemoria = (await http.get('catalogos')).data;
    return catalogosEnMemoria;
  },
};
