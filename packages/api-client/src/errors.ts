// AppError taxonómia per docs/agents/architecture/decision-records/08-error-handling.md.
// BFF zhrnie upstream chyby z CA SDM (REST/SOAP) do tejto taxonómie.

export type AppErrorKind =
  | "AUTH" // 401 — relácia chýba / vypršala
  | "FORBIDDEN" // 403 — RBAC zlyhanie
  | "NOT_FOUND" // 404
  | "CONFLICT" // 409 — optimistic-lock / state collision
  | "VALIDATION" // 422 — Zod / form validation
  | "RATE_LIMIT" // 429
  | "NETWORK" // fetch zlyhalo, timeout
  | "SERVER" // 5xx
  | "UNKNOWN";

export interface AppErrorPayload {
  readonly kind: AppErrorKind;
  readonly message: string;
  readonly correlationId?: string;
  readonly status?: number;
  readonly details?: Record<string, unknown>;
}

export class AppError extends Error implements AppErrorPayload {
  readonly kind: AppErrorKind;
  readonly correlationId?: string;
  readonly status?: number;
  readonly details?: Record<string, unknown>;

  constructor(payload: AppErrorPayload) {
    super(payload.message);
    this.name = "AppError";
    this.kind = payload.kind;
    if (payload.correlationId !== undefined) this.correlationId = payload.correlationId;
    if (payload.status !== undefined) this.status = payload.status;
    if (payload.details !== undefined) this.details = payload.details;
  }
}

export const fromStatus = (status: number, message: string, correlationId?: string): AppError => {
  const kind: AppErrorKind =
    status === 401
      ? "AUTH"
      : status === 403
        ? "FORBIDDEN"
        : status === 404
          ? "NOT_FOUND"
          : status === 409
            ? "CONFLICT"
            : status === 422
              ? "VALIDATION"
              : status === 429
                ? "RATE_LIMIT"
                : status >= 500
                  ? "SERVER"
                  : "UNKNOWN";
  return new AppError({ kind, message, status, ...(correlationId ? { correlationId } : {}) });
};

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
