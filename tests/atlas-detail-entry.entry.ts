import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { AtlasDetailEntry, type AtlasDetailEntryItem } from "../src/ui/atlas-detail-entry";
import type { AtlasNavigationTarget } from "../src/features/atlas/atlas-campaign-navigation";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = (kind: AtlasNavigationTarget["kind"], n: number): AtlasNavigationTarget => ({
  kind, documentId: id(1), recordId: id(n), roomId: kind === "room-section" ? id(5) : null,
});
const item = (label: string, n: number, kind: AtlasNavigationTarget["kind"] = "building"): AtlasDetailEntryItem => ({ label, target: target(kind, n) });
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred() {
  let resolve!: () => void, reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(onNavigate: (target: Readonly<AtlasNavigationTarget>) => void | Promise<void>) {
  const { document, window } = parseHTML("<html><body><aside id='dock'><p id='key'>Offener Key</p></aside></body></html>");
  let focused: HTMLElement | undefined;
  Object.defineProperty(document, "activeElement", { configurable: true, get: () => focused });
  Object.defineProperty(window.HTMLElement.prototype, "focus", { configurable: true, value(this: HTMLElement) { focused = this; } });
  const host = document.querySelector<HTMLElement>("#dock")!;
  const entry = new AtlasDetailEntry(host, { onNavigate });
  const click = (node: HTMLElement) => node.dispatchEvent(new window.Event("click", { bubbles: true }));
  const buttons = () => Array.from(host.querySelectorAll<HTMLButtonElement>("li button"));
  const search = () => host.querySelector<HTMLInputElement>('input[type="search"]')!;
  const status = () => host.querySelector('[role="status"]')!.textContent!;
  return { host, entry, click, buttons, search, status, document, window };
}

test("detail entry forwards complete stable targets with duplicate labels and treats names as text", async () => {
  const calls: Readonly<AtlasNavigationTarget>[] = [];
  const f = fixture((t) => { calls.push(t); });
  const entries = [item("Stadtplan öffnen", 1, "city"), item("Gasthaus", 2), item("Gasthaus", 3), item("<img src=x onerror=alert(1)>", 4, "room-section")];
  f.entry.update({ locationName: "<b>Altstadt</b>", entries });
  assert.equal(f.host.querySelectorAll("img,b").length, 0);
  for (const button of f.buttons()) { f.click(button); await tick(); }
  assert.deepEqual(calls, entries.map((e) => e.target));
  assert.ok(calls.every(Object.isFrozen));
  assert.equal(f.host.querySelector("#key")!.textContent, "Offener Key");
  f.entry.destroy();
});

test("search filters labels/descriptions without replacing focused input, reset restores targets", () => {
  const f = fixture(() => undefined);
  f.entry.update({ locationName: "Altstadt", entries: [item("Haus", 2), { ...item("Raum", 3, "room"), description: "BLAUE Fackel" }] });
  const input = f.search(); input.focus(); input.value = "blaue";
  input.dispatchEvent(new f.window.Event("input", { bubbles: true }));
  assert.equal(f.buttons().length, 1); assert.equal(f.buttons()[0]!.textContent, "Raum");
  assert.equal(f.search(), input); assert.equal(f.document.activeElement, input); assert.equal(input.value, "blaue");
  input.value = "nicht vorhanden"; input.dispatchEvent(new f.window.Event("input"));
  assert.match(f.status(), /Keine passenden Ziele/);
  f.click(f.host.querySelector<HTMLButtonElement>("section > button")!);
  assert.equal(input.value, ""); assert.equal(f.buttons().length, 2); assert.equal(f.document.activeElement, input);
  f.entry.update({ locationName: "Leer", entries: [] }); assert.match(f.status(), /keine Ziele verfügbar/);
  f.entry.destroy();
});

test("unavailable and host-blocked targets explain their reasons without invoking navigation", () => {
  let calls = 0; const f = fixture(() => { calls++; });
  f.entry.update({ locationName: "Ort", entries: [{ ...item("Haus", 2), unavailableReason: "Hauskarte fehlt" }] });
  assert.equal(f.buttons()[0]!.disabled, true); assert.match(f.host.textContent!, /Hauskarte fehlt/);
  f.click(f.buttons()[0]!); assert.equal(calls, 0);
  f.entry.update({ locationName: "Ort", entries: [item("Haus", 2)], blockedReason: "Ortswechsel läuft" });
  f.click(f.buttons()[0]!); assert.equal(calls, 0); assert.equal(f.status(), "Ortswechsel läuft");
  f.entry.destroy();
});

test("pending blocks repeated clicks; rejection preserves UI, explains error and permits explicit retry", async () => {
  let calls = 0; const task = deferred();
  const f = fixture(() => { calls++; return calls === 1 ? task.promise : undefined; });
  f.entry.update({ locationName: "Ort", entries: [item("Haus", 2), item("Raum", 3, "room")] });
  const button = f.buttons()[0]!; f.click(button); f.click(button); f.click(f.buttons()[1]!);
  assert.equal(calls, 1); assert.ok(f.buttons().every((b) => b.disabled));
  assert.equal(f.host.querySelector("section")!.getAttribute("aria-busy"), "true");
  task.reject(new Error("Key zuerst korrigieren")); await tick();
  assert.match(f.status(), /Key zuerst korrigieren/); assert.ok(f.buttons().every((b) => !b.disabled));
  f.click(button); await tick(); assert.equal(calls, 2); assert.doesNotMatch(f.status(), /Key zuerst korrigieren/);
  f.entry.destroy();
});

test("synchronous navigation failure is shown and does not leak a rejected event handler", () => {
  const f = fixture(() => { throw new Error("Ziel nicht mehr vorhanden"); });
  f.entry.update({ locationName: "Ort", entries: [item("Haus", 2)] });
  assert.doesNotThrow(() => f.click(f.buttons()[0]!));
  assert.match(f.status(), /Ziel nicht mehr vorhanden/); assert.equal(f.buttons()[0]!.disabled, false);
  f.entry.destroy();
});

test("old rows and late responses cannot act on a newer location or release its pending action", async () => {
  const old = deferred(), fresh = deferred(); const calls: Readonly<AtlasNavigationTarget>[] = [];
  const f = fixture((t) => { calls.push(t); return calls.length === 1 ? old.promise : fresh.promise; });
  f.entry.update({ locationName: "A", entries: [item("Haus A", 2)] });
  const oldButton = f.buttons()[0]!; f.click(oldButton);
  f.entry.update({ locationName: "B", entries: [item("Haus B", 3)] });
  f.click(oldButton); assert.equal(calls.length, 1); f.click(f.buttons()[0]!);
  const status = f.status(); old.reject(new Error("Alter Fehler")); await tick();
  assert.equal(f.status(), status); assert.equal(f.buttons()[0]!.disabled, true); assert.equal(calls.length, 2);
  fresh.resolve(); await tick(); assert.equal(f.buttons()[0]!.disabled, false); assert.doesNotMatch(f.status(), /Alter Fehler/);
  f.entry.destroy();
});

test("caller mutation and detached filtered rows cannot redirect a bound target", async () => {
  const calls: Readonly<AtlasNavigationTarget>[] = [];
  const f = fixture((t) => { calls.push(t); });
  const bound = target("building", 2); const expected = { ...bound };
  f.entry.update({ locationName: "Ort", entries: [{ label: "Haus", target: bound }, item("Raum", 3)] });
  Object.assign(bound, { recordId: id(999) }); const old = f.buttons()[0]!;
  f.search().value = "Raum"; f.search().dispatchEvent(new f.window.Event("input")); f.click(old);
  assert.equal(calls.length, 0);
  f.search().value = ""; f.search().dispatchEvent(new f.window.Event("input")); f.click(f.buttons()[0]!); await tick();
  assert.deepEqual(calls, [expected]); f.entry.destroy();
});

test("dock pointer/keyboard events stay outside Atlas gestures and destroy revokes outstanding UI work", async () => {
  const task = deferred(); let calls = 0; const f = fixture(() => { calls++; return task.promise; });
  f.entry.update({ locationName: "Ort", entries: [item("Haus", 2)] });
  let routed = 0;
  for (const name of ["keydown", "keyup", "pointerdown", "pointermove", "pointerup", "wheel", "click"])
    f.host.addEventListener(name, () => { routed++; });
  const button = f.buttons()[0]!;
  for (const name of ["keydown", "keyup", "pointerdown", "pointermove", "pointerup", "wheel"])
    f.search().dispatchEvent(new f.window.Event(name, { bubbles: true }));
  f.click(button); assert.equal(routed, 0); assert.equal(calls, 1);
  f.entry.destroy(); f.entry.destroy(); f.click(button); task.reject(new Error("Späte Antwort")); await tick();
  f.entry.update({ locationName: "C", entries: [item("Neu", 4)] });
  assert.equal(calls, 1); assert.equal(f.host.querySelector("section"), null); assert.equal(f.host.querySelector("#key")!.textContent, "Offener Key");
});
