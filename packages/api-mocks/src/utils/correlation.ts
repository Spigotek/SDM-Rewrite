const HEADER = "X-Correlation-ID";

export function correlationIdFrom(req: Request): string | undefined {
  return req.headers.get(HEADER) ?? undefined;
}
