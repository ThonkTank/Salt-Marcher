import { test as base, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCoreTransport, type CoreTransport } from "./coreTransport";

type CoreOptions = NonNullable<Parameters<typeof startCoreTransport>[0]>;
export const test = base.extend<{
  coreOptions: CoreOptions;
  coreDirectory: string;
  core: CoreTransport;
}>({
  coreOptions: [{}, { option: true }],
  coreDirectory: async ({}, use) => {
    const dir = await mkdtemp(join(tmpdir(), "saltmarcher-e2e-"));
    try {
      await use(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  core: async ({ coreOptions, coreDirectory }, use) => {
    const core = startCoreTransport({
      ...coreOptions,
      env: { ...process.env, ...coreOptions.env, TMPDIR: coreDirectory },
    });
    try {
      await use(core);
    } finally {
      await core.close();
    }
  },
  page: async ({ page, core, coreDirectory }, use) => {
    const request = async (cmd: string, args: Record<string, unknown>) => {
      if (cmd === "save" || cmd === "open")
        args = { ...args, path: join(coreDirectory, "Test.saltatlas") };
      const response = JSON.parse(await core.request({ cmd, args }));
      if (response.error) throw Error(JSON.stringify(response.error));
      return response.value;
    };
    await page.exposeBinding("atlasCore", (_source, cmd, args) =>
      request(cmd, args),
    );
    await page.exposeBinding("atlasRaw", (_source, cmd, args) =>
      request(cmd, args),
    );
    await use(page);
  },
});
export { expect };
