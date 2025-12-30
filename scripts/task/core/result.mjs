// Ziel: Result<T,E> Monad für fehlerbehandlung ohne Exceptions
// Siehe: docs/tools/taskTool.md#fehlerbehandlung

/**
 * @template T
 * @template E
 * @typedef {{ ok: true, value: T } | { ok: false, error: E }} Result
 */

/**
 * Creates a successful Result
 * @template T
 * @param {T} value - The success value
 * @returns {Result<T, never>} A successful Result
 */
export const ok = (value) => ({ ok: true, value });

/**
 * Creates a failed Result
 * @template E
 * @param {E} error - The error value
 * @returns {Result<never, E>} A failed Result
 */
export const err = (error) => ({ ok: false, error });

/**
 * Checks if Result is successful
 * @template T, E
 * @param {Result<T, E>} result - The Result to check
 * @returns {boolean} True if Result is ok
 */
export const isOk = (result) => result.ok === true;

/**
 * Checks if Result is failed
 * @template T, E
 * @param {Result<T, E>} result - The Result to check
 * @returns {boolean} True if Result is err
 */
export const isErr = (result) => result.ok === false;

/**
 * Extracts value from Result, throws on error
 * @template T, E
 * @param {Result<T, E>} result - The Result to unwrap
 * @returns {T} The success value
 * @throws {Error} If Result is err
 */
export const unwrap = (result) => {
  if (!result.ok) {
    throw new Error(`unwrap on err: ${JSON.stringify(result.error)}`);
  }
  return result.value;
};

/**
 * Extracts value from Result or returns default
 * @template T, E
 * @param {Result<T, E>} result - The Result to unwrap
 * @param {T} defaultValue - Value to return if Result is err
 * @returns {T} The success value or default
 */
export const unwrapOr = (result, defaultValue) =>
  result.ok ? result.value : defaultValue;

/**
 * Transforms the value if Result is ok
 * @template T, U, E
 * @param {Result<T, E>} result - The Result to map
 * @param {(value: T) => U} fn - Transform function
 * @returns {Result<U, E>} New Result with transformed value or original error
 */
export const map = (result, fn) =>
  result.ok ? ok(fn(result.value)) : result;

/**
 * Chains Result-returning operations
 * @template T, U, E
 * @param {Result<T, E>} result - The Result to chain
 * @param {(value: T) => Result<U, E>} fn - Function returning Result
 * @returns {Result<U, E>} Result from fn or original error
 */
export const flatMap = (result, fn) =>
  result.ok ? fn(result.value) : result;

/**
 * Transforms the error if Result is err
 * @template T, E, F
 * @param {Result<T, E>} result - The Result to map error
 * @param {(error: E) => F} fn - Error transform function
 * @returns {Result<T, F>} New Result with original value or transformed error
 */
export const mapErr = (result, fn) =>
  result.ok ? result : err(fn(result.error));

/**
 * Pattern matching on Result
 * @template T, E, U
 * @param {Result<T, E>} result - The Result to match
 * @param {{ ok: (value: T) => U, err: (error: E) => U }} handlers - Handler functions
 * @returns {U} Result of calling appropriate handler
 */
export const match = (result, handlers) =>
  result.ok ? handlers.ok(result.value) : handlers.err(result.error);
