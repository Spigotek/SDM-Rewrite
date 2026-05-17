import { HttpResponse } from "msw";
import type { AppErrorKind } from "@sdm/api-client";

export interface MockErrorBody {
  readonly error: {
    readonly kind: AppErrorKind;
    readonly message: string;
    readonly correlationId?: string;
  };
}

const STATUS_KIND: Record<number, AppErrorKind> = {
  400: "VALIDATION",
  401: "AUTH",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION",
  429: "RATE_LIMIT",
  500: "SERVER",
};

export function errorResponse(
  status: number,
  message: string,
  correlationId?: string,
): HttpResponse {
  const kind = STATUS_KIND[status] ?? "UNKNOWN";
  const body: MockErrorBody = correlationId
    ? { error: { kind, message, correlationId } }
    : { error: { kind, message } };
  return HttpResponse.json(body, { status });
}

export const notFound = (entity: string, id: string, correlationId?: string): HttpResponse =>
  errorResponse(404, `${entity} ${id} not found`, correlationId);

export const forbidden = (message: string, correlationId?: string): HttpResponse =>
  errorResponse(403, message, correlationId);

export const unauthorized = (
  message = "Authentication required",
  correlationId?: string,
): HttpResponse => errorResponse(401, message, correlationId);

export const badRequest = (message: string, correlationId?: string): HttpResponse =>
  errorResponse(400, message, correlationId);
