export interface KeyPlanReturn {
  label: string;
  current: () => boolean;
  leave: () => void;
  restore: () => Promise<boolean>;
}
interface Options {
  prepare: () => Promise<KeyPlanReturn | null>;
  open: (id: string, current: () => boolean) => Promise<boolean>;
  showKey: () => void;
  tell: (text: string, error?: boolean) => void;
}
/** Owns only a navigation return path; all text uses its existing writers. */
export class KeyPlanContext {
  private epoch = 0;
  private back: KeyPlanReturn | null = null;
  private task: Promise<void> | null = null;
  constructor(
    private button: HTMLButtonElement,
    private options: Options,
  ) {
    button.hidden = true;
    button.onclick = () => {
      void this.returnToKey();
    };
  }
  reset() {
    this.epoch++;
    this.back = null;
    this.task = null;
    this.button.hidden = true;
    this.button.disabled = false;
  }
  private current(epoch: number, back: KeyPlanReturn) {
    return this.epoch === epoch && this.back === back && back.current();
  }
  private sync() {
    if (this.back && !this.back.current()) this.back = null;
    this.button.hidden = !this.back;
    this.button.disabled = !!this.task;
  }
  async open(id: string) {
    if (this.task) return this.task;
    const epoch = ++this.epoch;
    const task = (async () => {
      try {
        const back = await this.options.prepare();
        if (this.epoch !== epoch || !back?.current()) return;
        this.back = back;
        this.button.textContent = 'Zum Raum-Key: ' + back.label;
        this.sync();
        back.leave();
        try {
          await this.options.open(id, () => this.current(epoch, back));
        } catch (error) {
          if (!this.current(epoch, back)) return;
          if ((await back.restore()) && this.current(epoch, back)) {
            this.options.showKey();
            this.back = null;
          }
          if (this.epoch === epoch) this.options.tell((error as Error).message, true);
        }
      } catch (error) {
        if (this.epoch === epoch) this.options.tell((error as Error).message, true);
      }
    })();
    this.task = task;
    this.sync();
    try {
      await task;
    } finally {
      if (this.task === task) {
        this.task = null;
        this.sync();
      }
    }
  }
  async returnToKey() {
    if (this.task) return;
    const back = this.back,
      epoch = this.epoch;
    if (!back?.current()) {
      this.reset();
      return;
    }
    const task = (async () => {
      try {
        if ((await back.restore()) && this.current(epoch, back)) {
          this.options.showKey();
          this.back = null;
        }
      } catch (error) {
        if (this.current(epoch, back)) this.options.tell((error as Error).message, true);
      }
    })();
    this.task = task;
    this.sync();
    try {
      await task;
    } finally {
      if (this.task === task) {
        this.task = null;
        this.sync();
      }
    }
  }
}
