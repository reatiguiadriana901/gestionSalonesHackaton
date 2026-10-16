/**
 * Módulo 2 · Recursos tecnológicos y préstamos
 * (workflow n8n: "Módulo 2 · Recursos y préstamos")
 */
import { CONFIG } from '../config.js';
import { http } from './httpClient.js';

export const recursosApi = {
  /** @param {{estado?}} filtros */
  listar: (filtros = {}) => http.get('recursos', filtros),

  /** @param {{codigo, nombre, tipo, espacio_id?}} recurso */
  crear: (recurso) => http.post('recursos', recurso),

  /** RN-13: "prestado" es automático y no se habilita con incidencias abiertas */
  cambiarEstado: (id, estado, motivo) => http.patch('recursos/estado', { id, estado, motivo }),
};

export const prestamosApi = {
  /** @param {{estado?: 'activo'|'devuelto'|'vencido'}} filtros */
  listar: (filtros = {}) => http.get('prestamos', filtros),

  /** RN-05 a RN-07 se validan en el backend */
  crear: (prestamo) => http.post('prestamos', prestamo),

  /** RN-08: con daño se crea una incidencia que la IA clasifica (por eso el tiempo de IA) */
  devolver: (id, conDanio, observaciones) =>
    http.patch(
      'prestamos/devolucion',
      { id, con_danio: conDanio, observaciones },
      { tiempoMaximo: CONFIG.api.tiempoMaximoIaMs },
    ),
};
