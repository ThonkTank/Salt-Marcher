import { safePath } from "../../model";
import { FileConflict, type FileStore } from "../../persistence";

export interface AtlasFileWrite {
  readonly path: string;
  readonly before: string | null;
  readonly after: string | null;
}
export interface AtlasFileJournal {
  readonly kind: "atlas-file-transaction";
  readonly version: 1;
  readonly journalPath: string;
  readonly transactionId: string;
  readonly state: "prepared" | "committed";
  readonly writes: readonly AtlasFileWrite[];
}
export type AtlasRecovery = "none" | "rolled_back" | "committed";
export interface AtlasFileRollbackReceipt {
  readonly transactionId: string;
  readonly outcome: "rolled_back";
  readonly journalState: "absent";
  readonly writes: readonly (AtlasFileWrite & { readonly current: string | null })[];
}
export interface AtlasFileTransactionObserver {
  prepared(journal: AtlasFileJournal): void | Promise<void>;
  committed(journal: AtlasFileJournal): void | Promise<void>;
  rolledBack(receipt: AtlasFileRollbackReceipt): void | Promise<void>;
}
const queues = new WeakMap<object, Map<string, Promise<unknown>>>();

/**
 * Recoverable multi-file save over the existing serialized Compare/Write contract.
 * This does not promise filesystem fsync/TOCTOU guarantees. Hosts share one scope per backend.
 */
export class FileTransaction {
  private readonly rollbackReceipts = new WeakSet<object>();
  constructor(
    readonly store: FileStore,
    readonly journalPath: string,
    private allowed: (path: string) => boolean,
    private serializationScope: object = store,
    private recoveryValidator?: (
      journal: AtlasFileJournal,
    ) => void | Promise<void>,
    private assertCurrent: () => void = () => {},
  ) {
    safePath(journalPath);
  }
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    let queue = queues.get(this.serializationScope);
    if (!queue) queues.set(this.serializationScope, (queue = new Map()));
    const result = (queue.get(this.journalPath) ?? Promise.resolve()).then(
      () => { this.assertCurrent(); return operation(); },
    );
    queue.set(
      this.journalPath,
      result.catch(() => {}),
    );
    return result;
  }
  private writes(raw: readonly AtlasFileWrite[]): readonly AtlasFileWrite[] {
    if (!Array.isArray(raw) || Object.keys(raw).length !== raw.length)
      throw new Error("Ungültige Dateiänderungen.");
    const paths = new Set<string>();
    return Object.freeze(
      raw.map((value) => {
        if (
          !value ||
          typeof value !== "object" ||
          Object.keys(value).length !== 3 ||
          !["path", "before", "after"].every((k) => Object.hasOwn(value, k)) ||
          typeof value.path !== "string" ||
          ![value.before, value.after].every(
            (v) => v === null || typeof v === "string",
          )
        )
          throw new Error("Ungültiger Speicherjournalinhalt.");
        const path = safePath(value.path);
        if (path === this.journalPath || !this.allowed(path) || paths.has(path))
          throw new Error("Unzulässiges oder doppeltes Speicherziel.");
        paths.add(path);
        return Object.freeze({
          path,
          before: value.before,
          after: value.after,
        });
      }),
    );
  }
  private parse(raw: string): AtlasFileJournal {
    const j = JSON.parse(raw) as AtlasFileJournal;
    if (
      !j ||
      typeof j !== "object" ||
      Object.keys(j).length !== 6 ||
      ![
        "kind",
        "version",
        "journalPath",
        "transactionId",
        "state",
        "writes",
      ].every((k) => Object.hasOwn(j, k))
    )
      throw new Error("Unlesbares Speicherjournal; Datei bleibt erhalten.");
    if (
      j.kind !== "atlas-file-transaction" ||
      j.version !== 1 ||
      j.journalPath !== this.journalPath ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        j.transactionId,
      ) ||
      !["prepared", "committed"].includes(j.state)
    )
      throw new Error("Unlesbares Speicherjournal; Datei bleibt erhalten.");
    const writes = this.writes(j.writes);
    if (!writes.length)
      throw new Error("Leeres Speicherjournal; Datei bleibt erhalten.");
    return Object.freeze({ ...j, writes });
  }
  recover(
    validate?: (journal: AtlasFileJournal) => void | Promise<void>,
  ): Promise<AtlasRecovery> {
    return this.exclusive(() => this.recoverNow(validate));
  }
  private async recoverNow(
    validate?: (journal: AtlasFileJournal) => void | Promise<void>,
  ): Promise<AtlasRecovery> {
    const raw = await this.store.read(this.journalPath);
    if (raw === null) return "none";
    const journal = this.parse(raw);
    // The owner validates this exact parsed journal inside the recovery queue.
    await this.recoveryValidator?.(journal);
    if (validate !== this.recoveryValidator) await validate?.(journal);
    if ((await this.store.read(this.journalPath)) !== raw)
      throw new FileConflict(this.journalPath);
    // Validate every target before repairing any; unknown external bytes stay untouched.
    for (const write of journal.writes) {
      const value = await this.store.read(write.path);
      if (
        journal.state === "committed"
          ? value !== write.after
          : value !== write.before && value !== write.after
      )
        throw new FileConflict(write.path);
    }
    // Once repair begins it belongs to this journal's old identity and must finish there.
    this.assertCurrent();
    if (journal.state === "prepared") {
      for (const write of [...journal.writes].reverse()) {
        const value = await this.store.read(write.path);
        if (value !== write.before && value !== write.after)
          throw new FileConflict(write.path);
        if (value === write.after && value !== write.before)
          await this.store.compareAndWrite(write.path, value, write.before);
      }
    }
    await this.store.compareAndWrite(this.journalPath, raw, null);
    return journal.state === "committed" ? "committed" : "rolled_back";
  }
  validateRollbackReceipt(receipt: AtlasFileRollbackReceipt): void {
    if (!this.rollbackReceipts.has(receipt))
      throw new Error("Rollback-Receipt stammt nicht aus dieser Dateitransaktion.");
  }
  commit(writes: readonly AtlasFileWrite[], observer?: AtlasFileTransactionObserver): Promise<boolean> {
    // Capture caller values before waiting for an older operation.
    const snapshot = this.writes(writes);
    return this.exclusive(async () => {
      await this.recoverNow();
      for (const write of snapshot)
        if ((await this.store.read(write.path)) !== write.before)
          throw new FileConflict(write.path);
      this.assertCurrent();
      const changed = snapshot.filter((write) => write.before !== write.after);
      if (!changed.length) return false;
      const journal: AtlasFileJournal = {
        kind: "atlas-file-transaction",
        version: 1,
        journalPath: this.journalPath,
        transactionId: crypto.randomUUID(),
        state: "prepared",
        writes: changed,
      };
      const prepared = JSON.stringify(journal),
        committed = JSON.stringify({ ...journal, state: "committed" });
      let commitAcknowledged = false;
      let preparedObserved = false;
      let wonCommitted: AtlasFileJournal | undefined;
      const observePrepared = async () => {
        if (!observer || preparedObserved) return;
        if (await this.store.read(this.journalPath) !== prepared)
          throw new FileConflict(this.journalPath);
        preparedObserved = true;
        await observer.prepared(this.parse(prepared));
      };
      const observeCommitted = async () => {
        if (!observer) return;
        if (await this.store.read(this.journalPath) !== committed)
          throw new FileConflict(this.journalPath);
        wonCommitted = this.parse(committed);
      };
      try {
        this.assertCurrent();
        await this.store.compareAndWrite(this.journalPath, null, prepared);
        await observePrepared();
        for (const write of changed)
          await this.store.compareAndWrite(
            write.path,
            write.before,
            write.after,
          );
        await this.store.compareAndWrite(this.journalPath, prepared, committed);
        commitAcknowledged = true;
        await observeCommitted();
        await this.store.compareAndWrite(this.journalPath, committed, null);
      } catch (error) {
        try {
          const current = await this.store.read(this.journalPath);
          if (current !== null && current !== prepared && current !== committed)
            throw new FileConflict(this.journalPath);
          if (current === prepared) await observePrepared();
          if (current === committed) await observeCommitted();
          const recovered = await this.recoverNow();
          const saved = recovered === "committed" || (recovered === "none" && commitAcknowledged);
          if (!saved) {
            if (observer && preparedObserved && recovered === "rolled_back") {
              // Guard the entire original closure, including unchanged native files.
              for (const write of snapshot)
                if (await this.store.read(write.path) !== write.before) throw new FileConflict(write.path);
              if (await this.store.read(this.journalPath) !== null) throw new FileConflict(this.journalPath);
              const receipt: AtlasFileRollbackReceipt = Object.freeze({
                transactionId: journal.transactionId, outcome: "rolled_back", journalState: "absent",
                writes: Object.freeze(changed.map((write) => Object.freeze({ ...write, current: write.before }))),
              });
              this.rollbackReceipts.add(receipt);
              await observer.rolledBack(receipt);
            }
          } else commitAcknowledged = true;
        } catch (recovery) {
          throw new AggregateError(
            [error, recovery],
            "Speicherung unterbrochen. Journal und fremde Änderungen bleiben erhalten.",
          );
        }
        if (!commitAcknowledged) throw error;
      }
      // Notification failure cannot turn a won canonical save into a rollback.
      if (observer) {
        if (!wonCommitted) throw new Error("Gewonnene Speicherung besitzt kein zurückgelesenes Commitjournal.");
        await observer.committed(wonCommitted);
      }
      return true;
    });
  }
}
