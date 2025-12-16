/**
 * Type Helper Utilities
 *
 * Generic TypeScript type utilities used across schemas.
 * Reduces repetitive type patterns.
 *
 * @module schemas/common/type-helpers
 */

// ============================================================================
// Array to Union Type
// ============================================================================

/**
 * Extracts a union type from a readonly array's element type.
 * Use instead of `typeof ARRAY[number]` for cleaner code.
 *
 * @example
 * const SIZES = ['small', 'medium', 'large'] as const;
 * type Size = ArrayElement<typeof SIZES>; // 'small' | 'medium' | 'large'
 */
export type ArrayElement<T extends readonly unknown[]> = T[number];

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Creates a branded string type for type-safe string identifiers.
 * Prevents mixing up different string IDs at compile time.
 *
 * @example
 * type UserId = BrandedString<'UserId'>;
 * type PostId = BrandedString<'PostId'>;
 *
 * function getUser(id: UserId) { ... }
 * const userId: UserId = 'abc' as UserId;
 * const postId: PostId = 'xyz' as PostId;
 * getUser(userId); // OK
 * getUser(postId); // Type error!
 */
export type BrandedString<Brand extends string> = string & { readonly __brand: Brand };

/**
 * Creates a branded number type for type-safe numeric values.
 * Prevents mixing up different numeric types at compile time.
 *
 * @example
 * type Pixels = BrandedNumber<'Pixels'>;
 * type Meters = BrandedNumber<'Meters'>;
 *
 * const width: Pixels = 100 as Pixels;
 * const distance: Meters = 50 as Meters;
 * // Can't assign Meters to Pixels without explicit cast
 */
export type BrandedNumber<Brand extends string> = number & { readonly __brand: Brand };

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Makes specified properties required while keeping others unchanged.
 *
 * @example
 * type User = { name?: string; age?: number; email?: string };
 * type UserWithName = RequireKeys<User, 'name'>; // name is required, others optional
 */
export type RequireKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Makes specified properties optional while keeping others unchanged.
 *
 * @example
 * type User = { name: string; age: number; email: string };
 * type UserPartial = OptionalKeys<User, 'age' | 'email'>; // name required, others optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extracts the value type from a Map type.
 *
 * @example
 * type MyMap = Map<string, { id: number; name: string }>;
 * type Value = MapValue<MyMap>; // { id: number; name: string }
 */
export type MapValue<T> = T extends Map<unknown, infer V> ? V : never;

/**
 * Extracts the key type from a Map type.
 *
 * @example
 * type MyMap = Map<string, number>;
 * type Key = MapKey<MyMap>; // string
 */
export type MapKey<T> = T extends Map<infer K, unknown> ? K : never;
