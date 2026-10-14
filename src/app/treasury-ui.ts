import {TreasureDistribution} from "./treasure-distribution-ui";
import type { ItemDefinition } from "./items-contracts";
import type { Workspace, Result } from "./contracts";
import type {
  Treasure,
  TreasurePage,
  ProgressView,
  ProgressAction,
  ProgressAck,
  ProgressCommand,
} from "./progression";
import type { TreasuryDraft } from "./treasury-contracts";
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
let w: Workspace | null = null,
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
  reading = 0;
let pending: Promise<boolean> | null = null,
  keeping: Promise<boolean> | null = null,
  timer: ReturnType<typeof setTimeout> | null = null,
  historyCursor: string | null = null;
let tell: (s: string, error?: boolean) => void,
  after: () => Promise<void>,
  enter: (id?: string) => Promise<void>,
  ready = false;
function run(fn: () => Promise<unknown>) {
  void fn().catch((e) => tell(e.message, true));
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
  timer = setTimeout(() => void keep(), 250);
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
export function activateTreasury(next: Workspace | null) {
  distribution?.reset();w = next;
  generation++;
  reading++;
  book = null;
  draft = null;
  writeId = null;
  dirty = false;
  pending = null;
  list = { items: [], next: null };
  if (timer) clearTimeout(timer);
  el("treasury-editor").hidden = true;
  el("treasury-list").replaceChildren();
}
export async function openTreasury(id?: string) {
  if (!w) return;
  if (!(await flushTreasury())) return;
  const token = w.token,
    g = generation;
  const r = unwrap(await window.campaign.treasures(token, null)),
    p = unwrap(await window.campaign.progress(token)),
    refs = unwrap(await window.campaign.ledgerParties(token));
  if (w?.token !== token || g !== generation) return;
  list = r;
  people = p;
  places = refs.filter((r) => r.kind === "location");
  drawList();
  const target = id ?? book?.id ?? r.items[0]?.id;
  if (target) await select(target);
}
async function select(id: string) {
  if (!w || !(await flushTreasury())) return;
  const token = w.token,
    g = generation,
    r = ++reading;
  const [t, d] = await Promise.all([
    window.campaign.treasure(token, id),
    window.campaign.treasuryDraft(token, id),
  ]);
  if (w?.token !== token || g !== generation || r !== reading) return;
  book = unwrap(t);
  draft = unwrap(d);
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
    b.textContent = t.title + " · " + t.available + " unverteilte Einheiten";
    b.setAttribute("aria-pressed", String(t.id === book?.id));
    b.onclick = () => run(() => select(t.id));
    root.append(b);
  }
  el("treasury-more").hidden = !list.next;
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
  rewardItemsEditor(el("treasury-rows"), draft.items, mark, true);
  const allocated = book.items.filter((i) => i.allocated > 0);
  el("treasury-allocated").textContent =
    allocated
      .map((i) => i.allocated + " × " + i.name + " bereits vergeben")
      .join("\n") || "Noch nichts vergeben.";
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
  lock();
}
async function keep(): Promise<boolean> {
  if (keeping) {
    if (!(await keeping)) return false;
    return dirty && savedVersion !== version ? keep() : true;
  }
  if (!dirty || !draft || !w || savedVersion === version) return true;
  const token = w.token,
    n = version,
    d = snapshot();
  d.writeId = crypto.randomUUID();
  const task = (async () => {
    try {
      unwrap(await window.campaign.keepTreasuryDraft(token, d, writeId));
      writeId = d.writeId;
      savedVersion = n;
      el("treasury-draft-status").textContent =
        "Schatzeingabe gesichert · noch nicht übernommen.";
      return true;
    } catch (e) {
      tell((e as Error).message, true);
      return false;
    }
  })();
  keeping = task;
  const ok = await task;
  keeping = null;
  return ok && savedVersion !== version ? keep() : ok;
}
export async function flushTreasury() {
  if (pending && !(await pending)) return false;
  if (timer) clearTimeout(timer);
  return (await keep()) && (!w || !hasPendingCommit(w.campaign.id));
}
async function execute(action: ProgressAction) {
  if (!w || pending || hasPendingCommit(w.campaign.id)) return false;
  const token = w.token,
    g = generation,
    command: ProgressCommand = {
      commandId: crypto.randomUUID(),
      token,
      campaignId: w.campaign.id,
      action: structuredClone(action),
    };
  const task = Promise.resolve().then(async () => {
    try {
      const ack = await writeConfirmed<ProgressAck>(
        "progress",
        command,
        () => window.campaign.executeProgress(command),
        () => w?.token === token && generation === g,
        { owner: "treasury", action: command.action },
      );
      if (w?.token !== token || generation !== g) return false;
      dirty = false;
      draft = null;
      writeId = null;
      await after();
      const r = unwrap(await window.campaign.treasures(token, null));
      list = r;
      people = ack;
      drawList();
      if (ack.treasureId) {
        const t = unwrap(await window.campaign.treasure(token, ack.treasureId));
        book = t;
        draw();
        await history(false);
      } else if (book) {
        book = unwrap(await window.campaign.treasure(token, book.id));
        draw();
        await history(false);
      }
      tell(
        "Schatzänderung gespeichert. Bereits vergebene Beute bleibt im Ledger.",
      );
      return true;
    } catch (e) {
      tell((e as Error).message, true);
      return false;
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
  if (!w || !book || !draft || !(await keep())) return false;
  const d = snapshot();
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
  if (!w || !book || !(await keep())) return;
  if (writeId)
    unwrap(
      await window.campaign.discardTreasuryDraft(w.token, book.id, writeId),
    );
  dirty = false;
  draft = null;
  writeId = null;
  await select(book.id);
}
async function history(more: boolean) {
  if (!w || !book) return;
  const token = w.token,
    id = book.id;
  const h = unwrap(
    await window.campaign.treasureHistory(
      token,
      id,
      more ? historyCursor : null,
    ),
  );
  if (w?.token !== token || book?.id !== id) return;
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
  const p = unwrap(await window.campaign.itemDefinitions(q));
  el("treasury-catalog-results").replaceChildren();
  for (const d of p.items) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = d.name + (d.unitCopper === null ? " · Wert offen" : "");
    b.onclick = () => addDefinition(d);
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
  rewardItemsEditor(el("treasury-rows"), draft.items, mark, true);
  mark();
}
export function initTreasury(
  status: typeof tell,
  changed: () => Promise<void>,
  navigate: typeof enter,
) {
  tell = status;
  after = changed;
  enter = navigate;
  if (ready) return;
  ready = true;
  distribution=new TreasureDistribution(status,()=>w,async()=>{if(!await flushTreasury())return false;if(dirty){tell("Schatzangaben zuerst übernehmen oder verwerfen.",true);return false;}return true;},execute);
  const batch=document.createElement("button");batch.id="treasury-distribute";batch.type="button";batch.textContent="Beute gemeinsam verteilen…";el("treasury-allocate-form").after(batch);batch.onclick=()=>run(()=>distribution.open(book?.id));
  onCommitState(lock);
  onCommitResolved((event) => {
    const meta = event.meta as { owner?: string } | undefined;
    if (
      meta?.owner === "treasury" &&
      w &&
      event.ref.campaignId === w.campaign.id
    ) {
      dirty = false;
      draft = null;
      writeId = null;
      run(() => openTreasury());
    }
  });
  el("treasury-new").onclick = () =>
    run(() =>
      execute({
        kind: "treasure-create",
        title: "Neuer Schatz",
        locationId: null,
      }),
    );
  el("treasury-refresh").onclick = () => run(() => openTreasury());
  el("treasury-more").onclick = () =>
    run(async () => {
      if (!w || !list.next) return;
      const p = unwrap(await window.campaign.treasures(w.token, list.next));
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
  el("treasury-move-form").onsubmit = (e) => {
    e.preventDefault();
    run(async () => {
      if (!book || !(await flushTreasury())) return;
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
      if (!w || !book || !(await flushTreasury())) return;
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

export async function openTreasureDistribution(id?:string,sceneId?:string){await distribution?.open(id,sceneId);}
