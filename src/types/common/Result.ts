/**
 * Result-Pattern für fallible Operationen.
 * Verwendet statt Exceptions für typsichere Fehlerbehandlung.
 */

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Type Guards
export const isOk = <T, E>(r: Result<T, E>): r is { ok: true; value: T } => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is { ok: false; error: E } => !r.ok;

// Unwrap (wirft bei falschem Zustand)
export const unwrap = <T, E>(r: Result<T, E>): T => {
  if (!r.ok) throw new Error('unwrap on err');
  return r.value;
};

export const unwrapErr = <T, E>(r: Result<T, E>): E => {
  if (r.ok) throw new Error('unwrapErr on ok');
  return r.error;
};
