/**
 * Error único de la API. Toda falla (red, tiempo de espera, HTTP o una regla
 * de negocio rechazada por el backend) llega a las vistas como ApiError, con
 * un mensaje listo para mostrar al usuario.
 */
const MENSAJES_POR_ESTADO = {
  400: 'La solicitud tiene datos inválidos.',
  404: 'El servicio solicitado no existe. ¿Están publicados los workflows de n8n?',
  409: 'La operación entra en conflicto con el estado actual.',
  413: 'El archivo es demasiado grande.',
  422: 'La operación no cumple las reglas del sistema.',
  500: 'Error interno del servidor.',
  502: 'El backend no responde. Verifica que el contenedor de n8n esté en ejecución.',
  503: 'El servicio no está disponible en este momento.',
  504: 'El servidor tardó demasiado en responder.',
};

export class ApiError extends Error {
  /**
   * @param {string} mensaje   Texto para el usuario
   * @param {object} opciones
   * @param {number} opciones.status    Código HTTP (0 si no hubo respuesta)
   * @param {string} opciones.codigo    Código del error (p. ej. REGLA_DE_NEGOCIO)
   * @param {Array<{regla?: string, mensaje: string}>} opciones.detalles
   */
  constructor(mensaje, { status = 0, codigo = 'ERROR', detalles = [] } = {}) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }

  /** Crea el error a partir de una respuesta HTTP fallida o con { ok: false } */
  static desdeRespuesta(status, contenido) {
    const error = contenido?.error;
    if (error?.message) {
      return new ApiError(error.message, { status, codigo: error.code ?? `HTTP_${status}`, detalles: error.details ?? [] });
    }
    // Respuesta que no viene de nuestros workflows (p. ej. n8n o nginx)
    const mensaje = MENSAJES_POR_ESTADO[status] ?? `Respuesta inesperada del servidor (HTTP ${status}).`;
    const original = contenido?.message ?? contenido?.textoPlano;
    return new ApiError(mensaje, {
      status,
      codigo: `HTTP_${status}`,
      detalles: original ? [{ mensaje: String(original).slice(0, 200) }] : [],
    });
  }

  static sinConexion() {
    return new ApiError('No hay conexión con el servidor. Verifica que los contenedores estén en ejecución.', {
      codigo: 'SIN_CONEXION',
    });
  }

  static tiempoAgotado(milisegundos) {
    return new ApiError(`El servidor no respondió en ${Math.round(milisegundos / 1000)} segundos. Intenta de nuevo.`, {
      codigo: 'TIEMPO_AGOTADO',
    });
  }

  static cancelada() {
    return new ApiError('La solicitud fue cancelada.', { codigo: 'CANCELADA' });
  }

  /** true cuando el backend rechazó la operación por una regla de negocio */
  get esReglaDeNegocio() {
    return this.status === 409 || this.status === 422;
  }
}
