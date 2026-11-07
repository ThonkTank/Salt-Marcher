import type {
  Status,
  Version,
  ValidPreview,
  Road,
  Parcel,
  House,
} from "../../src/atlas/model";
import { parcelTransform } from "../../src/atlas/parcelEditor";
export const status = (revision = 0): Status => ({
  sessionId: "test-session",
  revision,
  path: null,
  dirty: false,
  canUndo: false,
  canRedo: false,
  changes: null,
});
export function preview(
  version: Version = status(),
  changed = true,
): ValidPreview {
  return {
    valid: true,
    version: { ...version },
    status: { ...status(), ...version },
    changed,
    objects: [],
    removed: [],
    deletedIds: [],
    removedConnections: [],
    cascadeCounts: {
      roads: 0,
      parcels: 0,
      houses: 0,
      rooms: 0,
      connections: 0,
    },
    generationSummary: {
      createdParcels: 0,
      createdHouses: 0,
      emptyParcels: 0,
      skippedParcels: 0,
      unplacedHouses: 0,
      limited: false,
    },
    generationDiagnostics: [],
    generationLimit: null,
  };
}
export function workflowObjects() {
  const road: Road = {
    kind: "road",
    id: "road-1",
    name: "Test",
    width: 10,
    material: "earth",
    nodes: [
      { id: "node-2", point: [0, 0], incoming: null, outgoing: null },
      { id: "node-3", point: [80, 0], incoming: null, outgoing: null },
    ],
    path: [
      [0, 0],
      [80, 0],
    ],
    sections: [{ id: "section-4", populatedSides: [] }],
    edgeSections: ["section-4"],
    populationRecipe: null,
  };
  const parcel: Parcel = {
    kind: "parcel",
    id: "parcel-5",
    source: { kind: "detached" },
    polygon: [
      [-20, -20],
      [60, -20],
      [60, 100],
      [-20, 100],
    ],
    frame: { x: 10, y: 20, angle: 0.37 },
  };
  const house: House = {
    kind: "house",
    importantPlace: false,
    foundation: { height: 1, transition: 10 },
    id: "house-6",
    name: "Haus",
    roof: "#888888",
    placement: {
      kind: "parcel",
      parcelId: parcel.id,
      gridPose: { xCells: -2, yCells: 1, quarterTurns: 0 },
    },
    transform: parcelTransform(parcel.frame, {
      xCells: -2,
      yCells: 1,
      quarterTurns: 0,
    }),
    contours: [
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
    ],
    occupancyContours: [],
    occupancyBounds: [0, 0, 10, 10],
  };
  return { road, parcel, house };
}
