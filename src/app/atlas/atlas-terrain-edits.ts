import { TerrainQueueRecovery } from './terrain-queue-recovery';
import {
  TerrainStrokeQueue,
  TerrainStrokeWriteError,
  TerrainStrokeDiscardedError,
} from './terrain-stroke-queue';
import type { AtlasCommitAck, AtlasCommitOutcome } from './campaign-atlas-contracts';
import type { TerrainLiveAction, TerrainLiveContext } from './terrain-live-stroke';

type Source = Pick<TerrainLiveContext, 'expectedRevision' | 'sourceFence'>;
export type AtlasTerrainOwner = Readonly<{ token: string; campaignId: string }>;
export type AtlasTerrainStatus = 'checking' | 'rejected' | 'discarded' | 'saved';
interface AtlasTerrainPorts {
  source(): Source | null;
  blocked(): boolean;
  painting(): boolean;
  write(
    owner: AtlasTerrainOwner,
    action: TerrainLiveAction,
    context: TerrainLiveContext,
  ): Promise<AtlasCommitAck>;
  receipt(
    owner: AtlasTerrainOwner,
    action: TerrainLiveAction,
    context: TerrainLiveContext,
  ): Promise<AtlasCommitOutcome>;
  readSource(owner: AtlasTerrainOwner): Promise<Source>;
  acceptReceipt(ack: AtlasCommitAck): void;
  reconcile(source: Source): void;
  releaseHeld(): void;
  refresh(): Promise<unknown>;
  status(status: AtlasTerrainStatus): void;
  redraw(): void;
}
/** Owns released terrain gestures, receipt recovery and the decision to replay/discard.
 * The surface and controls consume the view and request operations; only this owner
 * changes the queue. Hiding invalidates UI/read continuations, never accepted writes. */
export class AtlasTerrainEdits {
  private queue: TerrainStrokeQueue | null = null;
  private owner: AtlasTerrainOwner | null = null;
  private visible = false;
  private generation = 0;
  private automaticRetries = new Set<string>();
  private automaticRetryHead: string | null = null;
  private recovering = false;
  private recovery = new TerrainQueueRecovery(
    () =>
      this.visible &&
      !!this.owner &&
      (this.queue?.failureKind === 'unknown' ||
        this.queue?.failureKind === 'source' ||
        (!!this.automaticRetryHead && this.queue?.head?.id === this.automaticRetryHead)),
    () => this.resolve(),
  );
  constructor(private ports: AtlasTerrainPorts) {}
  get view() {
    return {
      pending: this.queue?.pending ?? 0,
      failed: this.queue?.failed ?? false,
      failureKind: this.queue?.failureKind ?? null,
      hasCapacity: this.queue?.hasCapacity ?? true,
      recovering: this.recovering,
    } as const;
  }
  /** Validate before Workbench publishes a new campaign. */
  activate(owner: AtlasTerrainOwner) {
    if (this.owner?.token === owner.token && this.owner.campaignId === owner.campaignId) return;
    if (this.queue?.pending || this.queue?.failed)
      throw Error('Gehaltene Pinselzüge vor dem Kampagnenwechsel klären.');
    this.hide();
    this.owner = owner;
    this.queue = null;
    this.automaticRetries.clear();
    this.automaticRetryHead = null;
  }
  open() {
    this.visible = true;
    this.recovery.schedule();
  }
  hide() {
    this.visible = false;
    this.generation++;
    this.recovery.stop();
  }
  notice() {
    this.ports.status(this.queue?.failureKind === 'rejected' ? 'rejected' : 'checking');
  }
  async enqueue(action: TerrainLiveAction, id: string) {
    const owner = this.owner,
      source = this.ports.source();
    if (!owner || !source) throw Error('Kartenausschnitt fehlt. Erneut laden.');
    if (
      this.queue &&
      !this.queue.pending &&
      !this.queue.failed &&
      source.expectedRevision >= this.queue.confirmedSource.expectedRevision
    )
      this.queue = null;
    const queue = (this.queue ??= new TerrainStrokeQueue(source, async (a, context) => {
      if (this.owner !== owner)
        throw new TerrainStrokeWriteError('Kampagne inzwischen gewechselt.', 'rejected');
      return this.ports.write(owner, a, context);
    }));
    const generation = this.generation;
    try {
      await queue.enqueue(action, id);
    } catch (error) {
      if (error instanceof TerrainStrokeDiscardedError) throw error;
      if (this.current(owner, queue, generation)) {
        this.notice();
        this.recovery.schedule();
        this.ports.redraw();
      }
      throw error;
    }
    if (
      this.current(owner, queue, generation) &&
      !queue.pending &&
      !this.ports.painting() &&
      !this.recovering
    )
      await this.publish(queue.confirmedSource);
  }
  private current(owner: AtlasTerrainOwner, queue: TerrainStrokeQueue, generation: number) {
    return (
      this.visible && this.owner === owner && this.queue === queue && this.generation === generation
    );
  }
  private async publish(source: Source) {
    this.ports.reconcile(source);
    await this.ports.refresh();
  }
  async gestureEnded() {
    const queue = this.queue;
    if (this.visible && queue && !queue.pending && !queue.failed && !this.recovering)
      await this.publish(queue.confirmedSource);
  }
  async drain() {
    if (this.queue?.failed) return false;
    try {
      await this.queue?.finish();
      return true;
    } catch {
      return false;
    }
  }
  /** History/recovery may release an empty settled queue, never held gestures. */
  releaseSettled() {
    if (this.queue?.pending || this.queue?.failed)
      throw Error('Gehaltene Pinselzüge zuerst klären.');
    this.queue = null;
  }
  retry() {
    return this.resolve('retry');
  }
  discard() {
    return this.resolve('discard');
  }
  async resolve(decision?: 'retry' | 'discard') {
    const queue = this.queue,
      owner = this.owner,
      generation = this.generation;
    if (
      !queue ||
      !owner ||
      !this.visible ||
      this.ports.blocked() ||
      this.ports.painting() ||
      this.recovering
    )
      return;
    this.recovering = true;
    const current = () => this.current(owner, queue, generation);
    let automaticRetry = !!this.automaticRetryHead && queue.head?.id === this.automaticRetryHead;
    try {
      if (queue.failureKind === 'unknown') {
        const head = queue.head;
        if (!head?.context) throw Error('Gehaltene Pinselkennung fehlt.');
        const result = await this.ports.receipt(owner, head.action, head.context);
        if (!current()) return;
        if (result.outcome === 'unknown')
          throw Error('Pinselauftrag läuft noch. Alle Züge bleiben gehalten.');
        if (result.outcome === 'not-applied') {
          queue.notApplied();
          automaticRetry = !this.automaticRetries.has(head.id);
          if (automaticRetry) this.automaticRetryHead = head.id;
        } else queue.confirm(result.ack);
      }
      if (queue.failureKind === 'rejected' && !decision && !automaticRetry) {
        this.notice();
        return;
      }
      const source = await this.ports.readSource(owner);
      if (!current()) return;
      if (automaticRetry) {
        const head = queue.head;
        if (
          head?.context?.expectedRevision !== source.expectedRevision ||
          head.context.sourceFence !== source.sourceFence
        ) {
          this.automaticRetryHead = null;
          this.notice();
          return;
        }
      }
      if (
        queue.failureKind === 'source' &&
        queue.pending &&
        source.expectedRevision !== queue.confirmedSource.expectedRevision
      ) {
        queue.sourceConflict();
        this.notice();
        return;
      }
      if (
        queue.failureKind === 'source' &&
        queue.confirmedReceipt?.revision === source.expectedRevision
      )
        this.ports.acceptReceipt({ ...queue.confirmedReceipt, sourceFence: source.sourceFence });
      if (decision === 'discard') {
        this.automaticRetryHead = null;
        queue.discard(source);
      } else {
        if (decision === 'retry' || automaticRetry) {
          if (automaticRetry && queue.head) this.automaticRetries.add(queue.head.id);
          this.automaticRetryHead = null;
          queue.retry(source);
        } else queue.resume(source);
        await queue.finish();
        if (!current()) return;
      }
      this.ports.releaseHeld();
      await this.publish(queue.confirmedSource);
      if (current()) this.ports.status(decision === 'discard' ? 'discarded' : 'saved');
    } catch {
      if (current()) this.notice();
    } finally {
      this.recovering = false;
      if (current()) this.ports.redraw();
      // Reopening during an old read creates a fresh generation. The old read's
      // completion releases the single recovery lane and schedules the new one.
      this.recovery.schedule();
    }
  }
}
