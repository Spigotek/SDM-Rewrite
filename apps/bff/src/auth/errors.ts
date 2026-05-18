export type AppErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_EXPIRED"
  | "AUTH_FORBIDDEN"
  | "TENANT_FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BACKEND_UNAVAILABLE"
  | "NETWORK"
  | "UNKNOWN";

export interface AppError {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly httpStatus: number;
  readonly correlationId?: string;
  readonly details?: unknown;
}

export class AppErrorException extends Error {
  readonly code: AppErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(err: Omit<AppError, "correlationId">) {
    super(err.message);
    this.name = "AppErrorException";
    this.code = err.code;
    this.httpStatus = err.httpStatus;
    this.details = err.details;
  }
}

export function toAppErrorBody(err: AppError): {
  error: AppErrorCode;
  message: string;
  correlationId?: string;
  details?: unknown;
} {
  return {
    error: err.code,
    message: err.message,
    ...(err.correlationId ? { correlationId: err.correlationId } : {}),
    ...(err.details !== undefined ? { details: err.details } : {}),
  };
}
