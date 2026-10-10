import type { CampaignLocalId } from "../features/campaign/campaign-contracts";
import { searchWorldNotes, worldNotesSnapshot,
  type WorldNoteChange, type WorldNoteDraft, type WorldNoteKind,
  type WorldNoteRelation, type WorldNotesSnapshotV1 } from "../features/world/world-notes";

export interface WorldNotesPanelOptions {
  readonly newId: () => CampaignLocalId;
  /** Must return the confirmed published snapshot, never an uncommitted local proposal. */
  readonly commit: (change: WorldNoteChange, expectedRevision: number) => Promise<WorldNotesSnapshotV1>;
}
const kinds: readonly WorldNoteKind[] = ["npc", "faction", "quest", "rumor"];
const labels: Record<WorldNoteKind, string> = {
  npc: "NPC", faction: "Fraktion", quest: "Quest", rumor: "Gerücht",
};
const blank = (kind: WorldNoteKind): WorldNoteDraft => ({ kind, title: "",
  readAloud: "", gmNotes: "", relations: [], creatureId: null });

/** Host-neutral GM editor. No native write occurs without the Campaign-owned commit port. */
export class WorldNotesPanel {
  private readonly root: HTMLDivElement;
  private readonly list: HTMLUListElement;
  private readonly editor: HTMLDivElement;
  private readonly search: HTMLInputElement;
  private readonly status: HTMLParagraphElement;
  private snapshot: WorldNotesSnapshotV1 | null = null;
  private pending: { id: CampaignLocalId; draft: WorldNoteDraft; create: boolean;
    baseRevision: number | null } | null = null;
  private busy = false;
  private destroyed = false;
  private generation = 0;
  constructor(host: HTMLElement, private readonly options: WorldNotesPanelOptions) {
    const doc = host.ownerDocument;
    this.root = doc.createElement("div"); this.root.className = "dn-world-notes";
    this.root.setAttribute("aria-label", "Kampagnenwissen");
    const title = doc.createElement("h2"); title.textContent = "Kampagnenwissen";
    this.search = doc.createElement("input"); this.search.type = "search";
    this.search.setAttribute("aria-label", "Notizen durchsuchen");
    this.search.addEventListener("input", () => this.renderList());
    const actions = doc.createElement("div"); actions.className = "dn-world-notes-actions";
    for (const kind of kinds) {
      const button = doc.createElement("button"); button.type = "button";
      button.textContent = `${labels[kind]} anlegen`;
      button.addEventListener("click", () => {
        if (this.busy || !this.snapshot) return;
        this.pending = { id: options.newId(), draft: blank(kind), create: true, baseRevision: null };
        this.renderEditor();
      });
      actions.append(button);
    }
    this.list = doc.createElement("ul"); this.list.className = "dn-world-notes-list";
    this.editor = doc.createElement("div"); this.editor.className = "dn-world-notes-editor";
    this.status = doc.createElement("p"); this.status.setAttribute("role", "status");
    this.root.append(title, this.search, actions, this.list, this.editor, this.status);
    host.append(this.root);
  }
  update(snapshot: WorldNotesSnapshotV1): void {
    if (this.destroyed) return;
    const next = worldNotesSnapshot(snapshot);
    if (this.snapshot && (next.campaignId !== this.snapshot.campaignId ||
        next.namespace !== this.snapshot.namespace)) {
      this.pending = null; this.search.value = "";
    }
    const changedDuringEdit = this.pending && this.snapshot &&
      next.revision !== this.snapshot.revision;
    this.generation++; this.snapshot = next; this.busy = false;
    this.renderList(); this.renderEditor();
    if (changedDuringEdit) this.message("Bestand geändert; Entwurf behalten. Speichern prüft den alten Eintragsstand.", true);
  }
  private renderList(): void {
    this.list.replaceChildren();
    if (!this.snapshot) return;
    const boundSnapshot = this.snapshot;
    for (const record of searchWorldNotes(this.snapshot, this.search.value)) {
      const row = this.root.ownerDocument.createElement("li");
      const button = this.root.ownerDocument.createElement("button"); button.type = "button";
      button.textContent = `${labels[record.kind]}: ${record.title}`;
      button.dataset.worldId = record.id;
      button.addEventListener("click", () => {
        if (this.busy || this.snapshot !== boundSnapshot) return;
        this.pending = { id: record.id, draft: { kind: record.kind, title: record.title,
          readAloud: record.readAloud, gmNotes: record.gmNotes, creatureId: record.creatureId,
          relations: record.relations.map((relation) => ({ ...relation })) }, create: false,
          baseRevision: record.revision };
        this.renderEditor();
      });
      row.append(button); this.list.append(row);
    }
  }
  private renderEditor(): void {
    this.editor.replaceChildren();
    const pending = this.pending, snapshot = this.snapshot;
    if (!pending || !snapshot) return;
    const doc = this.root.ownerDocument, form = doc.createElement("form");
    const heading = doc.createElement("h3");
    heading.textContent = `${labels[pending.draft.kind]} ${pending.create ? "anlegen" : "bearbeiten"}`;
    form.append(heading);
    const field = (label: string, value: string, multiline = false) => {
      const wrapper = doc.createElement("label"); wrapper.textContent = label;
      const input = multiline ? doc.createElement("textarea") : doc.createElement("input");
      input.value = value; wrapper.append(input); form.append(wrapper); return input;
    };
    const name = field("Name", pending.draft.title);
    const readAloud = field("Vorlesetext", pending.draft.readAloud, true);
    const gmNotes = field("GM-Notizen", pending.draft.gmNotes, true);
    const creature = pending.draft.kind === "npc"
      ? field("Kreaturreferenz", pending.draft.creatureId ?? "") : null;
    name.addEventListener("input", () => { pending.draft = { ...pending.draft, title: name.value }; });
    readAloud.addEventListener("input", () => { pending.draft = { ...pending.draft, readAloud: readAloud.value }; });
    gmNotes.addEventListener("input", () => { pending.draft = { ...pending.draft, gmNotes: gmNotes.value }; });
    creature?.addEventListener("input", () => { pending.draft = { ...pending.draft,
      creatureId: creature.value || null }; });
    const relationTitle = doc.createElement("h4"); relationTitle.textContent = "Beziehungen";
    const relationList = doc.createElement("ul");
    const relationTarget = doc.createElement("select"); relationTarget.setAttribute("aria-label", "Beziehungsziel");
    for (const record of snapshot.records.filter((item) => !item.deleted && item.id !== pending.id)) {
      const option = doc.createElement("option"); option.value = record.id;
      option.textContent = `${labels[record.kind]}: ${record.title}`; relationTarget.append(option);
    }
    const relationLabel = doc.createElement("input"); relationLabel.setAttribute("aria-label", "Beziehungsname");
    const renderRelations = () => {
      relationList.replaceChildren();
      for (const relation of pending.draft.relations) {
        const row = doc.createElement("li");
        const target = snapshot.records.find((record) => record.id === relation.targetId);
        row.append(doc.createTextNode(`${relation.label}: ${target?.title ?? relation.targetId} `));
        const remove = doc.createElement("button"); remove.type = "button";
        remove.textContent = "Beziehung entfernen";
        remove.addEventListener("click", () => {
          if (this.pending !== pending) return;
          pending.draft = { ...pending.draft, relations: pending.draft.relations.filter((item) => item !== relation) };
          renderRelations();
        });
        row.append(remove); relationList.append(row);
      }
    };
    renderRelations();
    const addRelation = doc.createElement("button"); addRelation.type = "button";
    addRelation.textContent = "Beziehung hinzufügen";
    addRelation.addEventListener("click", () => {
      if (this.pending !== pending || !relationTarget.value || !relationLabel.value.trim()) return;
      const relation: WorldNoteRelation = { targetId: relationTarget.value as CampaignLocalId,
        label: relationLabel.value };
      pending.draft = { ...pending.draft, relations: [...pending.draft.relations, relation] };
      relationLabel.value = ""; renderRelations();
    });
    form.append(relationTitle, relationList, relationTarget, relationLabel, addRelation);
    const save = doc.createElement("button"); save.type = "submit"; save.textContent = "Speichern";
    form.append(save);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (this.busy || !this.snapshot || this.pending !== pending) return;
      pending.draft = { ...pending.draft, title: name.value, readAloud: readAloud.value,
        gmNotes: gmNotes.value, creatureId: creature?.value || null };
      const before = this.snapshot;
      const change: WorldNoteChange = pending.create
        ? { kind: "create", id: pending.id, draft: pending.draft }
        : { kind: "update", id: pending.id, expectedRevision: pending.baseRevision!, draft: pending.draft };
      void this.commit(change, before);
    });
    if (!pending.create) {
      const remove = doc.createElement("button"); remove.type = "button";
      remove.textContent = "Löschen"; form.append(remove);
      remove.addEventListener("click", () => {
        if (this.busy || this.pending !== pending) return;
        if (remove.textContent !== "Löschen bestätigen") {
          remove.textContent = "Löschen bestätigen"; return;
        }
        const before = this.snapshot;
        if (before) void this.commit({ kind: "delete", id: pending.id,
          expectedRevision: pending.baseRevision! }, before);
      });
    }
    this.editor.append(form);
  }
  private async commit(change: WorldNoteChange, before: WorldNotesSnapshotV1): Promise<void> {
    this.busy = true; this.message("Speichern läuft");
    const stamp = ++this.generation;
    try {
      const confirmed = worldNotesSnapshot(await this.options.commit(change, before.revision));
      if (this.destroyed || stamp !== this.generation) return;
      if (confirmed.campaignId !== before.campaignId || confirmed.namespace !== before.namespace ||
          confirmed.revision <= before.revision) throw new Error("Bestätigter World-Stand fehlt.");
      this.snapshot = confirmed;
      this.pending = null; this.message("Gespeichert");
      this.renderList(); this.renderEditor();
    } catch (error) {
      if (!this.destroyed && stamp === this.generation) {
        this.message(`Nicht gespeichert: ${String(error)}`, true);
      }
    } finally {
      if (!this.destroyed && stamp === this.generation) this.busy = false;
    }
  }
  private message(value: string, error = false): void {
    this.status.textContent = value;
    this.status.setAttribute("role", error ? "alert" : "status");
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true; this.generation++; this.root.remove();
  }
}
