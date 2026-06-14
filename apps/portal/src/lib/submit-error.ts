/**
 * Shared write-path error handling for the portal create forms (new-incident +
 * catalog request).
 *
 * Before M.3 every non-2xx response surfaced to the user as a generic
 * "Server teraz neodpovedá" (server-down) message — misleading for a 400
 * VALIDATION (the BFF actually responded with an actionable message). This
 * helper turns a non-OK `Response` into a typed `SubmitError` that carries the
 * HTTP status, the BFF error `code`, and the BFF `message`; `submitErrorKey`
 * then maps it to the right i18n key so the form shows the real cause and the
 * generic network wording stays reserved for actual network/5xx failures.
 */

export interface SubmitError extends Error {
  status: number;
  code?: string;
  serverMessage?: string;
}

interface BffErrorBody {
  readonly error?: string;
  readonly code?: string;
  readonly message?: string;
}

export async function toSubmitError(resp: Response, op: string): Promise<SubmitError> {
  let body: BffErrorBody = {};
  try {
    body = (await resp.json()) as BffErrorBody;
  } catch {
    // Non-JSON body (gateway/proxy error page) — leave body empty.
  }
  const code = body.code ?? body.error;
  const serverMessage = body.message;
  const detail = serverMessage ? `: ${serverMessage}` : "";
  const error = new Error(`[${op}] HTTP ${resp.status}${detail}`) as SubmitError;
  error.status = resp.status;
  if (code !== undefined) error.code = code;
  if (serverMessage !== undefined) error.serverMessage = serverMessage;
  return error;
}

export interface SubmitErrorMessage {
  /** i18n key to translate, OR `null` when `literal` should be shown verbatim. */
  readonly key: string | null;
  /** Verbatim message (BFF validation text) when `key` is null. */
  readonly literal?: string;
}

/**
 * Map a thrown submit error to a translation key (under the `portal`
 * namespace). 400 VALIDATION shows the BFF's own message verbatim (it is
 * human-readable and Slovak-ish); 401/403 → "no permission"; everything else
 * (5xx, network, timeout, unknown) → the generic "server not responding".
 *
 * `genericKey` lets each form keep its existing copy key
 * (`newIncident.errors.submitFailed` vs `catalogBrowse.form.submitFailed`).
 */
export function submitErrorMessage(
  err: unknown,
  genericKey: string,
  forbiddenKey: string,
): SubmitErrorMessage {
  const e = err as Partial<SubmitError> | undefined;
  const status = typeof e?.status === "number" ? e.status : 0;
  if (status === 400) {
    const literal = e?.serverMessage;
    if (literal !== undefined && literal.length > 0) return { key: null, literal };
    return { key: genericKey };
  }
  if (status === 401 || status === 403) return { key: forbiddenKey };
  return { key: genericKey };
}
