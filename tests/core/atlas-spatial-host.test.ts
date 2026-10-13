import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Container } from "pixi.js";
import { AtlasRepository } from "../../src/features/atlas/atlas-repository";
import {
  CitySource,
  cityDocumentChange,
} from "../../src/features/city/commands";
import {
  DungeonAtlasSource,
  dungeonDocumentChange,
} from "../../src/features/dungeon/atlas-source";
import { AtlasRoomKeyDraft } from "../../src/features/dungeon/atlas-room-key-draft";
import { SpatialCanvas } from "../../src/features/atlas/spatial-canvas";
import { AtlasRenderer } from "../../src/features/atlas/atlas-renderer";
import {
  projectLocal,
  relativeCamera,
} from "../../src/features/atlas/relative-frame";
import { isStructuredRoom } from "../../src/model";
import { FileConflict, type FileStore } from "../../src/persistence";
import { editCity } from "../../src/features/city/edit";
import { createHash } from "node:crypto";
const fixture = "tests/fixtures/atlas-e2e-spatial-v2/",
  manifest = JSON.parse(readFileSync(fixture + "manifest.json", "utf8"));
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function setup(scale = 0.25) {
  const files = new Map<string, string>(
    manifest.input.map((r: { path: string; fixtureFile: string }) => [
      r.path,
      readFileSync(fixture + r.fixtureFile, "utf8"),
    ]),
  );
  const store: FileStore = {
    read: async (p) => files.get(p) ?? null,
    compareAndWrite: async (p, b, a) => {
      if ((files.get(p) ?? null) !== b) throw new FileConflict(p);
      if (a === null) files.delete(p);
      else files.set(p, a);
    },
  };
  const repo = new AtlasRepository(store, manifest.input[0].path, store, {
    locations: true,
    details: true,
    resolveDetail: async (_w, kind, owner) =>
      [...files]
        .filter(
          ([p, b]) => p.endsWith("." + kind) && JSON.parse(b).id === owner,
        )
        .map(([p]) => p),
  });
  const source = await repo.open(),
    city = repo.detail("city", id(100)),
    dungeon = repo.detail("dungeon", id(30));
  assert(city instanceof CitySource);
  assert(dungeon instanceof DungeonAtlasSource);
  const host = { dataset: {} as Record<string, string> };
  const renderer = {
    detailLayer: new Container(),
    relativeCamera: relativeCamera({ x: 0, y: 0 }, { x: 0, y: 0 }, scale),
    viewport: { width: 800, height: 600 },
    host,
  } as unknown as AtlasRenderer;
  const canvas = new SpatialCanvas(renderer, {
    graph: () => repo.spatialGraph,
    source: () => source,
    city: () => city,
    dungeon: () => dungeon,
  });
  const screen = (doc: string, p: { x: number; y: number }) =>
    projectLocal(
      repo.spatialGraph.frame(doc),
      renderer.relativeCamera,
      renderer.viewport,
      p,
    );
  return { files, repo, source, city, dungeon, renderer, canvas, host, screen };
}
test("Spatial v2 fixture has native metre footprint and complete byte oracles without changing v1", async () => {
  for (const group of [manifest.input, manifest.expected])
    for (const row of group) {
      const bytes = readFileSync(fixture + row.fixtureFile);
      assert.equal(bytes.length, row.bytes);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        row.sha256,
      );
    }
  const f = await setup(),
    house = f.city.read().buildings.find((b) => b.id === id(105))!;
  const room = f.dungeon.read().document.entities.find(isStructuredRoom)!;
  assert.equal(
    house.footprint.outer[1]!.x,
    (room.polygons[0]!.outer[1]!.x - room.polygons[0]!.outer[0]!.x) * 1.524,
  );
  assert.equal(house.footprint.outer[2]!.y, 8 * 1.524);
  f.canvas.destroy();
});
test("Same camera draws city roof then native room by zoom, with hysteresis and exact hit owner", async () => {
  const f = await setup();
  f.canvas.draw();
  assert.equal(f.host.dataset.visibleCities, "1");
  assert.equal(f.host.dataset.visibleRooms, "0");
  assert.equal(
    f.canvas.hit(f.screen(id(100), { x: -10, y: 12 }))?.kind,
    "city",
  );
  (f.renderer as unknown as { relativeCamera: unknown }).relativeCamera =
    relativeCamera({ x: 0, y: 0 }, { x: 0, y: 0 }, 0.1);
  f.canvas.draw();
  assert.equal(f.host.dataset.visibleRooms, "1");
  assert.deepEqual(f.canvas.hit(f.screen(id(30), { x: 8, y: 8 })), {
    kind: "room",
    ownerId: id(30),
    roomId: id(31),
  });
  (f.renderer as unknown as { relativeCamera: unknown }).relativeCamera =
    relativeCamera({ x: 0, y: 0 }, { x: 0, y: 0 }, 0.2);
  f.canvas.draw();
  assert.equal(f.host.dataset.visibleRooms, "1");
  (f.renderer as unknown as { relativeCamera: unknown }).relativeCamera =
    relativeCamera({ x: 0, y: 0 }, { x: 0, y: 0 }, 0.25);
  f.canvas.draw();
  assert.equal(f.host.dataset.visibleRooms, "0");
  f.canvas.destroy();
});
test("Courtyard remains transparent and nodes cannot be hit until their handles are drawn", async () => {
  const f = await setup();
  f.canvas.draw();
  assert.equal(f.canvas.hit(f.screen(id(100), { x: 10, y: 12 })), undefined);
  const p = f.screen(id(100), { x: -10, y: 0 });
  const hit = f.canvas.hit(p);
  assert.equal(hit?.kind, "city");
  if (hit?.kind === "city") assert.equal(hit.hit.kind, "road");
  f.canvas.selection = { ownerId: id(100), kind: "road", elementId: id(103) };
  f.canvas.draw();
  const active = f.canvas.hit(p);
  assert.equal(active?.kind, "city");
  if (active?.kind === "city") assert.equal(active.hit.kind, "node");
  (f.renderer as unknown as { imageCapture: boolean }).imageCapture = true;
  f.canvas.draw();
  const exported = f.canvas.hit(p);
  assert.equal(exported?.kind, "city");
  if (exported?.kind === "city") assert.equal(exported.hit.kind, "road");
  f.canvas.destroy();
});

test("Atlas image capture hides editor overlay and restores renderer state", async () => {
  const visibility: boolean[] = [],
    sizes: { width: number; height: number }[] = [],
    overlay = { visible: true },
    grid = { visible: true },
    context = { drawImage() {} },
    output = {
      width: 0,
      height: 0,
      getContext: () => context,
    },
    renderer = Object.assign(Object.create(AtlasRenderer.prototype), {
      initialized: true,
      closed: false,
      capturing: false,
      host: {
        clientWidth: 800,
        clientHeight: 400,
        ownerDocument: { createElement: () => output },
      },
      application: {
        canvas: {},
        renderer: { resize: (width: number, height: number) => sizes.push({ width, height }) },
      },
      currentCamera: relativeCamera({ x: 0, y: 0 }, { x: 0, y: 0 }, 2),
      level: 3,
      grid,
      overlay,
      draw: () => visibility.push(overlay.visible),
    }) as AtlasRenderer;
  const image = await renderer.captureMap({ scope: "view", width: 1024, includeGrid: false });
  assert.equal(image, output);
  assert.deepEqual(visibility, [false, true]);
  assert.deepEqual(sizes, [
    { width: 1024, height: 512 },
    { width: 800, height: 400 },
  ]);
  assert.equal(overlay.visible, true);
  assert.equal(grid.visible, true);
  assert.equal(renderer.imageCapture, false);
  assert.equal(renderer.level, 3);
});
test("Transient house preview moves child room in same frame without changing native owners or history", async () => {
  const f = await setup(0.1),
    before = f.dungeon.read().documentBytes,
    city = f.city.read();
  f.canvas.preview = editCity(city, [
    {
      kind: "set-building-pose",
      buildingId: id(105),
      position: { x: -14, y: 6 },
      rotationRadians: 0,
      scale: { x: 1, y: 1 },
    },
  ]);
  f.canvas.draw();
  const p = f.screen(id(30), { x: 8, y: 8 });
  assert.equal(f.canvas.hit({ x: p.x + 40, y: p.y - 20 })?.kind, "room");
  assert.equal(f.source.history.undoDepth, 0);
  assert.equal(f.dungeon.read().documentBytes, before);
  assert.deepEqual(f.city.read(), city);
  f.canvas.destroy();
});
test("Room Key uses one native owner/history, keeps untouched Markdown and geometry, and repeats edits", async () => {
  const f = await setup(),
    before = f.dungeon.read(),
    draft = new AtlasRoomKeyDraft(f.dungeon, id(31));
  draft.name = "Eingangsraum";
  assert.equal(draft.apply(), true);
  assert.equal(f.source.history.undoDepth, 1);
  const changed = f.dungeon.read();
  assert.deepEqual(
    changed.document.entities.map((r) =>
      r.kind === "building" ? r.polygons : null,
    ),
    before.document.entities.map((r) =>
      r.kind === "building" ? r.polygons : null,
    ),
  );
  assert.deepEqual(changed.keyClosure, before.keyClosure);
  const second = new AtlasRoomKeyDraft(f.dungeon, id(31));
  second.markdown.set(id(34), manifest.oracle.roomText);
  second.apply();
  assert.equal(f.source.history.undoDepth, 2);
  f.source.history.undo();
  assert.deepEqual(f.dungeon.read().keyClosure, before.keyClosure);
  f.source.history.undo();
  assert.equal(f.dungeon.read().documentBytes, before.documentBytes);
  f.source.history.redo();
  f.source.history.redo();
  await f.repo.save();
  f.canvas.destroy();
});
test("Stale Room Key remains dirty and cannot overwrite changed source", async () => {
  const f = await setup(),
    draft = new AtlasRoomKeyDraft(f.dungeon, id(31));
  draft.name = "Textentwurf";
  const before = f.dungeon.read().document;
  f.source.history.execute({
    label: "Andere Änderung",
    changes: [
      dungeonDocumentChange(before, {
        ...before,
        entities: before.entities.map((r) =>
          isStructuredRoom(r) ? { ...r, name: "Extern" } : r,
        ),
      }),
    ],
  });
  const bytes = f.dungeon.read().documentBytes;
  assert.throws(() => draft.apply(), /inzwischen/);
  assert(draft.dirty);
  assert.equal(f.dungeon.read().documentBytes, bytes);
  assert.equal(f.source.history.undoDepth, 1);
  f.canvas.destroy();
});
test("Native host oracle City + Room Key saves exact seven-file closure", async () => {
  const f = await setup(),
    before = f.city.read(),
    after = editCity(before, [
      {
        kind: "set-building-pose",
        buildingId: id(105),
        position: manifest.oracle.expectedPosition,
        rotationRadians: 0,
        scale: { x: 1, y: 1 },
      },
    ]);
  f.source.history.execute({
    label: "Haus verschieben",
    changes: [cityDocumentChange(before, after)],
  });
  const key = new AtlasRoomKeyDraft(f.dungeon, id(31));
  key.markdown.set(id(34), manifest.oracle.roomText);
  key.apply();
  await f.repo.save();
  for (const row of manifest.expected)
    assert.equal(
      f.files.get(row.path),
      readFileSync(fixture + row.fixtureFile, "utf8"),
      row.path,
    );
  f.canvas.destroy();
});

test("City-only and mixed content Fit uses native bounds through the same relative camera", async () => {
  const f = await setup();
  for (const anchor of [0, -1e16]) {
    if (anchor) f.repo.moveLocation(id(11), { x: anchor, y: anchor });
    const fit = Object.assign(Object.create(AtlasRenderer.prototype), {
      host: { clientWidth: 800, clientHeight: 600 },
      world: f.source.world,
      currentCamera: relativeCamera(
        { x: anchor, y: anchor },
        { x: 0, y: 0 },
        1,
      ),
      terrainSource: { references: () => [], placements: () => [] },
      detailFitPoints: () => f.canvas.fitPoints(),
    }) as AtlasRenderer;
    fit.fit();
    assert(fit.camera.metersPerPixel < 1);
    for (const p of f.canvas.fitPoints()) {
      const screen = projectLocal(
        p.frame,
        fit.relativeCamera,
        fit.viewport,
        p.point,
      );
      assert(
        screen.x >= 0 && screen.x <= 800 && screen.y >= 0 && screen.y <= 600,
      );
    }
  }
  f.canvas.destroy();
});
test("Distant City is safely absent; large negative dock still draws and hits centimetre details", async () => {
  const f = await setup(0.01);
  f.repo.moveLocation(id(11), { x: -1e16, y: -1e16 });
  f.canvas.draw();
  assert.equal(f.host.dataset.visibleCities, "0");
  assert.equal(f.host.dataset.visibleRooms, "0");
  (f.renderer as unknown as { relativeCamera: unknown }).relativeCamera =
    relativeCamera({ x: -1e16, y: -1e16 }, { x: -10, y: 14 }, 0.01);
  f.canvas.draw();
  assert.equal(f.host.dataset.visibleCities, "1");
  assert.equal(f.host.dataset.visibleRooms, "1");
  assert.equal(f.canvas.hit(f.screen(id(30), { x: 8, y: 8 }))?.kind, "room");
  f.canvas.destroy();
});
