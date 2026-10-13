import {campaignLocalId} from '../features/campaign/campaign-contracts';
import { worldNoteDocument } from "../features/world/world-notes";
import type { Workspace, Result } from "./contracts";
import type { DeskRef, DeskContent, SceneDesk } from "./scene-desk-contracts";
import type {
  PreparationDraft,
  PreparationEdit,
} from "./preparation-contracts";
import type { LiveScene } from "./live-contracts";
import { newLocation } from "../features/location/location-schema";
import { showNarrative, flushNarrative } from "./narrative-ui";
import { renderCreatureDetail } from "./catalog-ui";
import type { EncounterPlan } from "./encounter-contracts";
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const unwrap = <T>(r: Result<T>) => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
let w: Workspace | null = null,
  scene: LiveScene | null = null,
  desk: SceneDesk | null = null,
  content: DeskContent | null = null,
  draft: PreparationDraft | null = null,
  writeId: string | null = null,
  dirty = false,
  version = 0,
  savedVersion = 0,
  key = "",
  request = 0,
  searchRequest = 0,
  next: number | null = null;
let saving: Promise<boolean> | null = null,
  timer: ReturnType<typeof setTimeout> | null = null,
  initialized = false;
let tell: (s: string, error?: boolean) => void,
  encounter: (p: EncounterPlan) => Promise<void>,
  creature: (id: string, count: number, grouped: boolean) => Promise<void>;
function button(text: string, action: () => Promise<unknown>) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.onclick = () => void action().catch((e) => tell(e.message, true));
  return b;
}
const owns = (token: string, id: string) =>
  w?.token === token && scene?.id === id;
export function initSceneDesk(
  status: typeof tell,
  prepare: typeof encounter,
  add: typeof creature,
) {
  tell = status;
  encounter = prepare;
  creature = add;
  if (initialized) return;
  initialized = true;
  el("desk-search-form").onsubmit = (e) => {
    e.preventDefault();
    void search(false);
  };
  el("desk-more").onclick = () => void search(true);
  el("desk-refresh").onclick = () => void refresh();
  el("desk-create-form").onsubmit = (e) => {
    e.preventDefault();
    void create().catch((e) => tell(e.message, true));
  };
  el("desk-save").onclick = () => void flushSceneDesk();
  el("desk-reload").onclick = () =>
    void reloadContent().catch((e) => tell(e.message, true));
}
export function sceneDeskContext(
  workspace: Workspace | null,
  current: LiveScene | null,
) {
  w = workspace;
  scene = current;
  const changed = (workspace?.token ?? "") + ":" + (current?.id ?? "");
  el("scene-desk").hidden = !workspace || !current;
  if (changed === key) {
    if (desk && (desk.place?.ref.id ?? null) !== (current?.locationId ?? null))
      void refresh();
    return;
  }
  key = changed;
  request++;
  searchRequest++;
  if (timer) clearTimeout(timer);
  content = null;
  draft = null;
  writeId = null;
  dirty = false;
  desk = null;
  el("desk-editor").hidden = true;
  el("desk-results").replaceChildren();
  el("desk-pins").replaceChildren();
  el("desk-search-status").textContent = "";
  if (workspace && current) void refresh();
}
async function refresh() {
  if (!w || !scene) return;
  const token = w.token,
    id = scene.id,
    n = ++request;
  try {
    const result = unwrap(await window.campaign.sceneDesk(token, id));
    if (!owns(token, id) || n !== request) return;
    desk = result;
    drawPins();
    if (!content) {
      const initial = result.pins.find((p) => !p.unavailable) ?? result.place;
      if (initial && !initial.unavailable) await open(initial.ref);
    }
  } catch (e) {
    tell((e as Error).message, true);
  }
}
function drawPins() {
  const root = el("desk-pins");
  root.replaceChildren();
  const entries = desk
    ? [
        ...(desk.place ? [desk.place] : []),
        ...desk.pins.filter(
          (p) =>
            !(
              desk!.place?.ref.kind === p.ref.kind &&
              desk!.place.ref.id === p.ref.id
            ),
        ),
      ]
    : [];
  for (const p of entries) {
    const row = document.createElement("div");
    row.className = "toolbar";
    const openButton = button(p.label + " · " + p.title, () => open(p.ref));
    openButton.disabled = !!p.unavailable;
    row.append(openButton);
    if (
      desk!.pins.some((r) => r.ref.kind === p.ref.kind && r.ref.id === p.ref.id)
    )
      row.append(button("Vom Szenentisch nehmen", () => pin(p.ref, false)));
    root.append(row);
  }
  if (!entries.length)
    root.textContent =
      "Noch nichts angeheftet. Suche nach Kampagnenwissen oder lege einen Eintrag direkt hier an.";
}
async function pin(ref: DeskRef, on: boolean) {
  if (!w || !scene || !desk || !(await flushSceneDesk())) return;
  const token = w.token,
    id = scene.id,
    result = unwrap(
      await window.campaign.pinSceneDesk(token, id, desk.revision, ref, on),
    );
  if (!owns(token, id)) return;
  desk = result;
  drawPins();
  if (on) await open(ref);
}
async function search(more: boolean) {
  if (!w || !scene) return;
  const token = w.token,
    id = scene.id,
    n = ++searchRequest;
  try {
    const r = unwrap(
      await window.campaign.searchDesk(
        token,
        el<HTMLSelectElement>("desk-search-kind").value as "world",
        el<HTMLInputElement>("desk-search").value,
        more ? (next ?? 0) : 0,
      ),
    );
    if (!owns(token, id) || n !== searchRequest) return;
    if (!more) el("desk-results").replaceChildren();
    for (const entry of r.entries) {
      const row = document.createElement("div");
      row.className = "toolbar";
      row.append(
        button(entry.label + " · " + entry.title, () => open(entry.ref)),
        button("An Szene heften", () => pin(entry.ref, true)),
      );
      el("desk-results").append(row);
    }
    next = r.next;
    el("desk-more").hidden = next === null;
    el("desk-search-status").textContent = r.entries.length
      ? "Treffer · Titel und Notizen durchsucht."
      : "Keine passenden Inhalte.";if(r.notice)el("desk-search-status").textContent+=" · "+r.notice;
  } catch (e) {
    tell((e as Error).message, true);
  }
}
async function open(ref: DeskRef) {
  if (!w || !scene || !(await flushSceneDesk())) return;
  const token = w.token,
    id = scene.id,
    n = ++request;
  const c = unwrap(await window.campaign.deskContent(token, ref));
  if (!owns(token, id) || n !== request) return;
  let retained: PreparationDraft | null = null;
  if (c.note || c.location)
    retained = unwrap(
      await window.campaign.preparationDraft(
        token,
        c.note ? "note" : "location",
        ref.id,
      ),
    );
  if (!owns(token, id) || n !== request) return;
  content = c;
  draft = retained;
  writeId = retained?.writeId ?? null;
  dirty = !!retained;
  savedVersion = version;
  drawEditor();
  await drawNarrative();
}
function edit(): PreparationEdit | null {
  if (!content) return null;
  if (draft) return draft.change;
  if (content.note)
    return {
      kind: "note",
      note: structuredClone(content.note),
      expectedRevision: content.revision,
    };
  if (content.location)
    return {
      kind: "location",
      document: structuredClone(content.location),
      expectedRevision: content.revision,
    };
  return null;
}
function mark() {
  dirty = true;
  version++;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void keep(), 250);
}
function drawEditor() {
  const c = content!,
    root = el("desk-fields");
  root.replaceChildren();
  el("desk-editor").hidden = false;
  el("desk-title").textContent = c.label + " · " + c.title;
  el("desk-note-status").textContent = draft
    ? "Gesicherte Eingabe wieder geöffnet."
    : "";
  const change = edit();
  if (change) {
    draft = {
      version: 1,
      writeId: writeId ?? crypto.randomUUID(),
      change,
      failedCommand: null,
    };
    const title = document.createElement("input"),
      label = document.createElement("label");
    label.textContent = c.note ? "Titel" : "Name";
    title.setAttribute("aria-label", "Szenentisch-Titel");
    title.value =
      change.kind === "note"
        ? change.note.title
        : change.kind === "location"
          ? change.document.name
          : "";
    title.disabled = !!c.unavailable;
    title.oninput = () => {
      if (change.kind === "note")
        change.note = { ...change.note, title: title.value };
      if (change.kind === "location")
        change.document = { ...change.document, name: title.value };
      mark();
    };
    label.append(title);
    root.append(label);
    const field = (name: string, value: string, set: (v: string) => void) => {
      const label = document.createElement("label"),
        t = document.createElement("textarea");
      label.textContent = name;
      t.setAttribute("aria-label", name);
      t.rows = 5;
      t.value = value;
      t.disabled = !!c.unavailable;
      t.oninput = () => {
        set(t.value);
        mark();
      };
      label.append(t);
      root.append(label);
    };
    if (change.kind === "note") {
      field("Zum Vorlesen", change.note.readAloud, (v) => {
        change.note = { ...change.note, readAloud: v };
      });
      field("GM-Notizen", change.note.gmNotes, (v) => {
        change.note = { ...change.note, gmNotes: v };
      });
      for (const r of change.note.relations) {
        const p = document.createElement("p");
        p.textContent = "Beziehung: " + r.label;
        root.append(
          p,
          button("Verknüpften Inhalt öffnen", () =>
            open({ kind: "note", id: r.targetId }),
          ),
        );
      }
    }
    if (change.kind === "location")
      for (const [index, s] of change.document.sections.entries())
        field(s.title, s.markdown, (v) => {
          if (change.kind === "location")
            change.document = {
              ...change.document,
              sections: change.document.sections.map((s, i) =>
                i === index ? { ...s, markdown: v } : s,
              ),
            };
        });
  } else if (c.creature) {
    renderCreatureDetail(root, c.creature);
    root.append(
      button("Eine Kreatur zur aktuellen Initiative hinzufügen", () =>
        creature(c.ref.id, 1, false),
      ),
    );
  } else if (c.encounter) {
    const p = document.createElement("p");
    p.textContent = c.encounter.notes;
    root.append(
      p,
      button("Diesen Encounter vorbereiten", () => encounter(c.encounter!)),
    );
  } else if (c.item) {
    const p = document.createElement("p");
    p.textContent = c.item.description + "\n" + c.item.properties.join(" · ");
    root.append(p);
  }
  el("desk-save").hidden = !change;
  el("desk-reload").hidden = !change;
}
async function drawNarrative() {
  await showNarrative(
    w,
    content?.note ?? null,
    !!content?.unavailable,
    () => flushSceneDesk(false),
    tell,
    el("desk-narrative"),
  );
}
async function keep(): Promise<boolean> {
  if (saving) {
    if (!(await saving)) return false;
    return dirty && savedVersion !== version ? keep() : true;
  }
  if (!dirty || savedVersion === version || !draft || !w) return true;
  const token = w.token,
    n = version,
    value = structuredClone(draft);
  value.writeId = crypto.randomUUID();
  const run = (async () => {
    try {
      unwrap(await window.campaign.keepDeskDraft(token, value, writeId));
      writeId = value.writeId;
      savedVersion = n;
      el("desk-note-status").textContent = "Eingabe gesichert.";
      return true;
    } catch (e) {
      tell((e as Error).message, true);
      return false;
    }
  })();
  saving = run;
  const ok = await run;
  saving = null;
  return ok && savedVersion !== version ? keep() : ok;
}
let applying:Promise<boolean>|null=null;
export async function flushSceneDesk(narrative = true): Promise<boolean> {
  if(applying){const ok=await applying;return ok?flushSceneDesk(narrative):false;}
  if (narrative && !(await flushNarrative())) return false;
  if (timer) clearTimeout(timer);
  if (!(await keep())) return false;
  if (!dirty || !draft || !w || !content) return true;
  const run=applyContent();applying=run;try{return await run;}finally{if(applying===run)applying=null;}
}
async function applyContent():Promise<boolean>{
 if(!draft||!w||!content)return true;
  const change = structuredClone(draft.change),
    valid =
      change.kind === "note"
        ? change.note.title.trim()
        : change.kind === "location"
          ? change.document.name.trim()
          : true;
  if (!valid) {
    el("desk-note-status").textContent =
      "Eingabe gesichert · Titel vor Übernahme vervollständigen.";
    return true;
  }
  const token = w.token,
    c = content,
    n = version;
  try {
    unwrap(
      await window.campaign.changePreparation({
        commandId: crypto.randomUUID(),
        campaignId: w.campaign.id,
        token,
        draftWriteId: writeId ?? undefined,
        change,
      }),
    );
    const fresh = unwrap(await window.campaign.deskContent(token, c.ref));
    if (w?.token !== token || content !== c) return true;
    content = fresh;
    writeId = null;
    if (n === version) {
      dirty = false;
      draft = null;
      drawEditor();
    } else if (draft) {
      draft.change.expectedRevision = fresh.revision;
      if (draft.change.kind === "note")
        draft.change.note = { ...draft.change.note, revision: fresh.revision };
      savedVersion = -1;
      await keep();
    }
    if (desk) {
      desk.pins = desk.pins.map((p) =>
        p.ref.id === c.ref.id && p.ref.kind === c.ref.kind
          ? { ...p, title: fresh.title }
          : p,
      );
      drawPins();
    }
    return true;
  } catch (e) {
    tell((e as Error).message, true);
    return false;
  }
}
async function reloadContent() {
  if (!w || !content || !(await keep())) return;
  const ref = content.ref;
  if (writeId)
    unwrap(
      await window.campaign.discardPreparationDraft(
        w.token,
        content.note ? "note" : "location",
        ref.id,
        writeId,
      ),
    );
  dirty = false;
  draft = null;
  writeId = null;
  await open(ref);
}
async function create() {
  if (!w || !scene || !(await flushSceneDesk())) return;
  const token = w.token,
    id = scene.id,
    kind = el<HTMLSelectElement>("desk-new-kind").value,
    name = el<HTMLInputElement>("desk-new-title").value,
    notes = el<HTMLTextAreaElement>("desk-new-notes").value,
    newId = crypto.randomUUID();
  if (!name.trim()) throw new Error("Titel oder Name fehlt.");
  let ref: DeskRef;
  if (kind === "location") {
    let document = newLocation(newId, name, "poi", [
      crypto.randomUUID(),
      crypto.randomUUID(),
    ]);
    document = {
      ...document,
      sections: document.sections.map((s, i) =>
        i === 0 ? { ...s, markdown: notes } : s,
      ),
    };
    unwrap(
      await window.campaign.changePreparation({
        commandId: crypto.randomUUID(),
        campaignId: w.campaign.id,
        token,
        change: { kind: "location", expectedRevision: null, document },
      }),
    );
    ref = { kind: "location", id: newId };
  } else {
    const note = {
      version: 1 as const,
      id: campaignLocalId(newId),
      revision: 1,
      kind: kind as "npc",
      title: name,
      readAloud: "",
      gmNotes: notes,
      relations: [],
      creatureId: null,
      deleted: false,
    };
    unwrap(
      await window.campaign.changePreparation({
        commandId: crypto.randomUUID(),
        campaignId: w.campaign.id,
        token,
        change: {
          kind: "note",
          expectedRevision: null,
          note: worldNoteDocument(note),
        },
      }),
    );
    if (kind === "quest" || kind === "rumor")
      unwrap(
        await window.campaign.executeProgress({
          commandId: crypto.randomUUID(),
          campaignId: w.campaign.id,
          token,
          action: {
            kind: "narrative-state",
            expectedRevision: 0,
            expectedNoteRevision: 1,
            state: {
              noteId: newId,
              revision: 0,
              status: "open",
              locationId: scene.locationId,
              contributors: kind === "quest" ? [...scene.members] : [],
              poolXp: 0,
              items: [],
              awardId: null,
            },
          },
        }),
      );
    ref = { kind: "note", id: newId };
  }
  if (!owns(token, id)) return;
  el<HTMLInputElement>("desk-new-title").value = "";
  el<HTMLTextAreaElement>("desk-new-notes").value = "";
  await pin(ref, true);
  tell("Kampagneninhalt angelegt und an diese Szene geheftet.");
}
