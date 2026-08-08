export type SubmissionPhase =
  | 'idle'
  | 'saving'
  | 'persisted'
  | 'reconciled'
  | 'mutation-failed'
  | 'reconciliation-failed'

export type PersistedSubmissionOutcome<Value> =
  | Readonly<{ status: 'ignored' }>
  | Readonly<{ status: 'mutation-failed'; cause: unknown }>
  | Readonly<{ status: 'reconciled'; value: Value }>
  | Readonly<{
      status: 'reconciliation-failed'
      value: Value
      cause: unknown
    }>

/**
 * Owns the irreversible boundary between a mutation and UI reconciliation.
 * A persisted value is retained so reconciliation can be retried without ever
 * executing the mutation again.
 */
export class PersistedSubmissionLifecycle<Value> {
  #phase: SubmissionPhase = 'idle'
  #value: Value | null = null

  public get phase(): SubmissionPhase {
    return this.#phase
  }

  public get persistedValue(): Value | null {
    return this.#value
  }

  public beginMutation(): boolean {
    if (this.#phase !== 'idle' && this.#phase !== 'mutation-failed')
      return false
    this.#phase = 'saving'
    return true
  }

  public mutationFailed(): void {
    if (this.#phase === 'saving') this.#phase = 'mutation-failed'
  }

  public persisted(value: Value): void {
    if (this.#phase !== 'saving')
      throw new Error('Submission persistence completed outside saving.')
    this.#value = value
    this.#phase = 'persisted'
  }

  public beginReconciliation(): Value | null {
    if (
      (this.#phase !== 'persisted' &&
        this.#phase !== 'reconciliation-failed') ||
      this.#value === null
    )
      return null
    return this.#value
  }

  public reconciled(): void {
    if (this.#phase === 'persisted' || this.#phase === 'reconciliation-failed')
      this.#phase = 'reconciled'
  }

  public reconciliationFailed(): void {
    if (this.#phase === 'persisted' || this.#phase === 'reconciliation-failed')
      this.#phase = 'reconciliation-failed'
  }
}

export async function executePersistedSubmission<Value>(
  lifecycle: PersistedSubmissionLifecycle<Value>,
  persist: () => Promise<Value>,
  reconcile: (value: Value) => void | Promise<void>
): Promise<PersistedSubmissionOutcome<Value>> {
  if (!lifecycle.beginMutation()) return { status: 'ignored' }
  let value: Value
  try {
    value = await persist()
  } catch (cause) {
    lifecycle.mutationFailed()
    return { status: 'mutation-failed', cause }
  }
  lifecycle.persisted(value)
  return retryPersistedSubmissionReconciliation(lifecycle, reconcile)
}

export async function retryPersistedSubmissionReconciliation<Value>(
  lifecycle: PersistedSubmissionLifecycle<Value>,
  reconcile: (value: Value) => void | Promise<void>
): Promise<PersistedSubmissionOutcome<Value>> {
  const value = lifecycle.beginReconciliation()
  if (value === null) return { status: 'ignored' }
  try {
    await reconcile(value)
    lifecycle.reconciled()
    return { status: 'reconciled', value }
  } catch (cause) {
    lifecycle.reconciliationFailed()
    return { status: 'reconciliation-failed', value, cause }
  }
}
