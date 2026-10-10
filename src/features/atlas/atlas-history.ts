/** JSON values keep atlas commands portable across terrain, city and detail documents. */
export type AtlasValue =
  | null
  | boolean
  | number
  | string
  | readonly AtlasValue[]
  | { readonly [key: string]: AtlasValue };
export interface AtlasChange {
  readonly ownerId: string;
  readonly target: string;
  readonly before: AtlasValue;
  readonly after: AtlasValue;
}
export interface AtlasCommand {
  readonly label: string;
  readonly changes: readonly AtlasChange[];
}
type Validator = (target: string, value: AtlasValue) => void;
export interface AtlasReadView {
  read(ownerId: string, target: string): AtlasValue;
  entries(ownerId: string): readonly (readonly [string, AtlasValue])[];
}
export type AtlasPreflight = (view: AtlasReadView) => void;
interface Owner {
  values: Map<string, AtlasValue>;
  validate: Validator;
}
function immutable(value: AtlasValue): AtlasValue {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, immutable(v)]),
      ),
    );
  throw new Error("Ungültiger Atlas-Befehlswert.");
}
export function sameAtlasValue(a: AtlasValue, b: AtlasValue): boolean {
  if (a === b) return true;
  if (
    !a ||
    !b ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false;
  const ak = Object.keys(a),
    bk = Object.keys(b);
  return (
    ak.length === bk.length &&
    ak.every(
      (k) =>
        Object.hasOwn(b, k) &&
        sameAtlasValue(
          (a as Record<string, AtlasValue>)[k]!,
          (b as Record<string, AtlasValue>)[k]!,
        ),
    )
  );
}
/** One history for every owner in the atlas. All owners are validated before any state changes. */
export class AtlasHistory {
  private owners = new Map<string, Owner>();
  private undoStack: AtlasCommand[] = [];
  private redoStack: AtlasCommand[] = [];
  private listeners = new Set<() => void>();
  private preflights = new Set<AtlasPreflight>();
  private checking = false;
  private writable(): void {
    if (this.checking)
      throw new Error("Atlasprüfung darf den Zustand nicht ändern.");
  }
  /** Check the complete prospective state, never a partially applied command. */
  addPreflight(validate: AtlasPreflight): () => void {
    this.writable();
    this.preflights.add(validate);
    return () => {
      this.writable();
      this.preflights.delete(validate);
    };
  }
  register(ownerId: string, validate: Validator): void {
    this.writable();
    if (!ownerId || this.owners.has(ownerId))
      throw new Error("Atlasbesitzer bereits registriert.");
    this.owners.set(ownerId, { values: new Map(), validate });
  }
  private owner(id: string): Owner {
    const owner = this.owners.get(id);
    if (!owner) throw new Error("Unbekannter Atlasbesitzer.");
    return owner;
  }
  /** Loading adds checked baselines; it must never replace a live edit. */
  hydrate(
    ownerId: string,
    entries: Iterable<readonly [string, AtlasValue]>,
  ): void {
    this.writable();
    const owner = this.owner(ownerId),
      next = new Map(owner.values);
    for (const [target, raw] of entries) {
      const value = immutable(raw);
      owner.validate(target, value);
      if (next.has(target) && !sameAtlasValue(next.get(target)!, value))
        throw new Error("Laden würde eine Atlasänderung ersetzen.");
      next.set(target, value);
    }
    owner.values = next;
  }
  read(ownerId: string, target: string): AtlasValue {
    return this.owner(ownerId).values.get(target) ?? null;
  }
  entries(ownerId: string): readonly (readonly [string, AtlasValue])[] {
    return [...this.owner(ownerId).values.entries()];
  }
  private apply(command: AtlasCommand, reverse: boolean, commit = true): void {
    this.writable();
    const pending = new Map<string, Map<string, AtlasValue>>(),
      seen = new Set<string>();
    this.checking = true;
    try {
      for (const c of command.changes) {
        const key = JSON.stringify([c.ownerId, c.target]);
        if (seen.has(key)) throw new Error("Doppeltes Atlas-Befehlsziel.");
        seen.add(key);
        const owner = this.owner(c.ownerId),
          before = reverse ? c.after : c.before,
          after = reverse ? c.before : c.after;
        if (!sameAtlasValue(owner.values.get(c.target) ?? null, before))
          throw new Error("Atlasänderung kollidiert mit dem aktuellen Stand.");
        owner.validate(c.target, after);
        let next = pending.get(c.ownerId);
        if (!next) pending.set(c.ownerId, (next = new Map(owner.values)));
        next.set(c.target, after);
      }
      if (this.preflights.size) {
        const snapshot = new Map(
          [...this.owners].map(
            ([id, owner]) => [id, pending.get(id) ?? owner.values] as const,
          ),
        );
        const values = (id: string) => {
          const result = snapshot.get(id);
          if (!result) throw new Error("Unbekannter Atlasbesitzer.");
          return result;
        };
        const view: AtlasReadView = Object.freeze({
          read: (id: string, target: string) => values(id).get(target) ?? null,
          entries: (id: string) =>
            Object.freeze([...values(id)].map((entry) => Object.freeze(entry))),
        });
        for (const validate of this.preflights) {
          const result: unknown = validate(view);
          if (result !== undefined)
            throw new Error(
              "Prospektive Atlasprüfung muss synchron und schreibfrei sein.",
            );
        }
      }
    } finally {
      this.checking = false;
    }
    if (!commit) return;
    for (const [id, values] of pending) this.owner(id).values = values;
  }
  private command(raw: AtlasCommand): AtlasCommand {
    const changes = raw.changes.map((c) =>
      Object.freeze({
        ...c,
        before: immutable(c.before),
        after: immutable(c.after),
      }),
    );
    const command = Object.freeze({
      label: raw.label,
      changes: Object.freeze(changes),
    });
    return command;
  }
  /** Preview uses the identical validators without changing owners or either stack. */
  check(raw: AtlasCommand): void {
    this.apply(this.command(raw), false, false);
  }
  execute(raw: AtlasCommand): boolean {
    const command = this.command(raw),
      changes = command.changes;
    // Validate no-ops too: a stale command must not be accepted just because before equals after.
    this.apply(command, false);
    if (changes.every((c) => sameAtlasValue(c.before, c.after))) return false;
    this.undoStack.push(command);
    this.redoStack = [];
    this.notify();
    return true;
  }
  undo(): boolean {
    const command = this.undoStack.at(-1);
    if (!command) return false;
    this.apply(command, true);
    this.undoStack.pop();
    this.redoStack.push(command);
    this.notify();
    return true;
  }
  redo(): boolean {
    const command = this.redoStack.at(-1);
    if (!command) return false;
    this.apply(command, false);
    this.redoStack.pop();
    this.undoStack.push(command);
    this.notify();
    return true;
  }
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  get undoDepth(): number {
    return this.undoStack.length;
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        // State and stacks are already committed; diagnostics must not reject them.
        try {
          console.error("AtlasHistory subscriber failed", error);
        } catch {
          // A broken diagnostic sink must not block the remaining subscribers.
        }
      }
    }
  }
}
