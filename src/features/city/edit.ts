import type { Point, Polygon } from "../../model";
import { parseCityDocument, serializeCityDocument } from "./codec";
import type {
  CityArea,
  CityBuilding,
  CityDocument,
  CityRoad,
  CityRoadNode,
} from "./model";

export type CityEdit =
  | {
      readonly kind: "add-road";
      readonly road: CityRoad;
      readonly nodes: readonly CityRoadNode[];
    }
  | {
      readonly kind: "move-node";
      readonly nodeId: string;
      readonly point: Point;
    }
  | {
      readonly kind: "replace-road";
      readonly roadId: string;
      readonly road: CityRoad;
    }
  | { readonly kind: "remove-road"; readonly roadId: string }
  | { readonly kind: "remove-node"; readonly nodeId: string }
  | { readonly kind: "add-building"; readonly building: CityBuilding }
  | {
      readonly kind: "set-building-pose";
      readonly buildingId: string;
      readonly position: Point;
      readonly rotationRadians: number;
      readonly scale: Point;
    }
  | {
      readonly kind: "set-building-footprint";
      readonly buildingId: string;
      readonly footprint: Polygon;
    }
  | {
      readonly kind: "set-building-name";
      readonly buildingId: string;
      readonly name: string;
    }
  | { readonly kind: "remove-building"; readonly buildingId: string }
  | { readonly kind: "add-plaza"; readonly plaza: CityArea };

const FIELDS: Record<CityEdit["kind"], readonly string[]> = {
  "add-road": ["road", "nodes"],
  "move-node": ["nodeId", "point"],
  "replace-road": ["roadId", "road"],
  "remove-road": ["roadId"],
  "remove-node": ["nodeId"],
  "add-building": ["building"],
  "set-building-pose": ["buildingId", "position", "rotationRadians", "scale"],
  "set-building-footprint": ["buildingId", "footprint"],
  "set-building-name": ["buildingId", "name"],
  "remove-building": ["buildingId"],
  "add-plaza": ["plaza"],
};
function invalid(detail: string): never {
  throw new Error("Ungültige Stadtänderung: " + detail);
}
function data(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("Datensatz fehlt.");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    invalid("Kein natives Datenobjekt.");
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== "string" || !Object.hasOwn(descriptor, "value"))
      invalid("Berechnete oder unbekannte Datenfelder.");
  }
  return value as Record<string, unknown>;
}
function list(value: unknown): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    invalid("Keine dichte native Liste.");
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, "value"))
      invalid("Ausgelassener oder berechneter Listeneintrag.");
  }
  return value;
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    invalid("Ungültige Zielkennung.");
  return value;
}
function elementId(value: unknown): string {
  return identifier(data(value).id);
}
function operation(value: unknown): CityEdit {
  const d = data(value);
  if (typeof d.kind !== "string" || !Object.hasOwn(FIELDS, d.kind))
    invalid("Unbekannte Aktion.");
  const fields = ["kind", ...FIELDS[d.kind as CityEdit["kind"]]];
  if (
    Object.keys(d).length !== fields.length ||
    fields.some((k) => !Object.hasOwn(d, k)) ||
    Reflect.ownKeys(d).some((k) => !fields.includes(String(k)))
  )
    invalid("Fehlende oder unbekannte Aktionsfelder.");
  return d as unknown as CityEdit;
}
function update<T extends { readonly id: string }>(
  values: readonly T[],
  id: string,
  replace: (value: T) => T | null,
): readonly T[] {
  if (!values.some((value) => value.id === id))
    invalid("Ziel fehlt oder besitzt einen anderen Elementtyp: " + id);
  return values.flatMap((value) =>
    value.id === id ? (replace(value) ?? []) : [value],
  );
}

/** Pure package: validate the initial document and final state, never publish an intermediate edit. */
export function editCity(
  document: CityDocument,
  edits: readonly CityEdit[],
): CityDocument {
  let next = parseCityDocument(serializeCityDocument(document));
  const reserved = new Set(
    [
      next.roadNodes,
      next.roads,
      next.plazas,
      next.plots,
      next.districts,
      next.buildings,
    ].flatMap((values) => values.map((value) => value.id)),
  );
  const written = new Set<string>();
  function claim(raw: unknown, added = false): string {
    const id = identifier(raw);
    if (written.has(id)) invalid("Doppeltes Schreibziel: " + id);
    if (added && reserved.has(id))
      invalid("Kennung ist bereits vergeben: " + id);
    written.add(id);
    return id;
  }
  for (const raw of list(edits)) {
    const edit = operation(raw);
    switch (edit.kind) {
      case "add-road":
        claim(elementId(edit.road), true);
        for (const node of list(edit.nodes)) claim(elementId(node), true);
        next = {
          ...next,
          roads: [...next.roads, edit.road],
          roadNodes: [...next.roadNodes, ...edit.nodes],
        };
        break;
      case "move-node": {
        const id = claim(edit.nodeId);
        next = {
          ...next,
          roadNodes: update(next.roadNodes, id, (node) => ({
            ...node,
            point: edit.point,
          })),
        };
        break;
      }
      case "replace-road": {
        const id = claim(edit.roadId);
        if (elementId(edit.road) !== id)
          invalid("Straßenkennung darf nicht ersetzt werden.");
        next = { ...next, roads: update(next.roads, id, () => edit.road) };
        break;
      }
      case "remove-road":
        next = {
          ...next,
          roads: update(next.roads, claim(edit.roadId), () => null),
        };
        break;
      case "remove-node":
        next = {
          ...next,
          roadNodes: update(next.roadNodes, claim(edit.nodeId), () => null),
        };
        break;
      case "add-building":
        claim(elementId(edit.building), true);
        next = { ...next, buildings: [...next.buildings, edit.building] };
        break;
      case "set-building-pose":
        next = {
          ...next,
          buildings: update(
            next.buildings,
            claim(edit.buildingId),
            (building) => ({
              ...building,
              position: edit.position,
              rotationRadians: edit.rotationRadians,
              scale: edit.scale,
            }),
          ),
        };
        break;
      case "set-building-footprint":
        next = {
          ...next,
          buildings: update(
            next.buildings,
            claim(edit.buildingId),
            (building) => ({ ...building, footprint: edit.footprint }),
          ),
        };
        break;
      case "set-building-name":
        next = {
          ...next,
          buildings: update(
            next.buildings,
            claim(edit.buildingId),
            (building) => ({
              ...building,
              name: edit.name,
            }),
          ),
        };
        break;
      case "remove-building":
        next = {
          ...next,
          buildings: update(next.buildings, claim(edit.buildingId), () => null),
        };
        break;
      case "add-plaza":
        claim(elementId(edit.plaza), true);
        next = { ...next, plazas: [...next.plazas, edit.plaza] };
        break;
    }
  }
  return parseCityDocument(serializeCityDocument(next));
}
