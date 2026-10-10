import {
  buildingPointDragDestination,
  buildingVertexGrip,
  proposeBuildingPointDrag,
  type BuildingVertexGrip,
} from "../bau/building-point-gestures";
import { planBuildingContourMutation } from "../../commands";
import {
  buildingContourEntries,
} from "../../geometry";
import {
  isStructuredRoom,
  serializeDocument,
  type MapDocument,
  type Point,
  type RoomV4,
} from "../../model";
import { projectDocumentCommand } from "../../session";
import {
  type AtlasChange,
  type AtlasReadView,
  type AtlasValue,
} from "../atlas/atlas-history";
import {
  sameDungeonSpatialBasis,
  type DungeonSpatialBasis,
  type SpatialGraph,
} from "../atlas/spatial-graph";
import {
  dungeonDocumentChange,
  type DungeonAtlasSnapshot,
  type DungeonAtlasSource,
} from "./atlas-source";

export interface DungeonGeometryAccess {
  graph(): SpatialGraph;
  dungeon(id: string): DungeonAtlasSource;
}

export interface DungeonGeometryAddress {
  readonly ownerId: string;
  readonly floorId: string;
  readonly roomId: string;
  readonly contour: number;
  readonly point: number;
}

export interface DungeonGeometryProposal {
  readonly before: DungeonAtlasSnapshot;
  readonly address: DungeonGeometryAddress;
  readonly basis: DungeonSpatialBasis;
  readonly preview: MapDocument;
  readonly change: AtlasChange;
}

type GestureState = "active" | "changed-basis" | "cancelled" | "handed-off";

function roomOf(
  document: MapDocument,
  floorId: string,
  roomId: string,
): RoomV4 {
  const room = document.entities.find((entity) => entity.id === roomId);
  if (!room || !isStructuredRoom(room) || room.floorId !== floorId)
    throw new Error("Raum oder Geschoss ist nicht mehr verfügbar.");
  if (room.locked) throw new Error("Gesperrter Raum kann nicht bearbeitet werden.");
  return room;
}

function prospectiveView(
  basis: DungeonSpatialBasis,
  ownerId: string,
  bytes: string,
): AtlasReadView {
  const history = basis.history;
  return Object.freeze({
    read: (id: string, target: string): AtlasValue =>
      id === ownerId && target === "document"
        ? bytes
        : history.read(id, target),
    entries: (id: string) =>
      history.entries(id).map(([target, value]) =>
        id === ownerId && target === "document"
          ? Object.freeze([target, bytes] as const)
          : Object.freeze([target, value] as const),
      ),
  });
}

/**
 * A single transient outer-contour gesture. It never executes history and
 * becomes terminally stale on the first shared-history notification.
 */
export class DungeonGeometryGesture {
  readonly before: DungeonAtlasSnapshot;
  readonly address: DungeonGeometryAddress;
  readonly basis: DungeonSpatialBasis;
  readonly grip: BuildingVertexGrip;
  private state: GestureState = "active";
  private unsubscribe: () => void;
  private current?: DungeonGeometryProposal;

  constructor(
    private readonly access: DungeonGeometryAccess,
    request: {
      ownerId: string;
      floorId: string;
      roomId: string;
      pointer: Point;
      tolerance: number;
      invalidated?: () => void;
    },
  ) {
    const graph = access.graph(),
      source = access.dungeon(request.ownerId),
      basis = graph.dungeonBasis(request.ownerId),
      before = source.read();
    if (
      basis.graph !== graph ||
      basis.dungeonSource !== source ||
      basis.history !== source.history
    )
      throw new Error("Dungeon gehört nicht zur aktuellen räumlichen Lebensdauer.");
    const room = roomOf(before.document, request.floorId, request.roomId),
      grip = buildingVertexGrip(room, request.pointer, request.tolerance),
      contour = grip && buildingContourEntries(room)[grip.contour];
    if (!grip || !contour || contour.hole !== undefined)
      throw new Error("Nur ein äußerer Raumkonturpunkt kann gezogen werden.");
    this.before = before;
    this.basis = basis;
    this.grip = Object.freeze({ ...grip, point: Object.freeze({ ...grip.point }) });
    this.address = Object.freeze({
      ownerId: request.ownerId,
      floorId: request.floorId,
      roomId: request.roomId,
      contour: grip.contour,
      point: grip.index,
    });
    this.unsubscribe = basis.history.subscribe(() => {
      this.changedBasis();
      request.invalidated?.();
    });
  }

  get status(): GestureState {
    return this.state;
  }

  get preview(): MapDocument | undefined {
    return this.current?.preview;
  }

  private finish(state: Exclude<GestureState, "active">): void {
    if (this.state !== "active") return;
    this.state = state;
    this.current = undefined;
    this.unsubscribe();
  }

  private changedBasis(): void {
    this.finish("changed-basis");
  }

  private currentBasis(): DungeonSpatialBasis | null {
    if (this.state !== "active") return null;
    try {
      const graph = this.access.graph(),
        source = this.access.dungeon(this.address.ownerId),
        basis = graph.dungeonBasis(this.address.ownerId);
      if (
        graph !== this.basis.graph ||
        source !== this.basis.dungeonSource ||
        source.history !== this.basis.history ||
        source.read().documentBytes !== this.before.documentBytes ||
        !sameDungeonSpatialBasis(this.basis, basis)
      ) {
        this.changedBasis();
        return null;
      }
      return basis;
    } catch {
      this.changedBasis();
      return null;
    }
  }

  update(pointer: Point, snap: boolean): DungeonGeometryProposal | null {
    const basis = this.currentBasis();
    if (!basis || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y))
      return null;
    const beforeRoom = roomOf(
        this.before.document,
        this.address.floorId,
        this.address.roomId,
      ),
      destination = buildingPointDragDestination(
        this.grip,
        this.grip.point,
        pointer,
        snap,
      );
    if (destination.x === this.grip.point.x && destination.y === this.grip.point.y) {
      this.current = undefined;
      return null;
    }
    const geometry = proposeBuildingPointDrag(beforeRoom, this.grip, destination);
    if (!geometry) {
      this.current = undefined;
      return null;
    }
    const command = planBuildingContourMutation({
      entities: this.before.document.entities,
      before: beforeRoom,
      ...geometry,
    });
    if (!command) {
      this.current = undefined;
      return null;
    }
    const preview = projectDocumentCommand(this.before.document, command),
      bytes = serializeDocument(preview);
    // The same existing graph/preflight validates Floor/Room/Route closure.
    basis.graph.frame(
      this.address.ownerId,
      prospectiveView(basis, this.address.ownerId, bytes),
    );
    if (!this.currentBasis()) return null;
    const proposal = Object.freeze({
      before: this.before,
      address: this.address,
      basis: this.basis,
      preview,
      change: dungeonDocumentChange(this.before.document, preview),
    }) as DungeonGeometryProposal;
    this.current = proposal;
    return proposal;
  }

  cancel(): void {
    this.finish("cancelled");
  }

  /** Return at most one owner change; the caller remains the only executor. */
  handoff(): AtlasChange | null {
    if (!this.current || !this.currentBasis()) return null;
    const change = this.current.change;
    this.finish("handed-off");
    return change;
  }
}
