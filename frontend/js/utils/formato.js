/**
 * Formato de fechas, horas y etiquetas legibles.
 *
 * El backend devuelve fechas en hora del campus y sin zona horaria
 * ("2026-10-16T08:30"). Se formatean como UTC para que el navegador no las
 * desplace según la zona horaria del equipo.
 */
import { CONFIG } from '../config.js';

const fmtFecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtFechaCorta = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtFechaHora = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
});

export const formatearFecha = (iso) => (iso ? fmtFecha.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : '—');
export const formatearFechaCorta = (iso) => (iso ? fmtFechaCorta.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : '—');
export const formatearFechaHora = (iso) => (iso ? fmtFechaHora.format(new Date(`${iso.slice(0, 16)}:00Z`)) : '—');
export const formatearHora = (hora) => (hora ? hora.slice(0, 5) : '—');

/** Fecha y hora actuales del campus: { fecha: 'AAAA-MM-DD', hora: 'HH:MM' } */
export function ahoraCampus() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: CONFIG.zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

/** Suma días a una fecha 'AAAA-MM-DD' */
export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Texto sin tildes y en minúsculas (para búsquedas) */
export const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const ETIQUETAS_ESTADO = {
  disponible: 'Disponible',
  mantenimiento: 'En mantenimiento',
  inhabilitado: 'Inhabilitado',
  prestado: 'Prestado',
  baja: 'Dado de baja',
  activa: 'Activa',
  cancelada: 'Cancelada',
  finalizada: 'Finalizada',
  activo: 'Activo',
  devuelto: 'Devuelto',
  abierta: 'Abierta',
  en_proceso: 'En proceso',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
};

export const ETIQUETAS_PRIORIDAD = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };
export const ETIQUETAS_TRIAJE = { ia: 'Clasificada por IA', manual: 'Clasificada a mano', pendiente: 'Pendiente de triaje' };
export const ETIQUETAS_ENTIDAD = { espacio: 'Espacio', recurso: 'Recurso', reserva: 'Reserva', prestamo: 'Préstamo', incidencia: 'Incidencia' };
export const ETIQUETAS_ORIGEN = {
  usuario: 'usuario',
  sistema: 'sistema',
  ia: 'IA',
  importacion: 'importación',
  incidencia: 'incidencia',
  devolucion: 'devolución',
};

export const etiquetaEstado = (estado) => ETIQUETAS_ESTADO[estado] ?? estado ?? '—';
export const etiquetaPrioridad = (prioridad) => ETIQUETAS_PRIORIDAD[prioridad] ?? 'Sin prioridad';
export const capitalizar = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '');
