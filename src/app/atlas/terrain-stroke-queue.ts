import type { AtlasCommitAck } from './campaign-atlas-contracts';
import type { TerrainLiveAction, TerrainLiveContext } from './terrain-live-stroke';

type Source = Pick<TerrainLiveContext, 'expectedRevision' | 'sourceFence'>;
type FailureKind = 'unknown' | 'rejected' | 'source';
type Entry = {
  id: string;
  action: TerrainLiveAction;
  context?: TerrainLiveContext;
  resolve: () => void;
  reject: (error: unknown) => void;
  completion: Promise<void>;
};
export class TerrainStrokeWriteError extends Error {
  constructor(
    message: string,
    readonly outcome: 'unknown' | 'rejected',
  ) {
    super(message);
  }
}
export class TerrainStrokeDiscardedError extends Error {}

/** Closed gestures remain owned here through unknown receipts and failed reads.
 * Only an explicit rejection discard can remove an unconfirmed gesture. */
export class TerrainStrokeQueue {
  private entries: Entry[] = [];
  private running: Promise<void> | null = null;
  private error: unknown;
  private kind: FailureKind | null = null;
  private source: Source;
  private receipt: AtlasCommitAck | null = null;
  get confirmedReceipt() {
    return this.receipt ? { ...this.receipt } : null;
  }
  get confirmedSource() {
    return { ...this.source };
  }
  get pending() {
    return this.entries.length;
  }
  get failed() {
    return this.kind !== null;
  }
  get failureKind() {
    return this.kind;
  }
  get hasCapacity() {
    return this.entries.length < 32;
  }
  get head() {
    const first = this.entries[0];
    return first
      ? structuredClone({ id: first.id, action: first.action, context: first.context })
      : null;
  }
  constructor(
    source: Source,
    private write: (a: TerrainLiveAction, c: TerrainLiveContext) => Promise<AtlasCommitAck>,
    private accepted: (ack: AtlasCommitAck) => void = () => {},
  ) {
    this.source = { ...source };
  }
  enqueue(action: TerrainLiveAction, id: string): Promise<void> {
    const existing = this.entries.find((e) => e.id === id);
    if (existing) {
      if (JSON.stringify(existing.action) !== JSON.stringify(action))
        return Promise.reject(Error('Pinselzugkennung bereits mit anderen Eingaben belegt.'));
      return existing.completion;
    }
    if (!this.hasCapacity)
      return Promise.reject(
        Error(
          '32 Pinselzüge warten. Zuerst Speicherstand klären; alle gehaltenen Züge bleiben erhalten.',
        ),
      );
    let resolve!: () => void, reject!: (error: unknown) => void;
    const completion = new Promise<void>((a, b) => {
      resolve = a;
      reject = b;
    });
    this.entries.push({ id, action: structuredClone(action), resolve, reject, completion });
    this.start();
    return completion;
  }
  private start() {
    if (this.running || this.failed || !this.entries.length) return;
    this.running = this.pump().finally(() => {
      this.running = null;
      this.start();
    });
  }
  private async pump() {
    while (this.entries.length && !this.failed) {
      const entry = this.entries[0]!;
      entry.context ??= { id: entry.id, commandId: entry.id, ...this.source };
      try {
        const ack = await this.write(structuredClone(entry.action), { ...entry.context });
        if (
          !ack.sourceFence ||
          !Number.isSafeInteger(ack.revision) ||
          ack.revision < this.source.expectedRevision
        )
          throw new TerrainStrokeWriteError(
            'Speicherbestätigung des Pinselzugs unvollständig. Speicherstand klären.',
            'unknown',
          );
        this.source = { expectedRevision: ack.revision, sourceFence: ack.sourceFence };
        this.receipt = { ...ack };
        this.accepted(ack);
        this.entries.shift();
        entry.resolve();
      } catch (error) {
        this.error = error;
        this.kind = error instanceof TerrainStrokeWriteError ? error.outcome : 'unknown';
        // A rejected promise can show the error; its immutable entry remains.
        entry.reject(error);
      }
    }
  }
  confirm(ack: AtlasCommitAck) {
    const entry = this.entries[0];
    if (this.kind !== 'unknown' || !entry || ack.commandId !== entry.context?.commandId)
      throw Error('Pinselbestätigung gehört nicht zum gehaltenen Auftrag.');
    if (!Number.isSafeInteger(ack.revision) || ack.revision < this.source.expectedRevision)
      throw Error('Bestätigte Geländequelle prüfen.');
    this.accepted(ack);
    this.receipt = { ...ack };
    this.entries.shift();
    entry.resolve();
    this.source = { expectedRevision: ack.revision, sourceFence: '' };
    this.kind = 'source';
    this.error = Error(
      'Gespeichert. Aktuelle Geländequelle noch laden; Folgezüge bleiben erhalten.',
    );
  }
  notApplied() {
    if (this.kind !== 'unknown') throw Error('Kein unbekannter Pinselauftrag.');
    this.kind = 'rejected';
    this.error = Error(
      'Pinselzug wurde nicht gespeichert. Gehaltene Züge erneut speichern oder verwerfen.',
    );
  }
  sourceConflict() {
    if (
      this.kind !== 'source' ||
      !this.entries.length ||
      this.entries.some((entry) => entry.context)
    )
      throw Error('Nur ungesendete Folgezüge dürfen auf eine andere Quelle gesetzt werden.');
    this.kind = 'rejected';
    this.error = Error(
      'Gelände inzwischen geändert. Gehaltene Folgezüge erneut speichern oder verwerfen.',
    );
  }
  private checkedSource(source: Source) {
    if (
      !source.sourceFence ||
      !Number.isSafeInteger(source.expectedRevision) ||
      source.expectedRevision < this.source.expectedRevision
    )
      throw Error('Aktuelle Geländequelle fehlt. Gehaltene Züge bleiben erhalten.');
    return { ...source };
  }
  resume(source: Source) {
    if (this.kind !== 'source') throw Error('Zuerst Ausgang des Pinselauftrags klären.');
    this.source = this.checkedSource(source);
    this.kind = null;
    this.error = undefined;
    this.start();
  }
  retry(source: Source) {
    if (this.kind !== 'rejected')
      throw Error('Nur sicher abgewiesene Züge dürfen erneut gespeichert werden.');
    const current = this.checkedSource(source);
    if (this.entries[0]) this.entries[0].context = undefined;
    this.source = current;
    this.kind = null;
    this.error = undefined;
    this.start();
  }
  discard(source: Source) {
    if (this.kind !== 'rejected')
      throw Error('Unbekannte Pinselaufträge können nicht verworfen werden.');
    this.source = this.checkedSource(source);
    for (const entry of this.entries)
      entry.reject(new TerrainStrokeDiscardedError('Gehaltene Pinselzüge ausdrücklich verworfen.'));
    this.entries = [];
    this.kind = null;
    this.error = undefined;
  }
  async finish(): Promise<void> {
    await this.running;
    if (this.failed) throw this.error;
    if (this.entries.length) return this.finish();
  }
}

/** Storage starts only at pointer-up. Escape cannot cancel a released entry. */
export class TerrainDraftStroke {
  private action: TerrainLiveAction | null = null;
  private completed: Promise<void> | null = null;
  hasCommittedChanges = false;
  constructor(private commit: (action: TerrainLiveAction) => Promise<void>) {}
  update(action: TerrainLiveAction) {
    if (!this.completed) this.action = structuredClone(action);
  }
  finish() {
    return (this.completed ??= this.action
      ? this.commit(this.action).then(() => {
          this.hasCommittedChanges = true;
        })
      : Promise.resolve());
  }
  stop() {
    this.action = null;
    return this.completed ?? Promise.resolve();
  }
}
