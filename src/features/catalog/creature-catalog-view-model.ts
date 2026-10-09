export type CatalogTimer = ReturnType<typeof setTimeout>;
export type CatalogSchedule = (callback: () => void, milliseconds: number) => CatalogTimer;
export type CatalogCancel = (timer: CatalogTimer) => void;

export class CreatureCatalogDebouncer {
  private timer?: CatalogTimer;
  private generation = 0;

  constructor(
    private readonly delay = 200,
    private readonly scheduleTimer: CatalogSchedule = (callback, milliseconds) =>
      setTimeout(callback, milliseconds),
    private readonly cancelTimer: CatalogCancel = (timer) => clearTimeout(timer),
  ) {}

  schedule(publish: () => void): void {
    const generation = ++this.generation;
    if (this.timer !== undefined) {
      const cancelTimer = this.cancelTimer;
      cancelTimer(this.timer);
    }
    const scheduleTimer = this.scheduleTimer;
    this.timer = scheduleTimer(() => {
      this.timer = undefined;
      if (generation === this.generation) publish();
    }, this.delay);
  }

  flush(publish: () => void): void {
    this.cancelPending();
    publish();
  }

  dispose(): void {
    this.cancelPending();
  }

  private cancelPending(): void {
    this.generation++;
    if (this.timer !== undefined) {
      const cancelTimer = this.cancelTimer;
      cancelTimer(this.timer);
    }
    this.timer = undefined;
  }
}
