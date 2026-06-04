/**
 * J.3 — In-memory pub/sub keyed by sessionId.
 *
 * LIMITATION (by design): single-instance only. Events are not propagated
 * across BFF replicas. Multi-instance delivery requires a Redis pub/sub
 * adapter — deferred to v2.0 (v1.0 deploy is replicaCount=1 per
 * deploy/helm/sdm/values-staging.yaml). Document in prod runbook before
 * scaling to >1 replica.
 *
 * Backpressure: synchronous publish. If a sink throws (slow client, network
 * buffer full), the error is caught + logged with `console.warn` and the
 * next subscriber continues. Each user has at most a handful of open tabs;
 * backpressure-induced drops are acceptable at this scale.
 */

export interface BusEvent {
  readonly type: "tenant.suspended" | "session.expired";
  readonly tenantId?: string;
  readonly reason?: string;
  readonly at: string;
}

type Sink = (event: BusEvent) => void;

const subscribers = new Map<string, Set<Sink>>();

/**
 * Register a sink for a given sessionId. Returns an unsubscribe function.
 * The caller MUST call unsubscribe on stream abort to prevent memory leaks.
 */
export function subscribe(sessionId: string, sink: Sink): () => void {
  let sinks = subscribers.get(sessionId);
  if (!sinks) {
    sinks = new Set();
    subscribers.set(sessionId, sinks);
  }
  sinks.add(sink);

  return () => {
    const s = subscribers.get(sessionId);
    if (!s) return;
    s.delete(sink);
    if (s.size === 0) subscribers.delete(sessionId);
  };
}

/** Publish an event to all sinks registered for a specific sessionId. */
export function publishToSession(sessionId: string, event: BusEvent): void {
  const sinks = subscribers.get(sessionId);
  if (!sinks) return;
  for (const sink of sinks) {
    try {
      sink(event);
    } catch (err) {
      console.warn("[event-bus] sink threw on publish", { sessionId, eventType: event.type, err });
    }
  }
}

/**
 * Publish to every session that has `tenantId` in its registered tenant set.
 * The tenant membership is supplied by the caller (admin-tenants handler
 * iterates the session store and calls this per matching session).
 */
export function publishToAllSessionsWithTenant(
  tenantIds: readonly string[],
  event: BusEvent,
): void {
  for (const sessionId of tenantIds) {
    publishToSession(sessionId, event);
  }
}

/** Emit session.expired to a single session, then that session will close the stream. */
export function publishSessionExpired(sessionId: string): void {
  publishToSession(sessionId, { type: "session.expired", at: new Date().toISOString() });
}

/** Exposed for tests — snapshot of how many sessions have active subscribers. */
export function subscriberCount(): number {
  return subscribers.size;
}
