/**
 * Ventanas modales con el elemento nativo <dialog> (accesible: atrapa el
 * foco y se cierra con Escape).
 */
import { html, render } from './dom.js';
import { conCarga, contenidoError } from './estado.js';
import { leerFormulario } from '../utils/formularios.js';

export function abrirModal({ titulo, contenido, ancho = false }) {
  const dialogo = document.createElement('dialog');
  dialogo.className = `modal${ancho ? ' modal--ancho' : ''}`;
  render(
    dialogo,
    html`
      <header class="modal__encabezado">
        <h2>${titulo}</h2>
        <button type="button" class="boton boton--fantasma boton--pequeno" data-cerrar aria-label="Cerrar">✕</button>
      </header>
      <div class="modal__cuerpo">${contenido}</div>`,
  );
  document.body.append(dialogo);

  const cerrar = () => dialogo.close();
  dialogo.addEventListener('close', () => dialogo.remove());
  dialogo.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-cerrar]')) cerrar();
  });
  dialogo.showModal();
  return { dialogo, cuerpo: dialogo.querySelector('.modal__cuerpo'), cerrar };
}

/**
 * Formulario en ventana modal.
 * alEnviar(datos) debe devolver una promesa: si se resuelve, la ventana se
 * cierra; si falla, el error (con las reglas incumplidas) se muestra dentro
 * de la ventana para que el usuario corrija sin perder lo escrito.
 */
export function abrirFormulario({ titulo, intro = '', campos, textoEnviar = 'Guardar', textoCargando, claseEnviar = 'boton--primario', ancho = false, alEnviar }) {
  const modal = abrirModal({
    titulo,
    ancho,
    contenido: html`
      ${intro}
      <form class="formulario" novalidate>
        ${campos}
        <div class="aviso aviso--peligro" data-error hidden></div>
        <div class="formulario__acciones">
          <button type="button" class="boton boton--secundario" data-cerrar>Cancelar</button>
          <button type="submit" class="boton ${claseEnviar}">${textoEnviar}</button>
        </div>
      </form>`,
  });

  const formulario = modal.dialogo.querySelector('form');
  const cajaError = formulario.querySelector('[data-error]');
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!formulario.reportValidity()) return; // validación de formato del navegador
    cajaError.hidden = true;
    try {
      await conCarga(formulario.querySelector('[type="submit"]'), () => alEnviar(leerFormulario(formulario), modal), textoCargando);
      modal.cerrar();
    } catch (error) {
      render(cajaError, contenidoError(error));
      cajaError.hidden = false;
      cajaError.scrollIntoView({ block: 'nearest' });
    }
  });

  formulario.querySelector('input:not([type="hidden"]), select, textarea')?.focus();
  return modal;
}
