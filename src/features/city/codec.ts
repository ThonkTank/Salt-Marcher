import { assertBuildingTopology } from "../../geometry";
import { immutable, type Point, type Polygon } from "../../model";
import {
  CITY_FORMAT_VERSION,
  type CityArea,
  type CityBuilding,
  type CityDocument,
  type CityPlot,
  type CityRoad,
  type CityRoadNode,
} from "./model";

function invalid(detail: string): never {
  throw new Error("Ungültige Stadtdatei: " + detail);
}
function record(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("Datensatz fehlt.");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    invalid("Datensatz ist kein natives Datenobjekt.");
  const allowed = new Set([...required, ...optional]);
  if (
    required.some((key) => !Object.hasOwn(value, key)) ||
    Reflect.ownKeys(value).some(
      (key) => typeof key !== "string" || !allowed.has(key),
    )
  )
    invalid("Fehlende oder unbekannte Felder; Inhalt bleibt erhalten.");
  for (const descriptor of Object.values(
    Object.getOwnPropertyDescriptors(value),
  ))
    if (!Object.hasOwn(descriptor, "value"))
      invalid("Berechnete Datenfelder sind unzulässig.");
  return value as Record<string, unknown>;
}
function list(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) invalid("Liste fehlt.");
  if (
    Object.getPrototypeOf(value) !== Array.prototype ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    invalid(
      "Liste enthält ausgelassene Einträge oder unbekannte Zusatzfelder.",
    );
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value"))
      invalid("Liste enthält ausgelassene oder berechnete Einträge.");
  }
  return value;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    invalid("Ungültige Kennung.");
  return value;
}
function name(value: unknown, required = false): string {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    (required && !value.trim())
  )
    invalid("Ungültiger Name.");
  return value;
}
function finite(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    invalid("Koordinate oder Wert ist nicht endlich.");
  return value;
}
function positive(value: unknown): number {
  const number = finite(value);
  if (number <= 0) invalid("Breite und Skalierung müssen positiv sein.");
  return number;
}
function point(value: unknown): Point {
  const d = record(value, ["x", "y"]);
  return { x: finite(d.x), y: finite(d.y) };
}
function ring(value: unknown): readonly Point[] {
  const points = list(value).map(point);
  if (points.length < 3) invalid("Kontur braucht mindestens drei Punkte.");
  return points;
}
/** Translate only the validation copy; saved meters and winding stay untouched. */
function checkPolygon(polygon: Polygon): void {
  const origin = polygon.outer[0]!;
  const shifted = (points: readonly Point[]) =>
    points.map((p) => {
      const x = p.x - origin.x,
        y = p.y - origin.y;
      if (!Number.isFinite(x) || !Number.isFinite(y))
        invalid("Kontur ist numerisch nicht prüfbar.");
      return { x, y };
    });
  const outer = shifted(polygon.outer),
    holes = polygon.holes.map(shifted);
  let area = 0;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]!,
      b = outer[(i + 1) % outer.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  if (!Number.isFinite(area) || area === 0)
    invalid("Kontur ist entartet oder numerisch nicht prüfbar.");
  try {
    assertBuildingTopology([{ outer, holes }]);
  } catch {
    invalid(
      "Konturen schneiden sich, sind entartet oder enthalten ungültige Innenhöfe.",
    );
  }
}
function polygon(value: unknown): Polygon {
  const d = record(value, ["outer", "holes"]);
  const result = { outer: ring(d.outer), holes: list(d.holes).map(ring) };
  checkPolygon(result);
  return result;
}
function optionalId(
  d: Record<string, unknown>,
  key: string,
): string | undefined {
  return Object.hasOwn(d, key) ? id(d[key]) : undefined;
}
function roadNode(value: unknown): CityRoadNode {
  const d = record(value, ["id", "point"]);
  return { id: id(d.id), point: point(d.point) };
}
function road(value: unknown): CityRoad {
  const d = record(value, [
    "id",
    "startNodeId",
    "endNodeId",
    "via",
    "widthMeters",
  ]);
  return {
    id: id(d.id),
    startNodeId: id(d.startNodeId),
    endNodeId: id(d.endNodeId),
    via: list(d.via).map(point),
    widthMeters: positive(d.widthMeters),
  };
}
function area(value: unknown): CityArea {
  const d = record(value, ["id", "name", "outline"]);
  return { id: id(d.id), name: name(d.name), outline: polygon(d.outline) };
}
function plot(value: unknown): CityPlot {
  const d = record(value, ["id", "outline"], ["districtId"]);
  const districtId = optionalId(d, "districtId");
  return {
    id: id(d.id),
    outline: polygon(d.outline),
    ...(districtId === undefined ? {} : { districtId }),
  };
}
function building(value: unknown): CityBuilding {
  const d = record(
    value,
    ["id", "name", "footprint", "position", "rotationRadians", "scale"],
    ["plotId"],
  );
  const footprint = polygon(d.footprint),
    position = point(d.position),
    rotationRadians = finite(d.rotationRadians),
    scalePoint = point(d.scale),
    scale = { x: positive(scalePoint.x), y: positive(scalePoint.y) },
    plotId = optionalId(d, "plotId"),
    c = Math.cos(rotationRadians),
    s = Math.sin(rotationRadians);
  const pose = (points: readonly Point[]) =>
    points.map((p) => {
      const x = p.x * scale.x,
        y = p.y * scale.y;
      return {
        x: finite(position.x + x * c - y * s),
        y: finite(position.y + x * s + y * c),
      };
    });
  checkPolygon({
    outer: pose(footprint.outer),
    holes: footprint.holes.map(pose),
  });
  return {
    id: id(d.id),
    name: name(d.name),
    footprint,
    position,
    rotationRadians,
    scale,
    ...(plotId === undefined ? {} : { plotId }),
  };
}
function decode(value: unknown): CityDocument {
  const d = record(value, [
    "kind",
    "version",
    "id",
    "name",
    "units",
    "roadNodes",
    "roads",
    "plazas",
    "plots",
    "districts",
    "buildings",
  ]);
  if (
    d.kind !== "city" ||
    d.version !== CITY_FORMAT_VERSION ||
    d.units !== "meters"
  )
    invalid(
      "Unbekanntes Format, Version oder Maßstab; Inhalt bleibt erhalten.",
    );
  const document: CityDocument = {
    kind: "city",
    version: CITY_FORMAT_VERSION,
    id: id(d.id),
    name: name(d.name, true),
    units: "meters",
    roadNodes: list(d.roadNodes).map(roadNode),
    roads: list(d.roads).map(road),
    plazas: list(d.plazas).map(area),
    plots: list(d.plots).map(plot),
    districts: list(d.districts).map(area),
    buildings: list(d.buildings).map(building),
  };
  const ids = new Set<string>();
  for (const collection of [
    document.roadNodes,
    document.roads,
    document.plazas,
    document.plots,
    document.districts,
    document.buildings,
  ])
    for (const element of collection) {
      if (ids.has(element.id))
        invalid("Doppelte Elementkennung: " + element.id);
      ids.add(element.id);
    }
  const nodes = new Map(
      document.roadNodes.map((node) => [node.id, node.point]),
    ),
    districts = new Set(document.districts.map((district) => district.id)),
    plots = new Set(document.plots.map((plot) => plot.id));
  for (const edge of document.roads) {
    const start = nodes.get(edge.startNodeId),
      end = nodes.get(edge.endNodeId);
    if (!start || !end)
      invalid("Straße verweist auf einen fehlenden Knoten: " + edge.id);
    const points = [start, ...edge.via, end];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!,
        b = points[i]!,
        length = Math.hypot(b.x - a.x, b.y - a.y);
      if (!Number.isFinite(length) || length === 0)
        invalid(
          "Straße enthält ein Nullsegment oder ist numerisch nicht prüfbar: " +
            edge.id,
        );
    }
  }
  for (const plot of document.plots)
    if (plot.districtId !== undefined && !districts.has(plot.districtId))
      invalid("Grundstück verweist auf ein fehlendes Viertel: " + plot.id);
  for (const house of document.buildings)
    if (house.plotId !== undefined && !plots.has(house.plotId))
      invalid("Gebäude verweist auf ein fehlendes Grundstück: " + house.id);
  return immutable(document);
}

export function newCityDocument(id: string, name: string): CityDocument {
  return decode({
    kind: "city",
    version: CITY_FORMAT_VERSION,
    id,
    name: name.trim(),
    units: "meters",
    roadNodes: [],
    roads: [],
    plazas: [],
    plots: [],
    districts: [],
    buildings: [],
  });
}
export function parseCityDocument(text: string): CityDocument {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    invalid("JSON ist nicht lesbar; Inhalt bleibt erhalten.");
  }
  return decode(value);
}
export function serializeCityDocument(document: CityDocument): string {
  // Validate before JSON can drop undefined, unknown fields or non-finite values.
  return JSON.stringify(decode(document), null, 2) + "\n";
}
