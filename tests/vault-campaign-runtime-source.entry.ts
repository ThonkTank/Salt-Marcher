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

test("vault campaign storage emits only relevant create, modify, delete and rename changes", () => {
  const handlers = new Map<string, (...args: never[]) => void>(), removed: unknown[] = [];
  const vault = { getFiles: () => [], read: async () => "",
    on: (name: string, handler: (...args: never[]) => void) => { handlers.set(name, handler); return { name }; },
    offref: (ref: unknown) => removed.push(ref) };
  const storage = new VaultCampaignRuntimeStorage({ vault } as never); let changes = 0;
  const stop = storage.subscribe(() => { changes++; });
  handlers.get("create")?.(file(`${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json`) as never);
  handlers.get("modify")?.(file("Atlanten/a.overworld") as never);
  handlers.get("delete")?.(file(`${CAMPAIGN_RUNTIME_ROOT}/a.campaign.json`) as never);
  handlers.get("rename")?.(file("Elsewhere/a.json") as never, `${CAMPAIGN_RUNTIME_ROOT}/old.campaign.json` as never);
  assert.equal(changes, 3); stop(); assert.equal(removed.length, 4);
});
