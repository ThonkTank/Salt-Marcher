import {
  parseDocument,
  safePath,
  serializeDocument,
  validateDocument,
} from "./model";
import { Session, type DraftState } from "./session";

/** Compare/write must be serialized per path by the host; no multi-file atomicity is assumed. */
export interface FileStore {
  read(path: string): Promise<string | null>;
  compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ): Promise<void>;
}
export class FileConflict extends Error {
  constructor(readonly path: string) {
    super("Extern geändert: " + path);
  }
}
interface Write {
  path: string;
  before: string | null;
  after: string | null;
}
interface Journal {
  version: 1;
  mapPath: string;
  state: "prepared" | "committed";
  writes: Write[];
}
interface SavedDraft {
  version: 1;
  mapPath: string;
  baseline: string;
  draft: DraftState;
}
export class MapRepository {
  private baseline: string | null = null;
  private busy = false;
  private recoveryRequired = false;
  private queue: Promise<unknown> = Promise.resolve();
  readonly journalPath: string;
  readonly draftPath: string;
  constructor(
    readonly store: FileStore,
    readonly mapPath: string,
  ) {
    safePath(mapPath);
    this.journalPath = mapPath + ".journal";
    this.draftPath = mapPath + ".draft";
  }
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  private assertAllowed(path: string): void {
    safePath(path);
    const root = this.mapPath.slice(0, this.mapPath.lastIndexOf("/") + 1);
    if (
      path !== this.mapPath &&
      (!path.startsWith(root) ||
        !path.endsWith(".md") ||
        path.split("/").some((p) => p.startsWith(".")))
    )
      throw new Error("Unzulässige Datei im Speicherjournal: " + path);
  }
  async open(): Promise<Session> {
    await this.recover();
    const raw = await this.store.read(this.mapPath);
    if (raw === null) throw new Error("Karte nicht gefunden.");
    this.baseline = raw;
    const saved = await this.store.read(this.draftPath);
    if (saved === null) return new Session(parseDocument(raw));
    const data = JSON.parse(saved) as SavedDraft;
    if (
      data.version !== 1 ||
      data.mapPath !== this.mapPath ||
      !data.draft ||
      !Array.isArray(data.draft.notes)
    )
      throw new Error("Unlesbarer Entwurf; Datei unverändert erhalten.");
    validateDocument(data.draft.document);
    const currentNotes = new Map<string, string | null>();
    for (const n of data.draft.notes) {
      this.assertAllowed(n.path);
      currentNotes.set(n.path, await this.store.read(n.path));
    }
    // A crash after commit may leave the already-saved draft behind. Retire it
    // only when every value, including all Markdown bytes, is actually on disk.
    if (
      serializeDocument(data.draft.document) === raw &&
      data.draft.notes.every((n) => currentNotes.get(n.path) === n.current)
    ) {
      await this.store.compareAndWrite(this.draftPath, saved, null);
      return new Session(parseDocument(raw));
    }
    if (data.baseline !== raw) throw new FileConflict(this.draftPath);
    for (const n of data.draft.notes)
      if (currentNotes.get(n.path) !== n.base) throw new FileConflict(n.path);
    return Session.restore(parseDocument(raw), data.draft);
  }
  persistDraft(session: Session): Promise<void> {
    return this.exclusive(() => this.persistDraftNow(session));
  }
  private async persistDraftNow(session: Session): Promise<void> {
    if (this.recoveryRequired)
      throw new Error("Speicherjournal muss zuerst wiederhergestellt werden.");
    const previous = await this.store.read(this.draftPath);
    if (!session.dirty) {
      if (previous !== null)
        await this.store.compareAndWrite(this.draftPath, previous, null);
      return;
    }
    if (this.baseline === null)
      throw new Error("Die neue Karte zuerst speichern.");
    const draft = session.draft();
    for (const n of draft.notes) this.assertAllowed(n.path);
    const next = JSON.stringify({
      version: 1,
      mapPath: this.mapPath,
      baseline: this.baseline,
      draft,
    } satisfies SavedDraft);
    if (next !== previous)
      await this.store.compareAndWrite(this.draftPath, previous, next);
  }
  async recover(): Promise<void> {
    const raw = await this.store.read(this.journalPath);
    if (raw === null) {
      this.recoveryRequired = false;
      return;
    }
    this.recoveryRequired = true;
    const j = JSON.parse(raw) as Journal;
    if (
      j.version !== 1 ||
      j.mapPath !== this.mapPath ||
      !["prepared", "committed"].includes(j.state) ||
      !Array.isArray(j.writes) ||
      !j.writes.length ||
      new Set(j.writes.map((w) => w.path)).size !== j.writes.length
    )
      throw new Error("Unlesbares Speicherjournal; unverändert erhalten.");
    for (const w of j.writes) {
      this.assertAllowed(w.path);
      if (
        ![w.before, w.after].every((s) => s === null || typeof s === "string")
      )
        throw new Error("Ungültiger Journalinhalt.");
    }
    if (j.state === "prepared") {
      // Check all targets before rollback. Never overwrite an unrelated external edit.
      for (const w of j.writes) {
        const current = await this.store.read(w.path);
        if (current !== w.before && current !== w.after)
          throw new FileConflict(w.path);
      }
      for (const w of [...j.writes].reverse())
        if ((await this.store.read(w.path)) === w.after)
          await this.store.compareAndWrite(w.path, w.after, w.before);
    }
    await this.store.compareAndWrite(this.journalPath, raw, null);
    this.recoveryRequired = false;
  }
  async loadNote(session: Session, path: string): Promise<void> {
    this.assertAllowed(path);
    session.loadNote(path, await this.store.read(path));
  }
  save(session: Session): Promise<void> {
    return this.exclusive(() => this.saveNow(session));
  }
  private async saveNow(session: Session): Promise<void> {
    if (this.busy) throw new Error("Speichern läuft bereits.");
    if (this.recoveryRequired)
      throw new Error(
        "Vor erneutem Speichern ist die Wiederherstellung erforderlich.",
      );
    this.busy = true;
    try {
      const snapshot = session.snapshot(),
        mapText = serializeDocument(snapshot.document),
        writes: Write[] = [];
      for (const [path, after] of snapshot.notes) {
        this.assertAllowed(path);
        const before = session.noteBaseline(path);
        if (before === undefined) throw new Error("Textbasis fehlt.");
        if (before !== after) writes.push({ path, before, after });
      }
      if (mapText !== this.baseline)
        writes.push({
          path: this.mapPath,
          before: this.baseline,
          after: mapText,
        });
      if (!writes.length) {
        await this.persistDraftNow(session);
        return;
      }
      for (const w of writes)
        if ((await this.store.read(w.path)) !== w.before)
          throw new FileConflict(w.path);
      const journal: Journal = {
        version: 1,
        mapPath: this.mapPath,
        state: "prepared",
        writes,
      };
      const prepared = JSON.stringify(journal);
      await this.store.compareAndWrite(this.journalPath, null, prepared);
      this.recoveryRequired = true;
      try {
        for (const w of writes)
          await this.store.compareAndWrite(w.path, w.before, w.after);
        const committed = JSON.stringify({ ...journal, state: "committed" });
        await this.store.compareAndWrite(this.journalPath, prepared, committed);
        this.baseline = mapText;
        session.markSaved(snapshot);
        // A failed cleanup is recoverable as committed; do not roll back a completed save.
        await this.store.compareAndWrite(this.journalPath, committed, null);
        this.recoveryRequired = false;
      } catch (error) {
        try {
          await this.recover();
        } catch (recovery) {
          throw new AggregateError(
            [error, recovery],
            "Speicherung unterbrochen. Journal erhalten; fremde Änderungen bleiben geschützt.",
          );
        }
        throw error;
      }
      await this.persistDraftNow(session);
    } finally {
      this.busy = false;
    }
  }
}
