/**
 * Configuración del frontend.
 *
 * Con Docker, nginx reenvía /api/* a los webhooks de n8n, así que la interfaz
 * y la API comparten origen y no hay problemas de CORS.
 * Para abrir el frontend sin Docker (p. ej. con Live Server), cambia baseUrl a
 * 'http://localhost:5678/webhook'.
 */
export const CONFIG = Object.freeze({
  api: {
    baseUrl: '/api',
    tiempoMaximoMs: 20_000, // operaciones normales
    tiempoMaximoIaMs: 120_000, // operaciones que consultan a la IA
    tiempoMaximoImportacionMs: 180_000, // importación de archivos grandes
  },
  zonaHoraria: 'America/Bogota',
  intervaloEstadoMs: 60_000, // cada cuánto se revisa el estado del sistema
});
