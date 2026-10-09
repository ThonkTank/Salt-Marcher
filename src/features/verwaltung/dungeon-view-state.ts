export const DUNGEON_VIEW_STATE_SCHEMA_VERSION = 1 as const;
export const DUNGEON_VIEW_STATE_KEY = "dungeonViewState" as const;

const MAX_PATH_LENGTH = 1024;
const MAX_FLOOR_ID_LENGTH = 256;

export interface DungeonViewState {
  readonly schemaVersion: typeof DUNGEON_VIEW_STATE_SCHEMA_VERSION;
  readonly path: string;
  readonly activeFloorId: string;
}

export interface DungeonViewStateEntry {
  readonly state: DungeonViewState;
  readonly revision: number;
  readonly leafToken: object;
}

function boundedText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value.trim().length > 0
  );
}

function frozenState(path: string, activeFloorId: string): DungeonViewState {
  return Object.freeze({
    schemaVersion: DUNGEON_VIEW_STATE_SCHEMA_VERSION,
    path,
    activeFloorId,
  });
}

export function parseDungeonViewState(
  value: unknown,
  expectedPath?: string,
): DungeonViewState | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "activeFloorId" ||
    keys[1] !== "path" ||
    keys[2] !== "schemaVersion" ||
    record.schemaVersion !== DUNGEON_VIEW_STATE_SCHEMA_VERSION ||
    !boundedText(record.path, MAX_PATH_LENGTH) ||
    !boundedText(record.activeFloorId, MAX_FLOOR_ID_LENGTH) ||
    (expectedPath !== undefined && record.path !== expectedPath)
  )
    return;
  return frozenState(record.path, record.activeFloorId);
}

export function dungeonViewState(
  path: string,
  activeFloorId: string,
): DungeonViewState | undefined {
  return parseDungeonViewState({
    schemaVersion: DUNGEON_VIEW_STATE_SCHEMA_VERSION,
    path,
    activeFloorId,
  });
}

export function dungeonViewStateFromWorkspace(
  workspaceState: unknown,
  expectedPath?: string,
): DungeonViewState | undefined {
  if (!workspaceState || typeof workspaceState !== "object") return;
  return parseDungeonViewState(
    (workspaceState as Record<string, unknown>)[DUNGEON_VIEW_STATE_KEY],
    expectedPath,
  );
}

export function withDungeonViewState(
  baseState: Record<string, unknown>,
  state: DungeonViewState,
): Record<string, unknown> {
  return { ...baseState, [DUNGEON_VIEW_STATE_KEY]: state };
}

export class DungeonViewStateRegistry {
  private readonly entries = new Map<string, DungeonViewStateEntry>();
  private nextRevision = 0;

  publish(leafToken: object, candidate: unknown): DungeonViewStateEntry | undefined {
    const state = parseDungeonViewState(candidate);
    if (!state) return;
    const entry = Object.freeze({
      state,
      revision: ++this.nextRevision,
      leafToken,
    });
    this.entries.set(state.path, entry);
    return entry;
  }

  latest(path: string): DungeonViewStateEntry | undefined {
    return this.entries.get(path);
  }

  rename(previousPath: string, nextPath: string): DungeonViewStateEntry | undefined {
    const previous = this.entries.get(previousPath);
    if (!previous) return;
    const state = dungeonViewState(nextPath, previous.state.activeFloorId);
    if (!state) return;
    this.entries.delete(previousPath);
    const entry = Object.freeze({
      state,
      revision: ++this.nextRevision,
      leafToken: previous.leafToken,
    });
    this.entries.set(nextPath, entry);
    return entry;
  }

  delete(path: string): void {
    this.entries.delete(path);
  }

  clear(): void {
    this.entries.clear();
  }
}
