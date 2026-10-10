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
