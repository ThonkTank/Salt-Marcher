/** A missing receipt is inconclusive while asynchronous preparation can still commit. */
export class AtlasWriteActivity {
  private active = new Map<string, number>();
  has(commandId: string) { return this.active.has(commandId); }
  async run<T>(commandId: string, operation: () => T | Promise<T>): Promise<T> {
    this.active.set(commandId, (this.active.get(commandId) ?? 0) + 1);
    try { return await operation(); }
    finally {
      const remaining = this.active.get(commandId)! - 1;
      if (remaining) this.active.set(commandId, remaining);
      else this.active.delete(commandId);
    }
  }
}
