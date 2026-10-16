import {
  immutable,
  isStructuredRoom,
  parseDocument,
  serializeDocument,
  type KeySection,
  type MapDocument,
} from "../../model";
import { Session } from "../../session";
import {
  AtlasHistory,
  type AtlasChange,
  type AtlasValue,
} from "../atlas/atlas-history";

const DOCUMENT_TARGET = "document";

export type DungeonKeyClosureEntry = Readonly<{
  roomId: string;
  sectionId: string;
} & (
  | { kind: "markdown"; markdown: string }
  | { kind: "passage"; doorId: string }
)>;

export interface DungeonAtlasSnapshot {
  readonly ownerId: string;
  /** Canonical native .dungeon bytes; no process-local Session revision is persisted. */
  readonly documentBytes: string;
  readonly document: MapDocument;
  /** Derived from documentBytes and never stored as a second Key authority. */
  readonly keyClosure: readonly DungeonKeyClosureEntry[];
}

function documentOf(value: MapDocument | Session): MapDocument {
  return value instanceof Session ? value.document() : value;
}

function documentBytes(value: MapDocument | Session): string {
  const bytes = serializeDocument(documentOf(value));
  // Parse the bytes that AtlasHistory will actually own, not a parallel Session value.
  parseDocument(bytes);
  return bytes;
}

function checkedBytes(value: AtlasValue, ownerId: string): MapDocument {
  if (typeof value !== "string")
    throw new Error("Ungültiger Dungeon-Snapshot.");
  const document = parseDocument(value);
  if (document.id !== ownerId)
    throw new Error("Dungeonkennung stimmt nicht mit dem Atlasbesitzer überein.");
  if (serializeDocument(document) !== value)
    throw new Error("Dungeon-Snapshot ist nicht kanonisch serialisiert.");
  return immutable(document);
}

function keyEntry(roomId: string, section: KeySection): DungeonKeyClosureEntry {
  return section.kind === "markdown"
    ? immutable({ roomId, sectionId: section.id, kind: section.kind,
      markdown: section.markdown })
    : immutable({ roomId, sectionId: section.id, kind: section.kind,
      doorId: section.doorId });
}

function snapshot(value: AtlasValue, ownerId: string): DungeonAtlasSnapshot {
  const document = checkedBytes(value, ownerId),
    keyClosure = document.entities.flatMap((entity) =>
      isStructuredRoom(entity)
        ? entity.key.sections.map((section) => keyEntry(entity.id, section))
        : []);
  return immutable({
    ownerId,
    documentBytes: value as string,
    document,
    keyClosure,
  });
}

/**
 * One Dungeon owner in an externally supplied AtlasHistory lifetime.
 *
 * The source intentionally does not expose Session undo/redo or persistence. A
 * composed E2E command executes once in AtlasHistory; the steward-owned adapter
 * later persists the resulting native document bytes through the shared
 * transaction boundary.
 */
export class DungeonAtlasSource {
  readonly id: string;
  constructor(
    initial: MapDocument | Session,
    readonly history: AtlasHistory,
  ) {
    const bytes = documentBytes(initial),
      document = parseDocument(bytes);
    this.id = document.id;
    history.register(this.id, (target, next) => {
      if (target !== DOCUMENT_TARGET)
        throw new Error("Unbekanntes Dungeon-Befehlsziel.");
      checkedBytes(next, this.id);
    });
    history.hydrate(this.id, [[DOCUMENT_TARGET, bytes]]);
  }

  read(): DungeonAtlasSnapshot {
    return snapshot(this.history.read(this.id, DOCUMENT_TARGET), this.id);
  }
}

/** Keep the caller's original snapshots so stale combined commands fail atomically. */
export function dungeonDocumentChange(
  before: MapDocument | Session,
  after: MapDocument | Session,
): AtlasChange {
  const beforeBytes = documentBytes(before),
    afterBytes = documentBytes(after),
    ownerId = parseDocument(beforeBytes).id;
  checkedBytes(afterBytes, ownerId);
  return immutable({
    ownerId,
    target: DOCUMENT_TARGET,
    before: beforeBytes,
    after: afterBytes,
  });
}
