/**
 * Lector de CSV (RFC 4180): campos entre comillas, comillas escapadas (""),
 * saltos de línea dentro de un campo, BOM de Excel y separador "," o ";"
 * (Excel en español usa punto y coma).
 *
 * Devuelve objetos { columna: valor, __fila } donde __fila es la línea del
 * archivo donde empieza el registro (la 1 es el encabezado), para que el
 * reporte de validación del backend cite la fila exacta.
 */
export function leerCsv(texto) {
  const contenido = texto.replace(/^﻿/, '');
  const primeraLinea = contenido.split(/\r?\n/, 1)[0] ?? '';
  const contar = (caracter) => primeraLinea.split(caracter).length - 1;
  const separador = contar(';') > contar(',') ? ';' : ',';

  const registros = []; // { valores, linea }
  let valores = [];
  let campo = '';
  let entreComillas = false;
  let linea = 1;
  let lineaInicio = 1;

  const cerrarRegistro = () => {
    valores.push(campo);
    if (valores.some((v) => v.trim() !== '')) registros.push({ valores, linea: lineaInicio });
    valores = [];
    campo = '';
  };

  for (let i = 0; i < contenido.length; i++) {
    const caracter = contenido[i];
    if (entreComillas) {
      if (caracter === '"' && contenido[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (caracter === '"') {
        entreComillas = false;
      } else {
        if (caracter === '\n') linea++;
        campo += caracter;
      }
    } else if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === separador) {
      valores.push(campo);
      campo = '';
    } else if (caracter === '\n' || caracter === '\r') {
      if (caracter === '\r' && contenido[i + 1] === '\n') i++;
      cerrarRegistro();
      linea++;
      lineaInicio = linea;
    } else {
      campo += caracter;
    }
  }
  if (campo !== '' || valores.length) cerrarRegistro();

  if (entreComillas) throw new Error('El CSV tiene comillas sin cerrar.');
  if (registros.length === 0) return [];

  const [encabezado, ...filas] = registros;
  const columnas = encabezado.valores.map((c) => c.trim());
  return filas.map(({ valores: fila, linea: numeroLinea }) => {
    const registro = { __fila: numeroLinea };
    columnas.forEach((columna, j) => {
      if (columna) registro[columna] = (fila[j] ?? '').trim();
    });
    return registro;
  });
}
