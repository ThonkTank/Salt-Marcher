import { decideLod } from "./lod";
import { CityCache } from "./presentationCache";
import { describe, expect, it } from "vitest";
import { cityRequest, zoomIntoCity } from "./cityView";
import { AtlasClient } from "./client";
import { layoutLabels } from "./mapLabels";
import type { MapFeature } from "./generated/MapFeature";
import type { Status } from "./model";
const status: Status = {
  sessionId: "city",
  revision: 1,
  path: null,
  dirty: false,
  canUndo: false,
  canRedo: false,
  changes: null,
};
const house = (id: string, x: number, important = false): MapFeature => ({
  id,
  kind: "house",
  name: id,
  important,
  paths: [
    [
      [x, 40],
      [x + 30, 40],
      [x + 30, 70],
      [x, 70],
    ],
  ],
  color: "#aaaaaa",
  width: 0,
  rank: 900,
});
const measure = (s: string) => [...s].length * 7;
describe("city presentation", () => {
  it("uses floor coordinates and retains a level inside its hysteresis band", () => {
    expect(cityRequest([-1, -1, 1, 1], 0).tiles).toEqual([
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0],
    ]);
    const decision = decideLod(0.03);
    const level = decision.cityLevel;
    expect(decideLod(0.031, decision).cityLevel).toBe(level);
    expect(decideLod(0.3, decision).cityLevel).not.toBe(level);
    expect(
      zoomIntoCity(
        { scale: 0.01, x: 100, y: 50 },
        [20, 30],
        decideLod(0.01).navigationLevel,
      ),
    ).toEqual({
      scale: 304.8 / 11250,
      x: 100 + 20 * (0.01 - 304.8 / 11250),
      y: 50 + 30 * (0.01 - 304.8 / 11250),
    });
  });
  it("prioritizes important places and avoids overlap across objects", () => {
    const labels = layoutLabels(
      [house("ordinary", 0), house("Rathaus", 2, true)],
      { scale: 1, x: 100, y: 100 },
      decideLod(1).policy,
      800,
      600,
      "",
      measure,
    );
    expect(labels[0].key).toContain("Rathaus");
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i].box,
          b = labels[j].box;
        expect(a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]).toBe(
          false,
        );
      }
    const overview = layoutLabels(
      [house("ordinary", 0), house("Rathaus", 2, true)],
      { scale: 0.02, x: 100, y: 100 },
      decideLod(0.02).policy,
      800,
      600,
      "",
      measure,
    );
    expect(overview.map((l) => l.key)).toEqual(["Rathaus/center"]);
  });
  it("labels segmented curved roads upright with stable pan anchors", () => {
    const road: MapFeature = {
      id: "road",
      kind: "road",
      name: "Lange Straße",
      important: false,
      paths: [
        Array.from({ length: 31 }, (_, i) => [
          900 - i * 25,
          100 + Math.sin(i / 30) * 10,
        ]),
      ],
      color: "",
      width: 20,
      rank: 15000,
    };
    const labels = layoutLabels(
      [road],
      { scale: 1, x: 0, y: 0 },
      decideLod(1).policy,
      1200,
      400,
      "",
      measure,
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => Math.abs(l.angle) <= Math.PI / 2)).toBe(true);
    const shifted = layoutLabels(
      [road],
      { scale: 1, x: 5, y: 0 },
      decideLod(1).policy,
      1200,
      400,
      "",
      measure,
      new Set(labels.map((l) => l.key)),
    );
    expect(shifted[0].key).toBe(labels[0].key);
    expect(shifted[0].x - labels[0].x).toBeCloseTo(5);
  });
  it("wraps Unicode names without splitting surrogate pairs and respects obstacles", () => {
    const f = house("👑".repeat(100), 0, true);
    const labels = layoutLabels(
      [f],
      { scale: 1, x: 200, y: 100 },
      decideLod(1).policy,
      800,
      600,
      "",
      measure,
    );
    expect(labels[0].lines).toHaveLength(2);
    expect(labels[0].lines[1].endsWith("…")).toBe(true);
    expect(
      layoutLabels(
        [f],
        { scale: 1, x: 200, y: 100 },
        decideLod(1).policy,
        800,
        600,
        "",
        measure,
        new Set(),
        [[0, 0, 800, 600]],
      ),
    ).toEqual([]);
  });
  it("reuses clean tiles, invalidates affected tiles and rejects stale reads", async () => {
    let calls = 0;
    const client = new AtlasClient(async (_cmd, args) => {
      calls++;
      return {
        status: currentStatus,
        level: args.level,
        tiles: (args.tiles as number[][]).map(([x, y]) => ({
          x,
          y,
          density: [],
          features: [],
        })),
      };
    });
    let currentStatus = status;
    const cache = new CityCache();
    await cache.load(client, status, [1, 1, 100, 100], 0, () => true);
    await cache.load(client, status, [1, 1, 100, 100], 0, () => true);
    expect(calls).toBe(1);
    currentStatus = {
      ...status,
      revision: 2,
      changes: {
        world: [[10000, 10000, 10010, 10010]],
        interiors: [],
        metadata: [],
        relations: [],
      },
    };
    await cache.load(client, currentStatus, [1, 1, 100, 100], 0, () => true);
    expect(calls).toBe(1);
    currentStatus = {
      ...currentStatus,
      revision: 3,
      changes: {
        world: [[0, 0, 20, 20]],
        interiors: [],
        metadata: [],
        relations: [],
      },
    };
    await cache.load(client, currentStatus, [1, 1, 100, 100], 0, () => true);
    expect(calls).toBe(2);
    await expect(
      cache.load(
        client,
        { ...currentStatus, revision: 4 },
        [1, 1, 100, 100],
        0,
        () => true,
      ),
    ).rejects.toThrow("Kartenstand");
  });
});
