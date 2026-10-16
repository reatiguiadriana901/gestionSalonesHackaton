/**
 * Vista: Datos — carga del dataset oficial (RN-14)
 *
 * Acepta varios archivos CSV o JSON a la vez. Un JSON puede ser una lista de
 * registros o un objeto con una lista por entidad ({ "espacios": [...] }).
 * El tipo de cada archivo se deduce de su nombre y se puede corregir. Los
 * lotes se envían en orden de dependencias y el backend valida cada registro.
 */
import { datosApi, ORDEN_ENTIDADES } from '../api/datosApi.js';
import { html, render, delegarAcciones } from '../ui/dom.js';
import { bloqueCargando, bloqueError, bloqueVacio, conCarga } from '../ui/estado.js';
import { insignia, tabla } from '../ui/componentes.js';
import { abrirModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { ICONOS } from '../ui/iconos.js';
import { leerCsv } from '../utils/csv.js';
import { formatearFechaHora, normalizar } from '../utils/formato.js';

const NOMBRES_ENTIDAD = { espacios: 'Espacios', recursos: 'Recursos', reservas: 'Reservas', prestamos: 'Préstamos', incidencias: 'Incidencias' };
const COLUMNAS_ESPERADAS = {
  espacios: 'codigo, nombre, tipo, capacidad, ubicacion, equipamiento, estado',
  recursos: 'codigo, nombre, tipo, espacio (código del espacio), estado',
  reservas: 'espacio, solicitante, asistentes, fecha, hora_inicio, hora_fin, motivo, estado',
  prestamos: 'recurso, solicitante, fecha_prestamo, fecha_limite, fecha_devolucion, estado, observaciones',
  incidencias: 'descripcion, reportado_por, espacio, recurso, categoria, prioridad, area, estado, fecha',
};

/** "2-recursos.json" → recursos; "Préstamos.csv" → prestamos */
const detectarEntidad = (nombre) => ORDEN_ENTIDADES.find((entidad) => normalizar(nombre).includes(entidad.slice(0, -1))) ?? '';
const numerar = (lista) => lista.map((r, i) => (r && typeof r === 'object' && !Array.isArray(r) ? { ...r, __fila: i + 1 } : r));

async function leerArchivo(archivo) {
  const texto = await archivo.text();
  if (/\.json$/i.test(archivo.name)) {
    let contenido;
    try {
      contenido = JSON.parse(texto);
    } catch {
      throw new Error('No es un JSON válido.');
    }
    if (Array.isArray(contenido)) return [{ archivo: archivo.name, entidad: detectarEntidad(archivo.name), registros: numerar(contenido) }];
    const lotes = Object.entries(contenido ?? {})
      .filter(([, valor]) => Array.isArray(valor))
      .map(([clave, valor]) => ({ archivo: `${archivo.name} › ${clave}`, entidad: detectarEntidad(clave), registros: numerar(valor) }));
    if (lotes.length) return lotes;
    throw new Error('El JSON debe ser una lista de registros o un objeto con listas por entidad.');
  }
  if (/\.(csv|txt)$/i.test(archivo.name)) return [{ archivo: archivo.name, entidad: detectarEntidad(archivo.name), registros: leerCsv(texto) }];
  throw new Error('Formato no soportado: usa archivos .csv o .json.');
}

export const datosVista = {
  titulo: 'Datos',

  async montar(raiz) {
    const estadoVista = { lotes: [], siguienteId: 1 };

    render(
      raiz,
      html`
        <section class="vista">
          <header class="vista__encabezado">
            <div class="vista__titulo">
              <h1>Datos del campus</h1>
              <p>Carga del dataset oficial con validación registro por registro (RN-14).</p>
            </div>
          </header>

          <div class="rejilla rejilla--lateral">
            <section class="tarjeta">
              <div class="tarjeta__encabezado">
                <div>
                  <h2>Importar archivos</h2>
                  <p>Solo se cargan los registros válidos; los demás se reportan con su fila y motivo.</p>
                </div>
              </div>
              <label class="zona-archivos" data-zona>
                ${ICONOS.subir}
                <strong>Arrastra aquí los archivos o haz clic para elegirlos</strong>
                <span class="texto-sm">CSV (separado por coma o punto y coma) o JSON · varios a la vez</span>
                <input type="file" accept=".csv,.json,.txt" multiple hidden data-entrada-archivos />
              </label>
              <div class="pila" data-lotes></div>
              <div class="formulario__acciones">
                <button type="button" class="boton boton--secundario" data-accion="limpiar">Quitar todos</button>
                <button type="button" class="boton boton--primario" data-accion="importar">${ICONOS.subir} Validar e importar</button>
              </div>
            </section>

            <section class="tarjeta">
              <h2>Columnas reconocidas</h2>
              <p class="texto-sm texto-suave">
                Los nombres no distinguen mayúsculas ni tildes y admiten variantes (p. ej. <code>aforo</code> = <code>capacidad</code>).
                Si el dataset oficial usa otros nombres, agrégalos en el nodo <em>Validar registros (RN-14)</em> del workflow «Datos».
              </p>
              <dl class="lista-datos">
                ${ORDEN_ENTIDADES.map((e) => html`<dt>${NOMBRES_ENTIDAD[e]}</dt><dd class="texto-xs mono">${COLUMNAS_ESPERADAS[e]}</dd>`)}
              </dl>
              <div class="aviso aviso--info">
                <div>El orden de carga se aplica solo: espacios → recursos → reservas → préstamos → incidencias.
                Las incidencias sin clasificar quedan pendientes y se pueden clasificar con IA desde <a href="#/incidencias">Incidencias</a>.</div>
              </div>
            </section>
          </div>

          <section class="tarjeta">
            <div class="tarjeta__encabezado">
              <div>
                <h2>Historial de importaciones</h2>
                <p>Evidencia de carga, validación y persistencia del dataset.</p>
              </div>
              <button type="button" class="boton boton--fantasma boton--pequeno" data-accion="actualizarHistorial">${ICONOS.actualizar} Actualizar</button>
            </div>
            <div data-historial></div>
          </section>
        </section>`,
    );

    const contenedorLotes = raiz.querySelector('[data-lotes]');
    const contenedorHistorial = raiz.querySelector('[data-historial]');
    const zona = raiz.querySelector('[data-zona]');
    const entrada = raiz.querySelector('[data-entrada-archivos]');
    let historial = [];

    // -------------------------------------------------------------- lotes
    function vistaPrevia(lote) {
      const columnas = [...new Set(lote.registros.slice(0, 20).flatMap((r) => (r && typeof r === 'object' ? Object.keys(r) : [])))]
        .filter((c) => c !== '__fila')
        .slice(0, 7);
      if (!columnas.length) return '';
      return tabla(
        columnas,
        lote.registros.slice(0, 3).map((r) => html`<tr>${columnas.map((c) => html`<td>${String(r?.[c] ?? '').slice(0, 40)}</td>`)}</tr>`),
      );
    }

    function resultadoLote(r) {
      const { importacion } = r;
      return html`
        <div class="pila">
          <div class="lote__resumen">
            ${insignia(`${importacion.insertados} cargado(s)`, 'exito')}
            ${insignia(`${importacion.rechazados} rechazado(s)`, importacion.rechazados ? 'peligro' : 'neutro')}
            ${insignia(`${r.advertencias.length} con advertencias`, r.advertencias.length ? 'aviso' : 'neutro')}
            ${r.cambios.length > 0 && insignia(`${r.cambios.length} bloqueo(s) aplicado(s)`, 'aviso')}
          </div>
          ${r.rechazados.length > 0 &&
          html`<details class="plegable" open>
            <summary>Registros rechazados (${r.rechazados.length})</summary>
            <div class="plegable__cuerpo">
              <ul>${r.rechazados.map((x) => html`<li><strong>Fila ${x.fila}</strong>${x.identificador ? ` (${x.identificador})` : ''}: ${x.errores.join('; ')}</li>`)}</ul>
            </div>
          </details>`}
          ${r.advertencias.length > 0 &&
          html`<details class="plegable">
            <summary>Advertencias (${r.advertencias.length})</summary>
            <div class="plegable__cuerpo">
              <ul>${r.advertencias.map((x) => html`<li><strong>Fila ${x.fila}</strong>${x.identificador ? ` (${x.identificador})` : ''}: ${x.mensajes.join('; ')}</li>`)}</ul>
            </div>
          </details>`}
          ${r.cambios.length > 0 &&
          html`<details class="plegable">
            <summary>Efectos en espacios y recursos (${r.cambios.length})</summary>
            <div class="plegable__cuerpo"><ul>${r.cambios.map((c) => html`<li>${c}</li>`)}</ul></div>
          </details>`}
        </div>`;
    }

    function tarjetaLote(lote) {
      return html`
        <div class="lote">
          <div class="fila fila--entre">
            <div>
              <strong>${lote.archivo}</strong>
              <span class="texto-sm texto-suave">· ${lote.registros.length} registro(s)</span>
            </div>
            <div class="fila">
              <select class="control" aria-label="Tipo de datos de ${lote.archivo}" data-entidad-lote="${lote.id}" ${lote.resultado ? 'disabled' : ''}>
                <option value="">¿Qué contiene?</option>
                ${ORDEN_ENTIDADES.map((e) => html`<option value="${e}" ${lote.entidad === e ? 'selected' : ''}>${NOMBRES_ENTIDAD[e]}</option>`)}
              </select>
              <button type="button" class="boton boton--fantasma boton--pequeno" data-accion="quitarLote" data-id="${lote.id}" aria-label="Quitar ${lote.archivo}">${ICONOS.quitar}</button>
            </div>
          </div>
          ${lote.resultado ? resultadoLote(lote.resultado) : vistaPrevia(lote)}
          ${lote.error && html`<div class="aviso aviso--peligro">${lote.error}</div>`}
        </div>`;
    }

    function dibujarLotes() {
      render(
        contenedorLotes,
        estadoVista.lotes.length ? estadoVista.lotes.map(tarjetaLote) : html`<p class="texto-sm texto-tenue">Ningún archivo seleccionado.</p>`,
      );
    }

    async function agregarArchivos(archivos) {
      for (const archivo of archivos) {
        try {
          const lotes = await leerArchivo(archivo);
          lotes.forEach((lote) => estadoVista.lotes.push({ ...lote, id: estadoVista.siguienteId++ }));
        } catch (error) {
          toast.error(`${archivo.name}: ${error.message}`, { titulo: 'No se pudo leer el archivo' });
        }
      }
      dibujarLotes();
    }

    async function importar(boton) {
      const pendientes = estadoVista.lotes.filter((l) => !l.resultado);
      if (!pendientes.length) {
        toast.info('Agrega al menos un archivo para importar.');
        return;
      }
      if (pendientes.some((l) => !l.entidad)) {
        toast.aviso('Indica qué contiene cada archivo antes de importar.');
        return;
      }
      const ordenados = [...pendientes].sort((a, b) => ORDEN_ENTIDADES.indexOf(a.entidad) - ORDEN_ENTIDADES.indexOf(b.entidad));
      let cargados = 0;
      let rechazados = 0;
      await conCarga(boton, async () => {
        for (const lote of ordenados) {
          lote.error = null;
          try {
            const { data } = await datosApi.importar(lote.entidad, lote.registros, lote.archivo);
            lote.resultado = data;
            cargados += data.importacion.insertados;
            rechazados += data.importacion.rechazados;
          } catch (error) {
            lote.error = error.message;
          }
          dibujarLotes();
        }
      }, 'Validando e importando…');
      const conError = ordenados.filter((l) => l.error).length;
      if (conError) toast.error(`${conError} archivo(s) no se pudieron importar. Revisa el detalle de cada uno.`);
      else toast.exito(`${cargados} registro(s) cargado(s) y ${rechazados} rechazado(s) por las validaciones.`, { titulo: 'Importación completa' });
      cargarHistorial();
    }

    // ---------------------------------------------------------- historial
    async function cargarHistorial() {
      render(contenedorHistorial, bloqueCargando('Cargando historial…'));
      try {
        ({ data: historial } = await datosApi.historial());
        render(
          contenedorHistorial,
          historial.length
            ? tabla(
                ['Fecha', 'Datos', 'Archivo', 'Total', 'Cargados', 'Rechazados', 'Advertencias', ''],
                historial.map(
                  (i) => html`
                    <tr>
                      <td>${formatearFechaHora(i.importado_en)}</td>
                      <td>${NOMBRES_ENTIDAD[i.entidad] ?? i.entidad}</td>
                      <td>${i.archivo ?? '—'}</td>
                      <td>${i.total}</td>
                      <td>${insignia(String(i.insertados), 'exito')}</td>
                      <td>${insignia(String(i.rechazados), i.rechazados ? 'peligro' : 'neutro')}</td>
                      <td>${(i.detalle?.advertencias ?? []).length}</td>
                      <td><div class="tabla__acciones"><button type="button" class="boton boton--fantasma boton--pequeno" data-accion="detalleImportacion" data-id="${i.id}">${ICONOS.ojo} Detalle</button></div></td>
                    </tr>`,
                ),
              )
            : bloqueVacio('Todavía no se ha importado ningún archivo'),
        );
      } catch (error) {
        render(contenedorHistorial, bloqueError(error));
      }
    }

    function detalleImportacion(id) {
      const importacion = historial.find((i) => String(i.id) === String(id));
      if (!importacion) return;
      const rechazos = importacion.detalle?.rechazados ?? [];
      const avisos = importacion.detalle?.advertencias ?? [];
      abrirModal({
        titulo: `Importación #${importacion.id} · ${NOMBRES_ENTIDAD[importacion.entidad] ?? importacion.entidad}`,
        ancho: true,
        contenido: html`
          <p class="texto-sm texto-suave">${importacion.archivo ?? 'Sin nombre de archivo'} · ${formatearFechaHora(importacion.importado_en)}</p>
          <h3>Rechazados (${rechazos.length})</h3>
          ${rechazos.length ? html`<ul class="texto-sm">${rechazos.map((x) => html`<li><strong>Fila ${x.fila}</strong>${x.identificador ? ` (${x.identificador})` : ''}: ${x.errores.join('; ')}</li>`)}</ul>` : html`<p class="texto-sm texto-tenue">Ninguno.</p>`}
          <h3>Advertencias (${avisos.length})</h3>
          ${avisos.length ? html`<ul class="texto-sm">${avisos.map((x) => html`<li><strong>Fila ${x.fila}</strong>${x.identificador ? ` (${x.identificador})` : ''}: ${x.mensajes.join('; ')}</li>`)}</ul>` : html`<p class="texto-sm texto-tenue">Ninguna.</p>`}`,
      });
    }

    // -------------------------------------------------------------- eventos
    delegarAcciones(raiz, {
      importar: (_, boton) => importar(boton),
      limpiar: () => {
        estadoVista.lotes = [];
        dibujarLotes();
      },
      quitarLote: ({ id }) => {
        estadoVista.lotes = estadoVista.lotes.filter((l) => String(l.id) !== id);
        dibujarLotes();
      },
      actualizarHistorial: cargarHistorial,
      reintentar: cargarHistorial,
      detalleImportacion: ({ id }) => detalleImportacion(id),
    });

    raiz.addEventListener('change', (evento) => {
      if (evento.target === entrada) {
        agregarArchivos([...entrada.files]);
        entrada.value = '';
        return;
      }
      const idLote = evento.target.dataset.entidadLote;
      if (idLote) {
        const lote = estadoVista.lotes.find((l) => String(l.id) === idLote);
        if (lote) lote.entidad = evento.target.value;
      }
    });

    zona.addEventListener('dragover', (evento) => {
      evento.preventDefault();
      zona.classList.add('zona-archivos--activa');
    });
    zona.addEventListener('dragleave', () => zona.classList.remove('zona-archivos--activa'));
    zona.addEventListener('drop', (evento) => {
      evento.preventDefault();
      zona.classList.remove('zona-archivos--activa');
      agregarArchivos([...evento.dataTransfer.files]);
    });

    dibujarLotes();
    await cargarHistorial();
  },
};
