import {finishDraftCommit,finishDraftConsumed} from './finish-draft-ui';
import type { Workspace } from "./contracts";
import type { WorldNoteV1 } from "../features/world/world-notes";
import type { NarrativeView, NarrativeDraft } from "./narrative-contracts";
import type { ProgressView, ProgressAction } from "./progression";
import { copper } from "./progression";
import {
  prepareFinish,
  finishRewards,
  refreshProgress,
} from "./progression-ui";
import { rewardItemsEditor } from "./reward-items-ui";
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let request = 0,
  ownerKey = "",
  data: NarrativeView | null = null,
  progress: ProgressView | null = null,
  places: { id: string; name: string }[] = [],
  pending = false,
  dirty = false;
let saveHook: (() => Promise<boolean>) | null = null,
  task: Promise<boolean> | null = null;
let readyHook: (() => boolean) | null = null;
let draftVersion = 0,
  persistHook: (() => Promise<boolean>) | null = null,
  timer: ReturnType<typeof setTimeout> | null = null;
let displayedNoteRevision:number|null=null;
let resumeOwner:(()=>Promise<void>)|null=null;
export function captureNarrativeOwner(){return resumeOwner;}
function markDirty() {
  dirty = true;
  draftVersion++;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void persistHook?.(), 250);
}
export async function flushNarrative() {
  if (persistHook && !(await persistHook())) return false;
  if (task) {
    if (!(await task)) return false;
    return flushNarrative();
  }
  if (dirty && saveHook) {
    if (readyHook && !readyHook()) return true;
    if (!(await saveHook())) return false;
    return flushNarrative();
  }
  return true;
}
export async function showNarrative(
  w: Workspace | null,
  note: WorldNoteV1 | null,
  trashed: boolean,
  drain: () => Promise<boolean>,
  tell: (s: string, error?: boolean) => void,
  targetPanel?:HTMLElement,
  onSaved?:()=>void,
  initialLocationId?:string,
) {
  const panel = targetPanel??el("narrative-editor"),
    key = w && note ? panel.id+":"+w.token + ":" + note.id : "";
  panel.hidden =
    !w || !note || trashed || !["quest", "rumor"].includes(note.kind);
  if (!panel.hidden && key === ownerKey && (dirty || pending)) {
    if(pending||note!.revision===displayedNoteRevision)return;
    const prior=request;
    if(persistHook&&!await persistHook())return;
    if(ownerKey!==key||request!==prior)return;
  }
  resumeOwner=panel.hidden?null:()=>showNarrative(w,note,trashed,drain,tell,panel,onSaved);
  const n = ++request;
  if (panel.hidden) {
    ownerKey = "";
    displayedNoteRevision = null;
    data = null;
    dirty = false;
    saveHook = null;
    persistHook = null;
    readyHook = null;
    if (timer) clearTimeout(timer);
    return;
  }
  ownerKey = key;
  displayedNoteRevision = note!.revision;
  data = null;
  dirty = false;
  saveHook = null;
  persistHook = null;
  readyHook = null;
  if (timer) clearTimeout(timer);
  timer = null;
  const loading = document.createElement("p");
  loading.setAttribute("role", "status");
  loading.textContent = "Narrative Angaben werden geladen…";
  panel.replaceChildren(loading);
  panel.setAttribute("aria-busy", "true");
  let renderVersion = 0;
  let writeId: string | null = null,
    raw: NarrativeDraft | null = null,
    persisting: Promise<boolean> | null = null,
    savedVersion = draftVersion;
  function persist(): Promise<boolean> {
    if (persisting) return persisting;
    const run = (async () => {
      if (!dirty || savedVersion === draftVersion || !raw || !current())
        return true;
      const version = draftVersion,
        d = { ...structuredClone(raw), writeId: crypto.randomUUID() };
      try {
        const r = await window.campaign.keepNarrativeDraft(
          w!.token,
          d,
          writeId,
        );
        if (!r.ok) throw new Error(r.error);
        writeId = d.writeId;
        savedVersion = version;
        if (current()) data!.draft = d;
        if (current())
          draftStatus.textContent =
            "Eingabe gesichert · auch unvollständige Felder bleiben beim Neustart erhalten.";
        return true;
      } catch (e) {
        tell((e as Error).message, true);
        return false;
      }
    })();
    persisting = run;
    return run.then(async (ok) => {
      persisting = null;
      return ok && current() && savedVersion !== draftVersion ? persist() : ok;
    });
  }
  const draftStatus = document.createElement("p");
  persistHook = persist;
  const current = () => ownerKey === key && request === n;
  try {
    const r = await window.campaign.narrative(w!.token, note!.id),
      p = await window.campaign.progress(w!.token),
      refs = await window.campaign.ledgerParties(w!.token);
    if (!current()) return;
    if (!r.ok) throw new Error(r.error);
    if (!p.ok) throw new Error(p.error);
    if (!refs.ok) throw new Error(refs.error);
    places = refs.value.filter((p) => p.kind === "location");
    data = r.value;
    progress = p.value;
    dirty = !!data.draft;
    draw();
    if(initialLocationId&&data.state.revision===0&&!data.draft){
      if(!places.some(p=>p.id===initialLocationId))throw new Error('Ort für neuen Auftrag nicht verfügbar.');
      const place=panel.querySelector<HTMLSelectElement>('select[aria-label="Quest-Ort"]')!;place.value=initialLocationId;place.dispatchEvent(new Event('change',{bubbles:true}));
    }
  } catch (e) {
    if (current()) {
      data = null;
      saveHook = null;
      persistHook = null;
      readyHook = null;
      panel.setAttribute("aria-busy", "false");
      const error = document.createElement("p");
      error.setAttribute("role", "alert");
      error.textContent =
        "Narrative Angaben konnten nicht geladen werden: " + (e as Error).message;
      panel.replaceChildren(error);
      tell((e as Error).message, true);
    }
  }
  function execute(action: ProgressAction): Promise<boolean> {
    if (task) return task;
    const run = writeAction(structuredClone(action));
    task = run;
    void run.finally(() => {
      if (task === run) task = null;
    });
    return run;
  }
  async function writeAction(action: ProgressAction) {
    if (!current()) return false;
    const version = draftVersion;
    if (persistHook && !(await persistHook())) return false;
    if (action.kind === "narrative-state" || action.kind === "narrative-award")
      action.draftWriteId = writeId ?? undefined;
    if (!current() || pending || !(await drain()) || !current()) return false;
    pending = true;
    try {
      if (
        action.kind === "narrative-state" ||
        action.kind === "narrative-award"
      ) {
        const fresh = await window.campaign.narrative(w!.token, note!.id);
        if (!current()) return false;
        if (!fresh.ok) throw new Error(fresh.error);
        if(fresh.value.noteRevision!==action.expectedNoteRevision)throw new Error('Narrative Notiz wurde inzwischen geändert. Notiz und gesicherten Entwurf erneut prüfen.');
      }
      if(draftVersion!==version){if(persistHook&&!await persistHook())return false;if(!current())return false;throw new Error('Eingabe während der Prüfung geändert. Der neuere Entwurf ist gesichert; erneut bestätigen.');}
      const r = await window.campaign.executeProgress({
        commandId: crypto.randomUUID(),
        token: w!.token,
        campaignId: w!.campaign.id,
        action,
      });
      if (!current()) return false;
      if (!r.ok) throw new Error(r.error);
      const fresh = await window.campaign.narrative(w!.token, note!.id);
      if (!current()) return false;
      if (!fresh.ok) throw new Error(fresh.error);
      data = fresh.value;
      writeId = data.draft?.writeId ?? null;
      progress = r.value;
      if (version === draftVersion) {
        dirty = false;
        draw();
      } else {
        dirty = true;
        if (raw && (action.kind === "narrative-state" || action.kind === "narrative-award")) raw.revision = action.expectedRevision + 1;
        savedVersion = -1;
        void persist();
      }
      tell("Quest-/Gerüchtstatus und Belohnung gespeichert.");onSaved?.();
      return true;
    } catch (e) {
      if (current()) tell((e as Error).message, true);
      return false;
    } finally {
      pending = false;
    }
  }
  function draw() {
    if (!data || !progress) return;
    const rendered = ++renderVersion, active = () => current() && rendered === renderVersion;
    panel.setAttribute("aria-busy", "false");
    const d = data,
      s: NarrativeDraft = structuredClone(
        d.draft ?? {
          ...d.state,
          noteRevision: note!.revision,
          locationId: d.state.locationId ?? null,
          writeId: crypto.randomUUID(),
          poolXp: String(d.state.poolXp),
          items: d.state.items.map((i) => ({
            ...i,
            quantity: String(i.quantity),
          })),
        },
      );
    raw = s;
    writeId = d.draft?.writeId ?? null;
    savedVersion = draftVersion;
    draftStatus.textContent = d.draft
      ? "Gesicherte Eingabe wieder geöffnet."
      : "Änderungen werden als Eingabe automatisch gesichert.";
    const stale = s.revision !== d.state.revision || s.noteRevision !== d.noteRevision;
    const displayed = note!.revision === d.noteRevision;
    if (stale)
      draftStatus.textContent =
        displayed?"Gesicherte Eingabe und aktuelle Notiz-/Statusbasis unterscheiden sich oder die frühere Basis fehlt. Vor Übernahme den Entwurf prüfen.":"Notiz seit dem Öffnen geändert. Welttext aktualisieren und den gesicherten Entwurf erneut prüfen.";
    panel.replaceChildren();
    const heading = document.createElement("h3"),
      status = document.createElement("select"),
      pool = document.createElement("input"),
      contributors = document.createElement("fieldset"),
      legend = document.createElement("legend"),
      items = document.createElement("div"),
      save = document.createElement("button"),
      resolve = document.createElement("button");
    const place = document.createElement("select"),
      placeLabel = document.createElement("label");
    placeLabel.textContent = "Zugehöriger Ort";
    place.setAttribute("aria-label", "Quest-Ort");
    for (const p of [{ id: "", name: "Ohne Ortsbindung" }, ...places]) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name;
      place.append(o);
    }
    place.value = s.locationId ?? "";
    place.onchange = () => {
      if (!active()) return;
      s.locationId = place.value || null;
      markDirty();
    };
    placeLabel.append(place);
    heading.textContent = "Narrativer Status und Belohnung";
    for (const [id, label] of [
      ["open", "Offen"],
      ["closed", "Geschlossen"],
    ]) {
      const o = document.createElement("option");
      o.value = id!;
      o.textContent = label!;
      status.append(o);
    }
    status.value = s.status;
    status.setAttribute("aria-label", "Narrativer Status");
    status.onchange = () => {
      if (!active()) return;
      s.status = status.value as "open" | "closed";
      markDirty();
    };
    pool.type = "text";
    pool.inputMode = "numeric";
    pool.value = s.poolXp;
    pool.setAttribute("aria-label", "Quest-XP-Pool");
    pool.oninput = () => {
      if (!active()) return;
      s.poolXp = pool.value;
      markDirty();
    };
    legend.textContent = "Mitwirkende · Standardempfänger für XP";
    contributors.append(legend);
    for (const c of progress.characters) {
      const label = document.createElement("label"),
        box = document.createElement("input");
      box.type = "checkbox";
      box.checked = s.contributors.includes(c.characterId);
      box.value = c.characterId;
      label.className = "check-label";
      label.append(box, c.name + (c.active ? "" : " · inaktiv"));
      box.onchange = () => {
        if (!active()) return;
        s.contributors = Array.from(
          contributors.querySelectorAll<HTMLInputElement>("input:checked"),
        ).map((b) => b.value);
        markDirty();
      };
      contributors.append(label);
    }
    rewardItemsEditor(items, s.items, () => {if (active()) markDirty();}, true);
    readyHook = () => {
      try {
        if (
          stale ||
          !/^[0-9]+$/.test(s.poolXp) ||
          !Number.isSafeInteger(Number(s.poolXp)) ||
          s.items.some(
            (i) =>
              !i.name.trim() ||
              !/^([1-9][0-9]*)$/.test(i.quantity) ||
              !Number.isSafeInteger(Number(i.quantity)) ||
              Number(i.quantity) > 1000000,
          )
        )
          return false;
        for (const i of s.items) copper(i.valueGold);
        return true;
      } catch {
        return false;
      }
    };
    save.textContent = "Narrative Angaben speichern";
    saveHook = async () => {
      if (!active()) return false;
      try {
        if (
          !/^[0-9]+$/.test(s.poolXp) ||
          s.items.some(
            (i) => !i.name.trim() || !/^([1-9][0-9]*)$/.test(i.quantity),
          )
        )
          throw new Error(
            "Eingabe ist gesichert. Für die Übernahme XP, Namen und Mengen vervollständigen.",
          );
        if (stale)
          throw new Error(
            "Entwurf zuerst auf den aktuellen Stand übernehmen oder verwerfen.",
          );
        return await execute({
          kind: "narrative-state",
          state: {
            ...data!.state,
            status: s.status,
            locationId: s.locationId,
            contributors: s.contributors,
            poolXp: Number(s.poolXp),
            items: s.items.map((i) => ({ ...i, quantity: Number(i.quantity) })),
          },
          expectedRevision: s.revision,
          expectedNoteRevision: s.noteRevision!,
        });
      } catch (e) {
        tell((e as Error).message, true);
        return false;
      }
    };
    const saveCurrent = saveHook;
    save.onclick = () => {if (active()) void saveCurrent();};
    resolve.textContent = d.award
      ? "Belohnung bereits vergeben"
      : "Manuell abschließen und Belohnung verteilen…";
    resolve.disabled = !!d.award || stale;
    resolve.onclick = () => {
      void (async () => {
        if (stale || !active() || !(await flushNarrative()) || !active()) return;
        if (dirty) {
          tell(
            "Eingabe gesichert. Vor Abschluss die Belohnungsfelder vervollständigen und übernehmen.",
            true,
          );
          return;
        }
        if (!current() || !data || !(await drain()) || !current()) return;
        const basis = data;
        await prepareFinish(basis.state.contributors, undefined, {
          workspace: w!,
          owner:{kind:'narrative',targetId:note!.id,revision:basis.state.revision,noteRevision:basis.noteRevision},
          poolXp: basis.state.poolXp,
          items: basis.state.items,
        });
        if (!current()) return;
        const dialog = el<HTMLDialogElement>("combat-finish-dialog"),
          form = el<HTMLFormElement>("combat-finish-form"),
          oldSubmit = form.onsubmit,
          title = dialog.querySelector("h2")!,
          previousTitle = title.textContent;
        title.textContent = note!.title + " · Belohnung verteilen";
        const load = el<HTMLInputElement>("finish-load"),
          combatFields = [
            load.previousElementSibling,
            load,
            load.nextElementSibling,
          ].filter((e): e is HTMLElement => e instanceof HTMLElement),
          hidden = combatFields.map((e) => e.hidden),
          legend = dialog.querySelector("fieldset legend")!,
          oldLegend = legend.textContent,
          message = dialog.querySelector("form > p")!,
          oldMessage = message.textContent;
        for (const e of combatFields) e.hidden = true;
        legend.textContent = "XP";
        message.textContent =
          "Manuelles Ergebnis, XP und Beute werden gemeinsam gespeichert. Gegenstände anschließend ausdrücklich zuweisen.";

        const submit = (event:SubmitEvent) => {
          event.preventDefault();
          if (!current() || !dialog.open || form.onsubmit !== submit) return;
          void (async () => {
            try{const draft=await finishDraftCommit();if(!current()||!dialog.open||form.onsubmit!==submit)return;const rewards = finishRewards();
            if (
              await execute({
                kind: "narrative-award",
                noteId: note!.id,
                expectedRevision: draft.revision,
                finishDraftWriteId:draft.writeId,
                expectedNoteRevision: draft.noteRevision!,
                sceneId: null,
                poolXp: rewards.poolXp,
                noXp: rewards.noXp,
                recipients: rewards.recipients,
                items: rewards.items,
                outcome: el<HTMLTextAreaElement>("combat-outcome").value,
              })
            ) {
              finishDraftConsumed();dialog.close();
              await refreshProgress();
            }}catch(e){tell((e as Error).message,true);}
          })();
        };
        form.onsubmit = submit;
        dialog.addEventListener(
          "close",
          () => {
            form.onsubmit = oldSubmit;
            title.textContent = previousTitle;
            combatFields.forEach((e, i) => (e.hidden = hidden[i]!));
            legend.textContent = oldLegend;
            message.textContent = oldMessage;
          },
          { once: true },
        );
        dialog.showModal();
      })().catch((e) => tell((e as Error).message, true));
    };
    panel.append(
      heading,
      draftStatus,
      status,
      placeLabel,
      pool,
      contributors,
      items,
      save,
      resolve,
    );
    const discard = document.createElement("button");
    discard.textContent = "Eingabe verwerfen";
    discard.onclick = () =>
      void (async () => {
        if (!active() || !(await persist()) || !active()) return;
        if (writeId) {
          const r = await window.campaign.discardNarrativeDraft(
            w!.token,
            note!.id,
            writeId,
          );
          if (!active()) return;
          if (!r.ok) {
            tell(r.error, true);
            return;
          }
        }
        data!.draft = null;
        dirty = false;
        draw();
      })();
    panel.append(discard);
    if (stale) {
      const adopt = document.createElement("button");
      adopt.textContent = "Geprüften Entwurf auf aktuellen Stand übernehmen";
      adopt.disabled = !displayed;
      adopt.onclick = () => {
        void (async () => {
          if (!displayed || !active() || !await persist() || !active()) return;
          data!.draft = { ...s, writeId: writeId!, revision: data!.state.revision, noteRevision:note!.revision };
          draw();
          markDirty();
        })();
      };
      panel.append(adopt);
    }
    if (d.award) {
      const receipt = document.createElement("p");
      receipt.textContent =
        d.award.outcome +
        " · " +
        d.award.shareXp +
        " XP je Empfänger · " +
        (d.award.treasureId
          ? "Beute liegt zur ausdrücklichen Zuweisung bereit."
          : "Keine Gegenstandsbelohnung.");
      panel.append(receipt);
    }
  }
}
