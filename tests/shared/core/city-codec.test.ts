import assert from "node:assert/strict";
import test from "node:test";
import {
  newCityDocument,
  parseCityDocument,
  serializeCityDocument,
} from "../../../src/features/city/codec";

function square(size = 10, x = 0, y = 0) {
  return {
    outer: [
      { x, y },
      { x: x + size, y },
      { x: x + size, y: y + size },
      { x, y: y + size },
    ],
    holes: [] as { x: number; y: number }[][],
  };
}
function town() {
  const courtyard = square();
  courtyard.holes.push(square(2, 2, 2).outer);
  return {
    ...newCityDocument("city-a", "Teststadt"),
    roadNodes: [
      { id: "n-west", point: { x: -20, y: 0 } },
      { id: "n-east", point: { x: 20, y: 0 } },
    ],
    roads: [
      {
        id: "road-a",
        startNodeId: "n-west",
        endNodeId: "n-east",
        via: [{ x: 0, y: -5 }],
        widthMeters: 4.5,
      },
    ],
    plazas: [
      { id: "plaza-a", name: " Marktplatz ", outline: square(6, -3, 1) },
    ],
    districts: [
      { id: "district-a", name: "Altstadt", outline: square(100, -50, -50) },
    ],
    plots: [
      { id: "plot-a", outline: square(20, -10, -30), districtId: "district-a" },
    ],
    buildings: [
      {
        id: "house-a",
        name: "Haus mit Innenhof",
        footprint: courtyard,
        position: { x: -9.25, y: -25 },
        rotationRadians: Math.PI / 4,
        scale: { x: 0.8, y: 1.2 },
        plotId: "plot-a",
      },
      {
        id: "house-b",
        name: "",
        footprint: square(7),
        position: { x: 9.5, y: 11.5 },
        rotationRadians: -Math.PI * 3,
        scale: { x: 1, y: 1 },
        plotId: "plot-a",
      },
    ],
  };
}
function parse(value: unknown) {
  return parseCityDocument(JSON.stringify(value));
}

test("native city lists reject extra data and missing entries before serialization loses them", () => {
  for (const key of [
    "roadNodes",
    "roads",
    "plazas",
    "plots",
    "districts",
    "buildings",
  ] as const) {
    const extra = Object.assign([], { future: "must not disappear" });
    assert.throws(
      () => serializeCityDocument({ ...town(), [key]: extra }),
      /Liste/,
    );
    const sparse = new Array(1);
    assert.throws(
      () => serializeCityDocument({ ...town(), [key]: sparse }),
      /Liste/,
    );
  }
  const nested = town();
  Object.assign(nested.buildings[0]!.footprint.outer, { future: true });
  assert.throws(() => serializeCityDocument(nested), /Liste/);
  const accessor = town();
  Object.defineProperty(accessor.roads[0]!.via, "0", {
    get() {
      throw new Error("must not run");
    },
    enumerable: true,
  });
  assert.throws(() => serializeCityDocument(accessor), /berechnete Einträge/);
  const replacement = town();
  delete replacement.roads[0]!.via[0];
  Object.assign(replacement.roads[0]!.via, { future: true });
  assert.throws(() => serializeCityDocument(replacement), /ausgelassene/);
  class CustomList<T> extends Array<T> {}
  assert.throws(
    () => serializeCityDocument({ ...town(), roadNodes: new CustomList() }),
    /Liste/,
  );
});

test("native city roundtrip preserves materialized meters, all IDs, graph links and courtyard pose", () => {
  const source = town(),
    raw = serializeCityDocument(source),
    restored = parseCityDocument(raw);
  assert.deepEqual(restored, source);
  assert.equal(serializeCityDocument(restored), raw);
  assert.equal(restored.buildings[1]!.rotationRadians, -Math.PI * 3);
  assert.equal(restored.plazas[0]!.name, " Marktplatz ");
  assert.deepEqual(Object.keys(restored), [
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
  assert.equal(restored.roads[0]!.via.length, 1);
  assert.equal("start" in restored.roads[0]!, false);
});

test("empty city has no fixed canvas bounds or Atlas placement and never generates identifiers", () => {
  const document = newCityDocument("stable-city", " Stadt ");
  assert.equal(document.id, "stable-city");
  assert.equal(document.name, "Stadt");
  assert.deepEqual(
    parseCityDocument(serializeCityDocument(document)),
    document,
  );
  assert.deepEqual(document.buildings, []);
  assert.deepEqual(document.roadNodes, []);
  assert.equal("origin" in document, false);
  assert.equal("width" in document, false);
  assert.equal("height" in document, false);
  assert.equal("placements" in document, false);
});

test("city parser owns deeply frozen copies without freezing or changing the caller", () => {
  const source = town(),
    before = structuredClone(source);
  serializeCityDocument(source);
  assert.deepEqual(source, before);
  assert.equal(Object.isFrozen(source), false);
  assert.equal(Object.isFrozen(source.buildings[0]!.footprint.outer), false);
  const parsed = parse(source);
  for (const value of [
    parsed,
    parsed.buildings,
    parsed.buildings[0],
    parsed.buildings[0]!.position,
    parsed.buildings[0]!.scale,
    parsed.buildings[0]!.footprint,
    parsed.buildings[0]!.footprint.outer,
    parsed.buildings[0]!.footprint.outer[0],
    parsed.buildings[0]!.footprint.holes,
    parsed.buildings[0]!.footprint.holes[0],
    parsed.roads[0]!.via,
  ])
    assert.equal(Object.isFrozen(value), true);
  source.buildings[0]!.position.x = 777;
  assert.equal(
    parsed.buildings[0]!.position.x,
    before.buildings[0]!.position.x,
  );
  assert.throws(
    () => Object.assign(parsed.buildings[0]!.position, { x: 1 }),
    TypeError,
  );
});

test("strict city format rejects unknown versions, fields and units instead of dropping contents", () => {
  for (const value of [
    null,
    [],
    {},
    "city",
    { ...town(), version: 2 },
    { ...town(), units: "pixels" },
    { ...town(), kind: "dungeon-map" },
    { ...town(), origin: { x: 0, y: 0 } },
    { ...town(), width: 500 },
    { ...town(), seed: 17 },
    { ...town(), name: " " },
    { ...town(), id: "../city" },
  ])
    assert.throws(() => parse(value), /Ungültige Stadtdatei/);
  assert.throws(() => parseCityDocument("{broken"), /JSON/);
  const withUnknown = { ...town(), future: undefined };
  assert.throws(() => serializeCityDocument(withUnknown), /unbekannte Felder/);
  const withSymbol = { ...town(), [Symbol("future")]: "preserve" };
  assert.throws(() => serializeCityDocument(withSymbol), /unbekannte Felder/);
  const nested = town();
  Object.assign(nested.buildings[0]!.position, { future: true });
  assert.throws(() => serializeCityDocument(nested), /unbekannte Felder/);
  const computed = town();
  Object.defineProperty(computed, "name", {
    get() {
      throw new Error("must not run");
    },
  });
  assert.throws(
    () => serializeCityDocument(computed),
    /Berechnete Datenfelder/,
  );
});

test("city IDs are unique across entity kinds and references resolve to the proper collection", () => {
  const duplicate = town();
  duplicate.buildings[1]!.id = "road-a";
  assert.throws(() => parse(duplicate), /Doppelte Elementkennung/);
  const missingNode = town();
  missingNode.roads[0]!.endNodeId = "missing";
  assert.throws(() => parse(missingNode), /fehlenden Knoten/);
  const wrongNodeKind = town();
  wrongNodeKind.roads[0]!.endNodeId = "house-a";
  assert.throws(() => parse(wrongNodeKind), /fehlenden Knoten/);
  const missingPlot = town();
  missingPlot.buildings[0]!.plotId = "missing";
  assert.throws(() => parse(missingPlot), /fehlendes Grundstück/);
  const missingDistrict = town();
  missingDistrict.plots[0]!.districtId = "missing";
  assert.throws(() => parse(missingDistrict), /fehlendes Viertel/);
  const invalidID = town();
  invalidID.roads[0]!.id = "bad/id";
  assert.throws(() => parse(invalidID), /Kennung/);
});

test("native roads derive endpoints, reject zero segments and allow real closed loops", () => {
  const duplicatePoint = town();
  duplicatePoint.roads[0]!.via.unshift({ x: -20, y: 0 });
  assert.throws(() => parse(duplicatePoint), /Nullsegment/);
  const coincident = town();
  coincident.roadNodes[1]!.point = { x: -20, y: 0 };
  coincident.roads[0]!.via = [];
  assert.throws(() => parse(coincident), /Nullsegment/);
  const loop = town();
  loop.roads[0]!.endNodeId = "n-west";
  loop.roads[0]!.via = [
    { x: -20, y: -10 },
    { x: -10, y: -10 },
  ];
  assert.deepEqual(parse(loop), loop);
  const overflow = town();
  overflow.roadNodes[0]!.point.x = -Number.MAX_VALUE;
  overflow.roadNodes[1]!.point.x = Number.MAX_VALUE;
  overflow.roads[0]!.via = [];
  assert.throws(
    () => serializeCityDocument(overflow),
    /numerisch nicht prüfbar/,
  );
});

test("city numeric validation rejects nonfinite data, nonpositive width and unusable building poses", () => {
  for (const value of [NaN, Infinity, -Infinity, 0, -1]) {
    const width = town();
    width.roads[0]!.widthMeters = value;
    assert.throws(() => serializeCityDocument(width), /Stadtdatei/);
    const scale = town();
    scale.buildings[0]!.scale.x = value;
    assert.throws(() => serializeCityDocument(scale), /Stadtdatei/);
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    const position = town();
    position.buildings[0]!.position.y = value;
    assert.throws(() => serializeCityDocument(position), /nicht endlich/);
    const rotation = town();
    rotation.buildings[0]!.rotationRadians = value;
    assert.throws(() => serializeCityDocument(rotation), /nicht endlich/);
  }
  const overflow = town();
  overflow.buildings[0]!.scale.x = Number.MAX_VALUE;
  assert.throws(() => serializeCityDocument(overflow), /nicht endlich/);
  const collapsed = town();
  collapsed.buildings[0]!.position = { x: 1e20, y: 1e20 };
  assert.throws(() => serializeCityDocument(collapsed), /entartet/);
});

test("city topology rejects self crossings, repeated closure, invalid courtyards and collinear rings", () => {
  const malformed = [
    {
      outer: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ],
      holes: [],
    },
    { outer: [...square().outer, { x: 0, y: 0 }], holes: [] },
    { outer: square().outer, holes: [square(2, 9, 9).outer] },
    { outer: square().outer, holes: [square(2, 0, 0).outer] },
    {
      outer: square().outer,
      holes: [square(3, 2, 2).outer, square(3, 3, 3).outer],
    },
    {
      outer: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      holes: [],
    },
    {
      outer: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      holes: [],
    },
  ];
  for (const polygon of malformed) {
    const document = town();
    document.buildings[0]!.footprint = polygon;
    assert.throws(() => parse(document), /Stadtdatei/);
  }
});

test("local meter topology keeps small contours and far translated shapes without canvas limits", () => {
  const document = town();
  document.plazas[0]!.outline = square(100, -1e12, 1e12);
  document.buildings[0]!.footprint = square(0.001);
  document.buildings[0]!.position = { x: -100, y: 150 };
  document.buildings[0]!.rotationRadians = 0.1;
  document.buildings[0]!.scale = { x: 1, y: 1 };
  document.buildings[1]!.position = { x: 1e9, y: -1e9 };
  assert.deepEqual(parse(document), document);
  const huge = town();
  huge.plazas[0]!.outline = square(1e200);
  assert.throws(() => serializeCityDocument(huge), /numerisch nicht prüfbar/);
});

test("every native city collection and nested field is checked on parsing and serialization", () => {
  for (const key of [
    "roadNodes",
    "roads",
    "plazas",
    "plots",
    "districts",
    "buildings",
  ] as const) {
    assert.throws(() => parse({ ...town(), [key]: null }), /Liste/);
    assert.throws(() => parse({ ...town(), [key]: [{}] }), /Felder/);
  }
  const missing = { ...town() } as { units?: string };
  delete missing.units;
  assert.throws(() => parse(missing), /Felder/);
  assert.throws(
    () =>
      parse({ ...town(), roadNodes: [{ id: "a", point: { x: "1", y: 0 } }] }),
    /nicht endlich/,
  );
  assert.throws(
    () =>
      serializeCityDocument({
        ...town(),
        plots: [{ ...town().plots[0]!, districtId: undefined }],
      }),
    /Kennung/,
  );
});
