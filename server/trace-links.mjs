const TRACE_ID = /^(?:tr_[A-Za-z0-9_-]{4,}|[a-f0-9]{16,64})$/i;
const links = new Map();

export function neatlogsTraceUrl(traceId) {
  if (typeof traceId !== "string" || !TRACE_ID.test(traceId)) return null;
  return `https://app.neatlogs.com/traces/${encodeURIComponent(traceId)}`;
}

export function rememberTrace(sessionId, traceId, phase = "latest") {
  const url = neatlogsTraceUrl(traceId);
  if (!sessionId || !url) return null;
  const record = { traceId, url, phase };
  links.set(`${sessionId}:${phase}`, record);
  links.set(sessionId, record);
  return record;
}

export function traceFor(sessionId, phase) {
  if (!sessionId) return null;
  return links.get(phase ? `${sessionId}:${phase}` : sessionId) ?? null;
}
