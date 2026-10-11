export function exactRecord(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
  label = "Wert",
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} muss ein Objekt sein.`);
  const result = value as Record<string, unknown>,
    prototype = Object.getPrototypeOf(result),
    keys = Reflect.ownKeys(result),
    allowed = new Set([...required, ...optional]);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    required.some((key) => !Object.hasOwn(result, key)) ||
    keys.some((key) => typeof key !== "string" || !allowed.has(key)) ||
    Object.values(Object.getOwnPropertyDescriptors(result)).some(
      (descriptor) => !Object.hasOwn(descriptor, "value"),
    )
  )
    throw new Error(
      `${label} enthält unbekannte, berechnete oder unvollständige Daten.`,
    );
  return result;
}

export function exactArray(value: unknown, label: string): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    throw new Error(`${label} muss eine vollständige native Liste sein.`);
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value"))
      throw new Error(
        `${label} enthält ausgelassene oder berechnete Einträge.`,
      );
  }
  return value;
}

export function exactText(
  value: unknown,
  label: string,
  allowEmpty = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > 20_000 ||
    (!allowEmpty && !value.trim())
  )
    throw new Error(`${label} ist kein gültiger Text.`);
  return value;
}

export function exactBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} muss boolesch sein.`);
  return value;
}

export function uniqueBy<T>(
  values: readonly T[],
  key: (value: T) => string,
  label: string,
): readonly T[] {
  const seen = new Set<string>();
  for (const value of values) {
    const identity = key(value);
    if (seen.has(identity)) throw new Error(`${label} enthält doppelte Kennungen.`);
    seen.add(identity);
  }
  return values;
}
