import { test, expect } from "../support/fixture";
import {
  ready,
  paintedReady,
  url,
  scene,
  clickWorld,
  commit,
} from "../support/editor";

test("stored decorative scenery remains selectable and removable", async ({
  page,
}) => {
  await page.goto(url);
  await commit(page, {
    type: "terrainStroke",
    brush: {
      mode: "land",
      resolution: 8,
      radius: 10000,
      amount: 1,
      strength: 1,
      target: 10,
      points: [[0, 0]],
    },
  });
  await commit(page, {
    type: "sceneryStroke",
    brush: {
      biome: "forest",
      radius: 25,
      density: 0.8,
      size: 8,
      seed: 42,
      points: [
        [25, 35],
        [80, 40],
      ],
    },
  });
  await page.reload();
  await ready(page);
  const painted = (await scene(page)).objects;
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await ready(page);
  if (painted[0].kind !== "scenery") throw Error("missing stroke");
  await clickWorld(page, painted[0].assets[0].point);
  await expect(
    page.getByRole("heading", { name: "Landschaftsstrich" }),
  ).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(page.getByRole("dialog")).toContainText(
    "Betroffene Kartenobjekte: 1.",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Löschen bestätigen", exact: true })
    .click();
  await expect.poll(async () => (await scene(page)).objects.length).toBe(0);
});

test("all landscape asset sets render and survive saving and opening", async ({
  page,
}, testInfo) => {
  await page.goto(url);
  await commit(page, {
    type: "terrainStroke",
    brush: {
      mode: "land",
      resolution: 8,
      radius: 10000,
      amount: 1,
      strength: 1,
      target: 10,
      points: [[0, 0]],
    },
  });
  for (const [i, biome] of (
    ["forest", "meadow", "scrub", "rocks"] as const
  ).entries()) {
    await commit(page, {
      type: "sceneryStroke",
      brush: {
        biome,
        radius: 25,
        density: 0.8,
        size: biome === "meadow" ? 4 : 8,
        seed: 32 + i,
        points: [
          [25 + i * 58, 35],
          [25 + i * 58, 110],
        ],
      },
    });
  }
  const painted = (await scene(page)).objects;
  await page.evaluate(async () => {
    await window.atlasCore("save", {});
    await window.atlasCore("open", {});
  });
  expect((await scene(page)).objects).toEqual(painted);
  await page.reload();
  await ready(page);
  await paintedReady(page);
  for (const object of painted) {
    if (object.kind !== "scenery") continue;
    const visible = await page
      .getByTestId("atlas-canvas")
      .evaluate((canvas: HTMLCanvasElement, point) => {
        const c = canvas.getContext("2d")!,
          t = c.getTransform();
        const x = Math.round(t.a * point[0] + t.c * point[1] + t.e),
          y = Math.round(t.b * point[0] + t.d * point[1] + t.f);
        const bytes = c.getImageData(x - 4, y - 4, 8, 8).data;
        for (let i = 0; i < bytes.length; i += 4)
          if (bytes[i] !== 178 || bytes[i + 1] !== 185 || bytes[i + 2] !== 151)
            return true;
        return false;
      }, object.assets[0].point);
    expect(visible, `${object.biome} must visibly differ from bare land`).toBe(
      true,
    );
  }
  await page.mouse.move(40, 40);
  await page.screenshot({ path: testInfo.outputPath("landscape-assets.png") });
});
