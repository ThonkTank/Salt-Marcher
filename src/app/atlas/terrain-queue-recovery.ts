/** One read-only recovery attempt at a time. Transient failures back off without
 * asking the author to resolve transport uncertainty or replaying a write. */
export class TerrainQueueRecovery {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private delay = 200;
  private generation = 0;
  constructor(
    private needed: () => boolean,
    private attempt: () => Promise<void>,
  ) {}
  schedule() {
    if (this.timer !== undefined || this.running || !this.needed()) return;
    const generation = this.generation;
    this.timer = setTimeout(async () => {
      this.timer = undefined;
      if (generation !== this.generation || !this.needed()) return;
      this.running = true;
      try {
        await this.attempt();
      } catch {
        // A read failure is still uncertainty; the next bounded attempt can recover.
      } finally {
        this.running = false;
        if (generation === this.generation) {
          this.delay = this.needed() ? Math.min(5000, this.delay * 2) : 200;
          this.schedule();
        }
      }
    }, this.delay);
  }
  stop() {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.delay = 200;
  }
}
