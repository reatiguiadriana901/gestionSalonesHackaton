/**
 * Punto de entrada: inicia el enrutador y el indicador de estado del sistema
 * (base de datos e IA) de la barra lateral.
 */
import { CONFIG } from './config.js';
import { panelApi } from './api/panelApi.js';
import { iniciarRouter } from './router.js';
import { html, render } from './ui/dom.js';
import { conCarga } from './ui/estado.js';
import { toast } from './ui/toast.js';

const panelEstado = document.getElementById('estado-sistema');

function dibujarEstado(salud, error) {
  const punto = (tono) => html`<span class="estado-sistema__punto estado-sistema__punto--${tono}" aria-hidden="true"></span>`;
  if (error) {
    render(
      panelEstado,
      html`<div class="estado-sistema__fila">${punto('error')}<span>Sin conexión con el backend</span></div>
        <span class="texto-xs">${error.message}</span>`,
    );
    return;
  }
  const { ia, base_de_datos: bd } = salud;
  render(
    panelEstado,
    html`
      <div class="estado-sistema__fila">${punto(bd.conectada ? 'ok' : 'error')}<span>Base de datos ${bd.conectada ? 'conectada' : 'sin conexión'}</span></div>
      <div class="estado-sistema__fila" title="${ia.endpoint}">
        ${punto(ia.configurada ? 'ok' : 'aviso')}
        <span>IA: ${ia.proveedor} · ${ia.modelo}${ia.configurada ? '' : ' (sin configurar)'}</span>
      </div>
      <button type="button" class="boton boton--fantasma boton--pequeno" data-probar-ia>Probar conexión con la IA</button>`,
  );
}

async function actualizarEstado() {
  try {
    const { data } = await panelApi.salud();
    dibujarEstado(data);
  } catch (error) {
    dibujarEstado(null, error);
  }
}

// Consulta real de prueba al modelo (mide la latencia)
panelEstado.addEventListener('click', async (evento) => {
  const boton = evento.target.closest('[data-probar-ia]');
  if (!boton) return;
  try {
    const { data } = await conCarga(boton, () => panelApi.salud({ probarIa: true }), 'Consultando a la IA…');
    const prueba = data.ia.prueba;
    if (prueba.ok) toast.exito(`La IA respondió en ${(prueba.latencia_ms / 1000).toFixed(1)} s (${data.ia.proveedor} · ${prueba.modelo_respondio}).`);
    else toast.error(prueba.error, { titulo: 'La IA no respondió' });
  } catch (error) {
    toast.errorApi(error);
  }
});

iniciarRouter(document.getElementById('contenido'));
actualizarEstado();
setInterval(actualizarEstado, CONFIG.intervaloEstadoMs);
