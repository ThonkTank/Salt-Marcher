import type { Point } from "../../model";

/** Small native-data boundary for gesture addresses and meter points. */
export function cityInputRecord(
  value: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Ungültige Stadteingabe: Datensatz fehlt.");
  const prototype = Object.getPrototypeOf(value);
  const keys = Reflect.ownKeys(value);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.length !== fields.length ||
    fields.some((key) => !Object.hasOwn(value, key)) ||
    keys.some(
      (key) =>
        typeof key !== "string" ||
        !fields.includes(key) ||
        !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, "value"),
    )
  )
    throw new Error(
      "Ungültige Stadteingabe: unbekannte oder berechnete Felder.",
    );
  return value as Record<string, unknown>;
}
export function cityInputPoint(value: unknown): Point {
  const d = cityInputRecord(value, ["x", "y"]);
  if (
    typeof d.x !== "number" ||
    typeof d.y !== "number" ||
    !Number.isFinite(d.x) ||
    !Number.isFinite(d.y)
  )
    throw new Error("Ungültige Stadteingabe: Punkt ist nicht endlich.");
  return Object.freeze({ x: d.x, y: d.y });
}
