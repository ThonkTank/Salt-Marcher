import type { EditorSession } from './editor-session';

export type EditorTransition = 'checkpoint' | 'navigation' | 'campaign' | 'close';
export type EditorBoundary = boolean | 'complete';
export type EditorRegistration<Context, Id extends string> = {
  id: Id;
  session?: EditorSession;
  activate?: { order: number; run: (context: Context) => void | Promise<void> };
  flush?: (reason: EditorTransition) => EditorBoundary | Promise<EditorBoundary>;
  deactivate?: () => void;
  suspendBeforeActivation?: boolean;
};

/** Ordered ownership table, shared by activation and every exit reason. A flush
 * is deliberately sequential: later writers may depend on earlier receipts. */
export class EditorRegistry<Context, Id extends string> {
  private inputRevision = 0;
  private contextRevision = 0;
  constructor(private readonly entries: readonly EditorRegistration<Context, Id>[]) {
    if (new Set(entries.map((e) => e.id)).size !== entries.length)
      throw new Error('Duplicate editor registration');
  }
  async activate(context: Context) {
    this.contextRevision++;
    for (const entry of [...this.entries].sort(
      (a, b) => (a.activate?.order ?? Infinity) - (b.activate?.order ?? Infinity),
    )) {
      await entry.activate?.run(context);
    }
  }
  async flush(reason: EditorTransition, only?: readonly Id[]): Promise<boolean> {
    if (only?.some((id) => !this.entries.some((entry) => entry.id === id)))
      throw new Error('Unregistered editor');
    const context = this.contextRevision;
    for (;;) {
      const input = this.inputRevision;
      for (const entry of this.entries) {
        if (only && !only.includes(entry.id)) continue;
        await entry.session?.settle();
        if (context !== this.contextRevision) return false;
        const result = await entry.flush?.(reason);
        if (result === false || context !== this.contextRevision) return false;
        await entry.session?.settle();
        if (context !== this.contextRevision) return false;
        if (result === 'complete') return true;
      }
      // A user can type into an earlier editor while a later one is saving.
      // Repeat in the same order before allowing navigation/close to discard it.
      if (input === this.inputRevision) return true;
    }
  }
  changed() {
    this.inputRevision++;
  }
  /** Silence native output while reading the new context. Keep the drained
   * source session attached until that read succeeds, so failed loads can retry. */
  suspend() {
    for (const entry of this.entries) if (entry.suspendBeforeActivation) entry.deactivate?.();
  }
  deactivate() {
    this.contextRevision++;
    for (const entry of this.entries) {
      entry.session?.deactivate();
      entry.deactivate?.();
    }
  }
  get status() {
    return this.entries.flatMap((entry) =>
      entry.session ? [{ id: entry.id, ...entry.session.status }] : [],
    );
  }
}
