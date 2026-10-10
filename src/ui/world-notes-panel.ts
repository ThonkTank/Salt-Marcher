import type { CampaignLocalId } from "../features/campaign/campaign-contracts";
import { campaignCommandId, payloadDigest,
  type CampaignContextProjection, type CampaignCommandId } from "../features/campaign/campaign-contracts";
import { campaignOwnershipDigestValue,
  type CampaignOwnershipDigest } from "../features/campaign/campaign-ownership";
import { worldNotePath,
  type WorldNotesCommitReceiptV1 } from "../features/campaign/world-notes-commit";
import { searchWorldNotes, worldNotesSnapshot,
  serializeWorldNote,
  type WorldNoteChange, type WorldNoteDraft, type WorldNoteKind,
  type WorldNoteRelation, type WorldNotesSnapshotV1 } from "../features/world/world-notes";

export interface WorldNotesCommitResult {
  readonly snapshot: WorldNotesSnapshotV1;
  readonly receipt: WorldNotesCommitReceiptV1;
}
export interface WorldNotesPanelOptions {
  readonly newId: () => CampaignLocalId;
  readonly currentContext: () => CampaignContextProjection | null;
  readonly digest: CampaignOwnershipDigest;
  /** Must reject a receipt that was not issued by the Campaign-owned participant. */
  readonly validateReceipt: (receipt: WorldNotesCommitReceiptV1) => void;
  /** Must return the published projection and its causal committed receipt. */
  readonly commit: (commandId: CampaignCommandId, change: WorldNoteChange,
    expectedRevision: number) => Promise<WorldNotesCommitResult>;
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
  private readonly retainedDrafts = new Map<string, NonNullable<WorldNotesPanel["pending"]>>();
  private busy = false;
  private destroyed = false;
  private generation = 0;
  constructor(host: HTMLElement, private readonly options: WorldNotesPanelOptions) {
    const doc = host.ownerDocument;
    this.root = doc.createElement("div"); this.root.className = "dn-world-notes";
    this.root.setAttribute("role", "region");
    this.root.setAttribute("aria-label", "Kampagnenwissen");
    const title = doc.createElement("h2"); title.textContent = "Kampagnenwissen";
    const help = doc.createElement("details");
    const helpTitle = doc.createElement("summary"); helpTitle.textContent = "Hilfe zu Kampagnenwissen";
    const helpText = doc.createElement("p");
    helpText.textContent = "Lege NPCs, Fraktionen, Quests und Gerüchte an. Vorlesetext und GM-Notizen bleiben getrennt. Beziehungen verweisen auf bestehende Einträge; Löschen muss bestätigt werden.";
    help.append(helpTitle, helpText);
    this.search = doc.createElement("input"); this.search.type = "search";
    this.search.setAttribute("aria-label", "Notizen durchsuchen");
    this.search.addEventListener("input", () => this.renderList());
    const actions = doc.createElement("div"); actions.className = "dn-world-notes-actions";
    for (const kind of kinds) {
      const button = doc.createElement("button"); button.type = "button";
      button.textContent = `${labels[kind]} anlegen`;
      button.addEventListener("click", () => {
        if (this.busy || !this.snapshot) return;
        if (this.pending) { this.message("Erst den offenen Entwurf speichern oder ausdrücklich verwerfen.", true); return; }
        this.pending = { id: options.newId(), draft: blank(kind), create: true, baseRevision: null };
        this.renderEditor(true);
      });
      actions.append(button);
    }
    this.list = doc.createElement("ul"); this.list.className = "dn-world-notes-list";
    this.editor = doc.createElement("div"); this.editor.className = "dn-world-notes-editor";
    this.status = doc.createElement("p"); this.status.setAttribute("role", "status");
    this.root.append(title, help, this.search, actions, this.list, this.editor, this.status);
    host.append(this.root);
  }
  update(snapshot: WorldNotesSnapshotV1): void {
    if (this.destroyed) return;
    const next = worldNotesSnapshot(snapshot);
    if (this.snapshot && next.campaignId === this.snapshot.campaignId &&
        next.namespace === this.snapshot.namespace) {
      if (next.revision < this.snapshot.revision ||
          (next.revision === this.snapshot.revision && !this.sameSnapshot(next, this.snapshot))) {
        this.message("Veralteter oder widersprüchlicher World-Stand verworfen.", true);
        return;
      }
      if (next.revision === this.snapshot.revision) return;
    }
    if (this.snapshot && (next.campaignId !== this.snapshot.campaignId ||
        next.namespace !== this.snapshot.namespace)) {
      if (this.pending) this.retainedDrafts.set(this.draftKey(this.snapshot), this.pending);
      this.pending = this.retainedDrafts.get(this.draftKey(next)) ?? null;
      this.search.value = "";
    }
    const changedDuringEdit = this.pending && this.snapshot &&
      next.revision !== this.snapshot.revision;
    this.generation++; this.snapshot = next; this.busy = false;
    this.renderList(); this.renderEditor();
    if (changedDuringEdit) this.message("Bestand geändert; Entwurf behalten. Speichern prüft den alten Eintragsstand.", true);
  }
  private draftKey(snapshot: WorldNotesSnapshotV1): string {
    return `${snapshot.campaignId}/${snapshot.namespace}`;
  }
  private sameSnapshot(a: WorldNotesSnapshotV1, b: WorldNotesSnapshotV1): boolean {
    return JSON.stringify(a.records) === JSON.stringify(b.records);
  }
  private confirms(change: WorldNoteChange, before: WorldNotesSnapshotV1,
    after: WorldNotesSnapshotV1): boolean {
    if (after.revision !== before.revision + 1) return false;
    if (after.records.length !== before.records.length + (change.kind === "create" ? 1 : 0) ||
        before.records.some((item) => item.id !== change.id &&
          JSON.stringify(after.records.find((candidate) => candidate.id === item.id)) !== JSON.stringify(item)))
      return false;
    const record = after.records.find((item) => item.id === change.id);
    if (!record) return false;
    const old = before.records.find((item) => item.id === change.id);
    if (change.kind === "delete") return !!old && !old.deleted && old.revision === change.expectedRevision &&
      record.deleted && record.revision === change.expectedRevision + 1 &&
      Object.keys(record).length === 10 &&
      record.version === old.version && record.id === old.id && record.kind === old.kind &&
      record.title === old.title && record.readAloud === old.readAloud && record.gmNotes === old.gmNotes &&
      record.creatureId === old.creatureId && record.relations.length === 0;
    if (record.deleted || record.kind !== change.draft.kind ||
        record.title !== change.draft.title || record.readAloud !== change.draft.readAloud ||
        record.gmNotes !== change.draft.gmNotes || record.creatureId !== change.draft.creatureId ||
        record.relations.length !== change.draft.relations.length ||
        record.relations.some((relation, index) => relation.targetId !== change.draft.relations[index]?.targetId ||
          relation.label !== change.draft.relations[index]?.label)) return false;
    return change.kind === "create"
      ? !before.records.some((item) => item.id === change.id) && record.revision === 1
      : !!old && !old.deleted && old.revision === change.expectedRevision &&
        record.revision === change.expectedRevision + 1;
  }
  private confirmsReceipt(commandId: CampaignCommandId, change: WorldNoteChange,
    before: WorldNotesSnapshotV1, after: WorldNotesSnapshotV1,
    context: CampaignContextProjection, receipt: WorldNotesCommitReceiptV1): boolean {
    this.options.validateReceipt(receipt);
    const current = this.options.currentContext(),
      record = after.records.find((item) => item.id === change.id),
      old = before.records.find((item) => item.id === change.id);
    return !!current && current.lifecycle === "active" &&
      current.contextToken === context.contextToken &&
      current.campaignId === context.campaignId && current.namespace === context.namespace &&
      current.revision === context.revision &&
      !!record && receipt.version === 1 && receipt.status === "committed" &&
      receipt.commandId === commandId && receipt.contextToken === context.contextToken &&
      receipt.changeDigest === campaignOwnershipDigestValue(change, this.options.digest) &&
      receipt.recordId === change.id &&
      receipt.notePath === worldNotePath(after.namespace, record.kind, record.id) &&
      receipt.beforeSnapshotRevision === before.revision &&
      receipt.afterSnapshotRevision === after.revision &&
      receipt.beforeSnapshotDigest === campaignOwnershipDigestValue(before, this.options.digest) &&
      receipt.afterSnapshotDigest === campaignOwnershipDigestValue(after, this.options.digest) &&
      receipt.beforeRecordRevision === (old?.revision ?? null) &&
      receipt.afterRecordRevision === record.revision &&
      receipt.afterPayloadDigest === payloadDigest(this.options.digest(serializeWorldNote(record))) &&
      receipt.deleted === record.deleted;
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
        if (this.pending) { this.message("Erst den offenen Entwurf speichern oder ausdrücklich verwerfen.", true); return; }
        this.pending = { id: record.id, draft: { kind: record.kind, title: record.title,
          readAloud: record.readAloud, gmNotes: record.gmNotes, creatureId: record.creatureId,
          relations: record.relations.map((relation) => ({ ...relation })) }, create: false,
          baseRevision: record.revision };
        this.renderEditor(true);
      });
      row.append(button); this.list.append(row);
    }
  }
  private renderEditor(focusName = false): void {
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
    const discard = doc.createElement("button"); discard.type = "button";
    discard.textContent = "Entwurf verwerfen"; form.append(discard);
    discard.addEventListener("click", () => {
      if (this.busy || this.pending !== pending) return;
      if (discard.textContent !== "Verwerfen bestätigen") {
        discard.textContent = "Verwerfen bestätigen"; return;
      }
      this.pending = null;
      this.retainedDrafts.delete(this.draftKey(snapshot));
      this.message("Entwurf verworfen"); this.renderEditor(); this.search.focus();
    });
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
    if (focusName) name.focus();
  }
  private async commit(change: WorldNoteChange, before: WorldNotesSnapshotV1): Promise<void> {
    this.busy = true; this.message("Speichern läuft");
    const stamp = ++this.generation;
    try {
      const context = this.options.currentContext();
      if (!context || context.lifecycle !== "active" || context.campaignId !== before.campaignId ||
          context.namespace !== before.namespace)
        throw new Error("World-Kontext ist nicht aktiv.");
      const commandId = campaignCommandId(crypto.randomUUID()),
        result = await this.options.commit(commandId, change, before.revision),
        confirmed = worldNotesSnapshot(result.snapshot);
      if (this.destroyed || stamp !== this.generation) return;
      if (confirmed.campaignId !== before.campaignId || confirmed.namespace !== before.namespace ||
          !this.confirms(change, before, confirmed) ||
          !this.confirmsReceipt(commandId, change, before, confirmed, context, result.receipt))
        throw new Error("Angeforderte World-Änderung wurde nicht bestätigt.");
      this.snapshot = confirmed;
      this.pending = null; this.message("Gespeichert");
      this.retainedDrafts.delete(this.draftKey(confirmed));
      this.renderList(); this.renderEditor();
      (Array.from(this.list.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.dataset.worldId === change.id) ?? this.search).focus();
    } catch (error) {
      if (!this.destroyed && stamp === this.generation) {
        this.message(`Speicherung nicht bestätigt: ${String(error)}`, true);
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
