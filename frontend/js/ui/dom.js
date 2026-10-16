/**
 * Utilidades del DOM.
 *
 * html`...` construye HTML escapando automáticamente cada valor interpolado:
 * los datos del dataset o del usuario (que pueden traer < > " ') nunca se
 * interpretan como código. Para anidar HTML se interpola otro html`...`.
 */
class HtmlSeguro {
  constructor(valor) {
    this.valor = valor;
  }

  toString() {
    return this.valor;
  }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapar = (texto) => String(texto).replace(/[&<>"']/g, (caracter) => ESCAPES[caracter]);

function convertir(valor) {
  if (valor === null || valor === undefined || valor === false) return '';
  if (valor instanceof HtmlSeguro) return valor.valor;
  if (Array.isArray(valor)) return valor.map(convertir).join('');
  return escapar(valor);
}

export function html(partes, ...valores) {
  let resultado = partes[0];
  valores.forEach((valor, i) => {
    resultado += convertir(valor) + partes[i + 1];
  });
  return new HtmlSeguro(resultado);
}

/** Marca como seguro un fragmento escrito en el propio código (p. ej. un ícono SVG) */
export const seguro = (fragmento) => new HtmlSeguro(fragmento);

export function render(elemento, contenido) {
  elemento.innerHTML = convertir(contenido);
}

export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

/**
 * Delegación de eventos: un solo listener por vista. Cada botón declara su
 * acción con data-accion="nombre" y sus datos con data-* (p. ej. data-id).
 */
export function delegarAcciones(raiz, acciones) {
  raiz.addEventListener('click', (evento) => {
    const objetivo = evento.target.closest('[data-accion]');
    if (!objetivo || !raiz.contains(objetivo) || objetivo.disabled) return;
    const accion = acciones[objetivo.dataset.accion];
    if (!accion) return;
    evento.preventDefault();
    accion(objetivo.dataset, objetivo, evento);
  });
}
