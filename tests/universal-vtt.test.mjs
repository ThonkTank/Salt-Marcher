import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeUniversalVtt03 } from "../src/features/verwaltung/universal-vtt.ts";

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

test("does not invent native LOS, object LOS, portal or light records", () => {
  for (const key of ["lineOfSightSegments", "objectLineOfSightSegments", "portals", "lights"]) {
    assert.throws(
      () => serializeUniversalVtt03({ ...input(), [key]: [{ x: 1, y: 1 }] }),
      /native Datenform ist noch nicht belegt/,
      key,
    );
  }
});
