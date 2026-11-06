import { expect, it } from "vitest";
import { paintCity } from "./cityPaint";
import { decideLod } from "./lod";
import type { MapFeature } from "./generated/MapFeature";
import type { CityView } from "./cityView";

it("paints supplied immutable features in layer and author order", () => {
  const calls: string[] = [];
  const c = {
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    save() {},
    restore() {},
    fill(this: { fillStyle: string }) {
      calls.push(`fill:${this.fillStyle}`);
    },
    stroke(this: { strokeStyle: string }) {
      calls.push(`stroke:${this.strokeStyle}`);
    },
    fillRect() {
      calls.push("density");
    },
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    lineJoin: "",
    lineCap: "",
  } as unknown as CanvasRenderingContext2D;
  const f = (id: string, kind: string, rank: number): MapFeature => ({
    id,
    kind,
    rank,
    name: "",
    important: false,
    paths: [
      [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
    ],
    color: id,
    width: 20,
  });
  const features = Object.freeze([
    f("late", "area", 2),
    f("scenery", "scenery", 1),
    f("early", "area", 1),
    f("exact", "road", 1000),
    f("road", "road", 1000),
    f("house", "house", 10000),
  ]);
  const view = {
    level: 0,
    tiles: [
      { x: 0, y: 0, density: [[0, 0, 1]], features: [f("wrong", "area", 0)] },
    ],
  } as CityView;
  paintCity(c, view, features, 1, decideLod(1).policy, "exact", () =>
    calls.push("water"),
  );
  expect(calls).toEqual([
    "fill:early",
    "fill:late",
    "fill:scenery",
    "water",
    "density",
    "stroke:road",
    "fill:house",
    "stroke:#514c43",
  ]);
  expect(features.map((x) => x.id)).toEqual([
    "late",
    "scenery",
    "early",
    "exact",
    "road",
    "house",
  ]);
});
