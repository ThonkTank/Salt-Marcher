import { beforeEach, expect, test, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { AtlasClient } from "./client";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => true,
}));
beforeEach(() => vi.mocked(invoke).mockReset());

test("native request, open and save bind the registered commands and argument names", async () => {
  const client = new AtlasClient();
  const version = { sessionId: "native-session", revision: 7 };
  const args = { version, redo: false };
  const result = { ...version, dirty: false };
  vi.mocked(invoke).mockResolvedValue(result);
  expect(await client.request("history", args)).toBe(result);
  expect(invoke).toHaveBeenLastCalledWith("atlas_request", {
    cmd: "history",
    args,
  });
  expect(await client.open(version)).toBe(result);
  expect(invoke).toHaveBeenLastCalledWith("atlas_open", { version });
  expect(await client.save(version)).toBe(result);
  expect(invoke).toHaveBeenLastCalledWith("atlas_save", {
    version,
    saveAs: false,
  });
  await client.save(version, true);
  expect(invoke).toHaveBeenLastCalledWith("atlas_save", {
    version,
    saveAs: true,
  });
  expect(invoke).toHaveBeenCalledTimes(4);
  vi.mocked(invoke).mockResolvedValue(null);
  expect(await client.open(version)).toBeNull();
  expect(await client.save(version, true)).toBeNull();
});
