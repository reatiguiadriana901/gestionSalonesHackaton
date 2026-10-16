/**
 * Ventana de trazabilidad: historial de cambios de estado de un espacio,
 * recurso o incidencia (lo registran disparadores de la base de datos).
 */
import { panelApi } from '../api/panelApi.js';
import { html, render } from '../ui/dom.js';
import { bloqueCargando, bloqueVacio, contenidoError } from '../ui/estado.js';
import { abrirModal } from '../ui/modal.js';
import { etiquetaEstado, formatearFechaHora, ETIQUETAS_ORIGEN } from '../utils/formato.js';

export async function abrirHistorial(entidad, id, titulo) {
  const modal = abrirModal({ titulo: `Trazabilidad · ${titulo}`, contenido: bloqueCargando('Cargando historial…') });
  try {
    const { data } = await panelApi.historial({ entidad, id, limite: 100 });
    render(
      modal.cuerpo,
      data.length
        ? html`
            <ol class="linea-tiempo">
              ${data.map(
                (h) => html`
                  <li class="linea-tiempo__item">
                    <strong>${h.estado_anterior ? `${etiquetaEstado(h.estado_anterior)} → ` : 'Registrado como '}${etiquetaEstado(h.estado_nuevo)}</strong>
                    ${h.motivo && html`<div>${h.motivo}</div>`}
                    <div class="texto-xs texto-tenue">${formatearFechaHora(h.registrado_en)} · origen: ${ETIQUETAS_ORIGEN[h.origen] ?? h.origen}</div>
                  </li>`,
              )}
            </ol>`
        : bloqueVacio('Sin cambios registrados'),
    );
  } catch (error) {
    render(modal.cuerpo, html`<div class="aviso aviso--peligro">${contenidoError(error)}</div>`);
  }
}
