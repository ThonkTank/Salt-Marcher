import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
import {
  DungeonAtlasSource,
  dungeonDocumentChange,
} from "../../src/features/dungeon/atlas-source";
import { parseDocument, serializeDocument } from "../../src/model";
import { Session } from "../../src/session";

const root = "tests/fixtures/atlas-e2e-v1",
  inputPath = `${root}/input/Dungeons/E2E-01-Testdungeon/Karte.dungeon`,
  expectedPath = `${root}/expected/Dungeons/E2E-01-Testdungeon/Karte.dungeon`,
  manifest = JSON.parse(readFileSync(`${root}/dungeon-manifest.json`, "utf8")) as {
    input: { sha256: string; bytes: number };
    expected: { sha256: string; bytes: number };
  },
  inputBytes = readFileSync(inputPath, "utf8"),
  expectedBytes = readFileSync(expectedPath, "utf8"),
  input = parseDocument(inputBytes),
  expected = parseDocument(expectedBytes),
  dungeonId = "00000000-0000-4000-8000-000000000030",
  roomId = "00000000-0000-4000-8000-000000000031",
  floorId = "00000000-0000-4000-8000-000000000032",
  routeId = "00000000-0000-4000-8000-000000000033",
  sectionId = "00000000-0000-4000-8000-000000000034";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

test("E2E-01 Dungeon fixture is the canonical native document and Key closure", () => {
  assert.equal(sha256(inputBytes), manifest.input.sha256);
  assert.equal(Buffer.byteLength(inputBytes), manifest.input.bytes);
  assert.equal(sha256(expectedBytes), manifest.expected.sha256);
  assert.equal(Buffer.byteLength(expectedBytes), manifest.expected.bytes);
  assert.equal(serializeDocument(input), inputBytes);
  assert.equal(serializeDocument(expected), expectedBytes);
  assert.equal(input.id, dungeonId);
  assert.equal(input.floors[0]?.id, floorId);
  assert.equal(input.entities[0]?.id, roomId);
  assert.equal(input.content.routes[0]?.id, routeId);
  assert.equal(input.content.routes[0]?.entrance, true);
  assert.equal(input.content.routes[0]?.fromRoomId, undefined);
  assert.equal(input.content.routes[0]?.toRoomId, roomId);

  const source = new DungeonAtlasSource(input, new AtlasHistory()),
    closure = source.read();
  assert.equal(closure.documentBytes, inputBytes);
  assert.deepEqual(closure.keyClosure, [{
    roomId,
    sectionId,
    kind: "markdown",
    markdown: "## Eingang\r\nDie Basalttür ist geschlossen.  \r\n",
  }]);
  assert.equal("revision" in closure, false);
  assert.ok(Object.isFrozen(closure.document));
  assert.ok(Object.isFrozen(closure.keyClosure));
});

test("Dungeon owner composes once with another Atlas owner and leaves Session history untouched", () => {
  const history = new AtlasHistory(),
    session = new Session(input),
    source = new DungeonAtlasSource(session, history),
    sessionBytes = serializeDocument(session.document());
  history.register("spatial-owner", (_target, value) => {
    if (typeof value !== "number") throw new Error("bad spatial value");
  });
  history.hydrate("spatial-owner", [["placement", 1]]);

  assert.equal(history.execute({
    label: "Dungeon-Key und räumliche Gegenstelle",
    changes: [
      dungeonDocumentChange(input, expected),
      { ownerId: "spatial-owner", target: "placement", before: 1, after: 2 },
    ],
  }), true);
  assert.equal(source.read().documentBytes, expectedBytes);
  assert.equal(history.read("spatial-owner", "placement"), 2);
  assert.equal(history.undoDepth, 1);
  assert.equal(session.historySize, 0);
  assert.equal(serializeDocument(session.document()), sessionBytes);
  assert.equal(session.revision, 0);

  assert.equal(history.undo(), true);
  assert.equal(source.read().documentBytes, inputBytes);
  assert.equal(history.read("spatial-owner", "placement"), 1);
  assert.equal(history.redo(), true);
  assert.equal(source.read().documentBytes, expectedBytes);
  assert.equal(history.read("spatial-owner", "placement"), 2);
});

test("foreign, invalid and stale Dungeon snapshots fail before any combined owner mutation", () => {
  const history = new AtlasHistory(),
    source = new DungeonAtlasSource(input, history);
  history.register("spatial-owner", (_target, value) => {
    if (typeof value !== "number") throw new Error("bad spatial value");
  });
  history.hydrate("spatial-owner", [["placement", 1]]);
  const foreign = { ...expected, id: "00000000-0000-4000-8000-000000000099" };
  assert.throws(() => dungeonDocumentChange(input, foreign), /Dungeonkennung/);
  assert.throws(() => history.execute({ label: "stale", changes: [
    dungeonDocumentChange(expected, input),
    { ownerId: "spatial-owner", target: "placement", before: 1, after: 2 },
  ] }), /kollidiert/);
  assert.equal(source.read().documentBytes, inputBytes);
  assert.equal(history.read("spatial-owner", "placement"), 1);
  assert.equal(history.undoDepth, 0);

  const change = dungeonDocumentChange(input, expected);
  assert.throws(() => history.execute({ label: "invalid target", changes: [
    { ...change, target: "session-revision", before: null },
    { ownerId: "spatial-owner", target: "placement", before: 1, after: 2 },
  ] }), /Befehlsziel/);
  assert.equal(source.read().documentBytes, inputBytes);
  assert.equal(history.read("spatial-owner", "placement"), 1);
});
