import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { campaignLocalId } from "../src/features/campaign/campaign-contracts";
import { ManualPlanner } from "../src/features/planner/manual-planner";
import { ManualPlannerPanel } from "../src/ui/manual-planner-panel";
function fixture() {
  const { document } = parseHTML(
    '<html><body><div id="host"></div></body></html>',
  );
  const host = document.querySelector("#host") as HTMLElement;
  let n = 0;
  const p = new ManualPlanner(
    () =>
      campaignLocalId(
        `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
      ),
    () => {},
  );
  const ui = new ManualPlannerPanel(host, p);
  return { document, host, p, ui };
}
function button(host: HTMLElement, name: string) {
  return [...host.querySelectorAll("button")].find(
    (b) => b.textContent === name,
  )!;
}
function editDisplayed(f: ReturnType<typeof fixture>, fields: {title: string; notes: string; locationId: null}) {
  f.host.querySelector<HTMLInputElement>('[aria-label="Szenentitel"]')!.value = fields.title;
  const notes = f.host.querySelector<HTMLTextAreaElement>('[aria-label="Notizen"]')!;
  notes.value = fields.notes;
  notes.dispatchEvent(new f.document.defaultView!.Event("input"));
}
function focusProbe(document: Document) {
  const prototype = document.defaultView!.HTMLElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "focus");
  const calls: HTMLElement[] = [];
  Object.defineProperty(prototype, "focus", {
    configurable: true,
    value: function (this: HTMLElement) {
      calls.push(this);
    },
  });
  return {
    calls,
    restore() {
      if (descriptor) Object.defineProperty(prototype, "focus", descriptor);
      else delete (prototype as { focus?: unknown }).focus;
    },
  };
}
test("manual planner UI: successful scene selection focuses the newly rendered title without payload changes", () => {
  const f = fixture();
  button(f.host, "Neuer Plan").click();
  button(f.host, "Szene hinzufügen").click();
  editDisplayed(f, {
    title: "Hafen",
    notes: "  日本語\n\tOriginal\n",
    locationId: null,
  });
  button(f.host, "Entwurf übernehmen").click();
  const firstId = f.p.selectedSceneId;
  button(f.host, "Szene hinzufügen").click();
  const before = f.p.active;
  const probe = focusProbe(f.document);
  try {
    button(f.host, "Hafen").click();
    const title = f.host.querySelector('[aria-label="Szenentitel"]');
    assert.equal(probe.calls.length, 1);
    assert.equal(probe.calls[0], title);
    assert.equal(f.p.selectedSceneId, firstId);
    assert.equal(f.p.active, before);
    assert.equal(f.p.draft, null);
    assert.equal(
      (f.host.querySelector('[aria-label="Notizen"]') as HTMLTextAreaElement)
        .value,
      "  日本語\n\tOriginal\n",
    );
  } finally {
    probe.restore();
    f.ui.destroy();
  }
});
test("manual planner UI: stale scene selection cannot redirect focus or discard authored text", () => {
  const f = fixture();
  button(f.host, "Neuer Plan").click();
  button(f.host, "Szene hinzufügen").click();
  const old = button(f.host, "Unbenannte Szene");
  f.p.editDraft({ title: "Draft", notes: "keep exact", locationId: null });
  f.p.act(f.p.binding(), { kind: "rename", name: "external revision" });
  const draft = f.p.draft;
  const before = f.p.active;
  const title = f.host.querySelector('[aria-label="Szenentitel"]');
  const probe = focusProbe(f.document);
  try {
    old.click();
    assert.equal(probe.calls.length, 0);
    assert.equal(f.p.active, before);
    assert.equal(f.p.draft, draft);
    assert.equal(f.host.querySelector('[aria-label="Szenentitel"]'), title);
    assert.match(f.host.textContent!, /Ansicht geändert/);
  } finally {
    probe.restore();
    f.ui.destroy();
  }
});
test("manual planner UI: no Party/Generator; input focus node retained; old button cannot add into new plan", () => {
  const f = fixture();
  button(f.host, "Neuer Plan").click();
  button(f.host, "Szene hinzufügen").click();
  const old = button(f.host, "Szene hinzufügen");
  const notes = f.host.querySelector(
    '[aria-label="Notizen"]',
  ) as HTMLTextAreaElement;
  notes.value = "  日本語\n\tend\n";
  notes.dispatchEvent(new f.document.defaultView!.Event("input"));
  assert.equal(f.host.querySelector('[aria-label="Notizen"]'), notes);
  assert.equal(f.p.draft!.fields.notes, notes.value);
  const a = f.p.active!.id;
  button(f.host, "Neuer Plan").click();
  const b = f.p.active!;
  old.click();
  assert.equal(f.p.active, b);
  assert.equal(b.scenes.length, 0);
  assert.equal(
    f.p.catalog.find((p) => p.id === a)!.scenes[0]!.notes,
    notes.value,
  );
  assert.match(f.host.textContent!, /Ansicht geändert/);
  assert.match(f.host.textContent!, /noch nicht dauerhaft gespeichert/);
  f.ui.destroy();
  assert.equal(f.host.children.length, 0);
});
test("manual planner UI: stale switch keeps inspector and exact draft visible with actionable error", () => {
  const f = fixture();
  button(f.host, "Neuer Plan").click();
  button(f.host, "Szene hinzufügen").click();
  const a = f.p.active!.id;
  button(f.host, "Neuer Plan").click();
  const b = f.p.active!.id;
  const select = f.host.querySelector(
    '[aria-label="Plan"]',
  ) as HTMLSelectElement;
  [...select.options].find((o) => o.value === a)!.selected = true;
  select.dispatchEvent(new f.document.defaultView!.Event("change"));
  button(f.host, "Unbenannte Szene").click();
  const notes = f.host.querySelector(
    '[aria-label="Notizen"]',
  ) as HTMLTextAreaElement;
  notes.value = "do not lose";
  notes.dispatchEvent(new f.document.defaultView!.Event("input"));
  f.p.act(f.p.binding(), { kind: "rename", name: "concurrent" });
  const picker = f.host.querySelector(
    '[aria-label="Plan"]',
  ) as HTMLSelectElement;
  [...picker.options].find((o) => o.value === b)!.selected = true;
  picker.dispatchEvent(new f.document.defaultView!.Event("change"));
  assert.equal(f.p.active!.id, a);
  assert.equal(f.host.querySelector('[aria-label="Notizen"]'), notes);
  assert.equal(f.p.draft!.fields.notes, "do not lose");
  assert.match(f.host.textContent!, /Entwurf behalten/);
});

for (const action of [
  "Szene löschen",
  "Entwurf verwerfen",
  "Entwurf übernehmen",
  "input",
]) {
  test(`manual planner UI: external plan switch rejects retained ${action} without losing target draft`, () => {
    const f = fixture();
    button(f.host, "Neuer Plan").click();
    button(f.host, "Szene hinzufügen").click();
    const old =
      action === "input"
        ? (f.host.querySelector(
            '[aria-label="Notizen"]',
          ) as HTMLTextAreaElement)
        : button(f.host, action);
    f.p.create();
    f.p.addScene(f.p.binding());
    f.p.editDraft({ title: "B", notes: "must survive", locationId: null });
    const before = f.p.catalog;
    const draft = f.p.draft;
    if (action === "input") {
      (old as HTMLTextAreaElement).value = "old A text";
      old.dispatchEvent(new f.document.defaultView!.Event("input"));
    } else (old as HTMLButtonElement).click();
    assert.deepEqual(f.p.catalog, before);
    assert.equal(f.p.draft, draft);
    assert.match(f.host.textContent!, /Ansicht geändert/);
    f.ui.destroy();
  });
}

test("manual planner UI: retained scene action rejects external selection change within same revision", () => {
  const f = fixture();
  button(f.host, "Neuer Plan").click();
  button(f.host, "Szene hinzufügen").click();
  button(f.host, "Szene hinzufügen").click();
  const old = button(f.host, "Szene löschen");
  f.p.selectScene(f.p.active!.scenes[0]!.id);
  f.p.editDraft({
    title: "first",
    notes: "keep selected scene",
    locationId: null,
  });
  const before = f.p.catalog;
  const draft = f.p.draft;
  old.click();
  assert.deepEqual(f.p.catalog, before);
  assert.equal(f.p.draft, draft);
  assert.match(f.host.textContent!, /Ansicht geändert/);
  f.ui.destroy();
});

test("manual planner UI: refresh after external switch preserves target draft and restores editing", () => {
  const f = fixture();
  button(f.host, "Neuer Plan").click();
  button(f.host, "Szene hinzufügen").click();
  const oldDelete = button(f.host, "Szene löschen");
  f.p.create();
  f.p.addScene(f.p.binding());
  f.p.editDraft({ title: "B", notes: "keep B", locationId: null });
  const before = f.p.catalog;
  const draft = f.p.draft;
  button(f.host, "Ansicht aktualisieren").click();
  assert.deepEqual(f.p.catalog, before);
  assert.equal(f.p.draft, draft);
  const notes = f.host.querySelector(
    '[aria-label="Notizen"]',
  ) as HTMLTextAreaElement;
  assert.equal(notes.value, "keep B");
  oldDelete.click();
  assert.equal(f.p.draft, draft);
  notes.value = "B continued";
  notes.dispatchEvent(new f.document.defaultView!.Event("input"));
  button(f.host, "Entwurf übernehmen").click();
  assert.equal(f.p.active!.scenes[0]!.notes, "B continued");
  f.ui.destroy();
});
test("manual planner UI: refresh retains stale draft until explicit discard", () => {
  const f = fixture();
  button(f.host, "Neuer Plan").click();
  button(f.host, "Szene hinzufügen").click();
  f.p.editDraft({
    title: "draft",
    notes: "preserve exact text",
    locationId: null,
  });
  f.p.act(f.p.binding(), { kind: "rename", name: "external" });
  const before = f.p.catalog;
  const draft = f.p.draft;
  button(f.host, "Ansicht aktualisieren").click();
  assert.deepEqual(f.p.catalog, before);
  assert.equal(f.p.draft, draft);
  button(f.host, "Entwurf übernehmen").click();
  assert.equal(f.p.draft, draft);
  button(f.host, "Entwurf verwerfen").click();
  assert.equal(f.p.draft, null);
  assert.deepEqual(f.p.catalog, before);
  f.ui.destroy();
});

for (const action of ["Umbenennen", "Szene nach oben"] as const) {
  test(`manual planner UI: compound ${action} revision failure retains confirmed payload and exact dirty draft`, () => {
    const { document } = parseHTML(
      '<html><body><div id="host"></div></body></html>',
    );
    const host = document.querySelector("#host") as HTMLElement;
    const id = (n: number) =>
      campaignLocalId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
    const p = new ManualPlanner(
      () => id(9),
      () => {},
      [
        {
          version: 1,
          id: id(1),
          revision: Number.MAX_SAFE_INTEGER - 1,
          name: "old",
          scenes: [
            { id: id(2), title: "first", notes: "", locationId: null },
            {
              id: id(3),
              title: "second",
              notes: "confirmed",
              locationId: null,
            },
          ],
        },
      ],
    );
    p.selectScene(id(3));
    p.editDraft({
      title: "edited",
      notes: "  exact\n日本語\t",
      locationId: null,
    });
    const ui = new ManualPlannerPanel(host, p);
    (host.querySelector('[aria-label="Planname"]') as HTMLInputElement).value =
      "new";
    const before = p.active;
    const draft = p.draft;
    const selection = p.selectedSceneId;
    button(host, action).click();
    assert.equal(p.active, before);
    assert.equal(p.draft, draft);
    assert.equal(p.selectedSceneId, selection);
    assert.match(host.textContent!, /Ungültige Planrevision/);
    ui.destroy();
  });
}

test('manual planner UI: view-only refresh preserves the unsubmitted plan name without publishing it', () => {
  const f = fixture();
  try {
    button(f.host, 'Neuer Plan').click();
    button(f.host, 'Szene hinzufügen').click();
    const name = f.host.querySelector<HTMLInputElement>('[aria-label="Planname"]')!;
    name.value = '  Hafen 日本語\t';
    const before = f.p.active, selection = f.p.selectedSceneId;
    button(f.host, 'Ansicht aktualisieren').click();
    assert.equal(f.host.querySelector<HTMLInputElement>('[aria-label="Planname"]')!.value, name.value);
    assert.equal(f.p.active, before);
    assert.equal(f.p.selectedSceneId, selection);
    button(f.host, 'Umbenennen').click();
    assert.equal(f.p.active!.name, name.value);
  } finally { f.ui.destroy(); }
});

test('manual planner UI: refresh never carries the displayed name into an externally selected other plan', () => {
  const f = fixture();
  try {
    button(f.host, 'Neuer Plan').click();
    const old = f.p.active!;
    f.host.querySelector<HTMLInputElement>('[aria-label="Planname"]')!.value = 'Pending A';
    const other = f.p.create();
    button(f.host, 'Ansicht aktualisieren').click();
    assert.equal(f.p.active, other);
    assert.equal(f.host.querySelector<HTMLInputElement>('[aria-label="Planname"]')!.value, other.name);
    assert.equal(f.p.catalog.find(p => p.id === old.id), old);
  } finally { f.ui.destroy(); }
});

test('manual planner UI: refresh cannot rebase a typed name onto an external revision of the same plan', () => {
  const f = fixture();
  try {
    button(f.host, 'Neuer Plan').click();
    f.host.querySelector<HTMLInputElement>('[aria-label="Planname"]')!.value = 'Pending old revision';
    f.p.act(f.p.binding(), { kind: 'rename', name: 'External confirmed name' });
    const confirmed = f.p.active;
    button(f.host, 'Ansicht aktualisieren').click();
    assert.equal(f.p.active, confirmed);
    assert.equal(f.host.querySelector<HTMLInputElement>('[aria-label="Planname"]')!.value, confirmed!.name);
  } finally { f.ui.destroy(); }
});

for (const action of ['Szene hinzufügen', 'Entwurf übernehmen', 'Entwurf verwerfen', 'Szene nach oben', 'Unbenannte Szene']) {
  test(`manual planner UI: ${action} retains a typed plan name without renaming the plan`, () => {
    const f = fixture();
    try {
      button(f.host, 'Neuer Plan').click();
      button(f.host, 'Szene hinzufügen').click();
      const first = f.p.selectedSceneId;
      button(f.host, 'Szene hinzufügen').click();
      const field = f.host.querySelector<HTMLInputElement>('[aria-label="Planname"]')!;
      field.value = '  Hafen 日本語\t';
      const planId = f.p.active!.id;
      editDisplayed(f, {title: 'Edited', notes: '  Exact\n\ttext', locationId: null});
      button(f.host, action).click();
      assert.equal(f.p.active!.id, planId);
      assert.equal(f.p.active!.name, '', 'scene action must not silently rename');
      assert.equal(f.host.querySelector<HTMLInputElement>('[aria-label="Planname"]')!.value, field.value);
      if (action === 'Unbenannte Szene') assert.equal(f.p.selectedSceneId, first);
      button(f.host, 'Umbenennen').click();
      assert.equal(f.p.active!.name, field.value, 'explicit rename remains available');
    } finally { f.ui.destroy(); }
  });
}

test('manual planner UI: typed plan name never leaks into a newly created plan', () => {
  const f = fixture();
  try {
    button(f.host, 'Neuer Plan').click();
    const original = f.p.active!;
    f.host.querySelector<HTMLInputElement>('[aria-label="Planname"]')!.value = 'Pending old plan';
    button(f.host, 'Neuer Plan').click();
    assert.notEqual(f.p.active!.id, original.id);
    assert.equal(f.host.querySelector<HTMLInputElement>('[aria-label="Planname"]')!.value, '');
    assert.equal(f.p.catalog.find(p => p.id === original.id), original);
  } finally { f.ui.destroy(); }
});

for (const action of ["Entwurf übernehmen", "Entwurf verwerfen", "Szene nach oben"]) {
  test(`manual planner UI: focused ${action} continues on a connected enabled control after render`, () => {
    const f = fixture();
    button(f.host, "Neuer Plan").click();
    for (let i = 0; i < 3; i++) button(f.host, "Szene hinzufügen").click();
    editDisplayed(f, { title: "Edited", notes: "  exact\n日本語", locationId: null });
    const old = button(f.host, action);
    Object.defineProperty(f.document, "activeElement", { configurable: true, value: old });
    const probe = focusProbe(f.document);
    try {
      old.click();
      const next = button(f.host, action);
      assert.notEqual(next, old);
      assert.equal(next.isConnected, true);
      assert.equal(next.disabled, false);
      assert.equal(probe.calls.length, 1);
      assert.ok(probe.calls[0] === next);
      assert.equal(f.p.active!.scenes.length, 3);
    } finally { probe.restore(); f.ui.destroy(); }
  });
}
test("manual planner UI: moving to the first position focuses title when the move button becomes disabled", () => {
  const f = fixture();
  button(f.host, "Neuer Plan").click();
  button(f.host, "Szene hinzufügen").click();
  button(f.host, "Szene hinzufügen").click();
  const sceneId = f.p.selectedSceneId;
  const old = button(f.host, "Szene nach oben");
  Object.defineProperty(f.document, "activeElement", { configurable: true, value: old });
  const probe = focusProbe(f.document);
  try {
    old.click();
    assert.equal(button(f.host, "Szene nach oben").disabled, true);
    assert.equal(probe.calls.length, 1);
    assert.ok(probe.calls[0] === f.host.querySelector('[aria-label="Szenentitel"]'));
    assert.equal(f.p.selectedSceneId, sceneId);
    assert.equal(f.p.active!.scenes[0]!.id, sceneId);
  } finally { probe.restore(); f.ui.destroy(); }
});
test("manual planner UI: failed focused commit preserves the original focus node and authored draft", () => {
  const f = fixture();
  button(f.host, "Neuer Plan").click();
  button(f.host, "Szene hinzufügen").click();
  const old = button(f.host, "Entwurf übernehmen");
  Object.defineProperty(f.document, "activeElement", { configurable: true, value: old });
  f.p.editDraft({ title: "Exact", notes: "Keep", locationId: null });
  f.p.act(f.p.binding(), { kind: "rename", name: "external" });
  const before = f.p.active, draft = f.p.draft;
  const probe = focusProbe(f.document);
  try {
    old.click();
    assert.deepEqual(probe.calls, []);
    assert.equal(old.isConnected, true);
    assert.equal(f.p.active, before);
    assert.equal(f.p.draft, draft);
  } finally { probe.restore(); f.ui.destroy(); }
});

test("manual planner UI: a scene title matching an action cannot capture restored action focus", () => {
  const f = fixture();
  button(f.host, "Neuer Plan").click();
  button(f.host, "Szene hinzufügen").click();
  editDisplayed(f, { title: "Entwurf übernehmen", notes: "Exact", locationId: null });
  button(f.host, "Entwurf übernehmen").click();
  const old = [...f.host.querySelectorAll("button")].find(b =>
    b.textContent === "Entwurf übernehmen" && !b.closest("li"))!;
  Object.defineProperty(f.document, "activeElement", { configurable: true, value: old });
  const probe = focusProbe(f.document);
  try {
    old.click();
    const next = [...f.host.querySelectorAll("button")].find(b =>
      b.textContent === "Entwurf übernehmen" && !b.closest("li"))!;
    assert.equal(probe.calls.length, 1);
    assert.ok(probe.calls[0] === next);
    assert.equal(f.p.active!.scenes[0]!.title, "Entwurf übernehmen");
  } finally { probe.restore(); f.ui.destroy(); }
});

for (const action of ["input", "Entwurf übernehmen", "Entwurf verwerfen"]) {
  test(`manual planner UI: external replacement draft rejects old ${action} in the same plan and scene`, () => {
    const f = fixture();
    button(f.host, "Neuer Plan").click();
    button(f.host, "Szene hinzufügen").click();
    const notes = f.host.querySelector<HTMLTextAreaElement>('[aria-label="Notizen"]')!;
    notes.value = "local original";
    notes.dispatchEvent(new f.document.defaultView!.Event("input"));
    const before = f.p.active;
    f.p.editDraft({ title: "External", notes: "  newer 日本語\r\n", locationId: null });
    const newer = f.p.draft;
    try {
      if (action === "input") {
        notes.value = "old UI response";
        notes.dispatchEvent(new f.document.defaultView!.Event("input"));
      } else button(f.host, action).click();
      assert.ok(f.p.draft === newer, "newer authored draft must survive");
      assert.ok(f.p.active === before, "no unreviewed draft publication");
      assert.match(f.host.textContent!, /Ansicht geändert/);
      button(f.host, "Ansicht aktualisieren").click();
      const refreshed = f.host.querySelector<HTMLTextAreaElement>('[aria-label="Notizen"]')!;
      assert.equal(refreshed.value, newer!.fields.notes);
      refreshed.value += "continued";
      refreshed.dispatchEvent(new f.document.defaultView!.Event("input"));
      refreshed.value += " twice";
      refreshed.dispatchEvent(new f.document.defaultView!.Event("input"));
      button(f.host, "Entwurf übernehmen").click();
      assert.equal(f.p.active!.scenes[0]!.notes, newer!.fields.notes + "continued twice");
    } finally { f.ui.destroy(); }
  });
}
