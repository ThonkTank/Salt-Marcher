import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { LocationKeyDraft } from "../../src/features/location/location-key-draft";
import { LocationKeyPanel } from "../../src/ui/location-key-panel";
import {
  newLocation,
  checkedLocationDocument,
} from "../../src/features/location/location-schema";
import {
  LocationSource,
  locationDocumentChange,
} from "../../src/features/location/location-source";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";

const markdown = "# Hafen\r\n\r\n**日本語 🐉**  \r\n\t[[Chronik]]\r\n";
const initial = () =>
  checkedLocationDocument({
    ...newLocation("town", "Ödhafen", "city", ["description", "notes"]),
    sections: [
      { id: "description", title: "Beschreibung", markdown },
      { id: "notes", title: "Notizen", markdown: "  Notiz\n" },
    ],
    detailMaps: [{ kind: "dungeon", documentId: "dungeon" }],
    keyLinks: [
      {
        kind: "location",
        atlasId: "world",
        documentId: "town",
        sectionId: "notes",
      },
    ],
  });
function owner() {
  const history = new AtlasHistory(),
    source = new LocationSource("town", history, initial());
  return {
    history,
    source,
    edit: (next: ReturnType<typeof initial>) =>
      history.execute({
        label: "Orts-Key",
        changes: [locationDocumentChange(source.id, source.read(), next)],
      }),
  };
}
test("Location Key edits/reorder form one shared-history command and retain untouched CRLF, IDs and foreign references", () => {
  const { history, source, edit } = owner(),
    draft = new LocationKeyDraft(source.read()!);
  draft.name = "Neuer Hafen";
  draft.section("notes", "markdown", "**Neue Notiz**\n");
  draft.move("notes", -1);
  assert.equal(draft.apply(source.read(), edit), true);
  const next = source.read()!;
  assert.equal(history.undoDepth, 1);
  assert.deepEqual(
    next.sections.map((s) => s.id),
    ["notes", "description"],
  );
  assert.equal(next.sections[1]!.markdown, markdown);
  assert.deepEqual(next.detailMaps, initial().detailMaps);
  assert.deepEqual(next.keyLinks, initial().keyLinks);
  assert.equal(draft.apply(source.read(), edit), false);
  history.undo();
  assert.deepEqual(source.read(), initial());
  history.redo();
  assert.deepEqual(source.read(), next);
});
test("Invalid, missing, stale or rejected owners never erase the local Key draft or mutate history", () => {
  const { history, source, edit } = owner(),
    draft = new LocationKeyDraft(source.read()!);
  draft.name = "";
  draft.section("notes", "markdown", "Meine eingegebenen Zeilen\r\n");
  assert.throws(() => draft.apply(source.read(), edit));
  assert.equal(history.undoDepth, 0);
  assert.equal(draft.dirty, true);
  draft.name = "Korrigiert";
  assert.throws(() => draft.apply(null, edit), /bleibt erhalten/);
  assert.throws(
    () => draft.apply(source.read(), () => false),
    /bleibt erhalten/,
  );
  edit({ ...source.read()!, name: "Andere Änderung" });
  assert.throws(() => draft.apply(source.read(), edit), /inzwischen geändert/);
  assert.equal(draft.name, "Korrigiert");
  assert.equal(draft.sections[1]!.markdown, "Meine eingegebenen Zeilen\r\n");
  assert.equal(history.undoDepth, 1);
  assert.equal(source.read()!.name, "Andere Änderung");
});
test("Key panel reads only changed fields, preserves normalized untouched text, and protects text shortcuts from map handlers", () => {
  const { document, window } = parseHTML(
      "<html><body><aside></aside></body></html>",
    ),
    host = document.querySelector("aside")! as unknown as HTMLElement,
    { history, source, edit } = owner();
  let saves = 0,
    mapKeys = 0;
  const panel = new LocationKeyPanel(host, {
    read: () => source.read(),
    edit,
    changed: () => {},
    save: () => {
      saves++;
    },
  });
  document.addEventListener("keydown", () => {
    mapKeys++;
  });
  panel.show(source.read()!);
  const text = host.querySelector<HTMLTextAreaElement>("textarea")!;
  text.value = markdown.replace(/\r\n/g, "\n"); // Browser normalization without user input.
  const name = host.querySelector<HTMLInputElement>('[aria-label="Ortsname"]')!;
  name.value = "UI Hafen";
  name.dispatchEvent(new window.Event("input", { bubbles: true }));
  const reorder = host.querySelectorAll<HTMLButtonElement>(
    '[aria-label="Abschnitt nach oben"]',
  )[1]!;
  reorder.click();
  panel.apply();
  assert.equal(source.read()!.sections[1]!.markdown, markdown);
  assert.equal(history.undoDepth, 1);
  const key = new window.Event("keydown", { bubbles: true, cancelable: true });
  Object.assign(key, { key: "s", ctrlKey: true });
  host.querySelector("textarea")!.dispatchEvent(key);
  assert.equal(saves, 1);
  assert.equal(mapKeys, 0);
  assert.equal(key.defaultPrevented, true);
  const undo = new window.Event("keydown", { bubbles: true, cancelable: true });
  Object.assign(undo, { key: "z", ctrlKey: true });
  host.querySelector("textarea")!.dispatchEvent(undo);
  assert.equal(mapKeys, 0);
  assert.equal(undo.defaultPrevented, false);
  panel.destroy();
});
