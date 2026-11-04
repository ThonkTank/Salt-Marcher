/** One transport request may run at a time; only the newest unsent job survives. */
export class PreviewScheduler<T> {
  private running = false;
  private waiting: {
    valid: () => boolean;
    execute: () => Promise<T | null>;
    resolve: (value: T | null) => void;
  } | null = null;

  schedule(
    valid: () => boolean,
    execute: () => Promise<T | null>,
  ): Promise<T | null> {
    this.cancelWaiting();
    return new Promise((resolve) => {
      this.waiting = { valid, execute, resolve };
      this.pump();
    });
  }

  cancelWaiting() {
    const waiting = this.waiting;
    this.waiting = null;
    waiting?.resolve(null);
  }

  private pump() {
    if (this.running || !this.waiting) return;
    const job = this.waiting;
    this.waiting = null;
    if (!job.valid()) {
      job.resolve(null);
      this.pump();
      return;
    }
    this.running = true;
    void (async () => {
      try {
        job.resolve(await job.execute());
      } catch {
        job.resolve(null);
      } finally {
        this.running = false;
        this.pump();
      }
    })();
  }
}
