import { describe, expect, it } from "vitest";
import { evaluateGesture, type Gesture } from "./interaction";
import { parcelGridRange } from "./parcelEditor";
import {
  contextKey,
  hitScene,
  parcelTransform,
  parcelVisibility,
  rotateParcelHouse,
} from "./parcelEditor";
import {
  toWorld,
  type House,
  type Parcel,
  type Scene,
  type WorldPoint,
} from "./model";

const parcel: Parcel = {
  kind: "parcel",
  id: "parcel-1",
  source: { kind: "detached" },
  frame: { x: 13.5, y: 21.25, angle: 0.37 },
  polygon: [],
};
parcel.polygon = [
  [-10, -10],
  [10, -10],
  [10, 10],
  [-10, 10],
].map((p) => toWorld(p as [number, number], parcel.frame));
const house: House = {
  kind: "house",
  importantPlace: false,
  foundation: { height: 1, transition: 10 },
  id: "house-2",
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
const evaluate = (
  gesture: Gesture,
  point: WorldPoint,
  finish = true,
  screen: [number, number] = [20, 20],
) =>
  evaluateGesture(gesture, {
    pointer: 1,
    point,
    snapped: [999, 999],
    screen,
    finish,
  })!;

describe("parcel editor geometry and identities", () => {
  it("keeps all quarter turns and movement on the parcel lattice at an arbitrary world frame", () => {
    for (const quarterTurns of [0, 1, 2, 3] as const) {
      const pose = { xCells: -2, yCells: 1, quarterTurns };
      const h: House = {
        ...house,
        placement: { kind: "parcel", parcelId: parcel.id, gridPose: pose },
        transform: parcelTransform(parcel.frame, pose),
      };
      const g: Gesture = {
        pointer: 1,
        screen: [0, 0],
        start: toWorld([0.2, 0.3], parcel.frame),
        kind: "houseTransform",
        object: h,
        parcel,
        mode: "move",
      };
      const result = evaluate(g, toWorld([2.69, -0.21], parcel.frame));
      expect(result.intent).toEqual({
        type: "transformHouse",
        id: h.id,
        transform: parcelTransform(parcel.frame, {
          xCells: 0,
          yCells: 0,
          quarterTurns,
        }),
      });
      const rotated = rotateParcelHouse(h, parcel, 1);
      expect(rotated.x).toBe(h.transform.x);
      expect(rotated.y).toBe(h.transform.y);
      expect(rotated.angle).toBe(
        parcel.frame.angle + (((quarterTurns + 1) % 4) * Math.PI) / 2,
      );
    }
  });
  it("never exposes a free rotation or guesses a frame for a bound house", () => {
    const base = {
      pointer: 1,
      screen: [0, 0] as [number, number],
      start: [0, 0] as WorldPoint,
      kind: "houseTransform" as const,
      object: house,
    };
    expect(evaluate({ ...base, mode: "move" }, [20, 20]).intent).toBeNull();
    expect(
      evaluate({ ...base, mode: "rotate", parcel }, [20, 20]).error,
    ).toContain("90°");
    const free = { ...house, placement: { kind: "free" as const } };
    expect(
      evaluate({ ...base, object: free, mode: "move" }, [20.25, 21.75]).intent,
    ).toEqual({
      type: "transformHouse",
      id: house.id,
      transform: {
        ...house.transform,
        x: house.transform.x + 20.25,
        y: house.transform.y + 21.75,
      },
    });
  });
  it("creates a bound rectangle in its pointerdown frame even beyond its polygon", () => {
    const result = evaluate(
      {
        pointer: 1,
        screen: [0, 0],
        start: toWorld([-2.2, 1.2], parcel.frame),
        kind: "houseRectangle",
        parcel,
      },
      toWorld([11.8, 4.2], parcel.frame),
    );
    expect(result.intent).toEqual({
      type: "createHouse",
      parcelId: parcel.id,
      width: 14,
      depth: 3,
      transform: parcelTransform(parcel.frame, {
        xCells: -2,
        yCells: 1,
        quarterTurns: 0,
      }),
    });
    expect(result.guide?.points[0]).toEqual(toWorld([-2, 1], parcel.frame));
    expect(result.guide?.points[2]).toEqual(toWorld([12, 4], parcel.frame));
  });
  it("draws the first basement cell in parcel coordinates, subsequent disconnected cells in house coordinates", () => {
    const start = toWorld([-3.7, 2.2], parcel.frame);
    const first = evaluate(
      {
        pointer: 1,
        screen: [0, 0],
        start,
        kind: "parcelRectangle",
        parcel,
        floor: -2,
      },
      start,
      true,
      [1, 1],
    );
    expect(first.intent).toEqual({
      type: "createParcelHouse",
      parcelId: parcel.id,
      floor: -2,
      cells: [[-4, 2]],
    });
    for (const quarterTurns of [0, 1, 2, 3] as const) {
      const h = {
        ...house,
        transform: parcelTransform(parcel.frame, {
          xCells: -2,
          yCells: 1,
          quarterTurns,
        }),
      };
      const p = toWorld([8.2, -3.7], h.transform);
      const next = evaluate(
        {
          pointer: 1,
          screen: [0, 0],
          start: p,
          kind: "interiorRectangle",
          house: h,
          floor: -2,
          tool: "draw",
          room: "",
        },
        p,
        true,
        [1, 1],
      );
      expect(next.intent).toEqual({
        type: "room",
        buildingId: h.id,
        intent: { kind: "draw", floor: -2, cells: [[8, -4]] },
      });
    }
  });
  it("orders house, road, visible parcel and newest terrain hits explicitly", () => {
    const area = {
      kind: "area" as const,
      id: "area-1",
      material: "grass",
      points: parcel.polygon,
      order: 1,
    };
    const road = {
      kind: "road" as const,
      id: "road-1",
      name: "Straße",
      material: "earth" as const,
      width: 4,
      nodes: [],
      path: [toWorld([-5, 2], parcel.frame), toWorld([5, 2], parcel.frame)],
      edgeSections: [],
      sections: [],
      populationRecipe: null,
    };
    const point = toWorld([-1, 2], parcel.frame);
    const all = [house, road, parcel, area];
    expect(hitScene(all, point, 0, [parcel.id])?.id).toBe(house.id);
    expect(hitScene(all.slice(1), point, 0, [parcel.id])?.id).toBe(road.id);
    expect(hitScene([parcel, area], point, 0, [parcel.id])?.id).toBe(parcel.id);
    expect(hitScene([parcel, area], point, 0, [])?.id).toBe(area.id);
    expect(
      hitScene([{ ...area, id: "new", order: 2 }, area], point, 0, [])?.id,
    ).toBe("new");
  });
  it("uses scene owner states for visibility including offscreen owners", () => {
    const scene = {
      objects: [parcel],
      contextState: {
        exists: true,
        parcelId: parcel.id,
        houseId: "offscreen-house",
      },
      selectionState: {
        exists: true,
        parcelId: parcel.id,
        houseId: "offscreen-house",
      },
    } as Scene;
    expect(
      parcelVisibility(scene, { kind: "parcel", parcelId: parcel.id }, "draw"),
    ).toEqual({ boundaries: [parcel.id], grids: [parcel.id] });
    expect(contextKey({ kind: "house", houseId: parcel.id })).not.toBe(
      contextKey({ kind: "parcel", parcelId: parcel.id }),
    );
  });
  it("suppresses grids below four pixels and restricts large offscreen polygons to the viewport", () => {
    const big: Parcel = {
      ...parcel,
      frame: { x: 0, y: 0, angle: 0 },
      polygon: [
        [-100000, -100000],
        [100000, -100000],
        [100000, 100000],
        [-100000, 100000],
      ],
    };
    expect(parcelGridRange(big, [0, 0, 100, 50], 0.799)).toBeNull();
    expect(parcelGridRange(big, [0, 0, 100, 50], 0.8)).toEqual([0, 0, 20, 10]);
    expect(
      parcelGridRange(big, [200000, 200000, 200050, 200050], 2),
    ).toBeNull();
  });
});
