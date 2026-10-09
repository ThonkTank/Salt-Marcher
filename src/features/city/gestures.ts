import type { Point } from "../../model";
import type { CitySource } from "./commands";
import { CityDraft, type CityDraftPreview } from "./draft";
import type { CityEdit } from "./edit";
import {
  cityBuildingLocalPoint,
  cityBuildingPoint,
  type CityBuildingPose,
} from "./geometry";
import { cityInputPoint, cityInputRecord } from "./input";
import type { CityBuilding } from "./model";

export type CityGestureTarget =
  | {
      readonly kind: "move-node";
      readonly ownerId: string;
      readonly nodeId: string;
    }
  | {
      readonly kind: "move-road-point";
      readonly ownerId: string;
      readonly roadId: string;
      readonly viaIndex: number;
    }
  | {
      readonly kind: "move-building";
      readonly ownerId: string;
      readonly buildingId: string;
    }
  | {
      readonly kind: "rotate-building";
      readonly ownerId: string;
      readonly buildingId: string;
    }
  | {
      readonly kind: "scale-building";
      readonly ownerId: string;
      readonly buildingId: string;
      readonly axes: "both" | "x" | "y";
    };
const fields = {
  "move-node": ["kind", "ownerId", "nodeId"],
  "move-road-point": ["kind", "ownerId", "roadId", "viaIndex"],
  "move-building": ["kind", "ownerId", "buildingId"],
  "rotate-building": ["kind", "ownerId", "buildingId"],
  "scale-building": ["kind", "ownerId", "buildingId", "axes"],
} as const;
function invalid(): never {
  throw new Error("Ungültiger Stadtwerkzeugzug: Ziel oder Hebel.");
}
function target(raw: CityGestureTarget, owner: string): CityGestureTarget {
  // Read the discriminant descriptor without invoking an accessor.
  const kind =
    raw && typeof raw === "object"
      ? Object.getOwnPropertyDescriptor(raw, "kind")?.value
      : undefined;
  if (typeof kind !== "string" || !Object.hasOwn(fields, kind)) invalid();
  const d = cityInputRecord(raw, fields[kind as keyof typeof fields]);
  if (d.ownerId !== owner) invalid();
  const id =
    kind === "move-node"
      ? d.nodeId
      : kind === "move-road-point"
        ? d.roadId
        : d.buildingId;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) invalid();
  if (
    kind === "move-road-point" &&
    (!Number.isInteger(d.viaIndex) || (d.viaIndex as number) < 0)
  )
    invalid();
  if (
    kind === "scale-building" &&
    !["both", "x", "y"].includes(d.axes as string)
  )
    invalid();
  return Object.freeze({ ...d }) as CityGestureTarget;
}
function center(building: CityBuilding): Point {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of building.footprint.outer) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return cityInputPoint({ x: minX / 2 + maxX / 2, y: minY / 2 + maxY / 2 });
}
function vector(point: Point, origin: Point): Point {
  return cityInputPoint({ x: point.x - origin.x, y: point.y - origin.y });
}
/** Local-meter adapter; the Atlas router retains projection, capture and tool selection. */
export class CityGesture {
  readonly target: CityGestureTarget;
  private readonly draft: CityDraft;
  private readonly start: Point;
  private readonly edit: (point: Point) => CityEdit;
  constructor(
    source: CitySource,
    address: CityGestureTarget,
    startPoint: Point,
  ) {
    this.target = target(address, source.id);
    this.start = cityInputPoint(startPoint);
    this.draft = new CityDraft(source);
    const t = this.target,
      before = this.draft.before;
    const moved = (position: Point, point: Point) =>
      cityInputPoint({
        x: position.x + (point.x - this.start.x),
        y: position.y + (point.y - this.start.y),
      });
    if (t.kind === "move-node") {
      const node = before.roadNodes.find((n) => n.id === t.nodeId);
      if (!node) invalid();
      this.edit = (point) => ({
        kind: "move-node",
        nodeId: node.id,
        point: moved(node.point, point),
      });
    } else if (t.kind === "move-road-point") {
      const road = before.roads.find((r) => r.id === t.roadId),
        initial = road?.via[t.viaIndex];
      if (!road || !initial) invalid();
      this.edit = (point) => ({
        kind: "replace-road",
        roadId: road.id,
        road: {
          ...road,
          via: road.via.map((p, i) =>
            i === t.viaIndex ? moved(initial, point) : p,
          ),
        },
      });
    } else {
      const building = before.buildings.find((b) => b.id === t.buildingId);
      if (!building) invalid();
      const poseEdit = (pose: CityBuildingPose): CityEdit => ({
        kind: "set-building-pose",
        buildingId: building.id,
        position: pose.position,
        rotationRadians: pose.rotationRadians,
        scale: pose.scale,
      });
      if (t.kind === "move-building") {
        this.edit = (point) =>
          poseEdit({ ...building, position: moved(building.position, point) });
      } else {
        const pivotLocal = center(building),
          pivot = cityBuildingPoint(building, pivotLocal);
        const anchorPose = (
          rotationRadians: number,
          scale: Point,
        ): CityEdit => {
          if (
            rotationRadians === building.rotationRadians &&
            scale.x === building.scale.x &&
            scale.y === building.scale.y
          )
            return poseEdit(building);
          const offset = cityBuildingPoint(
            { position: { x: 0, y: 0 }, rotationRadians, scale },
            pivotLocal,
          );
          return poseEdit({
            position: vector(pivot, offset),
            rotationRadians,
            scale,
          });
        };
        if (t.kind === "rotate-building") {
          const initial = vector(this.start, pivot);
          if (initial.x === 0 && initial.y === 0) invalid();
          const angle = Math.atan2(initial.y, initial.x);
          this.edit = (point) => {
            const current = vector(point, pivot);
            if (current.x === 0 && current.y === 0) invalid();
            if (point.x === this.start.x && point.y === this.start.y)
              return poseEdit(building);
            const difference = Math.atan2(current.y, current.x) - angle;
            const delta = Math.atan2(
              Math.sin(difference),
              Math.cos(difference),
            );
            return anchorPose(building.rotationRadians + delta, building.scale);
          };
        } else {
          const initial = vector(
            cityBuildingLocalPoint(building, this.start),
            pivotLocal,
          );
          const x = t.axes !== "y",
            y = t.axes !== "x";
          if ((x && initial.x === 0) || (y && initial.y === 0)) invalid();
          this.edit = (point) => {
            if (point.x === this.start.x && point.y === this.start.y)
              return poseEdit(building);
            const current = vector(
              cityBuildingLocalPoint(building, point),
              pivotLocal,
            );
            const scale = cityInputPoint({
              x: x
                ? building.scale.x * (current.x / initial.x)
                : building.scale.x,
              y: y
                ? building.scale.y * (current.y / initial.y)
                : building.scale.y,
            });
            if (scale.x <= 0 || scale.y <= 0) invalid();
            return anchorPose(building.rotationRadians, scale);
          };
        }
      }
    }
  }
  get before() {
    return this.draft.before;
  }
  get state() {
    return this.draft.state;
  }
  get preview() {
    return this.draft.preview;
  }
  update(point: Point): CityDraftPreview {
    this.draft.clearPreview();
    return this.draft.setEdits([this.edit(cityInputPoint(point))]);
  }
  apply(label: string): boolean {
    return this.draft.apply(label);
  }
  cancel(): boolean {
    return this.draft.cancel();
  }
}
