/**
 * Módulo 1 · Espacios, reservas y recomendación con IA
 * (workflow n8n: "Módulo 1 · Espacios y reservas")
 */
import { CONFIG } from '../config.js';
import { http } from './httpClient.js';

export const espaciosApi = {
  /** Espacios con ocupación actual, reservas de hoy e incidencias abiertas */
  listar: () => http.get('espacios'),

  /** @param {{codigo, nombre, tipo, capacidad, ubicacion?, equipamiento?}} espacio */
  crear: (espacio) => http.post('espacios', espacio),

  /** RN-13: no se habilita un espacio con incidencias bloqueantes abiertas */
  cambiarEstado: (id, estado, motivo) => http.patch('espacios/estado', { id, estado, motivo }),

  /** Reglas + IA: devuelve el espacio recomendado, alternativas y justificación */
  recomendar: (solicitud) =>
    http.post('espacios/recomendacion', solicitud, { tiempoMaximo: CONFIG.api.tiempoMaximoIaMs }),
};

export const reservasApi = {
  /** @param {{fecha?, desde?, espacio_id?, estado?}} filtros */
  listar: (filtros = {}) => http.get('reservas', filtros),

  /** RN-01 a RN-04 se validan en el backend */
  crear: (reserva) => http.post('reservas', reserva),

  cancelar: (id, motivo) => http.patch('reservas/cancelacion', { id, motivo }),
};
