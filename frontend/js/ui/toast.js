/**
 * Notificaciones temporales (esquina inferior derecha).
 * toast.exito(), toast.info(), toast.aviso(), toast.error() y toast.errorApi()
 */
import { html, render } from './dom.js';

const DURACION_MS = { exito: 6000, info: 6000, aviso: 9000, error: 10000 };
const TITULO = { exito: 'Listo', info: 'Información', aviso: 'Atención', error: 'No se pudo completar' };

function mostrar(tipo, mensaje, { titulo, detalles = [] } = {}) {
  const contenedor = document.getElementById('toasts');
  const toast = document.createElement('div');
  toast.className = `toast toast--${tipo}`;
  toast.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  render(
    toast,
    html`
      <div class="toast__cuerpo">
        <div class="toast__titulo">${titulo ?? TITULO[tipo]}</div>
        <div>${mensaje}</div>
        ${detalles.length > 0 && html`<ul class="toast__detalles">${detalles.map((d) => html`<li>${d}</li>`)}</ul>`}
      </div>
      <button type="button" class="toast__cerrar" aria-label="Cerrar notificación">×</button>`,
  );
  const cerrar = () => toast.remove();
  toast.querySelector('.toast__cerrar').addEventListener('click', cerrar);
  contenedor.append(toast);
  setTimeout(cerrar, DURACION_MS[tipo]);
}

export const toast = {
  exito: (mensaje, opciones) => mostrar('exito', mensaje, opciones),
  info: (mensaje, opciones) => mostrar('info', mensaje, opciones),
  aviso: (mensaje, opciones) => mostrar('aviso', mensaje, opciones),
  error: (mensaje, opciones) => mostrar('error', mensaje, opciones),

  /** Muestra un ApiError; si incumplió varias reglas, las lista todas */
  errorApi(error) {
    const detalles = (error.detalles ?? [])
      .filter((d) => d.mensaje && d.mensaje !== error.message)
      .map((d) => (d.regla && d.regla !== 'DATOS' ? `${d.regla}: ${d.mensaje}` : d.mensaje));
    mostrar('error', error.message, {
      titulo: error.esReglaDeNegocio ? 'Regla de negocio' : TITULO.error,
      detalles,
    });
  },
};
