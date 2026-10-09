export type CatalogTimer = ReturnType<typeof setTimeout>;
export type CatalogSchedule = (callback: () => void, milliseconds: number) => CatalogTimer;
export type CatalogCancel = (timer: CatalogTimer) => void;

export class CreatureCatalogDebouncer {
  private timer?: CatalogTimer;
  private generation = 0;

  constructor(
    private readonly delay = 200,
    private readonly scheduleTimer: CatalogSchedule = setTimeout,
    private readonly cancelTimer: CatalogCancel = clearTimeout,
  ) {}

  schedule(publish: () => void): void {
    const generation = ++this.generation;
    if (this.timer !== undefined) this.cancelTimer(this.timer);
    this.timer = this.scheduleTimer(() => {
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
    if (this.timer !== undefined) this.cancelTimer(this.timer);
    this.timer = undefined;
  }
}
