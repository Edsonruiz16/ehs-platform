/** Error operacional con código HTTP, capturado por el middleware de errores. */
export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(msg: string, details?: unknown) {
    return new ApiError(400, msg, details);
  }
  static unauthorized(msg = 'No autorizado') {
    return new ApiError(401, msg);
  }
  static forbidden(msg = 'Acceso denegado') {
    return new ApiError(403, msg);
  }
  static notFound(msg = 'Recurso no encontrado') {
    return new ApiError(404, msg);
  }
  static conflict(msg: string, details?: unknown) {
    return new ApiError(409, msg, details);
  }
}
