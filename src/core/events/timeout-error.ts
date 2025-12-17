/**
 * Error thrown when an EventBus request times out waiting for a response.
 *
 * Used by the request/response pattern in EventBus when no matching
 * response event is received within the specified timeout period.
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}
