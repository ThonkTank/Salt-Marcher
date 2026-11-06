import {
  parseDocument,
  safePath,
  serializeDocument,
  type MapDocument,
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
interface PendingDraft {
  version: 2;
  kind: "pending";
  mapPath: string;
  initialDocument: MapDocument;
  draft: DraftState;
}
export class MapRepository {
  private baseline: string | null = null;
  private pendingInitial?: MapDocument;
  private pendingRaw?: string;
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
  private parsePending(raw: string): PendingDraft {
    const data = JSON.parse(raw) as PendingDraft;
    if (
      data.version !== 2 || data.kind !== "pending" ||
      data.mapPath !== this.mapPath || !data.initialDocument ||
      !data.draft || !Array.isArray(data.draft.notes)
    ) throw new Error("Unlesbarer neuer Kartenentwurf; Datei unverändert erhalten.");
    const initialDocument = parseDocument(JSON.stringify(data.initialDocument));
    const document = parseDocument(JSON.stringify(data.draft.document));
    if (initialDocument.id !== document.id)
      throw new Error("Neuer Kartenentwurf gehört zu einer anderen Karte.");
    for (const note of data.draft.notes) {
      this.assertAllowed(note.path);
      if (
        ![note.base, note.current].every((value) =>
          value === null || typeof value === "string")
      ) throw new Error("Ungültiger Text im neuen Kartenentwurf.");
    }
    return { ...data, initialDocument,
      draft: { ...data.draft, document } };
  }
  /** Begin a durable, fileless map. The normal map path remains absent. */
  beginPending(initialDocument: MapDocument, session: Session): Promise<void> {
    return this.exclusive(async () => {
      await this.recover();
      if (initialDocument.id !== session.id)
        throw new Error("Neue Karte und Sitzung passen nicht zusammen.");
      if (await this.store.read(this.mapPath) !== null)
        throw new FileConflict(this.mapPath);
      if (await this.store.read(this.draftPath) !== null)
        throw new FileConflict(this.draftPath);
      const initial = parseDocument(serializeDocument(initialDocument)),
        draft = session.draft();
      for (const note of draft.notes) this.assertAllowed(note.path);
      const next = JSON.stringify({ version: 2, kind: "pending",
        mapPath: this.mapPath, initialDocument: initial, draft } satisfies PendingDraft);
      await this.store.compareAndWrite(this.draftPath, null, next);
      this.pendingInitial = initial;
      this.pendingRaw = next;
    });
  }
  async openPending(): Promise<Session> {
    await this.recover();
    if (await this.store.read(this.mapPath) !== null)
      throw new FileConflict(this.mapPath);
    const raw = await this.store.read(this.draftPath);
    if (raw === null) throw new Error("Ungespeicherter Kartenentwurf nicht gefunden.");
    const data = this.parsePending(raw);
    for (const note of data.draft.notes)
      if (await this.store.read(note.path) !== note.base)
        throw new FileConflict(note.path);
    this.pendingInitial = data.initialDocument;
    this.pendingRaw = raw;
    return Session.restore(data.initialDocument, data.draft);
  }
  async open(): Promise<Session> {
    await this.recover();
    const raw = await this.store.read(this.mapPath);
    if (raw === null) throw new Error("Karte nicht gefunden.");
    this.baseline = raw;
    const saved = await this.store.read(this.draftPath);
    if (saved === null) return new Session(parseDocument(raw));
    const pending = JSON.parse(saved) as { version?: number };
    if (pending.version === 2) {
      const data = this.parsePending(saved);
      if (
        serializeDocument(data.draft.document) !== raw ||
        !(await Promise.all(data.draft.notes.map(async (note) =>
          (await this.store.read(note.path)) === note.current))).every(Boolean)
      ) throw new FileConflict(this.draftPath);
      await this.store.compareAndWrite(this.draftPath, saved, null);
      return new Session(parseDocument(raw));
    }
    const data = pending as SavedDraft;
    if (
      data.version !== 1 ||
      data.mapPath !== this.mapPath ||
      !data.draft ||
      !Array.isArray(data.draft.notes)
    )
      throw new Error("Unlesbarer Entwurf; Datei unverändert erhalten.");
    const draftDocument = parseDocument(JSON.stringify(data.draft.document));
    const currentNotes = new Map<string, string | null>();
    for (const n of data.draft.notes) {
      this.assertAllowed(n.path);
      currentNotes.set(n.path, await this.store.read(n.path));
    }
    // A crash after commit may leave the already-saved draft behind. Retire it
    // only when every value, including all Markdown bytes, is actually on disk.
    if (
      (serializeDocument(data.draft.document) === raw ||
        serializeDocument(draftDocument) === raw) &&
      data.draft.notes.every((n) => currentNotes.get(n.path) === n.current)
    ) {
      await this.store.compareAndWrite(this.draftPath, saved, null);
      return new Session(parseDocument(raw));
    }
    if (data.baseline !== raw) throw new FileConflict(this.draftPath);
    for (const n of data.draft.notes)
      if (currentNotes.get(n.path) !== n.base) throw new FileConflict(n.path);
    return Session.restore(parseDocument(raw), {
      ...data.draft,
      document: draftDocument,
    });
  }
  persistDraft(session: Session): Promise<void> {
    return this.exclusive(() => this.persistDraftNow(session));
  }
  private async persistPendingNow(draft: DraftState): Promise<void> {
    if (!this.pendingInitial || this.pendingRaw === undefined)
      throw new Error("Neuer Kartenentwurf nicht initialisiert.");
    if (draft.document.id !== this.pendingInitial.id)
      throw new Error("Entwurf gehört zu einer anderen Karte.");
    for (const note of draft.notes) this.assertAllowed(note.path);
    const next = JSON.stringify({ version: 2, kind: "pending",
      mapPath: this.mapPath, initialDocument: this.pendingInitial,
      draft } satisfies PendingDraft);
    const previous = await this.store.read(this.draftPath);
    if (previous !== this.pendingRaw) throw new FileConflict(this.draftPath);
    if (next !== previous) {
      await this.store.compareAndWrite(this.draftPath, previous, next);
      this.pendingRaw = next;
    }
  }
  private async persistDraftNow(session: Session): Promise<void> {
    if (this.recoveryRequired)
      throw new Error("Speicherjournal muss zuerst wiederhergestellt werden.");
    if (this.baseline === null && this.pendingInitial) {
      await this.persistPendingNow(session.draft());
      return;
    }
    const previous = await this.store.read(this.draftPath);
    if (this.pendingRaw !== undefined && previous !== this.pendingRaw)
      throw new FileConflict(this.draftPath);
    if (!session.dirty) {
      if (previous !== null)
        await this.store.compareAndWrite(this.draftPath, previous, null);
      this.pendingInitial = undefined;
      this.pendingRaw = undefined;
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
    this.pendingInitial = undefined;
    this.pendingRaw = undefined;
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
        pendingDraft = this.baseline === null && this.pendingInitial
          ? session.draft() : undefined,
        mapText = serializeDocument(snapshot.document),
        writes: Write[] = [];
      if (pendingDraft) await this.persistPendingNow(pendingDraft);
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
