import {captureView} from './editor-transition';

/** DOM-free lifetime of an editor. Domain drafts and receipt decisions stay with
 * their owner; detaching a view never cancels an accepted storage operation. */
export class EditorSession {
  private epoch = 0;
  private attached = true;
  private readonly reads = new Set<AbortController>();
  private readonly operations = new Set<Promise<unknown>>();
  private readonly drafts: (() => EditorDraftStatus)[] = [];
  private readonly commands: EditorCommand<unknown>[] = [];
  private readonly detach = new Set<() => void>();
  readonly input = { version: 0, retained: 0 };

  get generation() { return this.epoch; }
  get reading() { return this.reads.size; }
  set generation(next: number) {
    if (!Number.isSafeInteger(next) || next <= this.epoch) throw new Error('Editor generation must advance');
    this.epoch = next;
    this.attached = true;
    for (const read of this.reads) read.abort();
    this.reads.clear();
  }

  /** Capture before awaiting a read, save or preview; test before publishing. */
  capture(read: () => readonly unknown[] = () => [], valid: () => boolean = () => true): () => boolean {
    return captureView(() => [this.epoch, ...read()], () => this.attached && valid());
  }

  /** Only cancellable reads/previews receive a signal. Writes have no signal. */
  read() {
    const controller = new AbortController(), current = this.capture();
    this.reads.add(controller);
    if (!this.attached) controller.abort();
    return { signal: controller.signal, current: () => current() && !controller.signal.aborted,
      finish: () => this.reads.delete(controller) };
  }

  deactivate() {
    this.generation++;
    this.attached = false;
    for (const cancel of this.detach) cancel();
  }
  onDeactivate(cancelReadOrTimer: () => void) { this.detach.add(cancelReadOrTimer); }

  operation<T extends Promise<unknown> | { task: Promise<unknown> }>() {
    return new EditorOperation<T>(task => { this.track(task); return () => this.operations.delete(task); });
  }
  /** Only the domain owner's matching receipt may clear this state. Rejected
   * or missing transport responses do not imply that the command was unapplied. */
  command<T>() {
    const command = new EditorCommand<T>();
    this.commands.push(command);
    return command;
  }

  /** Register synchronously, before dispatching work in the next microtask. */
  run<T>(dispatch: () => Promise<T>): Promise<T> {
    const task = Promise.resolve().then(dispatch);
    this.track(task);
    return task;
  }

  /** Reserve before synchronous dispatch. Draft queues use this to preserve
   * the first in-flight value when more input arrives in the same event turn. */
  start<T>(dispatch: () => Promise<T>): Promise<T> {
    let resolve!: (value: T | PromiseLike<T>) => void, reject!: (error: unknown) => void;
    const task = new Promise<T>((yes,no) => { resolve=yes; reject=no; });
    this.track(task);
    try { void dispatch().then(resolve,reject); } catch (error) { reject(error); }
    return task;
  }

  track<T>(task: Promise<T>): Promise<T> {
    this.operations.add(task);
    const settled = () => this.operations.delete(task);
    void task.then(settled, settled);
    return task;
  }

  /** Does not infer success from transport completion. The owner's flush and
   * receipt check decide whether a transition may proceed. */
  async settle(): Promise<void> {
    while (this.operations.size) await Promise.allSettled([...this.operations]);
  }

  observeDraft(status: () => EditorDraftStatus) { this.drafts.push(status); }
  get status(): EditorStatus {
    const states = this.drafts.map(read => read());
    return {
      attached: this.attached, generation: this.epoch, saving: this.operations.size > 0,
      openInput: this.input.version !== this.input.retained || states.some(s => s.openInput),
      retainedDraft: states.some(s => s.retainedDraft),
      unresolvedCommand: this.commands.some(c => c.value !== null) || states.some(s => s.unresolvedCommand),
    };
  }
}

export class EditorCommand<T> { value: T | null = null; }

export type EditorDraftStatus = {
  openInput: boolean;
  retainedDraft: boolean;
  unresolvedCommand: boolean;
};
export type EditorStatus = EditorDraftStatus & { attached: boolean; generation: number; saving: boolean };

/** The visible slot may be reset by a new selection; its accepted operation
 * remains in the session's drain set until it actually settles. */
export class EditorOperation<T extends Promise<unknown> | { task: Promise<unknown> }> {
  private selected: T | null = null;
  private readonly completions = new Map<T, () => void>();
  constructor(private readonly track: (task: Promise<unknown>) => () => void) {}
  get value(): T | null { return this.selected; }
  set value(value: T | null) {
    this.selected = value;
    if (value) {
      const task: Promise<unknown> = 'task' in value ? value.task : value as Promise<unknown>;
      this.completions.set(value, this.track(task));
      const settled = () => this.clear(value);
      void task.then(settled, settled);
    }
  }
  /** A matching owner may release its completed write before awaiting a
   * navigation callback. A context reset uses value=null, which keeps draining. */
  clear(value: T) {
    this.completions.get(value)?.();
    this.completions.delete(value);
    if (this.selected === value) this.selected = null;
  }
}
