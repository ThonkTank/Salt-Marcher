import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

/** Objects on ordinary landscape. Magenta document paper makes a leaked city sheet unmistakable. */
export function seedAtlasCity(store, token, campaignId) {
  const write = (action) =>
    store.executeAtlasCommit({
      commandId:
        action.kind === "city" ? action.command.commandId : randomUUID(),
      token,
      campaignId,
      action,
    });
  write({
    kind: "landscape-put",
    expectedRevision: null,
    record: {
      id: randomUUID(),
      revision: 0,
      kind: "patch",
      name: "Stadtlandschaft",
      points: [],
      polygons: [
        {
          outer: [
            { x: 500, y: 500 },
            { x: 3500, y: 500 },
            { x: 3500, y: 3500 },
            { x: 500, y: 3500 },
          ],
          holes: [],
        },
      ],
      width: 0,
      resolution: 1000,
      values: { terrain: "plains", elevationM: 20 },
    },
  });
  const cityId = write({
    kind: "city-create",
    name: "Stadt auf der Landschaft",
    x: 1500,
    y: 1500,
    width: 500,
    height: 400,
  }).result.id;
  const header = store.city(token, cityId).header;
  const units = [
    {
      id: "west",
      kind: "node",
      name: "",
      protected: false,
      point: { x: 20, y: 200 },
    },
    {
      id: "east",
      kind: "node",
      name: "",
      protected: false,
      point: { x: 480, y: 200 },
    },
    {
      id: "street",
      kind: "road",
      name: "Marktstraße",
      protected: false,
      nodeIds: ["west", "east"],
      via: [{ x: 230, y: 170 }],
      width: 12,
    },
  ];
  for (let i = 0; i < 12; i++)
    units.push({
      id: "city-house-" + i,
      kind: "building",
      name: i === 0 ? "Taverne" : "",
      protected: false,
      position: { x: 65 + (i % 6) * 70, y: i < 6 ? 135 : 255 },
      angle: (i % 3) * 0.12,
      outline: [
        { x: -14, y: -12 },
        { x: 14, y: -12 },
        { x: 14, y: 12 },
        { x: -14, y: 12 },
      ],
      use: "Wohnhaus",
      notes: "",
      interior: false,
    });
  const commandId = randomUUID();
  write({
    kind: "city",
    command: {
      commandId,
      token,
      campaignId,
      cityId,
      expectedRevision: header.revision,
      action: {
        kind: "change",
        header: { ...header, paper: "#ff00ff" },
        upsert: units,
        remove: [],
        label: "Stadtobjekte auf Landschaft",
      },
    },
  });
  return cityId;
}

export async function verifyAtlasCity(page, settle, capture) {
  await page.locator("#atlas-search").fill("Stadt auf der Landschaft");
  await page
    .locator("#atlas-search-results")
    .getByRole("button", { name: "Stadt auf der Landschaft", exact: true })
    .click();
  await page.locator("#atlas-search").fill("");
  await settle();
  await page.evaluate(
    () =>
      (window.__cityAtlasSurface = document.querySelector(
        "#atlas-terrain-spatial",
      )),
  );
  const inspect = () =>
    page.locator("#atlas-terrain-spatial").evaluate((c) => {
      const gl = c.getContext("webgl2"),
        pixels = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let paper = 0,
        roof = 0,
        land = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b] = pixels.subarray(i, i + 3);
        if (r > 235 && g < 25 && b > 235) paper++;
        if (r > 80 && r < 210 && g > 35 && g < 150 && b < 100) roof++;
        if (r > 180 && g > 170 && b > 120 && b < 230) land++;
      }
      return { paper, roof, land };
    });
  const top = await inspect();
  assert.equal(top.paper, 0, "city document paper must never cover landscape");
  assert(top.roof > 50, "actual buildings must be visible");
  assert(top.land > 1000, "landscape remains visible between buildings");
  await capture("05-city-on-landscape");
  await page.locator("#atlas-view").click();
  await page.locator("#atlas-terrain-tilt").click();
  await page.keyboard.press("Escape");
  await settle();
  assert(
    await page.evaluate(
      () =>
        window.__cityAtlasSurface ===
        document.querySelector("#atlas-terrain-spatial"),
    ),
  );
  const tilted = await inspect();
  assert.equal(tilted.paper, 0);
  assert(tilted.roof > 50);
  assert(tilted.land > 1000);
  await capture("06-city-main-camera");
  await page.locator("#atlas-section").selectOption("terrain");
  await settle();
  assert.equal(
    await page.locator("#terrain-tilt").inputValue(),
    "45",
    "terrain tool switch retains the city camera",
  );
  assert.equal(
    await page.locator("dialog[open] #vegetation-spatial-canvas").count(),
    0,
  );
  // Real GPU context loss must fall back once, without an automatic retry loop.
  await page.locator("#atlas-terrain-spatial").evaluate((c) => {
    const extension = c.getContext("webgl2").getExtension("WEBGL_lose_context");
    if (!extension) throw Error("GPU context loss injection unavailable");
    extension.loseContext();
  });
  await page.waitForFunction(
    () =>
      document.querySelector("#campaign-map").dataset.renderer === "canvas2d",
  );
  await page.getByRole("button", { name: "Verkleinern", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#campaign-map").dataset.canvasState === "loaded",
  );
  assert.equal(
    await page.locator("#atlas-terrain-spatial").count(),
    0,
    "redraw must not restart a failed renderer",
  );
  await page.locator("#atlas-view").click();
  await page.locator("#atlas-camera-retry").click();
  await page.keyboard.press("Escape");
  await settle();
  assert.equal(await page.locator("#atlas-terrain-spatial").count(), 1);
  assert(await page.locator("#atlas-camera-retry").isHidden());
  await capture("07-city-camera-recovered");
  return { top, tilted, contextRecovery: true };
}
