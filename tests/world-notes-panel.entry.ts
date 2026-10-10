import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { campaignContext, campaignContextToken, campaignId, campaignLocalId,
  campaignNamespace, campaignRevision, campaignSnapshot } from "../src/features/campaign/campaign-contracts";
import { changeWorldNotes, emptyWorldNotes, type WorldNoteChange } from "../src/features/world/world-notes";
import { WorldNotesPanel } from "../src/ui/world-notes-panel";

const id = (n: number) => campaignLocalId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
const context = campaignContext(campaignSnapshot({ schemaVersion: 1,
  campaignId: campaignId("00000000-0000-4000-8000-000000000001"),
  namespace: campaignNamespace("00000000-0000-4000-8000-000000000002"),
  revision: campaignRevision(1), name: "Welt", lifecycle: "active" }), campaignContextToken("world:one"));
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function fixture() {
  const { document, window } = parseHTML("<html><body><div id='host'></div></body></html>");
  const host = document.querySelector<HTMLElement>("#host")!;
  let snapshot = emptyWorldNotes(context), nextId = 10;
  const calls: { change: WorldNoteChange; expected: number }[] = [];
  let refuse = false;
  let substitute: ((change: WorldNoteChange, expected: number) => typeof snapshot) | null = null;
  const panel = new WorldNotesPanel(host, {
    newId: () => id(nextId++),
    commit: async (change, expected) => {
      calls.push({ change, expected });
      if (refuse) throw new Error("Speicher gesperrt");
      if (substitute) return snapshot = substitute(change, expected);
      snapshot = changeWorldNotes(snapshot, context, context, expected, change);
      return snapshot;
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
  return { host, panel, click, input, save, calls, snapshot: () => snapshot,
    setSnapshot: (value: typeof snapshot) => { snapshot = value; panel.update(value); },
    substitute: (value: typeof substitute) => { substitute = value; },
    refuse: (value: boolean) => { refuse = value; }, window };
}

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
