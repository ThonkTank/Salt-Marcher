import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
import { addFloor, createRoom } from "../src/commands";
import {
  activateRoomKeySearchNavigation,
  DungeonEditor,
} from "../src/editor";
import { StructuredKeyPanel } from "../src/key-panel";
import { editMarkdownSection, structuredRoom } from "../src/room-key";
import { RoomKeySearchPanel } from "../src/room-key-search-panel";
import { Session } from "../src/session";
import { newDocument } from "./core/fixtures";

interface DomWindow {
  readonly Event: typeof Event;
  readonly HTMLElement: { readonly prototype: HTMLElement };
}

function dom(): { root: HTMLElement; window: DomWindow } {
  const { document, window } = parseHTML("<html><body><main id='root'></main></body></html>");
  let focused: HTMLElement | undefined;
  Object.defineProperty(document, "activeElement", { configurable: true, get: () => focused });
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true,
    value(this: HTMLElement) { focused = this; },
  });
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value() {},
  });
  Object.defineProperty(window.HTMLElement.prototype, "createDiv", {
    configurable: true,
    value(this: HTMLElement, options?: { cls?: string }) {
      const child = document.createElement("div");
      if (options?.cls) child.className = options.cls;
      this.append(child);
      return child;
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "createEl", {
    configurable: true,
    value(this: HTMLElement, name: string, options?: { cls?: string; text?: string }) {
      const child = document.createElement(name);
      if (options?.cls) child.className = options.cls;
      if (options?.text) child.textContent = options.text;
      this.append(child);
      return child;
    },
  });
  return {
    root: document.querySelector<HTMLElement>("#root")!,
    window: window as unknown as DomWindow,
  };
}

function event(window: DomWindow, type: string): Event {
  return new window.Event(type, { bubbles: true });
}

function outline(left: number) {
  return [
    { x: left, y: 1 }, { x: left + 5, y: 1 },
    { x: left + 5, y: 6 }, { x: left, y: 6 },
  ];
}

test("room key search panel filters immediately, clears to overview and unsubscribes", async () => {
  const { root, window } = dom(),
    session = new Session(newDocument("Suche", 30, 20, undefined, undefined, 4)),
    floor = session.floors.values().next().value!,
    upper = addFloor(session),
    first = createRoom(session, floor.id, outline(1), "QA/Räume"),
    second = createRoom(session, upper.id, outline(10), "QA/Räume"),
    section = structuredRoom(session, second.id).key.sections[0]!;
  assert.equal(section.kind, "markdown");
  editMarkdownSection(session, second.id, section.id, "", "Die blaue Fackel öffnet den Gang.");
  const before = session.document(), dirty = session.dirty,
    historySize = session.historySize, revision = session.revision;
  const activated: { roomId: string; floorId: string; sectionId?: string }[] = [];
  const panel = new RoomKeySearchPanel(root, session, {
    activate: (target) => { activated.push(target); return "activated"; },
  });
  assert.equal(root.querySelectorAll(".dn-room-key-search-result").length, 2);
  assert.match(root.querySelector('[role="status"]')?.textContent ?? "", /2 Räume/);
  const input = root.querySelector<HTMLInputElement>('input[type="search"]')!;
  input.focus();
  input.value = "blaue fackel";
  input.dispatchEvent(event(window, "input"));
  assert.equal(root.ownerDocument.activeElement, input);
  assert.equal(root.querySelectorAll(".dn-room-key-search-result").length, 1);
  assert.match(root.querySelector(".dn-room-key-search-result")?.textContent ?? "",
    new RegExp(`Raum ${structuredRoom(session, second.id).number}.*Geschoss 1.*blaue Fackel`, "s"));
  root.querySelector<HTMLButtonElement>(".dn-room-key-search-result")!.click();
  await Promise.resolve();
  assert.equal(activated.length, 1);
  assert.deepEqual({ roomId: activated[0]!.roomId, floorId: activated[0]!.floorId,
    sectionId: activated[0]!.sectionId },
  { roomId: second.id, floorId: upper.id, sectionId: section.id });
  assert.deepEqual(session.document(), before);
  assert.equal(session.dirty, dirty);
  assert.equal(session.historySize, historySize);
  assert.equal(session.revision, revision);
  const third = createRoom(session, floor.id, outline(18), "QA/Räume"),
    thirdSection = structuredRoom(session, third.id).key.sections[0]!;
  assert.equal(thirdSection.kind, "markdown");
  editMarkdownSection(session, third.id, thirdSection.id, "", "Noch eine blaue Fackel.");
  assert.equal(input.value, "blaue fackel");
  assert.equal(root.ownerDocument.activeElement, input);
  assert.equal(root.querySelectorAll(".dn-room-key-search-result").length, 2);
  root.querySelector<HTMLButtonElement>('[aria-label="Raum-Key-Suche leeren"]')!.click();
  assert.equal(input.value, "");
  assert.equal(root.ownerDocument.activeElement, input);
  assert.equal(root.querySelectorAll(".dn-room-key-search-result").length, 3);
  panel.destroy();
  createRoom(session, floor.id, outline(24), "QA/Räume");
  assert.equal(root.childElementCount, 0);
  assert.ok(first);
});

test("room key search panel rejects a stale rendered target without activation", async () => {
  const { root } = dom(),
    session = new Session(newDocument("Stale", 20, 20, undefined, undefined, 4)),
    floor = session.floors.values().next().value!,
    room = createRoom(session, floor.id, outline(1), "QA/Räume");
  let activations = 0;
  const panel = new RoomKeySearchPanel(root, session, {
    activate: () => { activations++; return "activated"; },
  });
  const stale = root.querySelector<HTMLButtonElement>(".dn-room-key-search-result")!;
  const current = structuredRoom(session, room.id);
  session.execute({ label: "Raum entfernen", entities: [{ id: room.id, before: current, after: null }] });
  stale.click();
  await Promise.resolve();
  assert.equal(activations, 0);
  assert.match(root.querySelector('[role="status"]')?.textContent ?? "", /nicht mehr verfügbar/);
  panel.destroy();
});

test("structured key navigation blocks a dirty draft until explicit apply or discard", () => {
  const { root } = dom(),
    session = new Session(newDocument("Guard", 20, 20, undefined, undefined, 4)),
    floor = session.floors.values().next().value!,
    room = createRoom(session, floor.id, outline(1), "QA/Räume"),
    section = structuredRoom(session, room.id).key.sections[0]!;
  assert.equal(section.kind, "markdown");
  const notices: string[] = [], before = session.document();
  const panel = new StructuredKeyPanel(
    { vault: { getName: () => "Test" } } as never,
    root, session, "Guard.dungeon", room.id, section.id,
    (message) => notices.push(message), () => false,
  );
  const editor = root.querySelector<HTMLTextAreaElement>(".dn-key-markdown")!;
  editor.value = "Ungespeicherter Entwurf";
  assert.equal(panel.allowNavigation(), false);
  assert.equal(root.ownerDocument.activeElement, editor);
  assert.deepEqual(session.document(), before);
  assert.match(notices.at(-1) ?? "", /Übernehmen oder Verwerfen/);
  const navigation = root.querySelectorAll<HTMLButtonElement>(".dn-key-navigation button");
  navigation[0]!.click();
  assert.deepEqual(session.document(), before);
  navigation[navigation.length - 1]!.click();
  assert.deepEqual(session.document(), before);
  const controls = [...root.querySelectorAll<HTMLButtonElement>(".dn-key-controls button")];
  controls.find((button) => button.textContent === "↑")!.click();
  controls.find((button) => button.textContent === "↓")!.click();
  controls.find((button) => button.textContent === "Entfernen")!.click();
  assert.deepEqual(session.document(), before);
  controls
    .find((button) => button.textContent === "Verwerfen")!.click();
  assert.equal(panel.allowNavigation(), true);
  editor.value = "Ausdrücklich übernommen";
  [...root.querySelectorAll<HTMLButtonElement>(".dn-key-controls button")]
    .find((button) => button.textContent === "Übernehmen")!.click();
  assert.equal(structuredRoom(session, room.id).key.sections[0]!.kind, "markdown");
  assert.equal((structuredRoom(session, room.id).key.sections[0] as { markdown: string }).markdown,
    "Ausdrücklich übernommen");
  panel.destroy();
});

test("search activation uses the editor navigation contract without document mutation", async () => {
  const prepared = new Session(newDocument("Aktivierung", 30, 20, undefined, undefined, 4)),
    ground = prepared.floors.values().next().value!, upper = addFloor(prepared),
    room = createRoom(prepared, upper.id, outline(10), "QA/Räume"),
    section = structuredRoom(prepared, room.id).key.sections[0]!;
  assert.equal(section.kind, "markdown");
  editMarkdownSection(prepared, room.id, section.id, "", "Die blaue Fackel wartet.");
  const session = new Session(prepared.document());
  const before = session.document(), dirty = session.dirty,
    historySize = session.historySize, revision = session.revision;
  let floorId = ground.id, selected: string[] = [], shown = false, keyOpen = false,
    focusedSection: string | undefined, focusedRoom: string | undefined;
  const result = await activateRoomKeySearchNavigation(session, {
    roomId: room.id, floorId: upper.id, sectionId: section.id,
  }, {
    allow: () => true,
    setFloor: (id) => { floorId = id; },
    selectRoom: async (id) => { selected = [id]; },
    showSearch: () => { shown = true; },
    openKey: () => { keyOpen = true; },
    focusSection: (id) => { focusedSection = id; return true; },
    focusRoom: (id) => { focusedRoom = id; },
  });
  assert.equal(result, "activated");
  assert.equal(floorId, upper.id);
  assert.deepEqual(selected, [room.id]);
  assert.equal(shown, true);
  assert.equal(keyOpen, true);
  assert.equal(focusedSection, section.id);
  assert.equal(focusedRoom, room.id);
  assert.deepEqual(session.document(), before);
  assert.equal(session.dirty, dirty);
  assert.equal(session.historySize, historySize);
  assert.equal(session.revision, revision);
});

test("dirty editor guard stops search, floor, selection and canvas before view mutation", async () => {
  const session = new Session(newDocument("Blockiert", 30, 20, undefined, undefined, 4)),
    floor = session.floors.values().next().value!, room = createRoom(session, floor.id,
      outline(1), "QA/Räume"), section = structuredRoom(session, room.id).key.sections[0]!;
  assert.equal(section.kind, "markdown");
  const view = { floorId: "vorher", selected: ["vorher"], camera: { x: 4, y: 5, scale: 2 } };
  const beforeView = structuredClone(view), before = session.document(),
    dirty = session.dirty, historySize = session.historySize, revision = session.revision;
  let calls = 0, allowed = false;
  const navigation = {
    allow: () => allowed,
    setFloor: (id: string) => { calls++; view.floorId = id; },
    selectRoom: async (id: string) => { calls++; view.selected = [id]; },
    showSearch: () => { calls++; }, openKey: () => { calls++; },
    focusSection: () => { calls++; return true; },
    focusRoom: () => { calls++; view.camera = { x: 9, y: 9, scale: 3 }; },
  };
  const result = await activateRoomKeySearchNavigation(session, {
    roomId: room.id, floorId: floor.id, sectionId: section.id,
  }, navigation);
  assert.equal(result, "blocked");
  assert.equal(calls, 0);

  const methods = DungeonEditor.prototype as unknown as Record<string, Function>;
  const fake = {
    allowKeyNavigation: () => false,
    floor: { value: "angefordert" }, renderer: { floorId: "vorher" },
    applyFloor: () => { calls++; }, applySelection: () => { calls++; },
    gesture: undefined, tool: "select", commitNote: () => { calls++; },
    clipboard: { entities: [{ id: "clip" }] },
    host: { notice: () => { calls++; } },
  };
  methods.switchFloor!.call(fake, floor.id);
  await methods.selectMany!.call(fake, [room.id], false, room.id);
  methods.begin!.call(fake, { button: 0 });
  await methods.copyCurrentFloor!.call(fake);
  methods.archiveCurrentFloor!.call(fake);
  methods.setTool!.call(fake, "room");
  methods.pasteSelection!.call(fake);
  methods.archiveSelection!.call(fake);
  assert.equal(fake.floor.value, "vorher");
  assert.equal(calls, 0);
  assert.deepEqual(view, beforeView);
  assert.deepEqual(session.document(), before);
  assert.equal(session.dirty, dirty);
  assert.equal(session.historySize, historySize);
  assert.equal(session.revision, revision);

  allowed = true;
  const retry = await activateRoomKeySearchNavigation(session, {
    roomId: room.id, floorId: floor.id, sectionId: section.id,
  }, navigation);
  assert.equal(retry, "activated");
  assert.equal(view.floorId, floor.id);
  assert.deepEqual(view.selected, [room.id]);
  assert.deepEqual(view.camera, { x: 9, y: 9, scale: 3 });
  assert.deepEqual(session.document(), before);
  assert.equal(session.dirty, dirty);
  assert.equal(session.historySize, historySize);
});

test("room key search panel reports non-V4 sessions honestly", () => {
  const { root } = dom(), session = new Session(newDocument("Alt", 12, 12, undefined, undefined, 3));
  const panel = new RoomKeySearchPanel(root, session, { activate: () => "activated" });
  assert.equal(root.querySelectorAll(".dn-room-key-search-result").length, 0);
  assert.match(root.querySelector('[role="status"]')?.textContent ?? "", /nur für strukturierte V4/);
  panel.destroy();
});
