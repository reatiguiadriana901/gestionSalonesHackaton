/**
 * Enrutador por hash: #/panel, #/espacios?pestana=reservas, ...
 * Cada vista exporta { titulo, montar(raiz, parametros) } y recibe un
 * contenedor nuevo en cada navegación (sus eventos se descartan con él).
 */
import { panelVista } from './vistas/panelVista.js';
import { espaciosVista } from './vistas/espaciosVista.js';
import { recursosVista } from './vistas/recursosVista.js';
import { incidenciasVista } from './vistas/incidenciasVista.js';
import { datosVista } from './vistas/datosVista.js';

const VISTAS = {
  panel: panelVista,
  espacios: espaciosVista,
  recursos: recursosVista,
  incidencias: incidenciasVista,
  datos: datosVista,
};
const RUTA_INICIAL = 'panel';

export function iniciarRouter(contenedor) {
  async function mostrarRutaActual() {
    const [ruta, consulta = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
    const nombre = VISTAS[ruta] ? ruta : RUTA_INICIAL;
    const vista = VISTAS[nombre];

    document.querySelectorAll('[data-ruta]').forEach((enlace) => {
      if (enlace.dataset.ruta === nombre) enlace.setAttribute('aria-current', 'page');
      else enlace.removeAttribute('aria-current');
    });
    document.title = `${vista.titulo} · Campus OPS`;

    const raiz = document.createElement('div');
    contenedor.replaceChildren(raiz);
    contenedor.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
    await vista.montar(raiz, new URLSearchParams(consulta));
  }

  window.addEventListener('hashchange', mostrarRutaActual);
  mostrarRutaActual();
}
