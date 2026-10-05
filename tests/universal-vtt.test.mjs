import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serializeUniversalVtt03,
  universalVttLightFromMapLight,
} from "../src/features/verwaltung/universal-vtt.ts";

// A real 2×2 transparent RGBA PNG. The native sample is 8×8 fields at 256 px.
const png = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAC0lEQVR4nGNgQAcAABIAAXfx+gAAAAAASUVORK5CYII=";
const input = () => ({
  renderedPngDataUrl: `data:image/png;base64,${png}`,
  mapWidthFields: 2,
  mapHeightFields: 2,
  pixelsPerGrid: 1,
  lineOfSightSegments: [],
  objectLineOfSightSegments: [],
  portals: [],
  lights: [],
  ambientLightHex: "FFFFFFFF",
});

test("DD-043.22 writes the measured native envelope with raw PNG base64", () => {
  const first = serializeUniversalVtt03(input());
  assert.equal(serializeUniversalVtt03(input()), first);
  assert.deepEqual(JSON.parse(first), {
    format: 0.3,
    resolution: {
      map_origin: { x: 0, y: 0 },
      map_size: { x: 2, y: 2 },
      pixels_per_grid: 1,
    },
    line_of_sight: [],
    objects_line_of_sight: [],
    portals: [],
    environment: { baked_lighting: true, ambient_light: "ffffffff" },
    lights: [],
    image: png,
  });
  assert.equal(first.endsWith("\n"), true);
});

test("rejects invalid grid dimensions, PNG data and mismatched pixels", () => {
  assert.throws(() => serializeUniversalVtt03({ ...input(), mapWidthFields: 0 }), RangeError);
  assert.throws(() => serializeUniversalVtt03({ ...input(), pixelsPerGrid: 1.5 }), RangeError);
  assert.throws(() => serializeUniversalVtt03({ ...input(), pixelsPerGrid: 2 }), /PNG-Abmessungen/);
  assert.throws(() => serializeUniversalVtt03({ ...input(), renderedPngDataUrl: "data:image/jpeg;base64," + png }), /PNG/);
  assert.throws(() => serializeUniversalVtt03({ ...input(), renderedPngDataUrl: "data:image/png;base64,!!!" }), /Base64/);
  assert.throws(() => serializeUniversalVtt03({ ...input(), ambientLightHex: "ffffff" }), /acht Hexadezimalstellen/);
});

// /qa/groups/verwaltung-export/native/runs/20261005-134626-3046382/
// evidence/exports/wall-portal-light.dd2vtt, Dungeondraft 1.2.0.1.
const nativeLine = [
  { x: 6, y: 3.5 }, { x: 6, y: 4 }, { x: 4, y: 5 },
  { x: 2, y: 2 }, { x: 4, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 2.5 },
];
const nativePortal = {
  position: { x: 6, y: 3 },
  bounds: [{ x: 6, y: 2.5 }, { x: 6, y: 3.5 }],
  rotation: 1.570796,
  closed: true,
  freestanding: false,
};
const nativeLight = {
  position: { x: 4, y: 2.84375 },
  range: 5,
  intensity: 1,
  color: "ffeccd8b",
  shadows: true,
};

test("DD-043.22 reproduces the measured nonempty LOS, portal and light records", () => {
  const source = {
    ...input(),
    lineOfSightSegments: [nativeLine],
    portals: [nativePortal],
    lights: [nativeLight],
  };
  const result = JSON.parse(serializeUniversalVtt03(source));
  assert.deepEqual(result.line_of_sight, [nativeLine]);
  assert.deepEqual(result.portals, [nativePortal]);
  assert.deepEqual(result.lights, [nativeLight]);
  assert.deepEqual(source.portals[0].bounds, nativePortal.bounds);
  assert.equal(serializeUniversalVtt03(source), serializeUniversalVtt03(source));
});

test("maps the editor's RGB light to the directly observed opaque native VTT light", () => {
  assert.deepEqual(universalVttLightFromMapLight({
    x: 4, y: 2.84375, radius: 5, intensity: 1,
    color: 0xeccd8b, shadows: true,
  }), nativeLight);
  assert.throws(() => universalVttLightFromMapLight({
    x: 4, y: 2, radius: 5, intensity: 1,
    color: 0x1000000, shadows: true,
  }), /24-Bit-RGB/);
});

test("rejects malformed measured records and still refuses unmeasured object LOS", () => {
  assert.throws(() => serializeUniversalVtt03({
    ...input(), lineOfSightSegments: [[{ x: 1, y: 2 }]],
  }), /mindestens zwei Punkte/);
  assert.throws(() => serializeUniversalVtt03({
    ...input(), lineOfSightSegments: [[{ x: NaN, y: 2 }, { x: 3, y: 4 }]],
  }), /muss endlich sein/);
  assert.throws(() => serializeUniversalVtt03({
    ...input(), portals: [{ ...nativePortal, bounds: [nativePortal.bounds[0]] }],
  }), /bounds braucht zwei Punkte/);
  assert.throws(() => serializeUniversalVtt03({
    ...input(), portals: [{ ...nativePortal, rotation: Infinity }],
  }), /muss endlich sein/);
  assert.throws(() => serializeUniversalVtt03({
    ...input(), lights: [{ ...nativeLight, color: "eccd8b" }],
  }), /acht Hexadezimalstellen/);
  assert.throws(() => serializeUniversalVtt03({
    ...input(), objectLineOfSightSegments: [[{ x: 1, y: 1 }, { x: 2, y: 2 }]],
  }), /native Datenform ist noch nicht belegt/);
});
