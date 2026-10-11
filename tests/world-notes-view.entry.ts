import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { campaignContext, campaignContextToken, campaignId, campaignNamespace,
  campaignRevision, campaignSnapshot, type CampaignContextProjection } from "../src/features/campaign/campaign-contracts";
import { emptyWorldNotes } from "../src/features/world/world-notes";
import type { AtlasCampaignServices } from "../src/ui/atlas-campaign-host";
import type { CreatureCatalogLoader } from "../src/features/catalog/creature-catalog-loader";
import type { WorldNotesNativeSession } from "../src/ui/world-notes-native-session";
import { WorldNotesView } from "../src/ui/world-notes-view";
import { WorldNotesDraftBuffer } from "../src/ui/world-notes-panel";

const context = (n: number, token = `world:${n}`) => campaignContext(campaignSnapshot({
  schemaVersion: 1,
  campaignId: campaignId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`),
  namespace: campaignNamespace(`00000000-0000-4000-8000-${String(n + 10).padStart(12, "0")}`),
  revision: campaignRevision(1), name: `Welt ${n}`, lifecycle: "active",
}), campaignContextToken(token));
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("actual World Notes view keeps authored A and B drafts across provider mounts", async () => {
  const { document, window } = parseHTML("<html><body><div id='host'></div></body></html>");
  Object.defineProperty(window.HTMLElement.prototype, "focus", { configurable: true, value() {} });
  const host = document.querySelector<HTMLElement>("#host")!;
  let active: CampaignContextProjection | null = context(1);
  let commitCalls = 0;
  const listeners = new Set<() => void>();
  const provider = {
    currentContext: () => active,
    subscribeContextChanged: (listener: () => void) => {
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    entries: async () => [],
  };
  const services = { provider } as unknown as AtlasCampaignServices;
  const draftBuffer = new WorldNotesDraftBuffer();
  class TestView extends WorldNotesView {
    protected override createSession(mounted: CampaignContextProjection): WorldNotesNativeSession {
      let closed = false;
      return {
        open: async () => {
          if (closed) throw new Error("closed session");
          return emptyWorldNotes(mounted);
        },
        close: () => { closed = true; },
        commit: async () => { commitCalls++; throw new Error("test must not save a draft"); },
        validateReceipt: () => { throw new Error("test must not validate a receipt"); },
      } as unknown as WorldNotesNativeSession;
    }
  }
  const view = new TestView({ contentEl: host } as never, services,
    { load: async () => { throw new Error("catalog unused"); } } as unknown as CreatureCatalogLoader,
    draftBuffer);
  const click = (label: string) => {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>(".dn-world-notes button"))
      .find((item) => item.textContent === label);
    assert(button, `missing ${label}`);
    button.dispatchEvent(new window.Event("click", { bubbles: true }));
  };
  const name = () => host.querySelector<HTMLInputElement>(".dn-world-notes form input")!;
  const write = (value: string) => {
    name().value = value;
    name().dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  await view.onOpen();
  const panel = host.querySelector(".dn-world-notes");
  click("NPC anlegen"); write("A-Entwurf");
  const oldInput = name();
  const oldForm = host.querySelector(".dn-world-notes form")!;
  active = context(2); listeners.forEach((listener) => listener()); await settle();
  assert.equal(host.querySelector(".dn-world-notes"), panel);
  assert.equal(host.querySelector(".dn-world-notes form"), null);
  click("Quest anlegen"); write("B-Entwurf");
  oldInput.value = "veralteter Text";
  oldInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  oldForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(commitCalls, 0);
  active = context(1, "world:one-renewed"); listeners.forEach((listener) => listener()); await settle();
  assert.equal(name().value, "A-Entwurf");
  active = null; listeners.forEach((listener) => listener()); await settle();
  assert.equal(host.querySelector<HTMLElement>(".dn-world-notes")?.hidden, true);
  active = context(1, "world:one-again"); listeners.forEach((listener) => listener()); await settle();
  assert.equal(name().value, "A-Entwurf");
  active = context(2, "world:two-renewed"); listeners.forEach((listener) => listener()); await settle();
  assert.equal(name().value, "B-Entwurf");
  await view.onClose();
  const reopened = new TestView({ contentEl: host } as never, services,
    { load: async () => { throw new Error("catalog unused"); } } as unknown as CreatureCatalogLoader,
    draftBuffer);
  await reopened.onOpen();
  assert.equal(name().value, "B-Entwurf");
  active = context(1, "world:after-reopen"); listeners.forEach((listener) => listener()); await settle();
  assert.equal(name().value, "A-Entwurf");
  oldInput.value = "late after close";
  oldInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  oldForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(name().value, "A-Entwurf");
  assert.equal(commitCalls, 0);
  click("Entwurf verwerfen"); click("Verwerfen bestätigen");
  await reopened.onClose();
  const afterDiscard = new TestView({ contentEl: host } as never, services,
    { load: async () => { throw new Error("catalog unused"); } } as unknown as CreatureCatalogLoader,
    draftBuffer);
  await afterDiscard.onOpen();
  assert.equal(host.querySelector(".dn-world-notes form"), null);
  await afterDiscard.onClose();
});
