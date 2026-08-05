/** Keeps renderer writes ordered while allowing failures to be handled per command. */
export class HexCommandQueue {
  private tail: Promise<void> = Promise.resolve()

  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation, operation)
    this.tail = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }
}
