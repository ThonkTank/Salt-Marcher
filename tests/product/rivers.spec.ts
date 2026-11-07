import { test, expect } from "../support/fixture";
import {
  ready,
  paintedReady,
  url,
  status,
  clickWorld,
} from "../support/editor";
test("Fluss zeichnen, bearbeiten und mit einem Schritt zurücknehmen", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Fluss", exact: true }).click();
  await paintedReady(page);
  await clickWorld(page, [15, 35]);
  await clickWorld(page, [130, 35]);
  await expect(page.getByText("Maximaler Einschnitt:")).toBeVisible();
  await page
    .getByRole("button", { name: "Fluss übernehmen", exact: true })
    .click();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await expect(
    page.getByRole("button", { name: "Fluss löschen", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fluss löschen", exact: true })
    .click();
  await expect.poll(async () => (await status(page)).revision).toBe(2);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect.poll(async () => (await status(page)).revision).toBe(3);
});
test("erster Kartenklick verwendet die gerade eingegebene Flussbreite", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Fluss", exact: true }).click();
  await paintedReady(page);
  await page.getByLabel("Flussbreite (Fuß)", { exact: true }).fill("2");
  // No Tab/Enter: clicking the map must commit the field before placing node one.
  await clickWorld(page, [15, 35]);
  await clickWorld(page, [130, 35]);
  await page
    .getByRole("button", { name: "Fluss übernehmen", exact: true })
    .click();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  const widths = await page.evaluate(async () => {
    const view = await window.atlasCore("rivers", {
      version: await window.atlasCore("status", {}),
      bounds: [-1000, -1000, 1000, 1000],
      ids: [],
    });
    return view.rivers[0].river.nodes.map((node) => node.width);
  });
  expect(widths).toEqual([2, 2]);
});
test("Escape verwirft den Flussentwurf ohne Dokumentänderung", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Fluss", exact: true }).click();
  await paintedReady(page);
  await clickWorld(page, [20, 30]);
  await clickWorld(page, [120, 60]);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Fluss übernehmen", exact: true }),
  ).toHaveCount(0);
  expect((await status(page)).revision).toBe(0);
});
test("Nebenfluss, Breitenbearbeitung und verzögerte Vorschau", async ({
  page,
}, info) => {
  const { holdResponse, releaseResponse, calls, screen } =
    await import("../support/editor");
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Fluss", exact: true }).click();
  await paintedReady(page);
  await clickWorld(page, [0, 50]);
  await clickWorld(page, [150, 50]);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await ready(page);
  await page
    .getByRole("button", { name: "Neuen Fluss zeichnen", exact: true })
    .click();
  await clickWorld(page, [65, 5]);
  await clickWorld(page, [65, 90]);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await status(page)).revision).toBe(2);
  await ready(page);
  const network = await page.evaluate(async () =>
    window.atlasCore("rivers", {
      version: await window.atlasCore("status", {}),
      bounds: [-100, -100, 500, 500],
      ids: [],
    }),
  );
  expect(network.rivers).toHaveLength(2);
  await page.getByLabel("Flussbreite (Fuß)", { exact: true }).fill("35");
  await page.getByLabel("Flussbreite (Fuß)", { exact: true }).blur();
  await page
    .getByRole("button", { name: "Fluss übernehmen", exact: true })
    .click();
  await expect.poll(async () => (await status(page)).revision).toBe(3);
  await ready(page);
  const source = await screen(page, [65, 5]);
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(source.x + 15, source.y + 10);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(
    page.getByRole("button", { name: "Fluss übernehmen", exact: true }),
  ).toHaveCount(0);
  expect(
    await page
      .getByTestId("atlas-canvas")
      .evaluate((c: HTMLCanvasElement) => c.hasPointerCapture(1)),
  ).toBe(false);
  await page.mouse.up();
  expect((await status(page)).revision).toBe(3);
  await page.screenshot({ path: info.outputPath("river-network.png") });
  await page
    .getByRole("button", { name: "Neuen Fluss zeichnen", exact: true })
    .click();
  await holdResponse(page, "preview");
  await clickWorld(page, [160, 10]);
  await clickWorld(page, [190, 40]);
  await expect
    .poll(async () => (await calls(page, "preview")).length)
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await releaseResponse(page);
  await expect(
    page.getByRole("button", { name: "Fluss übernehmen", exact: true }),
  ).toHaveCount(0);
  expect((await status(page)).revision).toBe(3);
  const q = await screen(page, [50, 40]);
  await page.mouse.move(q.x, q.y);
  await page.mouse.wheel(0, 700);
  await paintedReady(page);
  await page
    .getByRole("button", { name: "Neuen Fluss zeichnen", exact: true })
    .click();
  await clickWorld(page, [220, 130]);
  await clickWorld(page, [520, 160]);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await status(page)).revision).toBe(4);
});

for (const abort of ["blur", "tool", "unmount"] as const) {
  test(`verspätete Flussvorschau bleibt nach ${abort} verworfen`, async ({
    page,
  }) => {
    const { holdResponse, releaseResponse } = await import("../support/editor");
    await page.goto(url);
    await ready(page);
    await page.getByRole("button", { name: "Fluss", exact: true }).click();
    await paintedReady(page);
    await holdResponse(page, "preview");
    await clickWorld(page, [20, 30]);
    await clickWorld(page, [120, 60]);
    await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
    if (abort === "blur")
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    else if (abort === "unmount")
      await page.evaluate(() => window.atlasUnmount?.());
    else
      await page.getByRole("button", { name: "Auswahl", exact: true }).click();
    await releaseResponse(page);
    if (abort === "unmount") await page.evaluate(() => window.atlasRemount?.());
    await ready(page);
    await expect(
      page.getByRole("button", { name: "Fluss übernehmen", exact: true }),
    ).toHaveCount(0);
    expect((await status(page)).revision).toBe(0);
  });
}

test("Flussknoten verwendet den finalen Pointerwert und wartet auf ausdrückliche Übernahme", async ({
  page,
}) => {
  const { screen } = await import("../support/editor");
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Fluss", exact: true }).click();
  await paintedReady(page);
  await clickWorld(page, [20, 30]);
  await clickWorld(page, [120, 30]);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await expect(
    page.getByRole("button", { name: "Fluss löschen", exact: true }),
  ).toBeVisible();
  await ready(page);
  const start = await screen(page, [120, 30]),
    end = await screen(page, [140, 50]);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "preview" };
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect.poll(() => page.evaluate(() => window.atlasHeld)).toBe(true);
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
  expect((await status(page)).revision).toBe(1);
  await page.evaluate(() => window.atlasRelease!());
  await page
    .getByRole("button", { name: "Fluss übernehmen", exact: true })
    .click();
  await expect.poll(async () => (await status(page)).revision).toBe(2);
  const nodes = await page.evaluate(async () => {
    const result = await window.atlasCore("rivers", {
      version: await window.atlasCore("status", {}),
      bounds: [0, 0, 200, 200],
      ids: [],
    });
    return result.rivers[0].river.nodes;
  });
  expect(nodes.at(-1)!.point[0]).toBeCloseTo(140, 0);
  expect(nodes.at(-1)!.point[1]).toBeCloseTo(50, 0);
});

for (const finish of ["right", "double"] as const) {
  test(`gemeinsamer Eingabepfad übernimmt Flüsse per ${finish} nach Navigation`, async ({
    page,
  }) => {
    const { screen } = await import("../support/editor");
    await page.goto(url);
    await ready(page);
    await page.getByRole("button", { name: "Fluss", exact: true }).click();
    await paintedReady(page);
    await clickWorld(page, [20, 30]);
    await clickWorld(page, [120, 60]);
    const pan = await screen(page, [160, 80]);
    await page.keyboard.down("Space");
    await page.mouse.move(pan.x, pan.y);
    await page.mouse.down();
    await page.mouse.move(pan.x + 30, pan.y + 20);
    await page.mouse.up();
    await page.keyboard.up("Space");
    await paintedReady(page);
    const end = await screen(page, [120, 60]);
    if (finish === "right")
      await page.mouse.click(end.x, end.y, { button: "right" });
    else await page.mouse.dblclick(end.x, end.y);
    await expect.poll(async () => (await status(page)).revision).toBe(1);
    await expect(
      page.getByRole("button", { name: "Fluss löschen", exact: true }),
    ).toBeVisible();
    const nodes = await page.evaluate(async () => {
      const response = await window.atlasCore("rivers", {
        version: await window.atlasCore("status", {}),
        bounds: [0, 0, 200, 200],
        ids: [],
      });
      return response.rivers[0].river.nodes;
    });
    expect(nodes).toHaveLength(2);
    expect(nodes[0].point[0]).toBeCloseTo(20, 0);
    expect(nodes[1].point[0]).toBeCloseTo(120, 0);
  });
}

test("Flusspunkt bleibt bei Topologie, Auswahl, neuem Entwurf und Sessionwechsel gültig", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Fluss", exact: true }).click();
  await paintedReady(page);
  const point = page.getByLabel("Flusspunkt", { exact: true });
  const accept = page.getByRole("button", {
    name: "Fluss übernehmen",
    exact: true,
  });
  const newRiver = page.getByRole("button", {
    name: "Neuen Fluss zeichnen",
    exact: true,
  });
  for (const p of [
    [20, 20],
    [80, 20],
    [140, 20],
  ] as [number, number][])
    await clickWorld(page, p);
  await accept.click();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await ready(page);
  await point.selectOption("1");
  await page
    .getByRole("button", { name: "Punkt danach einfügen", exact: true })
    .click();
  await expect(point).toHaveValue("2");
  await accept.click();
  await expect.poll(async () => (await status(page)).revision).toBe(2);
  await ready(page);
  await point.selectOption("3");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect.poll(async () => (await status(page)).revision).toBe(3);
  await expect(point.locator("option")).toHaveCount(3);
  await expect(point).toHaveValue("2");
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await expect(point.locator("option")).toHaveCount(4);
  await expect(point).toHaveValue("2");
  await newRiver.click();
  await expect(point).toHaveCount(0);
  await clickWorld(page, [20, 80]);
  await expect(point).toHaveValue("0");
  await clickWorld(page, [140, 80]);
  await accept.click();
  await expect.poll(async () => (await status(page)).revision).toBe(5);
  await ready(page);
  await point.selectOption("1");
  await clickWorld(page, [80, 20]);
  await expect(point.locator("option")).toHaveCount(4);
  await expect(point).toHaveValue("0");
  await point.selectOption("3");
  await newRiver.click();
  await expect(point).toHaveCount(0);
  await clickWorld(page, [20, 140]);
  await expect(point).toHaveValue("0");
  await page.keyboard.press("Escape");
  const session = (await status(page)).sessionId;
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await page.getByRole("button", { name: "Verwerfen", exact: true }).click();
  await expect
    .poll(async () => (await status(page)).sessionId)
    .not.toBe(session);
  await ready(page);
  await page.getByRole("button", { name: "Fluss", exact: true }).click();
  await paintedReady(page);
  await expect(point).toHaveCount(0);
  await newRiver.click();
  await clickWorld(page, [20, 20]);
  await expect(point).toHaveValue("0");
});
