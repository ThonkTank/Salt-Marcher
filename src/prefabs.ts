import { type Entity, type Point, isRoom, uid } from "./model";
import { captureSelectionClipboard, copyAtViewportCenter } from "./selection";

export interface Prefab {
  readonly id: string;
  readonly set: string;
  readonly name: string;
  readonly entities: readonly Entity[];
  readonly center: Point;
}

export function createPrefab(
  set: string,
  name: string,
  sources: readonly Entity[],
  get: (id: string) => Entity | undefined,
  newId: () => string = uid,
): Prefab {
  set = set.trim();
  name = name.trim();
  if (!set || !name) throw new Error("Sammlung und Vorlagenname fehlen.");
  // Room keys and note links belong to their map, not a reusable drawing asset.
  const drawings = sources.filter((entity) =>
    !isRoom(entity) && entity.kind !== "reference",
  );
  if (!drawings.length) throw new Error("Keine wiederverwendbare Zeichnung ausgewählt.");
  const captured = captureSelectionClipboard(drawings, get);
  const entities = captured.entities.map((entity): Entity => {
    if (isRoom(entity) || entity.kind === "reference")
      throw new Error("Vorlagen enthalten keine Raum-Keys oder Nachzeichenvorlagen.");
    return {
      ...entity,
      note: undefined,
      roomId: undefined,
      groupId: undefined,
      prefabId: undefined,
    };
  });
  if (!captured.center) throw new Error("Vorlage ohne Position.");
  return { id: newId(), set, name, entities, center: captured.center };
}

export function placePrefab(
  prefab: Prefab,
  at: Point,
  floorId: string,
  newId: () => string = uid,
): Entity[] {
  const copies = copyAtViewportCenter(
    prefab.entities, prefab.center, at, floorId, newId,
  );
  return copies.map((entity) => ({ ...entity, prefabId: prefab.id }));
}

export function validPrefabs(value: unknown): Prefab[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Prefab =>
    !!item && typeof item === "object" &&
    typeof item.id === "string" && !!item.id &&
    typeof item.set === "string" && !!item.set.trim() &&
    typeof item.name === "string" && !!item.name.trim() &&
    Array.isArray(item.entities) && item.entities.length > 0 &&
    item.center && Number.isFinite(item.center.x) &&
    Number.isFinite(item.center.y),
  );
}
