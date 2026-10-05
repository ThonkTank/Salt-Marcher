// Focused host workflow for DD-041.02–.04. It runs only inside the isolated
// Obsidian QA host; the caller owns startup, shutdown, graphics lock and build.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const close = (actual, expected, tolerance = 1e-5) =>
  Math.abs(actual - expected) <= tolerance;

module.exports = async function dd041HostNavigation({ page, out, panOnly = false }) {
  const screens = path.join(out, "dd041-screens");
  fs.mkdirSync(screens, { recursive: true });
  const records = [];
  const failures = [];
  const record = (caseId, name, before, after, expected, screenshots) => {
    const actual = {
      scale: after.scale,
      cameraX: after.x - before.x,
      cameraY: after.y - before.y,
      centerWorldX: after.centerWorld.x - before.centerWorld.x,
      centerWorldY: after.centerWorld.y - before.centerWorld.y,
      pointerWorldX: after.pointerWorld.x - before.pointerWorld.x,
      pointerWorldY: after.pointerWorld.y - before.pointerWorld.y,
      documentSame: JSON.stringify(after.document) === JSON.stringify(before.document),
      notesSame: JSON.stringify(after.notes) === JSON.stringify(before.notes),
      dirtySame: after.dirty === before.dirty,
      historySame: after.history === before.history,
    };
    const passed = Object.entries(expected).every(([key, value]) =>
      typeof value === "number"
        ? close(actual[key], value, key.startsWith("centerWorld") ? 1e-4 : 1e-5)
        : actual[key] === value);
    records.push({ caseId, name, before, after, expected, actual, passed, screenshots });
    if (!passed) failures.push(`${caseId} ${name}`);
  };

  // Create a fresh visible marker. Navigation must leave its document and
  // history untouched; test setup and its Save precede the baseline snapshot.
  await page.evaluate(() =>
    app.plugins.getPlugin("dungeon-editor").create("NavigationQA", 12, 8));
  const canvas = page.locator(".dn-canvas canvas").last();
  await canvas.waitFor({ timeout: 30000 });
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count())) {
    await page.getByRole("button", { name: "Maximieren", exact: true }).click();
    await page.locator(".dungeon-native-editor.dn-maximized").waitFor();
  }
  await page.evaluate(async () => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    const floorId = editor.session.floors.keys().next().value;
    editor.session.execute({
      label: "DD-041-Prüfmarke",
      entities: [{
        id: "dd041-marker", before: null,
        after: {
          id: "dd041-marker", kind: "object", floorId,
          x: 6, y: 4, rotation: 0, width: 1, height: 1,
          color: 0x6688aa, label: "", layer: 100, flip: false,
        },
      }],
    });
    await editor.save();
    editor.renderer.fit();
    editor.renderer.zoom(64 / editor.renderer.camera.scale);
    editor.renderer.canvas.focus();
  });
  await page.waitForFunction(() =>
    !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.session.dirty);

  const box = await canvas.boundingBox();
  assert(box && box.width > 400 && box.height > 300, "Visible editor canvas");
  const center = { x: box.width / 2, y: box.height / 2 };
  const start = { x: center.x + 60, y: center.y + 40 };
  const end = { x: start.x + 96, y: start.y + 64 };
  const screen = (point) => ({ x: box.x + point.x, y: box.y + point.y });
  const snap = () => page.evaluate(({ center, start }) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    const camera = editor.renderer.camera;
    return {
      x: camera.x, y: camera.y, scale: camera.scale,
      centerWorld: editor.renderer.toWorld(center),
      pointerWorld: editor.renderer.toWorld(start),
      document: editor.session.document(),
      notes: editor.session.draft().notes,
      dirty: editor.session.dirty,
      history: editor.session.historySize,
    };
  }, { center, start });
  const reset = async (scale) => page.evaluate((target) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor.renderer;
    renderer.fit();
    renderer.zoom(target / renderer.camera.scale);
  }, scale);
  const shot = async (name) => {
    const file = path.join(screens, `${name}.png`);
    await page.screenshot({ path: file });
    return file;
  };
  const drag = async (button, space) => {
    await page.mouse.move(screen(start).x, screen(start).y);
    if (space) await page.keyboard.down("Space");
    await page.mouse.down({ button });
    await page.mouse.move(screen(end).x, screen(end).y, { steps: 8 });
    await page.mouse.up({ button });
    if (space) await page.keyboard.up("Space");
  };

  for (const [scale, zoomLabel] of [[64, "100"], [80, "125"]]) {
    for (const [name, button, space, caseId] of [
      ["space", "left", true, "DD-041.02"],
      ["middle", "middle", false, "DD-041.03"],
    ]) {
      await reset(scale);
      const before = await snap();
      const beforeScreen = await shot(`${caseId}-${name}-${zoomLabel}-before`);
      await drag(button, space);
      const after = await snap();
      record(caseId, `${name}-${zoomLabel}`, before, after, {
        scale, cameraX: 96, cameraY: 64,
        centerWorldX: -96 / scale, centerWorldY: -64 / scale,
        documentSame: true, notesSame: true, dirtySame: true, historySame: true,
      }, [beforeScreen, await shot(`${caseId}-${name}-${zoomLabel}-after`)]);
    }
  }

  // The native Ctrl+wheel ladder was measured from 50 to 200 percent. One
  // Chromium wheel event here is deltaY=±100 pixels; retain each event value.
  const wheelEvents = [];
  if (!panOnly) {
    await canvas.evaluate((node) => {
      node.addEventListener("wheel", (event) => {
        window.__dd041Wheel ??= [];
        window.__dd041Wheel.push({ deltaY: event.deltaY, deltaMode: event.deltaMode,
          ctrlKey: event.ctrlKey });
      }, { capture: true });
    });
    const ladder = [32, 48, 64, 80, 96, 128];
    const transitions = [
      ...ladder.slice(0, -1).map((scale, index) =>
        [scale, -100, ladder[index + 1]]),
      ...ladder.slice(1).reverse().map((scale, index) =>
        [scale, 100, ladder[ladder.length - 2 - index]]),
    ];
    await reset(ladder[0]);
    for (const [scale, deltaY, expectedScale] of transitions) {
      const name = `${scale / 64 * 100}-to-${expectedScale / 64 * 100}`;
      const before = await snap();
      assert(close(before.scale, scale), `${name}: starting zoom`);
      const beforeScreen = await shot(`DD-041.04-${name}-before`);
      await page.mouse.move(screen(start).x, screen(start).y);
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, deltaY);
      await page.keyboard.up("Control");
      const after = await snap();
      const events = await page.evaluate(() => {
        const result = window.__dd041Wheel ?? [];
        window.__dd041Wheel = [];
        return result;
      });
      wheelEvents.push({ name, events });
      record("DD-041.04", name, before, after, {
        scale: expectedScale,
        pointerWorldX: 0, pointerWorldY: 0,
        documentSame: true, notesSame: true, dirtySame: true, historySame: true,
      }, [beforeScreen, await shot(`DD-041.04-${name}-after`)]);
    }
  }

  const result = {
    reference: "Dungeondraft 1.2.0.1; native DD-041 navigation and zoom-ladder reports in implementation QA",
    extra: "DD-041.01 is a host Hand-tool addition, not a native required command",
    scope: panOnly ? "DD-041.02–.03 pan-only" : "DD-041.02–.04 navigation",
    mapPath: "Dungeons/NavigationQA/Karte.dungeon",
    input: { screenDrag: [96, 64], relativeStart: [60, 40], wheelDeltaY: [-100, 100],
      ladderPercent: [50, 75, 100, 125, 150, 200] },
    wheelEvents,
    records,
    failures,
    passed: failures.length === 0,
  };
  fs.writeFileSync(path.join(out, "dd041-navigation-result.json"),
    JSON.stringify(result, null, 2) + "\n");
  return result;
};
