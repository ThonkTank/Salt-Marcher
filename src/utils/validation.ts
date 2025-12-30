// Input-Validierung für CLI und Services
// Gibt hilfreiche Fehlermeldungen bei ungültigen Werten

/**
 * Prüft ob ein Wert in einer Liste gültiger Werte enthalten ist.
 * Wirft einen Error mit hilfreicher Fehlermeldung wenn nicht.
 *
 * @example
 * assertValidValue(timeSegment, TIME_SEGMENTS, 'timeSegment');
 * // Error: "day" ist kein gültiger Wert für timeSegment. Gültige Werte: dawn, morning, ...
 */
export function assertValidValue<T extends readonly string[]>(
  value: string,
  validValues: T,
  fieldName: string
): asserts value is T[number] {
  if (!validValues.includes(value as T[number])) {
    throw new Error(
      `"${value}" ist kein gültiger Wert für ${fieldName}. ` +
      `Gültige Werte: ${validValues.join(', ')}`
    );
  }
}
