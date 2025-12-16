/**
 * Result und Option Types für explizite Fehlerbehandlung
 * Inspiriert von Rust's Result und Option
 */

// ═══════════════════════════════════════════════════════════════
// AppError - Strukturiertes Error-Objekt
// ═══════════════════════════════════════════════════════════════

export interface AppError {
  /** Error-Code für programmatische Behandlung, z.B. "ENTITY_NOT_FOUND" */
  code: string;
  /** Human-readable Fehlermeldung */
  message: string;
  /** Zusätzlicher Kontext (optional) */
  details?: unknown;
}

// ═══════════════════════════════════════════════════════════════
// Result<T, E> - Fehlerbehandlung ohne Exceptions
// ═══════════════════════════════════════════════════════════════

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Helper Functions
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/** Unwrap value or throw */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(`Unwrap failed: ${JSON.stringify(result.error)}`);
}

/** Unwrap value or return default */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/** Map over successful result */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

// ═══════════════════════════════════════════════════════════════
// Option<T> - Explizite Optionalität
// ═══════════════════════════════════════════════════════════════

export type Option<T> =
  | { some: true; value: T }
  | { some: false };

// Helper Functions
export function some<T>(value: T): Option<T> {
  return { some: true, value };
}

export function none<T = never>(): Option<T> {
  return { some: false };
}

export function isSome<T>(option: Option<T>): option is { some: true; value: T } {
  return option.some;
}

export function isNone<T>(option: Option<T>): option is { some: false } {
  return !option.some;
}

/** Convert nullable to Option */
export function fromNullable<T>(value: T | null | undefined): Option<T> {
  return value != null ? some(value) : none();
}

/** Convert Option to nullable */
export function toNullable<T>(option: Option<T>): T | null {
  return option.some ? option.value : null;
}

/** Unwrap Option or return default */
export function getOrElse<T>(option: Option<T>, defaultValue: T): T {
  return option.some ? option.value : defaultValue;
}

/** Map over Some value */
export function mapOption<T, U>(option: Option<T>, fn: (value: T) => U): Option<U> {
  return option.some ? some(fn(option.value)) : none();
}
