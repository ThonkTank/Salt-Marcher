import {TreasureDistribution} from "./treasure-distribution-ui";
import type { ItemDefinition } from "./items-contracts";
import type { WorkspaceGeometry, Result } from "./contracts";
import type {
  Treasure,
  TreasurePage,
  ProgressView,
  ProgressAction,
  ProgressAck,
  ProgressCommand,
} from "./progression";
import type { TreasuryDraft,TreasureQuery } from "./treasury-contracts";
import { rewardItemsEditor } from "./reward-items-ui";
import {
  writeConfirmed,
  hasPendingCommit,
  onCommitResolved,
  onCommitState,
} from "./commit-confirmation";
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const value = (id: string) => el<HTMLInputElement>(id).value;
const goldText = (cp: string | null) =>
  cp === null
    ? ""
    : BigInt(cp) / 100n + "." + (BigInt(cp) % 100n).toString().padStart(2, "0");
let distribution:TreasureDistribution;
let catalogResults: {search:string;items:ItemDefinition[]} | null = null;
let listQuery:TreasureQuery={search:'',anchor:'all'},listRequest=0,anchorScenes:{id:string;title:string}[]=[];
function anchorChoices(){const controls=[el<HTMLSelectElement>('treasury-filter-anchor'),el<HTMLSelectElement>('treasury-anchor-target')];for(const select of controls){const prior=select.value;select.replaceChildren();if(select.id==='treasury-filter-anchor'){option(select,'all','Alle Schätze');option(select,'inbox','Posteingang: nicht platziert oder Zuordnung offen');option(select,'scene','Alle Gruppen');option(select,'location','Alle Orte');}else option(select,'unplaced','Nicht platziert');for(const scene of anchorScenes)option(select,'scene:'+scene.id,'Gruppe: '+(scene.title||'Unbenannte Gruppe · '+scene.id.slice(0,8)));for(const place of places)option(select,'location:'+place.id,'Ort: '+place.name);if([...select.options].some(o=>o.value===prior))select.value=prior;}}
function queryKey(){return JSON.stringify(listQuery);}
async function readList(token:string,after:string|null){const query=structuredClone(listQuery),key=queryKey(),request=++listRequest,response=await window.campaign.treasures(token,after,query);if(w?.token!==token||key!==queryKey()||request!==listRequest)return null;return unwrap(response);}

let w: WorkspaceGeometry | null = null,
  book: Treasure | null = null,
  draft: TreasuryDraft | null = null,
  writeId: string | null = null,
  list: TreasurePage = { items: [], next: null },
  people: ProgressView | null = null,
  places: { id: string; name: string }[] = [],
  dirty = false,
  version = 0,
  savedVersion = 0,
  generation = 0,
  editing = 0,
  reading = 0;
let pending: Promise<boolean> | null = null,
  keeping: Promise<boolean> | null = null,
  timer: ReturnType<typeof setTimeout> | null = null,
  historyCursor: string | null = null;
let tell: (s: string, error?: boolean) => void,
  after: () => Promise<void>,
  enter: (id?: string) => Promise<void>,
  ready = false;
function editorOwner() {
  const g = generation, e = editing;
  return () => generation === g && editing === e;
}
function run(fn: () => Promise<unknown>) {
  const current = editorOwner();
  void fn().catch((e) => { if (current()) tell(e.message, true); });
}
function option(s: HTMLSelectElement, id: string, title: string) {
  const o = document.createElement("option");
  o.value = id;
  o.textContent = title;
  s.append(o);
}
function mark() {
  if (!draft) return;
  dirty = true;
  version++;
  if (timer) clearTimeout(timer);
  const current = editorOwner();
  timer = setTimeout(() => { if (current()) void keep(); }, 250);
  lock();
}
function snapshot(): TreasuryDraft {
  if (!draft) throw new Error("Schatz auswählen.");
  return {
    ...structuredClone(draft),
    title: value("treasury-title"),
    locationId: value("treasury-place") || null,
    reason: value("treasury-reason"),
  };
}
export function activateTreasury(next: WorkspaceGeometry | null) {
  distribution?.reset();w = next;
  generation++;
  editing++;
  reading++;
  book = null;
  draft = null;
  writeId = null;
  dirty = false;
  pending = null;
  keeping = null;
  version = savedVersion = 0;
  people = null;
  places = [];
  historyCursor = null;
  list = { items: [], next: null };listQuery={search:'',anchor:'all'};listRequest++;anchorScenes=[];el<HTMLInputElement>('treasury-filter-search').value='';el<HTMLInputElement>('treasury-filter-remaining').checked=false;anchorChoices();
  if (timer) clearTimeout(timer);
  el("treasury-editor").hidden = true;
  el("treasury-list").replaceChildren();
  catalogResults = null;
  drawCatalogResults();
}
export async function openTreasury(id?: string) {
  if (!w) return;
  const current = editorOwner(), token = w.token;
  if (!(await flushTreasury()) || !current()) return;
  const [treasures, progress, parties,live] = await Promise.all([
    readList(token,null), window.campaign.progress(token), window.campaign.ledgerParties(token),window.campaign.live(token),
  ]);
  if (!current()) return;
  if(!treasures)return;const r=treasures,p=unwrap(progress),refs=unwrap(parties);anchorScenes=unwrap(live).scenes.map(s=>({id:s.id,title:s.title}));
  list = r;
  people = p;
  places = refs.filter((r) => r.kind === "location");
  anchorChoices();drawList();
  const target = id ?? book?.id ?? r.items[0]?.id;
  if (target) await select(target);
}
async function select(id: string) {
  if (!w) return;
  const current = editorOwner(), token = w.token;
  if (!(await flushTreasury()) || !current()) return;
  const r = ++reading, n = version;
  const [t, d] = await Promise.all([
    window.campaign.treasure(token, id),
    window.campaign.treasuryDraft(token, id),
  ]);
  if (!current() || r !== reading || n !== version) return;
  const nextBook = unwrap(t), nextDraft = unwrap(d);
  editing++;
  version = savedVersion = 0;
  book = nextBook;
  draft = nextDraft;
  dirty = !!draft;
  writeId = draft?.writeId ?? null;
  savedVersion = version;
  draw();
  await history(false);
}
function drawList() {
  const root = el("treasury-list");
  root.replaceChildren();
  for (const t of list.items) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t.title + " · " + t.available + " unverteilte Einheiten"+(t.anchorLabel?" · "+t.anchorLabel:"");
    b.setAttribute("aria-pressed", String(t.id === book?.id));
    b.onclick = () => run(() => select(t.id));
    root.append(b);
  }
  el("treasury-more").hidden = !list.next;el("treasury-list-status").textContent=list.items.length+" Schätze geladen"+(book&&!list.items.some(t=>t.id===book!.id)?" · geöffneter Schatz liegt außerhalb dieser geladenen Treffer":"")+(list.next?" · weitere Treffer vorhanden":"")+".";
  const target = el<HTMLSelectElement>("treasury-target");
  target.replaceChildren();
  option(target, "", "Neuen Zielschatz anlegen");
  for (const t of list.items)
    if (t.id !== book?.id) option(target, t.id, t.title);
}
function draw() {
  if (!book) return;
  el("treasury-editor").hidden = false;
  draft ??= {
    writeId: crypto.randomUUID(),
    treasureId: book.id,
    revision: book.revision,
    title: book.title,
    locationId: book.locationId,
    reason: "GM-Nachbearbeitung",
    items: book.items
      .filter((i) => i.quantity > i.allocated)
      .map((i) => {
        const d = i.currentDefinition;
        return {
          lotId: i.id,
          name: d?.name ?? i.name,
          category: d?.category ?? i.category,
          quantity: String(i.quantity - i.allocated),
          valueGold: goldText(d ? d.unitCopper : i.unitCopper),
          reference: {
            ...i.reference,
            revision: d?.revision ?? i.reference.revision,
          },
        };
      }),
  };
  el<HTMLInputElement>("treasury-title").value = draft.title;
  el<HTMLInputElement>("treasury-reason").value = draft.reason;
  for (const id of ["treasury-place", "treasury-target-place"]) {
    const s = el<HTMLSelectElement>(id),
      old = s.value;
    s.replaceChildren();
    option(s, "", "Ohne Ortsbindung");
    for (const p of places) option(s, p.id, p.name);
    s.value = id === "treasury-place" ? (draft.locationId ?? "") : old;
  }
  if (draft.locationId && !places.some((p) => p.id === draft!.locationId))
    option(
      el<HTMLSelectElement>("treasury-place"),
      draft.locationId,
      "Ort nicht verfügbar",
    );
  el<HTMLSelectElement>("treasury-place").value = draft.locationId ?? "";
  el("treasury-draft-status").textContent = writeId
    ? "Gesicherte Schatzeingabe wieder geöffnet."
    : "Unverteilte Mengen bearbeiten; bereits vergebene Mengen bleiben unverändert.";
  if (draft.revision !== book.revision)
    el("treasury-draft-status").textContent =
      "Schatz geändert. Entwurf bleibt erhalten; vor Übernahme abgleichen oder gespeicherten Stand laden.";
  rewardItemsEditor(el("treasury-rows"), draft.items, mark, true, true);
  if(!draft.items.length)el<HTMLDetailsElement>('treasury-catalog-picker').open=true;
  const allocated = book.items.filter((i) => i.allocated > 0);
  el("treasury-allocated").textContent =
    allocated
      .map((i) => i.allocated + " × " + i.name + " bereits vergeben")
      .join("\n") || "Noch nichts vergeben.";
  const anchor=el<HTMLSelectElement>('treasury-anchor-target'),anchorValue=book.sceneId?'scene:'+book.sceneId:book.locationId?'location:'+book.locationId:'unplaced';if(![...anchor.options].some(o=>o.value===anchorValue))option(anchor,anchorValue,'Bisherige Zuordnung nicht verfügbar');anchor.value=anchorValue;
  el('treasury-place').closest('label')!.hidden=!!book.sceneId;
  el("treasury-origin").textContent =
    (book.combatId ? "Kampf " + book.combatId.slice(0, 8) + " · " : "") +
    (book.sourceNoteId
      ? "Quest/Gerücht " + book.sourceNoteId.slice(0, 8) + " · "
      : "") +
    book.id.slice(0, 8);
  drawList();
  const move = el<HTMLSelectElement>("treasury-move-item");
  move.replaceChildren();
  for (const i of book.items)
    if (i.quantity > i.allocated)
      option(
        move,
        i.id,
        (i.currentDefinition?.name ?? i.name) +
          " · " +
          (i.quantity - i.allocated) +
          " verfügbar",
      );
  const recipient = el<HTMLSelectElement>("treasury-recipient");
  recipient.replaceChildren();
  for (const p of people?.characters.filter((p) => p.active) ?? [])
    option(recipient, p.characterId, p.name);
  drawCatalogResults();
  lock();
}
async function keep(): Promise<boolean> {
  const current = editorOwner();
  if (keeping) {
    if (!(await keeping) || !current()) return false;
    return dirty && savedVersion !== version ? keep() : true;
  }
  if (!dirty || !draft || !w || savedVersion === version) return true;
  const token = w.token, n = version, d = snapshot(), expected = writeId;
  d.writeId = crypto.randomUUID();
  const task = (async () => {
    try {
      unwrap(await window.campaign.keepTreasuryDraft(token, d, expected));
      if (!current()) return false;
      writeId = d.writeId;
      savedVersion = n;
      el("treasury-draft-status").textContent = "Schatzeingabe gesichert · noch nicht übernommen.";
      return true;
    } catch (e) {
      if (current()) tell((e as Error).message, true);
      return false;
    }
  })();
  keeping = task;
  const ok = await task;
  if (keeping === task) keeping = null;
  if (!current()) return false;
  return ok && savedVersion !== version ? keep() : ok;
}
export async function flushTreasury() {
  const current = editorOwner();
  if (pending && !(await pending)) return false;
  if (!current()) return false;
  if (timer) clearTimeout(timer);
  return (await keep()) && current() && (!w || !hasPendingCommit(w.campaign.id));
}
async function execute(action: ProgressAction,failed?:(message:string)=>void) {
  if (!w || pending) return false;
  if(hasPendingCommit(w.campaign.id)){failed?.('Eine Buchung ist noch ungeklärt. Schließen und den Buchungsstatus prüfen; keinen neuen Schreibversuch starten.');return false;}
  const token = w.token,
    g = generation,
    current = editorOwner(),
    command: ProgressCommand = {
      commandId: crypto.randomUUID(),
      token,
      campaignId: w.campaign.id,
      action: structuredClone(action),
    };
  const task = Promise.resolve().then(async () => {
    let confirmed = false;
    try {
      const ack = await writeConfirmed<ProgressAck>(
        "progress",
        command,
        () => window.campaign.executeProgress(command),
        () => current() && w?.token === token && generation === g,
        { owner: "treasury", action: command.action, token, generation: g, editing },
      );
      confirmed = true;
      if (!current()) return false;
      dirty = false;
      draft = null;
      writeId = null;
      await after();
      if (!current()) return false;
      const response = await readList(token,null);
      if (!current()) return false;
      if(!response)return false;const r=response;
      list = r;
      people = ack;
      drawList();
      if (ack.treasureId) {
        const response = await window.campaign.treasure(token, ack.treasureId);
        if (!current()) return false;
        const t = unwrap(response);
        book = t;
        draw();
        await history(false);
      } else if (book) {
        const response = await window.campaign.treasure(token, book.id);
        if (!current()) return false;
        book = unwrap(response);
        draw();
        await history(false);
      }
      if (!current()) return false;
      tell(
        "Schatzänderung gespeichert. Bereits vergebene Beute bleibt im Ledger.",
      );
      return true;
    } catch (e) {
      if (current()) {
        const message=(e as Error).message;
        if(!confirmed)failed?.(message);
        tell((confirmed ? "Schatzänderung gespeichert. Anzeige konnte nicht aktualisiert werden: " : "") + message, true);
      }
      return confirmed && current();
    } finally {
      if (pending === task) pending = null;
      lock();
    }
  });
  pending = task;
  lock();
  return task;
}
function lock() {
  const blocked = !!pending || (!!w && hasPendingCommit(w.campaign.id));
  for (const e of el("treasury").querySelectorAll<
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLButtonElement
    | HTMLTextAreaElement
  >("button,input,select,textarea"))
    e.disabled = blocked;
  for(const id of ['treasury-move-form','treasury-allocate-form']){const b=el(id).querySelector<HTMLButtonElement>('button');if(b)b.disabled=blocked||dirty||!book?.items.some(i=>i.quantity>i.allocated);}
}
async function apply() {
  if (!w || !book || !draft) return false;
  const current = editorOwner(), n = version, d = snapshot();
  if (!(await keep()) || !current() || version !== n) return false;
  if (d.revision !== book.revision)
    throw new Error("Schatzentwurf und bestätigten Stand zuerst abgleichen.");
  const items = d.items.map((i) => {
    if (!/^[0-9]+$/.test(i.quantity))
      throw new Error("Unverteilte Mengen vervollständigen.");
    return {
      lotId: i.lotId ?? null,
      item: { ...i, quantity: Number(i.quantity) },
    };
  });
  return execute({
    kind: "treasure-edit",
    treasureId: book.id,
    expectedRevision: d.revision,
    title: d.title,
    locationId: d.locationId,
    items,
    reason: d.reason,
    draftWriteId: writeId ?? undefined,
  });
}
async function reload() {
  if (!w || !book) return;
  const current = editorOwner(), token = w.token, id = book.id;
  if (!(await keep()) || !current()) return;
  const n = version;
  if (writeId) unwrap(await window.campaign.discardTreasuryDraft(token, id, writeId));
  if (!current()) return;
  writeId = null;
  savedVersion = -1;
  if (version !== n) { await keep(); return; }
  dirty = false;
  draft = null;
  await select(id);
}
async function history(more: boolean) {
  if (!w || !book) return;
  const token = w.token,
    id = book.id, current = editorOwner();
  const h = unwrap(
    await window.campaign.treasureHistory(
      token,
      id,
      more ? historyCursor : null,
    ),
  );
  if (!current() || w?.token !== token || book?.id !== id) return;
  const root = el("treasury-history");
  if (!more) root.replaceChildren();
  for (const entry of h.items) {
    const p = document.createElement("details"),
      s = document.createElement("summary");
    s.textContent =
      (
        {
          "treasure-created": "Schatz angelegt",
          "treasure-edited": "Unverteilte Beute geändert",
          "treasure-moved": "Beute verschoben",
          "treasure-anchored":"Ganzer Schatz neu zugeordnet",
          "loot-award": "Beute vergeben",
        } as Record<string, string>
      )[entry.kind] ?? entry.kind;
    s.textContent +=
      " · " + String(entry.facts.reason ?? entry.facts.recordedAt ?? "");
    const text = document.createElement("pre");
    p.append(s, text);
    p.ontoggle = () => {
      if (p.open && !text.textContent)
        text.textContent = JSON.stringify(entry.facts, null, 2);
    };
    root.append(p);
  }
  historyCursor = h.next;
  el("treasury-history-more").hidden = !h.next;
}
async function findCatalog() {
  const current = editorOwner();
  catalogResults = null;
  el('treasury-catalog-results').textContent='Gegenstände werden gesucht…';
  const q = {
    search: value("treasury-catalog-search"),
    category: "",
    magic: "" as const,
    rarity: "",
    attunement: "",
    sort: "name" as const,
    direction: "asc" as const,
    after: 0,
    includeTrashed: false,
  };
  let response;
  try{response=await window.campaign.itemDefinitions(q);}
  catch(error){
    if(!current()||q.search!==value('treasury-catalog-search'))return;
    el('treasury-catalog-results').textContent='Suche fehlgeschlagen. Bitte erneut suchen.';
    throw error;
  }
  if (!current() || q.search !== value("treasury-catalog-search")) return;
  if(!response.ok)el('treasury-catalog-results').textContent='Suche fehlgeschlagen: '+response.error;
  const p = unwrap(response);
  catalogResults = {search:q.search,items:p.items};
  drawCatalogResults();
}
function drawCatalogResults() {
  const current = editorOwner();
  el("treasury-catalog-results").replaceChildren();
  if(!catalogResults || catalogResults.search !== value('treasury-catalog-search')) {
    el('treasury-catalog-results').textContent='Suche mit Enter oder „Suchen“ starten.';
    return;
  }
  if(!catalogResults.items.length)el('treasury-catalog-results').textContent='Keine passenden Gegenstände gefunden.';
  for (const d of catalogResults.items) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = d.name + (d.unitCopper === null ? " · Wert offen" : "");
    b.disabled = !!pending || (!!w && hasPendingCommit(w.campaign.id));
    b.onclick = () => { if (current()) addDefinition(d); };
    el("treasury-catalog-results").append(b);
  }
}
function addDefinition(d: ItemDefinition) {
  if (!draft) return;
  draft.items.push({
    name: d.name,
    category: d.category,
    quantity: "1",
    valueGold: goldText(d.unitCopper),
    reference: { kind: "authored", definitionId: d.id, revision: d.revision },
  });
  rewardItemsEditor(el("treasury-rows"), draft.items, mark, true, true);
  mark();
}
export function initTreasury(
  status: typeof tell,
  changed: () => Promise<void>,
  navigate: typeof enter,
  openLoot?: (token:string,id:string)=>Promise<void>,
) {
  tell = status;
  after = changed;
  enter = navigate;
  if (ready) return;
  ready = true;
  distribution=new TreasureDistribution(status,()=>w,async()=>{if(!await flushTreasury())return false;if(dirty){tell("Schatzangaben zuerst übernehmen oder verwerfen.",true);return false;}return true;},execute,openLoot);
  const batch=document.createElement("button");batch.id="treasury-distribute";batch.type="button";batch.textContent="Beute gemeinsam verteilen…";el("treasury-apply").after(batch);batch.onclick=()=>run(()=>distribution.open(book?.id));
  onCommitState(lock);
  onCommitResolved((event) => {
    const meta = event.meta as { owner?: string; token?: string; generation?: number; editing?: number } | undefined;
    if (
      meta?.owner === "treasury" &&
      w && meta.token === w.token && meta.generation === generation && meta.editing === editing &&
      event.ref.campaignId === w.campaign.id
    ) {
      dirty = false;
      draft = null;
      writeId = null;
      run(() => openTreasury());
    }
  });
  el("treasury-new").onclick = () =>
    run(async () => {
      const current = editorOwner();
      if (!(await flushTreasury()) || !current() || pending || !w || hasPendingCommit(w.campaign.id)) return;
      editing++; // Revoke reads and timers belonging to the previous treasure editor.
      await execute({
        kind: "treasure-create",
        title: "Neuer Schatz",
        locationId: null,
      });
    });
  el<HTMLFormElement>('treasury-filter-form').onsubmit=e=>{e.preventDefault();run(async()=>{if(!await flushTreasury())return;const selected=value('treasury-filter-anchor'),parts=selected.split(':');listQuery={search:value('treasury-filter-search'),anchor:parts[0] as TreasureQuery['anchor'],...(parts[1]?{anchorId:parts.slice(1).join(':')}:{}),remainingOnly:el<HTMLInputElement>('treasury-filter-remaining').checked};await openTreasury();});};
  el('treasury-anchor-apply').onclick=()=>run(async()=>{if(!book||!await flushTreasury())return;if(dirty)throw new Error('Schatzangaben zuerst übernehmen oder verwerfen.');const target=value('treasury-anchor-target'),reason=value('treasury-anchor-reason').trim();if(!reason)throw new Error('Neue Zuordnung begründen.');const [kind,...ids]=target.split(':');if(!['scene','location','unplaced'].includes(kind!))throw new Error('Zielzuordnung auswählen.');await execute({kind:'treasure-anchor',treasureId:book.id,expectedRevision:book.revision,anchor:kind==='unplaced'?{kind:'unplaced'}:{kind:kind as 'scene'|'location',id:ids.join(':')},reason});});
  el("treasury-refresh").onclick = () => run(() => openTreasury());
  el("treasury-more").onclick = () =>
    run(async () => {
      if (!w || !list.next) return;
      const current = editorOwner(), token = w.token, cursor = list.next;
      const response = await readList(token,cursor);
      if (!current() || cursor !== list.next) return;
      if(!response)return;const p=response;
      list = {
        items: [
          ...new Map(
            [...list.items, ...p.items].map((i) => [i.id, i]),
          ).values(),
        ],
        next: p.next,
      };
      drawList();
    });
  for (const id of ["treasury-title", "treasury-place", "treasury-reason"])
    el(id).oninput = mark;
  el("treasury-apply").onclick = () => run(apply);
  el("treasury-reload").onclick = () => run(reload);
  el("treasury-history-more").onclick = () => run(() => history(true));
  el("treasury-catalog-form").onsubmit = (e) => {
    e.preventDefault();
    run(findCatalog);
  };
  el('treasury-catalog-search').oninput=()=>{catalogResults=null;drawCatalogResults();};
  el("treasury-move-form").onsubmit = (e) => {
    e.preventDefault();
    run(async () => {
      const current = editorOwner();
      if (!book || !(await flushTreasury()) || !current()) return;
      if (dirty) throw new Error('Schatzangaben zuerst übernehmen; danach die aktuelle Teilmenge auswählen.');
      const id = value("treasury-target"),
        target = list.items.find((t) => t.id === id);
      await execute({
        kind: "treasure-move",
        treasureId: book.id,
        expectedRevision: book.revision,
        itemId: value("treasury-move-item"),
        quantity: Number(value("treasury-move-quantity")),
        target: target
          ? { id: target.id, expectedRevision: target.revision }
          : {
              title: value("treasury-target-title"),
              locationId: value("treasury-target-place") || null,
            },
        reason: value("treasury-move-reason"),
      });
    });
  };
  el("treasury-allocate-form").onsubmit = (e) => {
    e.preventDefault();
    run(async () => {
      const current = editorOwner();
      if (!w || !book || !(await flushTreasury()) || !current()) return;
      if (dirty) throw new Error('Schatzangaben zuerst übernehmen; danach die aktuelle Teilmenge auswählen.');
      const item = book.items.find((i) => i.id === value("treasury-move-item")),
        person = people?.characters.find(
          (p) => p.characterId === value("treasury-recipient"),
        );
      if (!item?.currentDefinition || !person)
        throw new Error("Verfügbaren Gegenstand und aktive Figur auswählen.");
      await execute({
        kind: "allocate",
        treasureId: book.id,
        expectedRevision: book.revision,
        expectedDefinitionRevision: item.currentDefinition.revision,
        itemId: item.id,
        quantity: Number(value("treasury-allocate-quantity")),
        characterId: person.characterId,
        expectedMembershipRevision: person.membershipRevision,
      });
    });
  };
  el("treasury-open").onclick = () => run(() => enter(book?.id));
}

export async function openTreasureDistribution(id?:string,sceneId?:string,current:()=>boolean=()=>true){await distribution?.open(id,sceneId,current);}
export function closeStaleTreasureDistribution(){distribution?.closeStale();}
