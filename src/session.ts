import {
  type Entity,
  type Floor,
  type Id,
  type MapDocument,
  type DungeonContent,
  type Settings,
  immutable,
  validateDocument,
  validateEntity,
  validateSettings,
  validateFloor,
  validateContent,
  safePath,
} from "./model";

export interface RecordChange<T> {
  readonly id: Id;
  readonly before: T | null;
  readonly after: T | null;
  readonly beforeIndex?: number;
  readonly afterIndex?: number;
}
export interface TextPatch {
  readonly path: string;
  readonly offset: number;
  readonly before: string;
  readonly after: string;
  readonly create?: boolean;
}
export interface Command {
  readonly label: string;
  readonly entities?: readonly RecordChange<Entity>[];
  readonly floors?: readonly RecordChange<Floor>[];
  readonly settings?: { readonly before: Settings; readonly after: Settings };
  readonly content?: {
    readonly before: DungeonContent;
    readonly after: DungeonContent;
  };
  readonly texts?: readonly TextPatch[];
  readonly affectsRules?: boolean;
}
export interface ChangeEvent {
  readonly ids: ReadonlySet<Id>;
  readonly entityOrder: boolean;
  readonly notes: ReadonlySet<string>;
  readonly floors: boolean;
  readonly settings: boolean;
  readonly content: boolean;
  readonly revision: number;
  readonly rulesRevision: number;
  readonly label: string;
}
export interface SaveSnapshot {
  readonly document: MapDocument;
  readonly notes: ReadonlyMap<string, string | null>;
  readonly revision: number;
}
export interface DraftState {
  readonly document: MapDocument;
  readonly notes: readonly {
    path: string;
    base: string | null;
    current: string | null;
  }[];
}
interface NoteDraft {
  base: string | null;
  current: string | null;
}
function sameOrder(a: readonly Id[], b: readonly Id[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
function ordered<T>(
  records: ReadonlyMap<Id, T>,
  changes: readonly RecordChange<T>[],
): Map<Id, T> {
  const changed = new Set(changes.map((change) => change.id)),
    entries = [...records].filter(([id]) => !changed.has(id)),
    additions = changes
      .filter(
        (change): change is RecordChange<T> & { readonly after: T } =>
          change.after !== null,
      )
      .map((change, order) => ({ change, order }))
      .sort(
        (a, b) =>
          (a.change.afterIndex ?? Number.MAX_SAFE_INTEGER) -
            (b.change.afterIndex ?? Number.MAX_SAFE_INTEGER) ||
          a.order - b.order,
      );
  for (const { change } of additions)
    entries.splice(
      Math.min(change.afterIndex ?? entries.length, entries.length),
      0,
      [change.id, change.after],
    );
  return new Map(entries);
}
export function textPatch(
  path: string,
  before: string,
  after: string,
): TextPatch {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start++;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end++;
  return {
    path,
    offset: start,
    before: before.slice(start, before.length - end),
    after: after.slice(start, after.length - end),
  };
}
export class Session {
  private records = new Map<Id, Entity>();
  private levels = new Map<Id, Floor>();
  private notes = new Map<string, NoteDraft>();
  private listeners = new Set<(event: ChangeEvent) => void>();
  private past: Command[] = [];
  private future: Command[] = [];
  private lockOverrides = new Map<Id, boolean>();
  private references = new Map<Id, Set<Id>>();
  private dirtyIds = new Set<Id>();
  private dirtyOrder = false;
  private dirtyFloors = new Set<Id>();
  private mutationsHeld = false;
  private savedRecords: Map<Id, Entity>;
  private savedFloors: Map<Id, Floor>;
  private savedSettings: Settings;
  private stateSettings: Settings;
  private savedContent: DungeonContent;
  private stateContent: DungeonContent;
  readonly id: Id;
  readonly version: 3 | 4;
  revision = 0;
  rulesRevision = 0;
  constructor(
    doc: MapDocument,
    private readonly historyLimit = Infinity,
  ) {
    validateDocument(doc);
    doc = immutable(structuredClone(doc));
    this.id = doc.id;
    this.version = doc.version;
    this.stateSettings = doc.settings;
    this.stateContent = doc.content;
    for (const f of doc.floors) this.levels.set(f.id, f);
    for (const e of doc.entities) {
      this.records.set(e.id, e);
      this.index(e, true);
    }
    this.savedRecords = new Map(this.records);
    this.savedFloors = new Map(this.levels);
    this.savedSettings = this.stateSettings;
    this.savedContent = this.stateContent;
  }
  get settings(): Settings {
    return this.stateSettings;
  }
  get entities(): ReadonlyMap<Id, Entity> {
    return this.records;
  }
  get floors(): ReadonlyMap<Id, Floor> {
    return this.levels;
  }
  get content(): DungeonContent {
    return this.stateContent;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  get dirty(): boolean {
    return (
      this.dirtyIds.size > 0 ||
      this.dirtyOrder ||
      this.dirtyFloors.size > 0 ||
      this.stateSettings !== this.savedSettings ||
      this.stateContent !== this.savedContent ||
      [...this.notes.values()].some((n) => n.base !== n.current)
    );
  }
  get historySize(): number {
    return this.past.length;
  }
  /** Keep the first-save snapshot stable until its pending view is handed off. */
  holdMutations(): () => void {
    if (this.mutationsHeld) throw new Error("Kartenänderungen sind bereits gesperrt.");
    this.mutationsHeld = true;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.mutationsHeld = false;
    };
  }
  private assertMutable(): void {
    if (this.mutationsHeld)
      throw new Error("Karte wird gespeichert; Änderungen bitte danach wiederholen.");
  }
  subscribe(fn: (event: ChangeEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  dependents(id: Id): ReadonlySet<Id> {
    return this.references.get(id) ?? new Set();
  }
  private index(e: Entity, add: boolean): void {
    const parent =
      e.kind === "door"
        ? e.anchor?.boundaryId
        : e.kind !== "building"
          ? e.roomId
          : undefined;
    if (parent) {
      if (add) {
        const s = this.references.get(parent) ?? new Set();
        s.add(e.id);
        this.references.set(parent, s);
      } else {
        const s = this.references.get(parent);
        s?.delete(e.id);
        if (!s?.size) this.references.delete(parent);
      }
    }
  }
  loadNote(path: string, text: string | null): void {
    this.assertMutable();
    safePath(path);
    const n = this.notes.get(path);
    if (n && n.base !== text)
      throw new Error(
        "Der Raumtext wurde außerhalb des Entwurfs geändert: " + path,
      );
    if (!n) this.notes.set(path, { base: text, current: text });
  }
  note(path: string): string | null | undefined {
    return this.notes.get(path)?.current;
  }
  noteBaseline(path: string): string | null | undefined {
    return this.notes.get(path)?.base;
  }
  setLocked(id: Id, locked: boolean): void {
    this.setLockedMany([id], locked);
  }
  setLockedMany(ids: Iterable<Id>, locked: boolean): void {
    this.assertMutable();
    const changes = [...new Set(ids)].map((id) => {
      const current = this.records.get(id);
      if (!current) throw new Error("Kartenobjekt wurde entfernt: " + id);
      const after = immutable({ ...current, locked });
      return { id, current, after };
    }).filter(({ current }) => !!current.locked !== locked);
    if (!changes.length) return;
    const proposed = new Map(changes.map(({ id, after }) => [id, after]));
    for (const { after } of changes)
      validateEntity(after, this.levels, (candidate) =>
        proposed.get(candidate) ?? this.records.get(candidate),
        this.version,
      );
    for (const { id, after } of changes) {
      this.records.set(id, after);
      this.lockOverrides.set(id, locked);
      if (JSON.stringify(this.savedRecords.get(id)) === JSON.stringify(after))
        this.dirtyIds.delete(id);
      else this.dirtyIds.add(id);
    }
    this.revision++;
    this.emit({
      ids: new Set(changes.map(({ id }) => id)),
      entityOrder: false,
      notes: new Set(),
      floors: false,
      settings: false,
      content: false,
      revision: this.revision,
      rulesRevision: this.rulesRevision,
      label: locked ? "Element sperren" : "Element entsperren",
    });
  }
  execute(command: Command): void {
    this.assertMutable();
    if (
      !(
        command.entities?.length ||
        command.floors?.length ||
        command.settings ||
        command.content ||
        command.texts?.some((p) => p.before !== p.after || p.create)
      )
    )
      return;
    const indexed = <T>(
        changes: readonly RecordChange<T>[] | undefined,
        records: ReadonlyMap<Id, T>,
      ): readonly RecordChange<T>[] | undefined => {
        if (!changes) return undefined;
        const positions = new Map(
          [...records.keys()].map((id, index) => [id, index]),
        );
        let append = records.size;
        return changes.map((change) => {
          const current = positions.get(change.id);
          return {
            ...change,
            ...(change.before
              ? { beforeIndex: change.beforeIndex ?? current }
              : {}),
            ...(change.after
              ? {
                  afterIndex:
                    change.afterIndex ??
                    (change.before ? current : append++),
                }
              : {}),
          };
        });
      },
      owned = immutable(
        structuredClone({
          ...command,
          ...(command.entities
            ? { entities: indexed(command.entities, this.records) }
            : {}),
          ...(command.floors
            ? { floors: indexed(command.floors, this.levels) }
            : {}),
        }),
      ),
      event = this.apply(owned, false);
    this.past.push(owned);
    this.future = [];
    if (
      Number.isFinite(this.historyLimit) &&
      this.past.length > this.historyLimit
    )
      this.past.shift();
    this.emit(event);
  }
  undo(): void {
    this.assertMutable();
    const c = this.past.at(-1);
    if (!c) return;
    const event = this.apply(c, true);
    this.past.pop();
    this.future.push(c);
    this.emit(event);
  }
  redo(): void {
    this.assertMutable();
    const c = this.future.at(-1);
    if (!c) return;
    const event = this.apply(c, false);
    this.future.pop();
    this.past.push(c);
    this.emit(event);
  }
  private apply(c: Command, inverse: boolean): ChangeEvent {
    const entityChanges = (c.entities ?? []).map((p) => {
      const change = inverse
        ? {
            id: p.id,
            before: p.after,
            after: p.before,
            beforeIndex: p.afterIndex,
            afterIndex: p.beforeIndex,
          }
        : p;
      const locked = this.lockOverrides.get(p.id);
      if (locked === undefined) return change;
      const withLock = (entity: Entity | null): Entity | null =>
        entity ? { ...entity, locked } : null;
      return {
        ...change,
        before: withLock(change.before),
        after: withLock(change.after),
      };
    });
    const floorChanges = (c.floors ?? []).map((p) =>
      inverse
        ? {
            id: p.id,
            before: p.after,
            after: p.before,
            beforeIndex: p.afterIndex,
            afterIndex: p.beforeIndex,
          }
        : p,
    );
    const byId = new Map(entityChanges.map((p) => [p.id, p]));
    const get = (id: Id): Entity | undefined => {
      const p = byId.get(id);
      return p ? (p.after ?? undefined) : this.records.get(id);
    };
    const equal = (a: unknown, b: unknown) =>
      a === b || JSON.stringify(a) === JSON.stringify(b);
    const check = <T>(
      changes: readonly RecordChange<T>[],
      store: ReadonlyMap<Id, T>,
    ) => {
      if (new Set(changes.map((p) => p.id)).size !== changes.length)
        throw new Error("Mehrfache Änderung derselben Kennung.");
      for (const p of changes) {
        if (!equal(store.get(p.id) ?? null, p.before))
          throw new Error("Veraltete Änderung: " + p.id);
        for (const index of [p.beforeIndex, p.afterIndex])
          if (
            index !== undefined &&
            (!Number.isInteger(index) || index < 0)
          )
            throw new Error("Ungültige Datensatzposition: " + p.id);
      }
    };
    check(entityChanges, this.records);
    check(floorChanges, this.levels);
    const nextFloors = floorChanges.length ? new Map(this.levels) : this.levels;
    for (const p of floorChanges) {
      if (p.after) {
        if (p.after.id !== p.id) throw new Error("Ungültiges Geschoss.");
        validateFloor(p.after);
        nextFloors.set(p.id, p.after);
      } else nextFloors.delete(p.id);
    }
    if (!nextFloors.size)
      throw new Error("Mindestens ein Geschoss bleibt erforderlich.");
    const affected = new Set(entityChanges.map((p) => p.id));
    for (const p of entityChanges)
      for (const id of this.dependents(p.id)) affected.add(id);
    for (const p of entityChanges)
      for (const e of [p.before, p.after])
        if (e?.kind === "door" && e.anchor)
          affected.add(e.anchor.boundaryId);
    if (floorChanges.length)
      for (const e of this.records.values()) affected.add(e.id);
    for (const id of affected) {
      const e = get(id);
      if (e) {
        if (e.id !== id) throw new Error("Abweichende Objektkennung.");
        validateEntity(e, nextFloors, get, this.version);
      }
    }
    let settings = this.stateSettings;
    if (c.settings) {
      const before = inverse ? c.settings.after : c.settings.before;
      settings = inverse ? c.settings.before : c.settings.after;
      if (!equal(before, this.stateSettings))
        throw new Error("Veraltete Karteneinstellungen.");
      validateSettings(settings);
    }
    let content = this.stateContent;
    if (c.content) {
      const before = inverse ? c.content.after : c.content.before;
      content = inverse ? c.content.before : c.content.after;
      if (!equal(before, this.stateContent))
        throw new Error("Veraltete Dungeon-Inhalte.");
    }
    const nextEntities = entityChanges.length ? new Map(this.records) : this.records;
    if (entityChanges.length)
      for (const change of entityChanges)
        if (change.after) nextEntities.set(change.id, change.after);
        else nextEntities.delete(change.id);
    validateContent(content, nextEntities, this.version);
    const noteValues = new Map<string, string | null>();
    const patches = inverse ? [...(c.texts ?? [])].reverse() : (c.texts ?? []);
    for (const p of patches) {
      safePath(p.path);
      const note = this.notes.get(p.path);
      if (!note) throw new Error("Text zuerst laden: " + p.path);
      const current = noteValues.has(p.path)
        ? noteValues.get(p.path)!
        : note.current;
      const old = inverse ? p.after : p.before,
        next = inverse ? p.before : p.after;
      if (p.create) {
        if (inverse) {
          if (current !== p.after)
            throw new Error("Geänderter neuer Raumtext.");
          noteValues.set(p.path, null);
        } else {
          if (current !== null || p.before !== "" || p.offset !== 0)
            throw new Error("Datei existiert bereits.");
          noteValues.set(p.path, p.after);
        }
        continue;
      }
      if (
        current === null ||
        !Number.isInteger(p.offset) ||
        p.offset < 0 ||
        current.slice(p.offset, p.offset + old.length) !== old
      )
        throw new Error("Veraltete Textänderung: " + p.path);
      noteValues.set(
        p.path,
        current.slice(0, p.offset) +
          next +
          current.slice(p.offset + old.length),
      );
    }
    // Validate everything before mutating; observers see only a complete joint command.
    const previousOrder = entityChanges.length ? [...this.records.keys()] : [];
    for (const p of entityChanges) {
      const previous = this.records.get(p.id);
      if (previous) this.index(previous, false);
      if (p.after) {
        this.records.set(p.id, p.after);
        this.index(p.after, true);
      } else this.records.delete(p.id);
      if (equal(this.savedRecords.get(p.id) ?? null, p.after))
        this.dirtyIds.delete(p.id);
      else this.dirtyIds.add(p.id);
    }
    if (entityChanges.length)
      this.records = ordered(this.records, entityChanges);
    const entityOrder = entityChanges.length > 0 &&
      !sameOrder(previousOrder, [...this.records.keys()]);
    if (entityChanges.length)
      this.dirtyOrder = !sameOrder(
        [...this.records.keys()], [...this.savedRecords.keys()],
      );
    for (const p of floorChanges) {
      if (p.after) this.levels.set(p.id, p.after);
      else this.levels.delete(p.id);
      if (equal(this.savedFloors.get(p.id) ?? null, p.after))
        this.dirtyFloors.delete(p.id);
      else this.dirtyFloors.add(p.id);
    }
    if (floorChanges.length)
      this.levels = ordered(this.levels, floorChanges);
    this.stateSettings = equal(settings, this.savedSettings)
      ? this.savedSettings
      : settings;
    this.stateContent = equal(content, this.savedContent)
      ? this.savedContent
      : content;
    for (const [path, current] of noteValues)
      this.notes.get(path)!.current = current;
    this.revision++;
    if (c.affectsRules || c.content) this.rulesRevision++;
    return {
      ids: affected,
      entityOrder,
      notes: new Set(noteValues.keys()),
      floors: !!floorChanges.length,
      settings: !!c.settings,
      content: !!c.content,
      revision: this.revision,
      rulesRevision: this.rulesRevision,
      label: (inverse ? "Rückgängig: " : "") + c.label,
    };
  }
  private emit(event: ChangeEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch (error) {
        console.error(
          "Dungeon-Ansicht konnte nicht aktualisiert werden",
          error,
        );
      }
    }
  }
  document(): MapDocument {
    return {
      format: "dungeon-map",
      version: this.version,
      id: this.id,
      settings: this.stateSettings,
      floors: [...this.levels.values()],
      entities: [...this.records.values()],
      content: this.stateContent,
    };
  }
  snapshot(): SaveSnapshot {
    return {
      document: this.document(),
      notes: new Map(
        [...this.notes]
          .filter(([, n]) => n.base !== n.current)
          .map(([p, n]) => [p, n.current]),
      ),
      revision: this.revision,
    };
  }
  draft(): DraftState {
    return {
      document: this.document(),
      notes: [...this.notes]
        .filter(([, n]) => n.base !== n.current)
        .map(([path, n]) => ({ path, ...n })),
    };
  }
  static restore(baseline: MapDocument, draft: DraftState): Session {
    if (baseline.id !== draft.document.id)
      throw new Error("Entwurf gehört zu einer anderen Karte.");
    const session = new Session(draft.document);
    for (const n of draft.notes) {
      safePath(n.path);
      if (
        ![n.base, n.current].every((v) => v === null || typeof v === "string")
      )
        throw new Error("Ungültiger Textentwurf.");
      session.notes.set(n.path, { base: n.base, current: n.current });
    }
    session.markSaved({
      document: immutable(structuredClone(baseline)),
      notes: new Map(),
      revision: 0,
    });
    return session;
  }
  markSaved(snapshot: SaveSnapshot): void {
    this.savedRecords = new Map(
      snapshot.document.entities.map((e) => [e.id, e]),
    );
    this.dirtyOrder = !sameOrder(
      [...this.records.keys()], [...this.savedRecords.keys()],
    );
    this.savedFloors = new Map(snapshot.document.floors.map((f) => [f.id, f]));
    this.savedSettings = snapshot.document.settings;
    this.savedContent = snapshot.document.content;
    const equal = (a: unknown, b: unknown) =>
      a === b || JSON.stringify(a) === JSON.stringify(b);
    if (equal(this.stateSettings, this.savedSettings))
      this.stateSettings = this.savedSettings;
    if (equal(this.stateContent, this.savedContent))
      this.stateContent = this.savedContent;
    this.dirtyIds = new Set(
      [
        ...new Set([...this.records.keys(), ...this.savedRecords.keys()]),
      ].filter((id) => !equal(this.records.get(id), this.savedRecords.get(id))),
    );
    this.dirtyFloors = new Set(
      [...new Set([...this.levels.keys(), ...this.savedFloors.keys()])].filter(
        (id) => !equal(this.levels.get(id), this.savedFloors.get(id)),
      ),
    );
    for (const [path, base] of snapshot.notes) {
      const n = this.notes.get(path);
      if (n) n.base = base;
    }
  }
}
