/** Validate native records before JSON conversion can silently remove data or invoke getters. */
export function nativeRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== keys.length
  )
    throw new Error("Unbekannte oder unvollständige native Daten.");
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable)
      throw new Error("Native Daten benötigen eigene lesbare Werte.");
    result[key] = descriptor.value;
  }
  return result;
}
export function nativeKind(value: unknown): unknown {
  if (
    !value ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error("Ungültiger nativer Datentyp.");
  const descriptor = Object.getOwnPropertyDescriptor(value, "kind");
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable)
    throw new Error("Ungültiger nativer Datentyp.");
  return descriptor.value;
}
export function nativeArray(value: unknown): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    throw new Error(
      "Native Liste ist unvollständig oder enthält unbekannte Daten.",
    );
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable)
      throw new Error("Native Liste enthält keine eigenen lesbaren Werte.");
  }
  return value;
}
export function nativeId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    throw new Error("Ungültige stabile Kennung.");
  return value;
}
export function nativeText(value: unknown, nonempty = false): string {
  if (typeof value !== "string" || (nonempty && !value.trim()))
    throw new Error("Ungültiger nativer Text.");
  return value;
}
