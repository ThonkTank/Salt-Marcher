import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
import { campaignId } from "../src/features/campaign/campaign-contracts";
import { CampaignEntry } from "../src/ui/campaign-entry";

const a = campaignId("00000000-0000-4000-8000-000000000001"),
  b = campaignId("00000000-0000-4000-8000-000000000002");
const deferred = () => { let resolve!: () => void, reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function fixture(open: ConstructorParameters<typeof CampaignEntry>[1]["onOpen"] = async (campaignId) => ({ activeCampaignId: campaignId })) {
  const { document } = parseHTML("<html><body><div id='host'></div></body></html>"), host = document.querySelector("#host") as HTMLElement;
  const view = new CampaignEntry(host, { onOpen: open, onRetry: async () => {} });
  return { document, host, view };
}
function model(active: typeof a | null = null) { return { activeCampaignId: active, entries: [
  { key: a, campaignId: a, name: "Alpha", status: "available" as const, reason: null },
  { key: b, campaignId: b, name: "Beta", status: "unavailable" as const, reason: "Registry fehlt" },
] }; }

test("empty campaign picker stays as a compact optional disclosure", async () => {
  const f = fixture();
  const disclosure = f.host.querySelector("details")!;
  assert.ok(disclosure);
  assert.equal(disclosure.hasAttribute("open"), false);
  assert.equal(disclosure.querySelector("summary")?.textContent, "Kampagne verknüpfen");
  assert.match(disclosure.textContent, /Keine verfügbare Kampagne gefunden/);
  assert.equal(f.host.querySelector("h3"), null);
});

test("campaign picker renders active and unavailable campaigns and invokes the safe host callback", async () => {
  const calls: unknown[] = [], f = fixture(async (...args) => { calls.push(args); return { activeCampaignId: args[0] }; }); f.view.update(model(a));
  assert.match(f.host.textContent, /AlphaAktivErneut versuchen/); assert.match(f.host.textContent, /BetaRegistry fehlt/);
  const buttons = f.host.querySelectorAll("button");
  (buttons[0] as HTMLButtonElement).click(); await tick();
  assert.deepEqual(calls, [[a, "switch"]]); assert.equal((buttons[1] as HTMLButtonElement).disabled, true);
});

test("campaign picker blocks duplicate clicks and exposes a current-campaign failure for retry", async () => {
  const gate = deferred(), f = fixture(async () => { await gate.promise; throw new Error("B ist aktiv, Atlas fehlt"); }); f.view.update(model(a));
  const button = f.host.querySelector("button") as HTMLButtonElement; button.click(); button.click();
  assert.equal(button.disabled, false); // old node is detached; live control is disabled
  assert.equal((f.host.querySelector("button") as HTMLButtonElement).disabled, true);
  gate.resolve(); await tick();
  assert.match(f.host.textContent, /B ist aktiv, Atlas fehlt/);
});

test("campaign picker ignores stale completion after update and destroy", async () => {
  const first = deferred(), f = fixture(async () => { await first.promise; return { activeCampaignId: a }; }); f.view.update(model());
  (f.host.querySelector("button") as HTMLButtonElement).click(); f.view.update(model(a));
  assert.equal((f.host.querySelector("button") as HTMLButtonElement).disabled, false);
  first.resolve(); await tick(); assert.equal(f.host.querySelector("[data-active=true]")?.textContent.includes("Alpha"), true);
  const second = deferred(), g = fixture(async () => { await second.promise; return { activeCampaignId: a }; }); g.view.update(model());
  (g.host.querySelector("button") as HTMLButtonElement).click(); g.view.destroy(); second.resolve(); await tick();
  assert.equal(g.host.textContent, "");
});

test("campaign picker represents a post-activation load failure as current unavailable B", async () => {
  const f = fixture(async () => ({ activeCampaignId: b, unavailableReason: "Atlas für B konnte nicht geladen werden" }));
  f.view.update({ activeCampaignId: a, entries: [model(a).entries[0]!, { ...model(a).entries[1]!, status: "available", reason: null }] });
  (f.host.querySelectorAll("button")[1] as HTMLButtonElement).click(); await tick();
  assert.equal(f.host.querySelector("[data-active=true]")?.getAttribute("data-campaign-key"), b);
  assert.match(f.host.textContent, /Atlas für B konnte nicht geladen werden/);
});
