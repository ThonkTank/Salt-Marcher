/** An async operation owns this activation and view, not merely an entity ID. */
export function captureView(
  read: () => readonly unknown[],
  valid: () => boolean = () => true,
): () => boolean {
  const identity = [...read()];
  return () => {
    const now = read();
    return (
      valid() &&
      identity.length === now.length &&
      identity.every((value, index) => Object.is(value, now[index]))
    );
  };
}

/** Accept a confirmed basis while retaining only editable fields changed after send.
 * Identity, revision and other canonical fields always come from the confirmation.
 * Callers keep their domain-specific draft persistence and conflict policy.
 */
type ScalarField<T> = {
  [K in keyof T]: T[K] extends string | number | boolean | null | undefined ? K : never;
}[keyof T];
export function acknowledgeFields<T, K extends ScalarField<T>>(
  confirmed: T,
  sent: T,
  current: T,
  fields: readonly K[],
): { basis: T; value: T; dirty: boolean } {
  const value = { ...confirmed };
  let dirty = false;
  for (const field of fields) {
    if (!Object.is(current[field], sent[field])) value[field] = current[field];
    if (!Object.is(value[field], confirmed[field])) dirty = true;
  }
  return { basis: confirmed, value, dirty };
}
