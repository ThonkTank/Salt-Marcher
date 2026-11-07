/** Internal diagnostics only: never part of the renderer Result contract. */
export type ErrorContext = {
  phase: string;
  method?: string;
  requestId?: number;
  channel?: string;
};
export type ErrorDiagnostic = {
  version: 1;
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  cause?: ErrorDiagnostic;
  context?: ErrorContext;
  truncated?: true;
};
const diagnosticKey = Symbol.for('saltmarcher.internal.error-diagnostic');
const nativeStackGetter = Object.getOwnPropertyDescriptor(new Error(), 'stack')?.get;
const limit = (value: string, size: number) =>
  value.length > size ? value.slice(0, size) + '…' : value;
function field(value: unknown, key: PropertyKey): unknown {
  try {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return undefined;
    let current: object | null = value;
    for (let i = 0; current && i < 8; i++, current = Object.getPrototypeOf(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor) {
        if ('value' in descriptor) return descriptor.value;
        // Node 22 stores Error.stack behind its native lazy getter.
        if (key === 'stack' && nativeStackGetter && descriptor.get === nativeStackGetter)
          return nativeStackGetter.call(value);
        return undefined;
      }
    }
  } catch {
    /* A thrown proxy/accessor must not break error reporting. */
  }
  return undefined;
}
function contextValue(value: unknown): ErrorContext | undefined {
  const phase = field(value, 'phase');
  if (typeof phase !== 'string') return undefined;
  const result: ErrorContext = { phase: limit(phase, 128) };
  for (const key of ['method', 'channel'] as const) {
    const text = field(value, key);
    if (typeof text === 'string') result[key] = limit(text, 256);
  }
  const id = field(value, 'requestId');
  if (typeof id === 'number' && Number.isSafeInteger(id)) result.requestId = id;
  return result;
}
/** No enumeration, user-defined toJSON/toString, accessors or argument payloads. */
export function errorDiagnostic(value: unknown, context?: ErrorContext): ErrorDiagnostic {
  const seen = new Set<unknown>();
  function visit(input: unknown, depth: number, allowAttached = true): ErrorDiagnostic {
    if (depth >= 5 || seen.has(input))
      return {
        version: 1,
        name: 'TruncatedCause',
        message: 'Further cause omitted.',
        truncated: true,
      };
    if (input && (typeof input === 'object' || typeof input === 'function')) seen.add(input);
    const attached = field(input, diagnosticKey);
    if (allowAttached && attached && attached !== input) return visit(attached, depth, false);
    const name = field(input, 'name'),
      message = field(input, 'message'),
      stack = field(input, 'stack'),
      code = field(input, 'code');
    const primitive =
      input === null ||
      ['string', 'number', 'boolean', 'undefined', 'bigint', 'symbol'].includes(typeof input);
    const result: ErrorDiagnostic = {
      version: 1,
      name: typeof name === 'string' ? limit(name, 128) : 'ThrownValue',
      message:
        typeof message === 'string'
          ? limit(message, 4096)
          : primitive
            ? limit(String(input), 4096)
            : 'Non-Error value thrown.',
    };
    if (typeof stack === 'string') result.stack = limit(stack, 16384);
    if (typeof code === 'string') result.code = limit(code, 256);
    else if (typeof code === 'number' && Number.isFinite(code)) result.code = code;
    const existing = contextValue(field(input, 'context'));
    if (existing) result.context = existing;
    const cause = field(input, 'cause');
    if (cause !== undefined) result.cause = visit(cause, depth + 1);
    if (
      field(input, 'truncated') === true ||
      (typeof name === 'string' && name.length > 128) ||
      (typeof code === 'string' && code.length > 256) ||
      (typeof message === 'string' && message.length > 4096) ||
      (typeof stack === 'string' && stack.length > 16384)
    )
      result.truncated = true;
    return result;
  }
  const result = visit(value, 0);
  if (context) result.context = contextValue(context);
  return result;
}
export function withDiagnostic<T extends Error>(error: T, diagnostic: ErrorDiagnostic): T {
  try {
    Object.defineProperty(error, diagnosticKey, {
      value: errorDiagnostic(diagnostic),
      configurable: true,
    });
  } catch {}
  return error;
}
/** Reconstruct an ordinary Error, never a remotely named constructor/prototype. */
export function remoteStoreError(message: string, diagnostic?: unknown): Error {
  const error = new Error(message);
  if (!diagnostic) return error;
  const detail = errorDiagnostic(diagnostic);
  error.name = detail.name;
  if (detail.stack) error.stack = detail.stack;
  if (detail.code !== undefined) Object.defineProperty(error, 'code', { value: detail.code });
  if (detail.cause)
    Object.defineProperty(error, 'cause', {
      value: remoteStoreError(detail.cause.message, detail.cause),
    });
  return withDiagnostic(error, detail);
}
export type DiagnosticRecord = {
  event: 'desktop-error';
  context: ErrorContext;
  error: ErrorDiagnostic;
};
export type DiagnosticSink = (record: DiagnosticRecord) => void;
export const stderrDiagnostics: DiagnosticSink = (record) => console.error(JSON.stringify(record));
/** Diagnostics are best-effort and may never replace an operation's outcome. */
export function reportError(
  error: unknown,
  context: ErrorContext,
  sink: DiagnosticSink = stderrDiagnostics,
): void {
  try {
    sink({
      event: 'desktop-error',
      context: contextValue(context)!,
      error: errorDiagnostic(error),
    });
  } catch {}
}

/** Preserve existing UI text; hostile thrown values receive the existing generic fallback. */
export function errorText(value: unknown, includeName = false): string {
  try {
    const text = !includeName && value instanceof Error ? value.message : String(value);
    return typeof text === 'string' ? text : 'Vorgang fehlgeschlagen.';
  } catch {
    return 'Vorgang fehlgeschlagen.';
  }
}
