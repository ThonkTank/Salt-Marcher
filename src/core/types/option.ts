/**
 * Option type for optional values.
 * Use Option<T> instead of null/undefined for explicit optionality.
 */

// ============================================================================
// Types
// ============================================================================

export interface Some<T> {
  readonly some: true;
  readonly value: T;
}

export interface None {
  readonly none: true;
}

export type Option<T> = Some<T> | None;

// ============================================================================
// Constructors
// ============================================================================

/** Create a Some Option */
export function some<T>(value: T): Option<T> {
  return { some: true, value };
}

/** Create a None Option */
export function none(): Option<never> {
  return { none: true };
}

/** Convert nullable value to Option */
export function fromNullable<T>(value: T | null | undefined): Option<T> {
  return value == null ? none() : some(value);
}

// ============================================================================
// Type Guards
// ============================================================================

/** Type guard for Some */
export function isSome<T>(option: Option<T>): option is Some<T> {
  return 'some' in option;
}

/** Type guard for None */
export function isNone<T>(option: Option<T>): option is None {
  return 'none' in option;
}

// ============================================================================
// Extractors
// ============================================================================

/** Extract value or return default */
export function getOrElse<T>(option: Option<T>, defaultValue: T): T {
  return isSome(option) ? option.value : defaultValue;
}

/**
 * Extract value from Option. Throws if Option is None.
 * Use sparingly - prefer pattern matching with isSome/isNone.
 */
export function unwrap<T>(option: Option<T>): T {
  if (isSome(option)) {
    return option.value;
  }
  throw new Error('Called unwrap on None');
}

// ============================================================================
// Transformers
// ============================================================================

/** Transform the value if Some */
export function map<T, U>(option: Option<T>, fn: (value: T) => U): Option<U> {
  return isSome(option) ? some(fn(option.value)) : none();
}

/** Chain Options (flatMap) */
export function flatMap<T, U>(
  option: Option<T>,
  fn: (value: T) => Option<U>
): Option<U> {
  return isSome(option) ? fn(option.value) : none();
}

/** Filter Option by predicate */
export function filter<T>(
  option: Option<T>,
  predicate: (value: T) => boolean
): Option<T> {
  return isSome(option) && predicate(option.value) ? option : none();
}
