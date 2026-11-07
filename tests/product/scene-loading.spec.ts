import { editorUrl } from "../support/browserServer";
import { showObjects, drawn } from "../support/editor";
import { expect, test } from "../support/fixture";

test("covering superseded scene advances the view while newest request remains pending", async ({
  page,
}) => {
  await page.goto(`${editorUrl}?presentation`);
  const status = await page.evaluate(() => window.atlasCore("status", {}));
  await page.evaluate(
    (status) => window.atlasPresentationSet({ status }),
    status,
  );
  await expect(page.locator("output")).toHaveText("fresh");
  await page.evaluate(() => {
    window.atlasSceneHeld = [];
    window.atlasSceneBarrier = true;
    window.atlasPresentationSet({ bounds: [100, 0, 150, 50] });
  });
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(1);
  const first = await page.evaluate(() => ({
    args: window.atlasSceneHeld[0].args,
    scene: window.atlasSceneHeld[0].scene,
  }));
  expect(first.args.bounds).toEqual([80, -20, 180, 80]);
  expect(first.scene.status.sessionId).toBe(status.sessionId);
  expect(first.scene.status.revision).toBe(status.revision);
  expect(Array.isArray(first.scene.objects)).toBe(true);
  await page.evaluate(() =>
    window.atlasPresentationSet({ bounds: [121, 0, 171, 50] }),
  );
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(2);
  const second = await page.evaluate(() => ({
    args: window.atlasSceneHeld[1].args,
    scene: window.atlasSceneHeld[1].scene,
  }));
  expect(second.args.bounds).toEqual([100, -20, 200, 80]);
  expect(second.scene.status.sessionId).toBe(status.sessionId);
  expect(second.scene.status.revision).toBe(status.revision);
  await page.evaluate(() => window.atlasSceneHeld[0].release());
  await expect
    .poll(() =>
      page.evaluate(() => ({
        fresh: window.atlasPresentation.fresh,
        bounds: window.atlasPresentation.value?.bounds,
        loading: window.atlasPresentation.loading,
      })),
    )
    .toEqual({ fresh: true, bounds: [80, -20, 180, 80], loading: true });
  await page.evaluate(() => {
    window.atlasSceneBarrier = false;
    window.atlasSceneHeld[1].release();
  });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        fresh: window.atlasPresentation.fresh,
        bounds: window.atlasPresentation.value?.bounds,
        loading: window.atlasPresentation.loading,
      })),
    )
    .toEqual({ fresh: true, bounds: [100, -20, 200, 80], loading: false });
});

async function startHeld(page: import("@playwright/test").Page) {
  await page.goto(`${editorUrl}?presentation`);
  const status = await page.evaluate(() => window.atlasCore("status", {}));
  await page.evaluate(
    (status) => window.atlasPresentationSet({ status }),
    status,
  );
  await expect(page.locator("output")).toHaveText("fresh");
  await page.evaluate(() => {
    window.atlasSceneHeld = [];
    window.atlasSceneBarrier = true;
    window.atlasPresentationSet({ bounds: [100, 0, 150, 50] });
  });
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(1);
  return status;
}
async function setBounds(
  page: import("@playwright/test").Page,
  bounds: [number, number, number, number],
  count: number,
) {
  await page.evaluate(
    (bounds) => window.atlasPresentationSet({ bounds }),
    bounds,
  );
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(count);
}
async function release(
  page: import("@playwright/test").Page,
  n: number,
  remaining: number,
) {
  await page.evaluate((n) => window.atlasSceneHeld[n].release(), n);
  await expect
    .poll(() => page.evaluate(() => window.atlasReadActive))
    .toBe(remaining);
}
async function state(page: import("@playwright/test").Page) {
  return page.evaluate(() => ({
    fresh: window.atlasPresentation.fresh,
    loading: window.atlasPresentation.loading,
    error: window.atlasPresentation.error,
    bounds: window.atlasPresentation.value?.bounds,
    revision: window.atlasPresentation.value?.scene.status.revision,
    session: window.atlasPresentation.value?.scene.status.sessionId,
  }));
}

test("noncovering old scene is never admitted", async ({ page }) => {
  await startHeld(page);
  await setBounds(page, [300, 0, 350, 50], 2);
  await release(page, 0, 1);
  expect(await state(page)).toMatchObject({
    fresh: false,
    loading: true,
    bounds: [-20, -20, 80, 80],
  });
  await release(page, 1, 0);
  await expect
    .poll(() => state(page))
    .toMatchObject({
      fresh: true,
      loading: false,
      bounds: [280, -20, 380, 80],
    });
});

test("late older covering scene cannot regress a newer intermediate", async ({
  page,
}) => {
  await startHeld(page);
  await setBounds(page, [121, 0, 171, 50], 2);
  await setBounds(page, [119, 0, 169, 50], 3);
  await release(page, 1, 2);
  await expect
    .poll(() => state(page))
    .toMatchObject({ fresh: true, loading: true, bounds: [100, -20, 200, 80] });
  await release(page, 0, 1);
  expect(await state(page)).toMatchObject({
    fresh: true,
    loading: true,
    bounds: [100, -20, 200, 80],
  });
  await release(page, 2, 0);
  await expect
    .poll(() => state(page))
    .toMatchObject({ fresh: true, loading: false, bounds: [80, -20, 200, 80] });
});

for (const field of ["sessionId", "revision"] as const) {
  test(`mismatched ${field} inside actual held response is rejected`, async ({
    page,
  }) => {
    await startHeld(page);
    await setBounds(page, [121, 0, 171, 50], 2);
    await page.evaluate((field) => {
      const s = window.atlasSceneHeld[0].scene.status;
      if (field === "sessionId") s.sessionId += "-foreign";
      else s.revision++;
    }, field);
    await release(page, 0, 1);
    expect(await state(page)).toMatchObject({
      fresh: false,
      loading: true,
      bounds: [-20, -20, 80, 80],
    });
    await release(page, 1, 0);
    await expect
      .poll(() => state(page))
      .toMatchObject({
        fresh: true,
        loading: false,
        bounds: [100, -20, 200, 80],
      });
  });
}

for (const kind of ["session", "revision"] as const) {
  test(`old ${kind} request cannot publish into new status`, async ({
    page,
  }) => {
    const old = await startHeld(page);
    const next = await page.evaluate(async (kind) => {
      if (kind === "session") await window.atlasCore("new", {});
      else
        await window.atlasCore("commit", {
          version: await window.atlasCore("status", {}),
          intent: {
            type: "createHouse",
            parcelId: null,
            transform: { x: 0, y: 0, angle: 0 },
            width: 8,
            depth: 8,
          },
        });
      return window.atlasCore("status", {});
    }, kind);
    if (kind === "session") expect(next.sessionId).not.toBe(old.sessionId);
    else expect(next.revision).toBeGreaterThan(old.revision);
    await page.evaluate(
      (status) =>
        window.atlasPresentationSet({ status, bounds: [121, 0, 171, 50] }),
      next,
    );
    await expect
      .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
      .toBe(2);
    await release(page, 0, 1);
    expect((await state(page)).fresh).toBe(false);
    await release(page, 1, 0);
    await expect
      .poll(() => state(page))
      .toMatchObject({
        fresh: true,
        session: next.sessionId,
        revision: next.revision,
      });
  });
}

test("old context and old client cannot publish into newer owners", async ({
  page,
}) => {
  await startHeld(page);
  await page.evaluate(() =>
    window.atlasPresentationSet({
      bounds: [121, 0, 171, 50],
      floor: 1,
      lower: false,
      client: "second",
    }),
  );
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(2);
  await release(page, 0, 1);
  expect((await state(page)).fresh).toBe(false);
  await release(page, 1, 0);
  await expect
    .poll(() => state(page))
    .toMatchObject({ fresh: true, bounds: [100, -20, 200, 80] });
  expect(
    await page.evaluate(() => ({
      floor: window.atlasPresentation.value?.floor,
      lower: window.atlasPresentation.value?.includeLower,
    })),
  ).toEqual({ floor: 1, lower: false });
});

test("unmounted owner cannot publish into a remounted presentation", async ({
  page,
}) => {
  const status = await startHeld(page);
  await page.evaluate(() => window.atlasUnmount?.());
  await expect(page.locator("output")).toHaveCount(0);
  await page.evaluate(() => window.atlasRemount?.());
  await expect(page.locator("output")).toBeVisible();
  await page.evaluate(
    (status) =>
      window.atlasPresentationSet({ status, bounds: [121, 0, 171, 50] }),
    status,
  );
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(2);
  await release(page, 0, 1);
  expect((await state(page)).fresh).toBe(false);
  await release(page, 1, 0);
  await expect
    .poll(() => state(page))
    .toMatchObject({ fresh: true, bounds: [100, -20, 200, 80] });
});

test("retry invalidates earlier covering responses without losing newest request", async ({
  page,
}) => {
  await startHeld(page);
  await setBounds(page, [121, 0, 171, 50], 2);
  await page.evaluate(() => window.atlasPresentation.retry());
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(3);
  await release(page, 0, 2);
  expect((await state(page)).fresh).toBe(false);
  await release(page, 1, 1);
  expect((await state(page)).fresh).toBe(false);
  await release(page, 2, 0);
  await expect
    .poll(() => state(page))
    .toMatchObject({
      fresh: true,
      loading: false,
      bounds: [100, -20, 200, 80],
    });
});

test("latest error blocks older covering response until retry succeeds", async ({
  page,
}) => {
  await startHeld(page);
  await setBounds(page, [121, 0, 171, 50], 2);
  await page.evaluate(() => {
    window.atlasSceneHeld[1].fail = true;
    window.atlasSceneHeld[1].release();
  });
  await expect
    .poll(() => page.evaluate(() => window.atlasPresentation.error))
    .toContain("Scene failed");
  await release(page, 0, 0);
  expect(await state(page)).toMatchObject({ fresh: false, loading: false });
  expect((await state(page)).error).toContain("Scene failed");
  await page.evaluate(() => {
    window.atlasSceneBarrier = false;
    window.atlasPresentation.retry();
  });
  await expect
    .poll(() => state(page))
    .toMatchObject({
      fresh: true,
      loading: false,
      error: "",
      bounds: [100, -20, 200, 80],
    });
});

test("failure from superseded read cannot replace or poison latest state", async ({
  page,
}) => {
  await startHeld(page);
  await setBounds(page, [121, 0, 171, 50], 2);
  await page.evaluate(() => {
    window.atlasSceneHeld[0].fail = true;
  });
  await release(page, 0, 1);
  expect(await state(page)).toMatchObject({
    fresh: false,
    loading: true,
    error: "",
  });
  await release(page, 1, 0);
  await expect
    .poll(() => state(page))
    .toMatchObject({
      fresh: true,
      loading: false,
      error: "",
      bounds: [100, -20, 200, 80],
    });
});

test("client A-B-A cannot revive an old A owner merely because identity returned", async ({
  page,
}) => {
  await startHeld(page);
  await page.evaluate(() =>
    window.atlasPresentationSet({
      bounds: [121, 0, 171, 50],
      client: "second",
    }),
  );
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(2);
  await page.evaluate(() => window.atlasPresentationSet({ client: "first" }));
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(3);
  await release(page, 0, 2);
  expect((await state(page)).fresh).toBe(false);
  await release(page, 1, 1);
  expect((await state(page)).fresh).toBe(false);
  await release(page, 2, 0);
  await expect
    .poll(() => state(page))
    .toMatchObject({ fresh: true, bounds: [100, -20, 200, 80] });
});

test("floor A-B-A cannot revive an old matching-context request", async ({
  page,
}) => {
  await startHeld(page);
  await page.evaluate(() =>
    window.atlasPresentationSet({ bounds: [121, 0, 171, 50], floor: 1 }),
  );
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(2);
  await page.evaluate(() => window.atlasPresentationSet({ floor: 0 }));
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(3);
  await release(page, 0, 2);
  expect((await state(page)).fresh).toBe(false);
  await release(page, 1, 1);
  expect((await state(page)).fresh).toBe(false);
  await release(page, 2, 0);
  await expect
    .poll(() => state(page))
    .toMatchObject({ fresh: true, bounds: [100, -20, 200, 80] });
});

test("exterior remains fresh across detail threshold when bounds and scene are unchanged", async ({
  page,
}) => {
  await page.goto(`${editorUrl}?presentation`);
  const status = await page.evaluate(() => window.atlasCore("status", {}));
  await page.evaluate(
    (status) => window.atlasPresentationSet({ status }),
    status,
  );
  await expect(page.locator("output")).toHaveText("fresh");
  await page.evaluate(() => {
    window.atlasPresentationTrace = [];
    window.atlasPresentationSet({ enabled: false });
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.atlasPresentationTrace.some((x) => !x.enabled),
      ),
    )
    .toBe(true);
  await expect(page.locator("output")).toHaveText("fresh");
  await page.evaluate(() => window.atlasPresentationSet({ enabled: true }));
  await expect
    .poll(() =>
      page.evaluate(() => window.atlasPresentationTrace.some((x) => x.enabled)),
    )
    .toBe(true);
  await expect(page.locator("output")).toHaveText("fresh");
  expect(
    await page.evaluate(() =>
      window.atlasPresentationTrace.filter((x) => !x.fresh),
    ),
  ).toEqual([]);
});

test("covering interim scene permits real Canvas edits while the latest read is pending", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  const canvas = page.getByTestId("atlas-canvas");
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  const box = (await canvas.boundingBox())!;
  const before = await page.evaluate(async () => {
    window.atlasCalls = [];
    window.atlasSceneHeld = [];
    window.atlasSceneBarrier = true;
    return window.atlasCore("status", {});
  });
  await page.mouse.move(box.x + 350, box.y + 300);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(box.x + 550, box.y + 300);
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(1);
  await page.mouse.move(box.x + 570, box.y + 300);
  await expect
    .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
    .toBe(2);
  await page.mouse.up({ button: "middle" });
  const requests = await page.evaluate(() =>
    window.atlasSceneHeld
      .slice(0, 2)
      .map((x) => ({ args: x.args, status: x.scene.status })),
  );
  expect(requests[0].status).toMatchObject({
    sessionId: before.sessionId,
    revision: before.revision,
  });
  expect(requests[1].status).toMatchObject({
    sessionId: before.sessionId,
    revision: before.revision,
  });
  const a = requests[0].args.bounds as number[],
    b = requests[1].args.bounds as number[];
  expect(a).not.toEqual(b);
  // The first pan crosses the loaded margin; the second requests another
  // quantum while remaining covered by the first response.
  await drawn(page);
  const current = await canvas.evaluate((element: HTMLCanvasElement) => {
    const t = element.getContext("2d")!.getTransform();
    return [
      -t.e / t.a,
      -t.f / t.d,
      (element.width - t.e) / t.a,
      (element.height - t.f) / t.d,
    ];
  });
  expect(a[0]).toBeLessThanOrEqual(current[0]);
  expect(a[1]).toBeLessThanOrEqual(current[1]);
  expect(a[2]).toBeGreaterThanOrEqual(current[2]);
  expect(a[3]).toBeGreaterThanOrEqual(current[3]);
  await page.evaluate(() => {
    window.atlasSceneHeld[0].release();
  });
  await expect.poll(() => page.evaluate(() => window.atlasReadActive)).toBe(1);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  const drag = async () => {
    await page.mouse.move(box.x + 250, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 310, box.y + 260);
    await page.mouse.up();
  };
  await page.evaluate(() => {
    window.atlasSceneBarrier = false;
  });
  await drag();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.atlasCalls.filter((x) => x.cmd === "commit").length,
      ),
    )
    .toBe(1);
  const edited = await page.evaluate(() => window.atlasCore("status", {}));
  expect(edited.sessionId).toBe(before.sessionId);
  expect(edited.revision).toBeGreaterThan(before.revision);
  await showObjects(page);
  await expect(
    page.getByRole("button", { name: "⌂ Haus 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  // The old B reply is released only after the actual edit and newer presentation.
  await page.evaluate(() => window.atlasSceneHeld[1].release());
  await expect.poll(() => page.evaluate(() => window.atlasReadActive)).toBe(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await showObjects(page);
  await expect(
    page.getByRole("button", { name: "⌂ Haus 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  const final = await page.evaluate(() => window.atlasCore("status", {}));
  expect(final.sessionId).toBe(edited.sessionId);
  expect(final.revision).toBe(edited.revision);
});
