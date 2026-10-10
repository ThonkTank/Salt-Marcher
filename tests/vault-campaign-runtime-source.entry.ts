import assert from "node:assert/strict";
import test from "node:test";
import { TFile } from "obsidian";
import { CAMPAIGN_RUNTIME_ROOT, VaultCampaignRuntimeStorage } from "../src/vault-campaign-runtime-source";

const file = (path: string) => Object.assign(new TFile(), { path });

test("vault campaign storage lists only sorted manifest files below its product root", async () => {
  const files = [file(`${CAMPAIGN_RUNTIME_ROOT}/b.campaign.json`), file("Atlanten/a.overworld"),
    file(`${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json`), file(`${CAMPAIGN_RUNTIME_ROOT}/note.md`)];
  const storage = new VaultCampaignRuntimeStorage({ vault: { getFiles: () => files,
    read: async (file: TFile) => `bytes:${file.path}` } } as never);
  assert.deepEqual(await storage.list(), [
    { path: `${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json`, bytes: `bytes:${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json` },
    { path: `${CAMPAIGN_RUNTIME_ROOT}/b.campaign.json`, bytes: `bytes:${CAMPAIGN_RUNTIME_ROOT}/b.campaign.json` },
  ]);
});

test("vault campaign storage emits typed relevant changes and exact modified bytes", async () => {
  const handlers = new Map<string, (...args: never[]) => void>(), removed: unknown[] = [];
  const vault = { getFiles: () => [], read: async () => "",
    on: (name: string, handler: (...args: never[]) => void) => { handlers.set(name, handler); return { name }; },
    offref: (ref: unknown) => removed.push(ref) };
  const storage = new VaultCampaignRuntimeStorage({ vault } as never); const changes: unknown[] = [];
  const stop = storage.subscribe((change) => { changes.push(change); });
  handlers.get("create")?.(file(`${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json`) as never);
  handlers.get("modify")?.(file("Atlanten/a.overworld") as never);
  handlers.get("delete")?.(file(`${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json`) as never);
  handlers.get("rename")?.(file("Elsewhere/a.json") as never, `${CAMPAIGN_RUNTIME_ROOT}/old.campaign.json` as never);
  await Promise.resolve();
  assert.deepEqual(changes, [
    { kind: "create", path: `${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json` },
    { kind: "delete", path: `${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json` },
    { kind: "rename", path: "Elsewhere/a.json", oldPath: `${CAMPAIGN_RUNTIME_ROOT}/old.campaign.json` },
  ]);
  handlers.get("modify")?.(file(`${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json`) as never);
  assert.deepEqual(changes.at(-1),
    { kind: "modify", phase: "pending", eventId: 1, path: `${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json` });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(changes.at(-1),
    { kind: "modify", phase: "resolved", eventId: 1,
      path: `${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json`, bytes: "" });
  stop(); assert.equal(removed.length, 4);
});

test("vault campaign storage announces modify before a deferred read and resolves events in source order", async () => {
  const handlers = new Map<string, (...args: never[]) => void>(),
    releases = new Map<string, (bytes: string) => void>();
  const vault = { getFiles: () => [],
    read: (target: TFile) => new Promise<string>((resolve) => { releases.set(target.path, resolve); }),
    on: (name: string, handler: (...args: never[]) => void) => { handlers.set(name, handler); return { name }; },
    offref: () => undefined };
  const storage = new VaultCampaignRuntimeStorage({ vault } as never), changes: unknown[] = [];
  storage.subscribe((change) => { changes.push(change); });
  const first = `${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json`, second = `${CAMPAIGN_RUNTIME_ROOT}/b.campaign.json`;
  handlers.get("modify")?.(file(first) as never);
  handlers.get("modify")?.(file(second) as never);
  assert.deepEqual(changes, [
    { kind: "modify", phase: "pending", eventId: 1, path: first },
    { kind: "modify", phase: "pending", eventId: 2, path: second },
  ]);
  releases.get(second)?.("bytes:b");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(changes.length, 2);
  releases.get(first)?.("bytes:a");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(changes.slice(2), [
    { kind: "modify", phase: "resolved", eventId: 1, path: first, bytes: "bytes:a" },
    { kind: "modify", phase: "resolved", eventId: 2, path: second, bytes: "bytes:b" },
  ]);
});
