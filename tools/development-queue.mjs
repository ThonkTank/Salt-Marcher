/** Coalesce saves; a superseded build returns false to retain all of its inputs. */
export class DevelopmentQueue {
  constructor(run, { delay = 80, onError = console.error } = {}) {
    this.run = run;
    this.delay = delay;
    this.onError = onError;
    this.pending = new Set();
    this.revision = 0;
    this.active = null;
    this.timer = null;
    this.stopped = false;
  }
  add(file) {
    if (this.stopped) return;
    this.pending.add(file);
    this.revision++;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.drain();
    }, this.delay);
  }
  async drain() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.active) return this.active;
    this.active = (async () => {
      while (!this.stopped && this.pending.size) {
        const files = [...this.pending];
        this.pending.clear();
        const revision = this.revision;
        try {
          const committed = await this.run(
            files,
            () => revision === this.revision && !this.stopped,
          );
          if (committed === false) for (const file of files) this.pending.add(file);
        } catch (error) {
          this.onError(error);
        }
      }
    })();
    try {
      await this.active;
    } finally {
      this.active = null;
    }
  }
  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.pending.clear();
    await this.active;
  }
}
