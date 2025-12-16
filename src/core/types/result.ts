/**
 * Result type for operations that can fail.
 * Use Result<T, AppError> for fallible operations instead of throwing exceptions.
 */

// ============================================================================
// Types
// ============================================================================

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

// ============================================================================
// Constructors
// ============================================================================

/** Create a success Result */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Create a failure Result */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ============================================================================
// Type Guards
// ============================================================================

/** Type guard for success Result */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/** Type guard for failure Result */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

// ============================================================================
// Extractors
// ============================================================================

/**
 * Extract value from Result. Throws if Result is Err.
 * Use sparingly - prefer pattern matching with isOk/isErr.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error(`Called unwrap on Err: ${JSON.stringify(result.error)}`);
}

/** Extract value or return default */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

// ============================================================================
// Transformers
// ============================================================================

/** Transform the success value */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/** Transform the error value */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return result.ok ? result : err(fn(result.error));
}

/** Chain Results (flatMap) */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}
