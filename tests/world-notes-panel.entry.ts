import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
import { campaignContext, campaignContextToken, campaignId, campaignLocalId,
  campaignNamespace, campaignRevision, campaignSnapshot } from "../src/features/campaign/campaign-contracts";
import { changeWorldNotes, emptyWorldNotes, type WorldNoteChange } from "../src/features/world/world-notes";
import { serializeWorldNote } from "../src/features/world/world-notes";
import { payloadDigest, type CampaignCommandId } from "../src/features/campaign/campaign-contracts";
import { campaignOwnershipDigestValue } from "../src/features/campaign/campaign-ownership";
import { worldNotePath, type WorldNotesCommitReceiptV1 } from "../src/features/campaign/world-notes-commit";
import { WorldNotesPanel, type WorldNotesCreatureChoice } from "../src/ui/world-notes-panel";

const id = (n: number) => campaignLocalId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
const context = campaignContext(campaignSnapshot({ schemaVersion: 1,
  campaignId: campaignId("00000000-0000-4000-8000-000000000001"),
  namespace: campaignNamespace("00000000-0000-4000-8000-000000000002"),
  revision: campaignRevision(1), name: "Welt", lifecycle: "active" }), campaignContextToken("world:one"));
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const digest = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

function fixture(creatures?: {
  search: (query: string) => Promise<readonly WorldNotesCreatureChoice[]>;
  detail: (id: string) => Promise<WorldNotesCreatureChoice | null>;
}) {
  const { document, window } = parseHTML("<html><body><div id='host'></div></body></html>");
  const host = document.querySelector<HTMLElement>("#host")!;
  let focused: HTMLElement | null = null;
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true, value: function (this: HTMLElement) { focused = this; },
  });
  let snapshot = emptyWorldNotes(context), nextId = 10;
  const calls: { change: WorldNoteChange; expected: number }[] = [];
  let refuse = false;
  let substitute: ((change: WorldNoteChange, expected: number) => typeof snapshot) | null = null;
  let tamperReceipt: ((receipt: WorldNotesCommitReceiptV1) => WorldNotesCommitReceiptV1) | null = null;
  let rejectReceipt = false;
  const issued = new WeakSet<object>();
  const panel = new WorldNotesPanel(host, {
    newId: () => id(nextId++),
    currentContext: () => context,
    searchCreatures: creatures?.search,
    creatureDetail: creatures?.detail,
    digest,
    validateReceipt: (receipt) => {
      if (rejectReceipt || !issued.has(receipt)) throw new Error("Fremdes Receipt");
    },
    commit: async (commandId: CampaignCommandId, change, expected) => {
      calls.push({ change, expected });
      if (refuse) throw new Error("Speicher gesperrt");
      const before = snapshot;
      snapshot = substitute ? substitute(change, expected) :
        changeWorldNotes(snapshot, context, context, expected, change);
      const record = snapshot.records.find((item) => item.id === change.id) ?? before.records[0]!;
      const old = before.records.find((item) => item.id === change.id);
      let receipt: WorldNotesCommitReceiptV1 = {
        version: 1, status: "committed", commandId, transactionId: crypto.randomUUID(),
        contextToken: context.contextToken,
        changeDigest: campaignOwnershipDigestValue(change, digest), recordId: change.id,
        notePath: worldNotePath(snapshot.namespace, record.kind, record.id),
        beforeSnapshotRevision: before.revision, afterSnapshotRevision: snapshot.revision,
        beforeSnapshotDigest: campaignOwnershipDigestValue(before, digest),
        afterSnapshotDigest: campaignOwnershipDigestValue(snapshot, digest),
        beforeRecordRevision: old?.revision ?? null, afterRecordRevision: record.revision,
        afterPayloadDigest: payloadDigest(digest(serializeWorldNote(record))), deleted: record.deleted,
      };
      if (tamperReceipt) receipt = tamperReceipt(receipt);
      issued.add(receipt);
      return { snapshot, receipt };
    },
  });
  panel.update(snapshot);
  const click = (label: string) => {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((item) => item.textContent === label);
    assert(button, `Button ${label} fehlt`);
    button.dispatchEvent(new window.Event("click", { bubbles: true }));
    return button;
  };
  const input = (label: string, value: string) => {
    const element = Array.from(host.querySelectorAll("label"))
      .find((item) => item.textContent?.startsWith(label))?.querySelector("input,textarea") as HTMLInputElement | null;
    assert(element, `Feld ${label} fehlt`);
    element.value = value; element.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  const save = async () => {
    host.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await tick();
  };
  return { host, panel, click, input, save, calls, focused: () => focused, snapshot: () => snapshot,
    setSnapshot: (value: typeof snapshot) => { snapshot = value; panel.update(value); },
    substitute: (value: typeof substitute) => { substitute = value; },
    tamperReceipt: (value: typeof tamperReceipt) => { tamperReceipt = value; },
    rejectReceipt: (value: boolean) => { rejectReceipt = value; },
    refuse: (value: boolean) => { refuse = value; }, window };
}

test("keyboard focus moves into a new editor and returns after save or discard", async () => {
  const f = fixture();
  f.click("NPC anlegen");
  assert.equal(f.focused(), f.host.querySelector("form input"));
  f.input("Name", "Älva"); await f.save();
  assert.equal(f.focused()?.textContent, "NPC: Älva");
  f.click("NPC: Älva");
  assert.equal(f.focused(), f.host.querySelector("form input"));
  f.click("Entwurf verwerfen"); f.click("Verwerfen bestätigen");
  assert.equal(f.focused(), f.host.querySelector('input[type="search"]'));
  f.panel.destroy();
});

test("NPC can choose an existing creature by name without copying catalog content", async () => {
  const f = fixture({
    search: async (query) => query === "gob" ? [{ id: "goblin", name: "Goblin" }] : [],
    detail: async (id) => id === "goblin" ? { id, name: "Goblin" } : null,
  });
  f.click("NPC anlegen"); f.input("Name", "Maris");
  f.input("Kreatur suchen", "gob"); await tick();
  f.click("Goblin auswählen");
  assert.equal(f.host.querySelector<HTMLInputElement>('form label input')?.value, "Maris");
  assert.equal(Array.from(f.host.querySelectorAll("label"))
    .find((label) => label.textContent?.startsWith("Kreaturreferenz"))?.querySelector("input")?.value, "goblin");
  await f.save();
  assert.equal(f.snapshot().records[0]?.creatureId, "goblin");
  f.click("NPC: Maris"); await tick();
  assert.match(f.host.querySelector("form")!.textContent!, /Goblin \(goblin\)/);
  assert.equal(f.snapshot().records[0]?.readAloud, "");
  f.panel.destroy();
});

test("manual creature edits clear the prior catalog name and late suggestions", async () => {
  let answer!: (choices: readonly WorldNotesCreatureChoice[]) => void;
  const f = fixture({
    search: (query) => query === "dra" ? new Promise((resolve) => { answer = resolve; }) :
      Promise.resolve([{ id: "goblin", name: "Goblin" }]),
    detail: async () => null,
  });
  f.click("NPC anlegen"); f.input("Name", "Maris");
  f.input("Kreatur suchen", "gob"); await tick();
  f.click("Goblin auswählen");
  f.input("Kreatur suchen", "dra");
  f.input("Kreaturreferenz", "srd:wizard");
  answer([{ id: "dragon", name: "Drache" }]); await tick();
  assert.match(f.host.querySelector("form")!.textContent!, /Kreaturreferenz: srd:wizard/);
  assert.doesNotMatch(f.host.querySelector("form")!.textContent!, /Goblin|Drache auswählen/);
  await f.save();
  assert.equal(f.snapshot().records[0]?.creatureId, "srd:wizard");
  f.panel.destroy();
});

test("late creature search cannot populate a discarded NPC editor", async () => {
  let answer!: (choices: readonly WorldNotesCreatureChoice[]) => void;
  const f = fixture({
    search: () => new Promise((resolve) => { answer = resolve; }),
    detail: async () => null,
  });
  f.click("NPC anlegen"); f.input("Kreatur suchen", "gob");
  f.click("Entwurf verwerfen"); f.click("Verwerfen bestätigen");
  answer([{ id: "goblin", name: "Goblin" }]); await tick();
  assert.equal(f.host.querySelector("form"), null);
  assert.equal(f.host.textContent?.includes("Goblin auswählen"), false);
  f.panel.destroy();
});

test("older catalog answers cannot replace the newest creature search", async () => {
  const answers = new Map<string, (choices: readonly WorldNotesCreatureChoice[]) => void>();
  const f = fixture({
    search: (query) => new Promise((resolve) => { answers.set(query, resolve); }),
    detail: async () => null,
  });
  f.click("NPC anlegen"); f.input("Kreatur suchen", "gob");
  f.input("Kreatur suchen", "dra");
  answers.get("dra")!([{ id: "adult-red-dragon", name: "Adult Red Dragon" }]); await tick();
  answers.get("gob")!([{ id: "goblin", name: "Goblin" }]); await tick();
  assert.match(f.host.querySelector("form")!.textContent!, /Adult Red Dragon auswählen/);
  assert.doesNotMatch(f.host.querySelector("form")!.textContent!, /Goblin auswählen/);
  f.panel.destroy();
});

test("GM creates, searches, edits and reopens exact authored prose through confirmed snapshots", async () => {
  const f = fixture();
  assert.equal(f.host.querySelector('details summary')?.textContent, "Hilfe zu Kampagnenwissen");
  assert.equal(f.host.querySelector('[role="region"]')?.getAttribute("aria-label"), "Kampagnenwissen");
  f.click("NPC anlegen"); f.input("Name", "Älva");
  f.input("Vorlesetext", "  Licht fällt.\n"); f.input("GM-Notizen", "# Geheim\n\n[[Tor]]");
  f.input("Kreaturreferenz", "srd:wizard"); await f.save();
  assert.equal(f.snapshot().records[0]?.readAloud, "  Licht fällt.\n");
  assert.equal(f.snapshot().records[0]?.gmNotes, "# Geheim\n\n[[Tor]]");
  assert.equal(f.host.querySelector('[role="status"]')?.textContent, "Gespeichert");
  const search = f.host.querySelector<HTMLInputElement>('input[type="search"]')!;
  search.value = "ÄLVA"; search.dispatchEvent(new f.window.Event("input"));
  assert.match(f.host.querySelector("ul")!.textContent!, /Älva/);
  f.click("NPC: Älva"); f.input("GM-Notizen", "# Geheim\n\n[[Tor]]\nNeue Spur"); await f.save();
  assert.equal(f.snapshot().records[0]?.revision, 2);
  f.panel.destroy();
  const reopened = fixture(); reopened.panel.update(f.snapshot());
  reopened.click("NPC: Älva");
  assert.equal(reopened.host.querySelector<HTMLTextAreaElement>("textarea")?.value, "  Licht fällt.\n");
  assert.equal(reopened.host.querySelectorAll<HTMLTextAreaElement>("textarea")[1]?.value, "# Geheim\n\n[[Tor]]\nNeue Spur");
  reopened.panel.destroy();
});

test("GM finds a related NPC by faction name or relation label", async () => {
  const f = fixture();
  f.click("Fraktion anlegen"); f.input("Name", "Nebelbund"); await f.save();
  f.click("NPC anlegen"); f.input("Name", "Älva");
  f.host.querySelector('[aria-label="Beziehungsziel"] option')!.setAttribute("selected", "");
  const relationLabel = f.host.querySelector<HTMLInputElement>('[aria-label="Beziehungsname"]')!;
  relationLabel.value = "Mitglied";
  f.click("Beziehung hinzufügen"); await f.save();
  const search = f.host.querySelector<HTMLInputElement>('input[type="search"]')!;
  const results = () => Array.from(f.host.querySelectorAll<HTMLButtonElement>(".dn-world-notes-list button"))
    .map((button) => button.textContent);
  search.value = "nebelbund"; search.dispatchEvent(new f.window.Event("input"));
  assert.deepEqual(results(), ["Fraktion: Nebelbund", "NPC: Älva"]);
  search.value = "mitglied"; search.dispatchEvent(new f.window.Event("input"));
  assert.deepEqual(results(), ["NPC: Älva"]);
  f.click("NPC: Älva");
  f.input("GM-Notizen", "Nicht gespeichert");
  f.click("Fraktion öffnen");
  assert.equal(f.host.querySelector<HTMLInputElement>("form input")?.value, "Älva");
  assert.equal(f.host.querySelectorAll<HTMLTextAreaElement>("textarea")[1]?.value, "Nicht gespeichert");
  assert.match(f.host.querySelector('[role="alert"]')!.textContent!, /offenen Entwurf/);
  f.input("GM-Notizen", "");
  f.click("Fraktion öffnen");
  assert.equal(f.host.querySelector<HTMLInputElement>("form input")?.value, "Nebelbund");
  assert.match(f.host.querySelector("form")!.textContent!, /Verweise auf diesen Eintrag/);
  assert.match(f.host.querySelector("form")!.textContent!, /Mitglied: NPC Älva/);
  f.input("GM-Notizen", "Ungespeicherter Fraktionsentwurf");
  f.click("NPC öffnen");
  assert.equal(f.host.querySelector<HTMLInputElement>("form input")?.value, "Nebelbund");
  assert.equal(f.host.querySelectorAll<HTMLTextAreaElement>("textarea")[1]?.value,
    "Ungespeicherter Fraktionsentwurf");
  f.input("GM-Notizen", "");
  f.click("NPC öffnen");
  assert.equal(f.host.querySelector<HTMLInputElement>("form input")?.value, "Älva");
  f.panel.destroy();
});

test("failed save retains the draft and never turns a local proposal into confirmed data", async () => {
  const f = fixture(); f.click("Quest anlegen"); f.input("Name", "Geheime Reise");
  f.refuse(true); await f.save();
  assert.equal(f.snapshot().records.length, 0);
  assert.match(f.host.querySelector('[role="alert"]')!.textContent!, /Speicher gesperrt/);
  assert.equal(f.host.querySelector("input")?.value, "");
  assert.equal(f.host.querySelector<HTMLInputElement>("form input")?.value, "Geheime Reise");
  f.refuse(false); await f.save();
  assert.equal(f.snapshot().records[0]?.title, "Geheime Reise");
  f.panel.destroy();
});

test("external revision retains typed text but stale edit and detached controls cannot overwrite", async () => {
  const f = fixture(); f.click("Gerücht anlegen"); f.input("Name", "Alte Spur"); await f.save();
  const oldRow = f.host.querySelector<HTMLButtonElement>("li button")!;
  f.click("Gerücht: Alte Spur"); f.input("GM-Notizen", "Mein Entwurf");
  const external = changeWorldNotes(f.snapshot(), context, context, f.snapshot().revision,
    { kind: "update", id: id(10), expectedRevision: 1, draft: { kind: "rumor", title: "Fremde Spur",
      readAloud: "", gmNotes: "Fremde Änderung", relations: [], creatureId: null } });
  f.setSnapshot(external);
  assert.equal(f.host.querySelectorAll<HTMLTextAreaElement>("textarea")[1]?.value, "Mein Entwurf");
  assert.match(f.host.querySelector('[role="alert"]')!.textContent!, /Bestand geändert/);
  await f.save();
  assert.equal(f.calls.at(-1)?.change.kind, "update");
  const last = f.calls.at(-1)!.change;
  assert.equal(last.kind === "update" ? last.expectedRevision : 0, 1);
  f.panel.update({ ...external, campaignId: campaignId("00000000-0000-4000-8000-000000000099") });
  oldRow.dispatchEvent(new f.window.Event("click", { bubbles: true }));
  assert.equal(f.host.querySelector("form"), null);
  f.panel.destroy();
});

test("switching records or campaigns does not silently discard an authored draft", () => {
  const f = fixture(); f.click("Fraktion anlegen"); f.input("Name", "Nebelbund");
  f.input("GM-Notizen", "Mein geheimer Text");
  f.click("Quest anlegen");
  assert.equal(f.host.querySelector<HTMLInputElement>("form input")?.value, "Nebelbund");
  assert.match(f.host.querySelector('[role="alert"]')!.textContent!, /offenen Entwurf/);
  const other = { ...f.snapshot(), campaignId: campaignId("00000000-0000-4000-8000-000000000099") };
  f.panel.update(other);
  assert.equal(f.host.querySelector("form"), null);
  f.panel.update(f.snapshot());
  assert.equal(f.host.querySelectorAll<HTMLTextAreaElement>("textarea")[1]?.value, "Mein geheimer Text");
  f.click("Entwurf verwerfen");
  assert.equal(f.host.querySelector("form") !== null, true);
  f.click("Verwerfen bestätigen");
  assert.equal(f.host.querySelector("form"), null);
  assert.equal(f.snapshot().records.length, 0);
  f.panel.destroy();
});

test("suspended Campaign mount keeps each draft and rejects detached editor input", () => {
  const f = fixture(); f.click("Fraktion anlegen"); f.input("Name", "Nebelbund");
  f.input("GM-Notizen", "A-Entwurf");
  const staleInput = f.host.querySelectorAll<HTMLTextAreaElement>("textarea")[1]!;
  const a = f.snapshot(), b = { ...a,
    campaignId: campaignId("00000000-0000-4000-8000-000000000099"),
    namespace: campaignNamespace("00000000-0000-4000-8000-000000000098") };
  f.panel.suspend();
  assert.equal(f.host.querySelector<HTMLElement>(".dn-world-notes")?.hidden, true);
  f.panel.update(b);
  assert.equal(f.host.querySelector("form"), null);
  f.click("Quest anlegen"); f.input("Name", "B-Entwurf");
  staleInput.value = "Überschrieben";
  staleInput.dispatchEvent(new f.window.Event("input", { bubbles: true }));
  f.panel.suspend(); f.panel.update(a);
  assert.equal(f.host.querySelector<HTMLInputElement>("form input")?.value, "Nebelbund");
  assert.equal(f.host.querySelectorAll<HTMLTextAreaElement>("textarea")[1]?.value, "A-Entwurf");
  f.panel.suspend(); f.panel.update(b);
  assert.equal(f.host.querySelector<HTMLInputElement>("form input")?.value, "B-Entwurf");
  f.panel.destroy();
});

test("unrelated higher commit revision cannot acknowledge a requested record or erase its draft", async () => {
  const f = fixture(); f.click("Quest anlegen"); f.input("Name", "Requested");
  f.input("GM-Notizen", "Nur mein Entwurf");
  f.substitute((_change, expected) => changeWorldNotes(f.snapshot(), context, context, expected,
    { kind: "create", id: id(99), draft: { kind: "quest", title: "Unrelated",
      readAloud: "", gmNotes: "", relations: [], creatureId: null } }));
  await f.save();
  assert.match(f.host.querySelector('[role="alert"]')!.textContent!, /nicht bestätigt/);
  assert.equal(f.host.querySelector<HTMLInputElement>("form input")?.value, "Requested");
  assert.equal(f.host.querySelectorAll<HTMLTextAreaElement>("textarea")[1]?.value, "Nur mein Entwurf");
  assert.equal(f.snapshot().records[0]?.id, id(99));
  f.panel.destroy();
});

test("older and same-revision divergent host projections cannot roll back visible authority", async () => {
  const f = fixture(); const old = f.snapshot();
  f.click("Quest anlegen"); f.input("Name", "Newest"); await f.save();
  f.click("Quest: Newest"); f.input("GM-Notizen", "Entwurf bleibt");
  assert.match(f.host.querySelector("ul")!.textContent!, /Newest/);
  f.panel.update(old);
  assert.match(f.host.querySelector("ul")!.textContent!, /Newest/);
  assert.equal(f.host.querySelectorAll<HTMLTextAreaElement>("textarea")[1]?.value, "Entwurf bleibt");
  assert.match(f.host.querySelector('[role="alert"]')!.textContent!, /verworfen/);
  f.panel.update({ ...f.snapshot(), records: [{ ...f.snapshot().records[0]!, title: "Divergent" }] });
  assert.match(f.host.querySelector("ul")!.textContent!, /Newest/);
  assert.doesNotMatch(f.host.querySelector("ul")!.textContent!, /Divergent/);
  assert.equal(f.host.querySelectorAll<HTMLTextAreaElement>("textarea")[1]?.value, "Entwurf bleibt");
  f.panel.destroy();
});

test("a mismatched update and an unconfirmed delete retain the editable record", async () => {
  const f = fixture(); f.click("NPC anlegen"); f.input("Name", "Älva"); await f.save();
  f.click("NPC: Älva"); f.input("GM-Notizen", "Neuer Text");
  f.substitute((_change, expected) => changeWorldNotes(f.snapshot(), context, context, expected,
    { kind: "update", id: id(10), expectedRevision: 1, draft: { kind: "npc", title: "Älva",
      readAloud: "", gmNotes: "Anderer Text", relations: [], creatureId: null } }));
  await f.save();
  assert.match(f.host.querySelector('[role="alert"]')!.textContent!, /nicht bestätigt/);
  assert.equal(f.host.querySelectorAll<HTMLTextAreaElement>("textarea")[1]?.value, "Neuer Text");
  f.setSnapshot(f.snapshot());
  f.click("Entwurf verwerfen"); f.click("Verwerfen bestätigen");
  f.click("NPC: Älva"); f.click("Löschen");
  f.substitute((_change, expected) => changeWorldNotes(f.snapshot(), context, context, expected,
    { kind: "update", id: id(10), expectedRevision: 2, draft: { kind: "npc", title: "Älva",
      readAloud: "", gmNotes: "Immer noch da", relations: [], creatureId: null } }));
  f.click("Löschen bestätigen"); await tick();
  assert.match(f.host.querySelector('[role="alert"]')!.textContent!, /nicht bestätigt/);
  assert.equal(f.host.querySelector("form") !== null, true);
  f.panel.destroy();
});

test("a forged NPC tombstone cannot change kind or creature identity and clear the draft", async () => {
  const f = fixture(); f.click("NPC anlegen"); f.input("Name", "Älva");
  f.input("Kreaturreferenz", "srd:wizard"); await f.save();
  f.click("NPC: Älva"); f.click("Löschen");
  f.substitute(() => ({ ...f.snapshot(), revision: f.snapshot().revision + 1,
    records: [{ ...f.snapshot().records[0]!, revision: 2, kind: "quest" as const,
      creatureId: null, relations: [], deleted: true }] }));
  f.click("Löschen bestätigen"); await tick();
  assert.match(f.host.querySelector('[role="alert"]')!.textContent!, /nicht bestätigt/);
  assert.equal(f.host.querySelector("form") !== null, true);
  f.panel.destroy();
});

test("a foreign or causally mismatched receipt cannot clear a saved draft", async () => {
  const f = fixture(); f.click("Quest anlegen"); f.input("Name", "Wichtige Spur");
  f.tamperReceipt((receipt) => ({ ...receipt, changeDigest: digest("anderer Befehl") }));
  await f.save();
  assert.equal(f.snapshot().records[0]?.title, "Wichtige Spur");
  assert.match(f.host.querySelector('[role="alert"]')!.textContent!, /nicht bestätigt/);
  assert.equal(f.host.querySelector<HTMLInputElement>("form input")?.value, "Wichtige Spur");
  f.panel.destroy();
  const foreign = fixture(); foreign.click("Quest anlegen"); foreign.input("Name", "Anderer Entwurf");
  foreign.rejectReceipt(true); await foreign.save();
  assert.match(foreign.host.querySelector('[role="alert"]')!.textContent!, /Fremdes Receipt/);
  assert.equal(foreign.host.querySelector<HTMLInputElement>("form input")?.value, "Anderer Entwurf");
  foreign.panel.destroy();
});
