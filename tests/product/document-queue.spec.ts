import type { PlannedAction } from "../../src/atlas/editorWorkflow";
import type { Intent } from "../../src/atlas/model";
type Hook = Window["atlasHook"];
declare global {
  interface Window {
    action: PlannedAction;
    first: ReturnType<Hook["inspect"]>;
    queued: ReturnType<Hook["inspect"]>;
    next: ReturnType<Hook["inspect"]>;
    remounted: ReturnType<Hook["inspect"]>;
    oldHook: Hook;
    doc: Promise<void>;
    refresh: Promise<void>;
    docPromise: Promise<void>;
    docSettled: boolean;
    write1: ReturnType<Hook["commit"]>;
    write2: ReturnType<Hook["commit"]>;
  }
}
import { editorUrl } from "../support/browserServer";
import { expect, test } from "../support/fixture";

const url = `${editorUrl}?hook`;

test("document replacement and StrictMode unmount settle pending previews", async ({
  page,
}) => {
  await page.goto(url);
  await expect
    .poll(() => page.evaluate(() => !!window.atlasHook?.status))
    .toBe(true);
  await page.evaluate(() => window.atlasHook.document("save"));
  await page.evaluate(() => {
    window.atlasHold = { cmd: "preview" };
    const action: PlannedAction = {
      operationId: 1,
      intent: {
        type: "createRoad",
        road: {
          name: "Test",
          width: 10,
          material: "earth",
          nodes: [
            { point: [0, 0], incoming: null, outgoing: null },
            { point: [100, 0], incoming: null, outgoing: null },
          ],
        },
        population: null,
      },
    };
    window.action = action;
    window.first = window.atlasHook.inspect(action);
  });
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await page.evaluate(() => {
    window.queued = window.atlasHook.inspect(window.action);
    window.doc = window.atlasHook.document("open");
  });
  expect(await page.evaluate(() => window.queued)).toBeNull();
  await page.evaluate(() => window.doc);
  await page.evaluate(() => {
    window.next = window.atlasHook.inspect(window.action);
    window.atlasUnmount!();
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.getElementById("root")!.childNodes.length),
    )
    .toBe(0);
  expect(await page.evaluate(() => window.next)).toBeNull();
  await page.evaluate(() => {
    window.oldHook = window.atlasHook;
    window.atlasRemount!();
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.atlasHook !== window.oldHook && !!window.atlasHook.status,
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    window.remounted = window.atlasHook.inspect(window.action);
  });
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "preview").length,
    ),
  ).toBe(1);
  await page.evaluate(() => window.atlasRelease!());
  expect(await page.evaluate(() => window.first)).toBeNull();
  expect((await page.evaluate(() => window.remounted))?.actionId).toBe(1);
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "preview").length,
    ),
  ).toBe(2);
});

test("accepted writes drain in order after real unmount", async ({ page }) => {
  await page.goto(url);
  await expect
    .poll(() => page.evaluate(() => !!window.atlasHook?.status))
    .toBe(true);
  const initial = await page.evaluate(() => window.atlasHook.status!.revision);
  await page.evaluate(() => {
    window.atlasCalls = [];
    window.atlasHold = { cmd: "commit" };
    const intent = (name: string, y: number): Intent => ({
      type: "createRoad",
      road: {
        name,
        width: 10,
        material: "earth",
        nodes: [
          { point: [0, y], incoming: null, outgoing: null },
          { point: [100, y], incoming: null, outgoing: null },
        ],
      },
      population: null,
    });
    window.write1 = window.atlasHook.commit(intent("First", 0));
    window.write2 = window.atlasHook.commit(intent("Second", 100));
  });
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  const unmounts = await page.evaluate(() => window.atlasUnmounts ?? 0);
  await page.evaluate(() => window.atlasUnmount!());
  await expect
    .poll(() => page.evaluate(() => window.atlasUnmounts ?? 0))
    .toBe(unmounts + 1);
  await page.evaluate(() => {
    window.oldHook = window.atlasHook;
    window.atlasRemount!();
  });
  await expect
    .poll(() => page.evaluate(() => window.atlasHook !== window.oldHook))
    .toBe(true);
  expect(await page.evaluate(() => window.atlasHook.status)).toBeNull();
  await page.evaluate(() => window.atlasRelease!());
  const results = await page.evaluate(() =>
    Promise.all([window.write1, window.write2]),
  );
  expect(results.map((r) => r?.status?.revision)).toEqual([
    initial + 1,
    initial + 2,
  ]);
  const calls = await page.evaluate(() =>
    window.atlasCalls
      .filter((c) => c.cmd === "commit")
      .map((c) => ({
        name:
          c.args.intent.type === "createRoad" ? c.args.intent.road.name : null,
        revision: c.args.version.revision,
      })),
  );
  expect(calls).toEqual([
    { name: "First", revision: initial },
    { name: "Second", revision: initial + 1 },
  ]);
  const status = await page.evaluate(() => window.atlasCore("status", {}));
  expect(status.revision).toBe(initial + 2);
  await expect
    .poll(() => page.evaluate(() => window.atlasHook.status?.revision))
    .toBe(initial + 2);
});

test("unmount cancels an abandoned unsaved confirmation", async ({ page }) => {
  await page.goto(url);
  await expect
    .poll(() => page.evaluate(() => !!window.atlasHook?.status))
    .toBe(true);
  await page.evaluate(async () => {
    await window.atlasHook.commit({
      type: "createHouse",
      parcelId: null,
      transform: { x: 0, y: 0, angle: 0 },
      width: 2,
      depth: 2,
    });
    window.atlasCalls = [];
    window.docSettled = false;
    window.docPromise = window.atlasHook.document("new").finally(() => {
      window.docSettled = true;
    });
  });
  await expect
    .poll(() => page.evaluate(() => !!window.atlasHook.unsaved))
    .toBe(true);
  const unmounts = await page.evaluate(() => window.atlasUnmounts ?? 0);
  await page.evaluate(() => window.atlasUnmount!());
  await expect
    .poll(() => page.evaluate(() => window.atlasUnmounts ?? 0))
    .toBe(unmounts + 1);
  await expect.poll(() => page.evaluate(() => window.docSettled)).toBe(true);
  await page.evaluate(() => window.atlasRemount!());
  await expect
    .poll(() => page.evaluate(() => !!window.atlasHook.status))
    .toBe(true);
  expect(await page.evaluate(() => window.atlasHook.status!.dirty)).toBe(true);
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "new").length,
    ),
  ).toBe(0);
});

for (const operation of ["open", "save"] as const) {
  for (const loseReply of [false, true]) {
    test(`remount waits for a held ${operation} response (lost: ${loseReply})`, async ({
      page,
    }) => {
      await page.goto(url);
      await expect
        .poll(() => page.evaluate(() => !!window.atlasHook?.status))
        .toBe(true);
      await page.evaluate(
        async ({ kind, lose }) => {
          await window.atlasHook.commit({
            type: "createHouse",
            parcelId: null,
            transform: { x: 0, y: 0, angle: 0 },
            width: 2,
            depth: 2,
          });
          if (kind === "open") {
            await window.atlasHook.document("save");
            await window.atlasHook.document("new");
          }
          window.atlasCalls = [];
          window.atlasHold = { cmd: kind };
          window.atlasFailFile = lose ? kind : undefined;
          window.doc = window.atlasHook.document(kind);
        },
        { kind: operation, lose: loseReply },
      );
      await expect
        .poll(() => page.evaluate(() => !!window.atlasHeld))
        .toBe(true);
      const actual = await page.evaluate(() => window.atlasCore("status", {}));
      const unmounts = await page.evaluate(() => window.atlasUnmounts ?? 0);
      await page.evaluate(() => window.atlasUnmount!());
      await expect
        .poll(() => page.evaluate(() => window.atlasUnmounts ?? 0))
        .toBe(unmounts + 1);
      await page.evaluate(() => {
        window.oldHook = window.atlasHook;
        window.atlasRemount!();
      });
      await expect
        .poll(() => page.evaluate(() => window.atlasHook !== window.oldHook))
        .toBe(true);
      expect(await page.evaluate(() => window.atlasHook.status)).toBeNull();
      expect(await page.evaluate(() => window.atlasHook.exclusive)).toBe(true);
      expect(
        await page.evaluate(() =>
          window.atlasHook.commit({
            type: "createHouse",
            parcelId: null,
            transform: { x: 100, y: 0, angle: 0 },
            width: 2,
            depth: 2,
          }),
        ),
      ).toBeNull();
      await page.evaluate(() => {
        window.refresh = window.atlasHook.reconcile();
      });
      expect(
        await page.evaluate(
          () => window.atlasCalls.filter((c) => c.cmd === "status").length,
        ),
      ).toBe(0);
      await page.evaluate(() => window.atlasRelease!());
      await page.evaluate(() => Promise.all([window.doc, window.refresh]));
      await expect
        .poll(() => page.evaluate(() => window.atlasHook.status?.sessionId))
        .toBe(actual.sessionId);
      expect(await page.evaluate(() => window.atlasHook.status?.revision)).toBe(
        actual.revision,
      );
      expect(await page.evaluate(() => window.atlasHook.status?.dirty)).toBe(
        actual.dirty,
      );
      expect(
        await page.evaluate(
          (kind) => window.atlasCalls.filter((c) => c.cmd === kind).length,
          operation,
        ),
      ).toBe(1);
      expect(
        await page.evaluate(
          () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
        ),
      ).toBe(0);
    });
  }
}
