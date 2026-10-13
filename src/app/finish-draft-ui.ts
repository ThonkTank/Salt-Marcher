import type { Workspace } from "./contracts";
import type {
  FinishDraft,
  FinishOwner,
  RewardItemDraft,
} from "./finish-draft-contracts";
const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
type Values = Pick<
  FinishDraft,
  | "outcome"
  | "poolXp"
  | "loadXp"
  | "noXp"
  | "hasLoot"
  | "recipientIds"
  | "items"
>;
type Session = {
  w: Workspace;
  owner: FinishOwner;
  draft: FinishDraft | null;
  defaults: Values;
  readItems: () => RewardItemDraft[];
  restoreItems: (items: RewardItemDraft[]) => void;
  preview: () => void;
  version: number;
  saved: number;
  pending: Promise<boolean> | null;
  error: string | null;
};
let active: Session | null = null,
  timer: ReturnType<typeof setTimeout> | null = null,
  initialized = false;
function snapshot(s: Session): Values {
  return {
    outcome: get<HTMLTextAreaElement>("combat-outcome").value,
    poolXp: get<HTMLInputElement>("finish-xp").value,
    loadXp: get<HTMLInputElement>("finish-load").value,
    noXp: get<HTMLInputElement>("finish-no-xp").checked,
    hasLoot: get<HTMLInputElement>("finish-has-loot").checked,
    recipientIds: [
      ...get("finish-recipients").querySelectorAll<HTMLInputElement>(
        "input:checked",
      ),
    ].map((b) => b.value),
    items: structuredClone(s.readItems()),
  };
}
function restore(s: Session, v: Values) {
  get<HTMLTextAreaElement>("combat-outcome").value = v.outcome;
  get<HTMLInputElement>("finish-xp").value = v.poolXp;
  get<HTMLInputElement>("finish-load").value = v.loadXp;
  get<HTMLInputElement>("finish-no-xp").checked = v.noXp;
  get<HTMLInputElement>("finish-has-loot").checked = v.hasLoot;
  for (const box of get("finish-recipients").querySelectorAll<HTMLInputElement>(
    "input",
  ))
    box.checked = v.recipientIds.includes(box.value);
  s.restoreItems(structuredClone(v.items));
  s.preview();
}
function status(s: Session, text?: string) {
  if (active !== s) return;
  get("finish-draft-status").textContent =
    text ??
    s.error ??
    (s.draft && s.draft.revision !== s.owner.revision
      ? "Der Kampf-/Queststand hat sich geändert. Eingabe prüfen und ausdrücklich auf den aktuellen Stand übernehmen."
      : s.draft
        ? "Gesicherte Abschlusseingabe wieder geöffnet."
        : "Eingaben werden automatisch gesichert; Schließen behält den Entwurf.");
  get("finish-draft-adopt").hidden =
    !s.draft || s.draft.revision === s.owner.revision;
}
export function markFinishDraft() {
  const s = active;
  if (!s) return;
  s.version++;
  status(s, "Abschlusseingabe wird gesichert…");
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void save(s), 250);
}
async function save(s: Session): Promise<boolean> {
  if (s.pending) {
    if (!(await s.pending)) return false;
    return s.version === s.saved ? true : save(s);
  }
  if (s.version === s.saved) return true;
  const version = s.version,
    d: FinishDraft = {
      ...s.owner,
      revision: s.draft?.revision ?? s.owner.revision,
      ...snapshot(s),
      writeId: crypto.randomUUID(),
    };
  const run = (async () => {
    try {
      const r = await window.campaign.keepFinishDraft(
        s.w.token,
        d,
        s.draft?.writeId ?? null,
      );
      if (!r.ok) throw new Error(r.error);
      s.draft = d;
      s.saved = version;
      s.error = null;
      status(
        s,
        "Abschlusseingabe gesichert · beim nächsten Öffnen fortsetzen.",
      );
      return true;
    } catch (e) {
      s.error = (e as Error).message;
      status(s);
      return false;
    }
  })();
  s.pending = run;
  const ok = await run;
  s.pending = null;
  return ok && s.version !== s.saved ? save(s) : ok;
}
export async function flushFinishDraft() {
  return !active || (await save(active));
}
export async function resetFinishDraft() {
  if (!(await flushFinishDraft()))
    throw new Error(active?.error ?? "Abschlusseingabe noch nicht gesichert.");
  active = null;
  if (timer) clearTimeout(timer);
}
export async function beginFinishDraft(
  w: Workspace,
  owner: FinishOwner,
  readItems: () => RewardItemDraft[],
  restoreItems: (items: RewardItemDraft[]) => void,
  preview: () => void,
) {
  init();
  const s: Session = {
    w,
    owner,
    draft: null,
    defaults: {} as Values,
    readItems,
    restoreItems,
    preview,
    version: 0,
    saved: 0,
    pending: null,
    error: null,
  };
  s.defaults = snapshot(s);
  const r = await window.campaign.finishDraft(w.token, owner);
  if (!r.ok) throw new Error(r.error);
  s.draft = r.value;
  active = s;
  if (s.draft) restore(s, s.draft);
  status(s);
}
export async function finishDraftCommit() {
  const s = active;
  if (!s) throw new Error("Abschlussziel zuerst öffnen.");
  if (!(await save(s)))
    throw new Error(s.error ?? "Abschlusseingabe noch nicht gesichert.");
  if (s.draft && s.draft.revision !== s.owner.revision)
    throw new Error(
      "Abschlussstand geändert. Gesicherte Eingabe zuerst prüfen und übernehmen.",
    );
  return { writeId: s.draft?.writeId, revision: s.owner.revision };
}
export function finishDraftConsumed() {
  active = null;
  if (timer) clearTimeout(timer);
}
function init() {
  if (initialized) return;
  initialized = true;
  const dialog = get<HTMLDialogElement>("combat-finish-dialog");
  dialog.addEventListener("input", markFinishDraft);
  dialog.addEventListener("change", markFinishDraft);
  dialog.addEventListener("close", () => {
    if (active) void save(active);
  });
  get("finish-draft-discard").onclick = () => {
    void (async () => {
      const s = active;
      if (!s || !(await save(s))) return;
      if (s.draft) {
        const r = await window.campaign.discardFinishDraft(
          s.w.token,
          s.owner,
          s.draft.writeId,
        );
        if (!r.ok) {
          s.error = r.error;
          status(s);
          return;
        }
      }
      s.draft = null;
      restore(s, s.defaults);
      s.saved = s.version;
      status(s, "Entwurf verworfen · vorbereitete Vorgaben wieder geladen.");
    })().catch((e) => {
      if (active) {
        active.error = e.message;
        status(active);
      }
    });
  };
  get("finish-draft-adopt").onclick = () => {
    void (async () => {
      const s = active;
      if (!s || !(await save(s)) || !s.draft) return;
      s.draft.revision = s.owner.revision;
      s.version++;
      await save(s);
      status(s);
    })();
  };
}
