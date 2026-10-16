/**
 * Lectura de formularios: convierte un <form> en un objeto listo para la API.
 * Solo se valida el formato (campos requeridos, números, fechas); las reglas
 * de negocio las valida el backend, que es la única fuente de verdad.
 */
export function leerFormulario(formulario) {
  const datos = {};
  for (const elemento of formulario.elements) {
    if (!elemento.name || elemento.disabled) continue;
    if (elemento.type === 'checkbox') datos[elemento.name] = elemento.checked;
    else if (elemento.type === 'radio') {
      if (elemento.checked) datos[elemento.name] = elemento.value;
    } else if (elemento.type === 'number') datos[elemento.name] = elemento.value === '' ? null : Number(elemento.value);
    else datos[elemento.name] = elemento.value.trim();
  }
  return datos;
}
