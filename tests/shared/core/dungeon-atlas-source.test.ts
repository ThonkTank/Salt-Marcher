import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isStructuredRoom,
  parseDocument,
  serializeDocument,
} from "../../../src/model";

const root = "tests/fixtures/atlas-e2e-v1",
  inputPath = `${root}/input/Dungeons/E2E-01-Testdungeon/Karte.dungeon`,
  expectedPath = `${root}/expected/Dungeons/E2E-01-Testdungeon/Karte.dungeon`,
  manifest = JSON.parse(
    readFileSync(`${root}/dungeon-manifest.json`, "utf8"),
  ) as {
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

  const room = input.entities.find(isStructuredRoom)!;
  assert.equal(room.id, roomId);
  assert.deepEqual(room.key.sections, [
    {
      id: sectionId,
      kind: "markdown",
      markdown: "## Eingang\r\nDie Basalttür ist geschlossen.  \r\n",
    },
  ]);
});
