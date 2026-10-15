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
  editorEpoch = 0,
  request = 0,
  searchRequest = 0,
  next: number | null = null;
let searchPage: { kind: string; query: string } | null = null, searchBusy = false;
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
const editorOwner=()=>{const epoch=editorEpoch;return()=>epoch===editorEpoch;};
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
  el("desk-search").addEventListener("input", () => invalidateSearch(true));
  el("desk-search-kind").addEventListener("change", () => invalidateSearch(true));
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
  editorEpoch++;version=0;savedVersion=0;saving=null;applying=null;
  request++;
  invalidateSearch();
  if (timer) clearTimeout(timer);
  timer=null;
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
export async function refreshSceneDeskPins(id:string){if(scene?.id===id)await refresh(false);}
async function refresh(openInitial=true) {
  if (!w || !scene) return;
  const token = w.token,
    id = scene.id,
    n = ++request;
  try {
    const result = unwrap(await window.campaign.sceneDesk(token, id));
    if (!owns(token, id) || n !== request) return;
    desk = result;
    drawPins();
    if (!content&&openInitial) {
      const initial = result.pins.find((p) => !p.unavailable) ?? result.place;
      if (initial && !initial.unavailable) await open(initial.ref);
    }
  } catch (e) {
    if(owns(token,id)&&n===request)tell((e as Error).message,true);
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
async function pin(ref:DeskRef,on:boolean){
  if(!w||!scene||!desk)return;
  const current=editorOwner(),token=w.token,id=scene.id,revision=desk.revision;
  if(!await flushSceneDesk()||!current())return;
  const result=unwrap(await window.campaign.pinSceneDesk(token,id,revision,ref,on));
  if(!current())return;
  desk=result;drawPins();
  if(on)await open(ref);
}
function invalidateSearch(changed = false) {
  searchRequest++;
  searchPage = null;
  searchBusy = false;
  next = null;
  el("desk-results").replaceChildren();
  el("desk-more").hidden = true;
  el<HTMLButtonElement>("desk-more").disabled = false;
  el("desk-search-status").textContent = changed
    ? "Suche geändert · mit Suchen oder Enter neue Treffer laden."
    : "";
}
async function search(more: boolean) {
  if (!w || !scene) return;
  const kind = el<HTMLSelectElement>("desk-search-kind").value,
    query = el<HTMLInputElement>("desk-search").value;
  if (more && (searchBusy || next === null || searchPage?.kind !== kind || searchPage.query !== query)) return;
  const offset = more ? next! : 0;
  if (!more) invalidateSearch();
  const token = w.token, id = scene.id, n = ++searchRequest;
  const current = () => owns(token, id) && n === searchRequest;
  searchBusy = true;
  el<HTMLButtonElement>("desk-more").disabled = true;
  el("desk-search-status").textContent = "Suche läuft…";
  try {
    const r = unwrap(await window.campaign.searchDesk(token, kind as "world", query, offset));
    if (!current()) return;
    for (const entry of r.entries) {
      const row = document.createElement("div");
      row.className = "toolbar";
      row.append(
        button(entry.label + " · " + entry.title, () => open(entry.ref)),
        button("An Szene heften", () => pin(entry.ref, true)),
      );
      el("desk-results").append(row);
    }
    searchPage = {kind, query};
    next = r.next;
    el("desk-more").hidden = next === null;
    const count = el("desk-results").childElementCount;
    el("desk-search-status").textContent = count
      ? `${count} Treffer geladen · Titel und Notizen durchsucht.`
      : "Keine passenden Inhalte.";
    if (r.notice) el("desk-search-status").textContent += " · " + r.notice;
  } catch (e) {
    if (!current()) return;
    el("desk-search-status").textContent = "Suche fehlgeschlagen · bitte erneut suchen. " + (e as Error).message;
    tell((e as Error).message, true);
  } finally {
    if (current()) {
      searchBusy = false;
      el<HTMLButtonElement>("desk-more").disabled = false;
    }
  }
}
async function open(ref: DeskRef) {
  if(!w||!scene)return;
  const current=editorOwner(),token=w.token,id=scene.id,n=++request;
  if(!await flushSceneDesk()||!current()||n!==request)return;
  const readVersion=version;
  const read=await window.campaign.deskContent(token,ref);
  if(!current()||!owns(token,id)||n!==request)return;
  const c=unwrap(read);
  let retained: PreparationDraft | null = null;
  if (c.note || c.location)
  {
    const read=await window.campaign.preparationDraft(token,c.note?"note":"location",ref.id);
    if(!current()||n!==request)return;
    retained=unwrap(read);
  }
  if (!owns(token, id) || n !== request) return;
  if(version!==readVersion)return;
  editorEpoch++;version=0;savedVersion=0;
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
  const current=editorOwner();
  timer = setTimeout(() => {if(current())void keep();}, 250);
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
  const editing=el<HTMLDetailsElement>("desk-editing"), preview=el("desk-note-preview");
  editing.open=!c.note||!!draft;
  el("desk-edit-summary").hidden=!c.note;
  const showPreview=()=>{
    preview.hidden=!c.note||editing.open;preview.replaceChildren();
    if(preview.hidden)return;
    const note=change?.kind==='note'?change.note:c.note!;
    el("desk-title").textContent=c.label+' · '+note.title;
    for(const [title,text] of [["Zum Vorlesen",note.readAloud],["GM-Notizen",note.gmNotes]])if(text?.trim()){
      const heading=document.createElement('h4'),p=document.createElement('p');heading.textContent=title!;p.textContent=text!;preview.append(heading,p);
    }
    if(!preview.children.length)preview.textContent='Noch keine Notizen.';
    if(dirty){const hint=document.createElement('small');hint.textContent='Vorschau der Eingabe · noch nicht übernommen.';preview.append(hint);}
  };
  editing.ontoggle=showPreview;showPreview();
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
  const current=editorOwner();
  if (saving) {
    if (!(await saving)||!current()) return false;
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
      if(!current())return false;
      writeId = value.writeId;
      savedVersion = n;
      el("desk-note-status").textContent = "Eingabe gesichert.";
      return true;
    } catch (e) {
      if(current())tell((e as Error).message,true);
      return false;
    }
  })();
  saving = run;
  const ok = await run;
  if(saving===run)saving=null;
  return current()&&(ok&&savedVersion!==version?await keep():ok);
}
let applying:Promise<boolean>|null=null;
export async function flushSceneDesk(narrative=true):Promise<boolean>{
  const current=editorOwner();
  if(applying){const ok=await applying;return ok&&current()?flushSceneDesk(narrative):false;}
  if(narrative&&!(await flushNarrative())||!current())return false;
  if(timer)clearTimeout(timer);
  if(!await keep()||!current())return false;
  if(!dirty||!draft||!w||!content)return true;
  const run=applyContent();applying=run;
  try{return await run;}finally{if(applying===run)applying=null;}
}
async function applyContent():Promise<boolean>{
 const current=editorOwner();
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
    if(!current())return false;
    const fresh = unwrap(await window.campaign.deskContent(token, c.ref));
    if(!current()||content!==c)return false;
    if(fresh.revision!==c.revision+1)throw new Error("Inhalt nach Speicherung erneut geändert. Gesicherte Eingabe zuerst prüfen.");
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
    if(current())tell((e as Error).message,true);
    return false;
  }
}
async function reloadContent(){
  if(!w||!content)return;
  const current=editorOwner(),token=w.token,c=content;
  if(!await keep()||!current())return;
  const n=version;
  if(writeId)unwrap(await window.campaign.discardPreparationDraft(token,c.note?"note":"location",c.ref.id,writeId));
  if(!current())return;
  writeId=null;
  if(n!==version){savedVersion=-1;await keep();return;}
  dirty=false;draft=null;
  await open(c.ref);
}
async function create() {
  if(!w||!scene)return;
  const current=editorOwner(),token=w.token,id=scene.id,campaignId=w.campaign.id,locationId=scene.locationId,members=[...scene.members],
    kind = el<HTMLSelectElement>("desk-new-kind").value,
    name = el<HTMLInputElement>("desk-new-title").value,
    notes = el<HTMLTextAreaElement>("desk-new-notes").value,
    newId = crypto.randomUUID();
  if(!await flushSceneDesk()||!current())return;
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
        campaignId,
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
        campaignId,
        token,
        change: {
          kind: "note",
          expectedRevision: null,
          note: worldNoteDocument(note),
        },
      }),
    );
    if(!current())return;
    if (kind === "quest" || kind === "rumor")
      unwrap(
        await window.campaign.executeProgress({
          commandId: crypto.randomUUID(),
          campaignId,
          token,
          action: {
            kind: "narrative-state",
            expectedRevision: 0,
            expectedNoteRevision: 1,
            state: {
              noteId: newId,
              revision: 0,
              status: "open",
              locationId,
              contributors: kind === "quest" ? members : [],
              poolXp: 0,
              items: [],
              awardId: null,
            },
          },
        }),
      );
    ref = { kind: "note", id: newId };
  }
  if(!current()||!owns(token,id))return;
  if(el<HTMLInputElement>("desk-new-title").value===name)el<HTMLInputElement>("desk-new-title").value="";
  if(el<HTMLTextAreaElement>("desk-new-notes").value===notes)el<HTMLTextAreaElement>("desk-new-notes").value="";
  await pin(ref, true);
  tell("Kampagneninhalt angelegt und an diese Szene geheftet.");
}
