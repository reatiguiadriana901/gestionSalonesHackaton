/** Íconos SVG en línea (trazo), para usar dentro de html`...` */
import { seguro } from './dom.js';

const icono = (trazos) =>
  seguro(`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${trazos}</svg>`);

export const ICONOS = {
  mas: icono('<path d="M12 5v14M5 12h14"/>'),
  actualizar: icono('<path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/>'),
  ia: icono('<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>'),
  calendario: icono('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'),
  historial: icono('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
  editar: icono('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  devolver: icono('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  prestar: icono('<path d="M15 10l5 5-5 5"/><path d="M20 15H9a5 5 0 0 1 0-10h3"/>'),
  cancelar: icono('<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>'),
  subir: icono('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
  ojo: icono('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  manual: icono('<path d="M9 11V5a2 2 0 0 1 4 0v6"/><path d="M13 9a2 2 0 0 1 4 0v4a7 7 0 0 1-14 0v-1a2 2 0 0 1 4 0"/>'),
  quitar: icono('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
};
