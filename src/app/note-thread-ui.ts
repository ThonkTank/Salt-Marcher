import { markdownView } from './markdown-view';
import { mountNoteEditor, focusNoteEditor } from './note-editor-mount';
import {
  noteThreadMembers,
  noteSourceLinks,
  restoreNoteSource,
  type NoteSourceRecovery,
  type NoteSourceLinks,
} from './note-thread-edit';
import type { Note } from './preparation-contracts';
import type { ManualPlan } from '../features/planner/manual-planner';
import type { NoteThreadAPI, NoteThreadEntry, NoteThreadSelection } from './note-thread-contracts';
import type { SceneDeskAPI } from './scene-desk-contracts';
import type { PreparationAPI } from './preparation-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const label = (text: string, field: HTMLElement) => {
  const l = node('label', text + ' ');
  l.append(field);
  return l;
};
const kinds = {
  note: 'Notiz',
  npc: 'NSC',
  faction: 'Fraktion',
  quest: 'Quest',
  rumor: 'Gerücht',
  rule: 'Regel',
};
export interface NoteThreadTarget {
  planId: string | null;
  visitId: string | null;
  title: string;
  planName: string;
}
export interface NoteThreadSource {
  token: string;
  id: string;
  plans: ManualPlan[];
  destination?: { planId: string; visitId: string | null };
  current: () => boolean;
  blocked: () => boolean;
  room: (id: string, current: () => boolean, restore: () => void) => Promise<boolean>;
  edit: (id: string, current: () => boolean) => Promise<boolean>;
  returnToRoot: (current: () => boolean) => Promise<boolean>;
  add: (root: Note, ids: string[]) => Promise<boolean>;
  detach: (root: Note, id: string, current: () => boolean) => Promise<boolean>;
  restore?: (root: Note, recovery: NoteSourceRecovery, current: () => boolean) => Promise<boolean>;
  use: (
    target: NoteThreadTarget,
    selection: NoteThreadSelection,
    current: () => boolean,
  ) => Promise<boolean>;
}
interface Options {
  prepare: () => Promise<NoteThreadSource | null>;
  api: NoteThreadAPI &
    Pick<SceneDeskAPI, 'searchDesk' | 'deskContent'> &
    Pick<PreparationAPI, 'noteRoomUses'>;
  tell: (text: string, error?: boolean) => void;
}
interface NoteMapFrame {
  owner: NoteThreadSource;
  root: Note;
  choices: Map<string, { stamp: string; selected: boolean }>;
  active: boolean;
  includeRoot: boolean;
  planId: string;
  visitId: string;
  planName: string;
  visitTitle: string;
  query: string;
  searched: boolean;
  additions: Set<string>;
  collectOpen: boolean;
  loadedIds: string[];
  scroll: number;
  preparing: boolean;
  reviewOpen: boolean;
}
/** A reading projection of one existing note and its direct note references, with existing writers. */
export class NoteThreadDialog {
  private dialog = node('dialog');
  private parents: NoteMapFrame[] = [];
  private parentButton = node('button');
  private collect = node('details');
  private heading = node('h2');
  private status = node('p');
  private summary = node('p');
  private body = node('div');
  private sources = node('div');
  private active = node('input');
  private includeRoot = node('input');
  private clearSelection = node('button', 'Quellenauswahl leeren');
  private more = node('button', 'Weitere Quellen');
  private refresh = node('button', 'Aktualisieren');
  private close = node('button', 'Schließen');
  private query = node('input');
  private find = node('button', 'Notizen suchen');
  private candidates = node('div');
  private add = node('button', 'Ausgewählte Quellen verknüpfen');
  private searchStatus = node('p');
  private plan = node('select');
  private visit = node('select');
  private visitTitle = node('input');
  private planName = node('input');
  private use = node('button', 'Auswahl für den Spielabend verwenden');
  private choice = node('p');
  private selectionSummary = node('div');
  private targetHint = node('p');
  private target = node('section');
  private mapContent = node('div');
  private review = node('details');
  private sourceChoices = node('div');
  private rootChoice = label('Übersichtsnotiz ebenfalls verknüpfen', this.includeRoot);
  private preparing = false;
  private owner: NoteThreadSource | null = null;
  private root: Note | null = null;
  private epoch = 0;
  private request = 0;
  private searchRequest = 0;
  private busy = false;
  private loading = false;
  private reloadIds = new Set<string>();
  private stale = false;
  private next: number | null = null;
  private total = 0;
  private entries = new Map<string, NoteThreadEntry>();
  private choices = new Map<string, { stamp: string; selected: boolean }>();
  private additions = new Set<string>();
  private reading = node('div');
  private editor = node('section');
  private editorContent = node('div');
  private editorStatus = node('p');
  private returnButton = node('button', 'Zur Notizmappe');
  private prepareMap = node('button', 'Mit dieser Mappe zum Spielabend…');
  private chooseSource = node('button', 'Diese Quelle vormerken');
  private inspection: { id: string; searchRequest: number } | null = null;
  private editRoot = node('button', 'Übersichtsnotiz bearbeiten…');
  private editing: string | null = null;
  private openingNote: string | null = null;
  private restoreEditor: (() => void) | null = null;
  private readingScroll = 0;
  private sourceLinks = new Map<string, NoteSourceLinks>();
  get editorId() {
    return this.editing;
  }
  ownsNote(id: string | null) {
    return (
      !!id &&
      (id === this.rootId ||
        id === this.editing ||
        id === this.openingNote ||
        this.parents.some((f) => f.owner.id === id))
    );
  }
  ownsContext(root: string, selected: string | null) {
    return (
      this.ownsNote(selected) &&
      (root === this.rootId || this.parents.some((f) => f.owner.id === root))
    );
  }
  feedback(text: string, error = false) {
    if (this.editing && this.dialog.open) {
      this.editorStatus.textContent = text;
      this.editorStatus.dataset.error = String(error);
    }
  }

  constructor(private options: Options) {
    this.dialog.id = 'note-thread-dialog';
    this.dialog.setAttribute('aria-labelledby', 'note-thread-heading');
    this.heading.id = 'note-thread-heading';
    this.heading.tabIndex = -1;
    this.reading.id = 'note-thread-reading';
    this.editor.id = 'note-thread-editor';
    this.editor.hidden = true;
    this.chooseSource.id = 'note-thread-choose-source';
    this.chooseSource.type = 'button';
    this.chooseSource.hidden = true;
    this.chooseSource.onclick = () => void this.chooseInspectedSource();
    this.returnButton.id = 'note-thread-return';
    this.returnButton.type = this.editRoot.type = 'button';
    this.editRoot.id = 'note-thread-edit-root';
    this.editorStatus.id = 'note-thread-editor-status';
    this.editorStatus.setAttribute('role', 'status');
    const editHead = node('div');
    editHead.className = 'note-thread-edit-head';
    this.prepareMap.id = 'note-thread-prepare-map';
    this.prepareMap.type = 'button';
    this.prepareMap.onclick = () => void this.prepareCurrentMap();
    editHead.append(this.returnButton, this.prepareMap, this.chooseSource, this.editorStatus);
    this.editor.append(editHead, this.editorContent);
    this.returnButton.onclick = () => void this.finishEditing();
    this.editRoot.onclick = () => {
      if (this.root) void this.editNote(this.root.id);
    };
    this.active.type = this.includeRoot.type = 'checkbox';
    this.active.checked = true;
    this.includeRoot.checked = true;
    this.active.id = 'note-thread-active';
    this.includeRoot.id = 'note-thread-include-root';
    this.clearSelection.id = 'note-thread-clear-selection';
    this.clearSelection.type = 'button';
    this.clearSelection.onclick = () => {
      if (
        !this.dialog.open ||
        !this.owner?.current() ||
        this.owner.blocked() ||
        this.busy ||
        this.loading ||
        this.stale ||
        this.editing !== null
      )
        return;
      for (const [id, choice] of this.choices) this.choices.set(id, { ...choice, selected: false });
      this.controls();
      this.status.textContent = 'Quellenauswahl geleert. Weitere Quellen bleiben abgewählt.';
    };
    this.sources.id = 'note-thread-sources';
    this.summary.id = 'note-thread-summary';
    this.body.id = 'note-thread-root';
    this.status.id = 'note-thread-status';
    this.status.setAttribute('role', 'status');
    this.query.type = 'search';
    this.query.maxLength = 1000;
    this.query.id = 'note-thread-search';
    this.find.id = 'note-thread-find';
    this.candidates.id = 'note-thread-candidates';
    this.add.id = 'note-thread-add';
    this.more.id = 'note-thread-more';
    this.use.id = 'note-thread-use';
    this.plan.id = 'note-thread-plan';
    this.visit.id = 'note-thread-visit';
    this.visitTitle.id = 'note-thread-visit-title';
    this.planName.id = 'note-thread-plan-name';
    this.choice.id = 'note-thread-choice';
    this.targetHint.id = 'note-thread-target-hint';
    this.targetHint.setAttribute('role', 'status');
    this.plan.setAttribute('aria-describedby', this.targetHint.id);
    this.visit.setAttribute('aria-describedby', this.targetHint.id);
    this.planName.setAttribute('aria-describedby', this.targetHint.id);
    this.visitTitle.setAttribute('aria-describedby', this.targetHint.id);
    this.visitTitle.maxLength = this.planName.maxLength = 1000;
    for (const b of [this.more, this.refresh, this.close, this.find, this.add, this.use])
      b.type = 'button';
    const head = node('div');
    head.className = 'toolbar';
    this.parentButton.id = 'note-thread-parent';
    this.parentButton.type = 'button';
    this.parentButton.hidden = true;
    this.parentButton.onclick = () => void this.returnToParent();
    head.append(this.heading, this.parentButton, this.refresh, this.close);
    const collect = this.collect,
      searchTools = node('div');
    searchTools.className = 'toolbar';
    searchTools.append(label('Notizinhalt oder Titel', this.query), this.find);
    collect.append(
      node('summary', 'Quellen zu dieser Notizmappe hinzufügen'),
      node(
        'p',
        'Ausgewählte Notizen werden als Beziehung „Quelle“ in der Übersichtsnotiz verknüpft. Vorhandene Texte und Beziehungen bleiben erhalten.',
      ),
      searchTools,
      this.searchStatus,
      this.candidates,
      this.add,
    );
    const target = this.target;
    target.className = 'note-thread-target';
    this.selectionSummary.className = 'note-thread-selection-summary';
    this.selectionSummary.append(this.choice);
    this.sourceChoices.id = 'note-thread-source-choices';
    this.sourceChoices.setAttribute('role', 'group');
    this.sourceChoices.setAttribute('aria-label', 'Quellen für den Spielabend');
    const destinations = node('div');
    destinations.className = 'note-thread-destinations';
    destinations.append(
      label('Spielabend', this.plan),
      label('Besuch', this.visit),
      label('Name des neuen Spielabends', this.planName),
      label('Titel des neuen Besuchs', this.visitTitle),
    );
    target.append(
      node('h3', 'Für einen Spielabend vorbereiten'),
      this.rootChoice,
      this.sourceChoices,
      this.selectionSummary,
      destinations,
      this.targetHint,
      this.use,
    );
    this.mapContent.append(
      node(
        'p',
        'Originalnotizen und ihre bestätigten Zustände gemeinsam lesen. Die Mappe zeigt direkte Beziehungen und Textverweise dieser Übersichtsnotiz.',
      ),
      this.body,
      this.editRoot,
      collect,
      label('Geschlossene Spuren ausblenden', this.active),
      this.summary,
      this.sources,
      this.more,
    );
    this.review.id = 'note-thread-review';
    this.review.append(node('summary', 'Originaltexte und Quellen bearbeiten…'));
    this.reading.append(this.mapContent, target, this.status);
    this.dialog.append(head, this.reading, this.editor);
    document.body.append(this.dialog);
    this.close.onclick = () => {
      if (!this.busy) void this.closeContext();
    };
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (!this.busy) void this.closeContext();
    });
    this.refresh.onclick = () => {
      if (!this.busy && !this.loading) void this.reload();
    };
    this.active.onchange = () => {
      if (!this.busy && !this.loading) void this.reload();
    };
    this.includeRoot.onchange = () => this.controls();
    this.more.onclick = () => {
      if (!this.loading && !this.busy && !this.stale && this.next !== null) void this.load(true);
    };
    this.query.oninput = () => {
      this.searchRequest++;
      this.candidates.replaceChildren();
      this.additions.clear();
      this.searchStatus.textContent = 'Suche erneut ausführen.';
      this.controls();
    };
    this.query.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.find.click();
      }
    };
    this.find.onclick = () => void this.search();
    this.add.onclick = () => void this.addSources();
    this.plan.onchange = () => this.drawVisits();
    this.visit.onchange = () => this.controls();
    this.planName.oninput = this.visitTitle.oninput = () => this.controls();
    this.use.onclick = () => void this.prepareVisit();
  }
  get rootId() {
    return this.owner?.id ?? null;
  }
  reset() {
    this.restoreEditor?.();
    this.restoreEditor = null;
    this.editing = null;
    this.openingNote = null;
    this.inspection = null;
    this.chooseSource.hidden = true;
    this.editor.hidden = true;
    this.reading.hidden = false;
    this.epoch++;
    this.request++;
    this.searchRequest++;
    this.owner = null;
    this.parents = [];
    this.parentButton.hidden = true;
    this.root = null;
    this.busy = false;
    this.loading = false;
    this.entries.clear();
    this.reloadIds.clear();
    this.choices.clear();
    this.sourceLinks.clear();
    this.additions.clear();
    this.dialog.close();
    this.body.replaceChildren();
    this.sources.replaceChildren();
    this.candidates.replaceChildren();
    this.status.textContent = '';
  }
  private current(epoch: number) {
    return epoch === this.epoch && !!this.owner?.current() && this.dialog.open;
  }
  async open(preparing = false) {
    if (this.dialog.open) {
      if (this.editing === this.rootId) {
        if ((await this.finishEditing()) && preparing) this.placeTarget(true);
        return;
      }
      await this.openNested(preparing);
      return;
    }
    const epoch = ++this.epoch,
      owner = await this.options.prepare();
    if (epoch !== this.epoch || !owner?.current()) return;
    await this.showMap(owner, undefined, preparing);
  }
  private placeTarget(preparing: boolean) {
    this.preparing = preparing;
    if (preparing) {
      this.review.append(this.mapContent);
      this.reading.replaceChildren(this.target, this.status, this.review);
      this.selectionSummary.append(this.clearSelection);
    } else {
      this.reading.replaceChildren(this.mapContent, this.target, this.status);
      this.summary.after(this.clearSelection);
    }
    this.sourceChoices.hidden = !preparing;
    this.controls();
    if (preparing) this.dialog.scrollTop = 0;
  }
  private async showMap(owner: NoteThreadSource, frame?: NoteMapFrame, preparing = false) {
    this.owner = owner;
    this.root = frame?.root ?? null;
    this.entries.clear();
    this.sourceLinks.clear();
    this.reloadIds.clear();
    this.choices = new Map(frame?.choices);
    this.additions.clear();
    this.active.checked = frame?.active ?? true;
    this.includeRoot.checked = frame?.includeRoot ?? true;
    this.query.value = frame?.query ?? '';
    this.collect.open = frame?.collectOpen ?? false;
    this.review.open = frame?.reviewOpen ?? false;
    this.candidates.replaceChildren();
    this.sources.replaceChildren();
    this.body.replaceChildren();
    this.searchStatus.textContent = '';
    this.status.textContent = '';
    this.reading.hidden = false;
    this.editor.hidden = true;
    this.placeTarget(frame?.preparing ?? preparing);
    this.stale = false;
    this.loading = false;
    if (!this.dialog.open) this.dialog.showModal();
    this.parentButton.hidden = !this.parents.length;
    this.parentButton.textContent = this.parents.length
      ? 'Zur Mappe: ' + this.parents.at(-1)!.root.title
      : '';
    this.plan.replaceChildren();
    const fresh = node('option', 'Neuen Spielabend anlegen');
    fresh.value = '';
    this.plan.append(fresh);
    for (const p of owner.plans) {
      const o = node('option', p.name || 'Unbenannter Spielabend');
      o.value = p.id;
      this.plan.append(o);
    }
    const destination = owner.plans.find((p) => p.id === owner.destination?.planId);
    this.plan.value = frame ? frame.planId : (destination?.id ?? '');
    this.drawVisits(frame ? frame.visitId : destination ? owner.destination?.visitId : undefined);
    if (frame) {
      this.planName.value = frame.planName;
      this.visitTitle.value = frame.visitTitle;
    }
    const epoch = this.epoch;
    await this.reload(frame?.loadedIds);
    if (!this.current(epoch)) return;
    if (frame?.searched && !this.stale) await this.search(frame.additions);
    if (!this.current(epoch)) return;
    this.dialog.scrollTop = frame?.scroll ?? 0;
    this.heading.focus({ preventScroll: true });
  }
  private async openNested(preparing = false) {
    if (
      !this.editing ||
      this.editing === this.rootId ||
      this.busy ||
      this.loading ||
      this.stale ||
      !this.root ||
      !this.owner?.current() ||
      this.owner.blocked()
    )
      return;
    const epoch = this.epoch,
      id = this.editing;
    if (this.parents.some((f) => f.owner.id === id)) {
      this.feedback(
        'Diese Mappe liegt bereits im Rückweg. Über „Zur Mappe“ zur übergeordneten Mappe zurückkehren.',
      );
      return;
    }
    this.busy = true;
    this.controls();
    try {
      const owner = await this.options.prepare();
      if (!this.current(epoch) || this.editing !== id) return;
      if (!owner?.current() || owner.id !== id)
        throw Error(
          'Eingabe noch nicht übernommen. Original bleibt geöffnet; Speicherstatus prüfen.',
        );
      const parent: NoteMapFrame = {
        owner: this.owner!,
        root: this.root!,
        choices: new Map(this.choices),
        active: this.active.checked,
        includeRoot: this.includeRoot.checked,
        planId: this.plan.value,
        visitId: this.visit.value,
        planName: this.planName.value,
        visitTitle: this.visitTitle.value,
        query: this.query.value,
        searched: !!this.candidates.childNodes.length || !!this.searchStatus.textContent,
        additions: new Set(this.additions),
        collectOpen: this.collect.open,
        reviewOpen: this.review.open,
        loadedIds: [...this.entries.keys()],
        scroll: this.readingScroll,
        preparing: this.preparing,
      };
      this.restoreEditor?.();
      this.restoreEditor = null;
      this.editing = null;
      this.inspection = null;
      this.parents.push(parent);
      this.epoch++;
      this.request++;
      this.searchRequest++;
      this.busy = false;
      await this.showMap(owner, undefined, preparing);
    } catch (error) {
      if (this.current(epoch)) this.feedback((error as Error).message, true);
    } finally {
      if (epoch === this.epoch) {
        this.busy = false;
        this.controls();
      }
    }
  }
  private async returnToParent() {
    if (
      !this.parents.length ||
      this.busy ||
      this.loading ||
      !this.owner?.current() ||
      this.owner.blocked()
    )
      return;
    if (this.editing && !(await this.finishEditing())) return;
    const epoch = this.epoch,
      parent = this.parents.at(-1)!;
    if (!this.current(epoch) || this.busy || this.loading || this.owner?.blocked()) return;
    this.busy = true;
    this.controls();
    try {
      if (!(await parent.owner.returnToRoot(() => this.current(epoch))))
        throw Error('Rückweg noch nicht bestätigt. Speicherstatus prüfen.');
      if (!this.current(epoch)) return;
      this.parents.pop();
      this.epoch++;
      this.request++;
      this.searchRequest++;
      this.busy = false;
      await this.showMap(parent.owner, parent);
    } catch (error) {
      if (this.current(epoch)) {
        this.status.textContent = (error as Error).message;
        this.feedback((error as Error).message, true);
      }
    } finally {
      if (epoch === this.epoch) {
        this.busy = false;
        this.controls();
      }
    }
  }
  private drawVisits(preferred?: string | null) {
    this.visit.replaceChildren();
    const fresh = node('option', 'Neuen Besuch anlegen');
    fresh.value = '';
    this.visit.append(fresh);
    const plan = this.owner?.plans.find((p) => p.id === this.plan.value);
    for (const s of plan?.scenes ?? []) {
      const o = node('option', s.title || 'Unbenannter Besuch');
      o.value = s.id;
      this.visit.append(o);
    }
    this.visit.value = plan?.scenes.find((s) => s.id === preferred)?.id ?? '';
    this.controls();
  }
  private isPicked(id: string) {
    const entry = this.entries.get(id),
      choice = this.choices.get(id);
    return (
      !!entry && !entry.unavailable && !!choice && choice.selected && choice.stamp === entry.stamp
    );
  }
  private selectedEntries() {
    return [...this.choices.keys()]
      .filter((id) => this.isPicked(id))
      .map((id) => this.entries.get(id)!);
  }
  private controls() {
    const picked = new Set(this.selectedEntries().map((e) => e.id));
    const blocked =
      this.busy || this.loading || this.stale || !this.owner?.current() || !!this.owner?.blocked();
    for (const c of this.reading.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLButtonElement
    >('input,select,button'))
      c.disabled = blocked || c.dataset.unavailable === 'true';
    this.parentButton.disabled = this.busy || this.loading || !!this.owner?.blocked();
    this.close.disabled = this.busy;
    this.refresh.disabled = this.busy || this.loading || this.editing !== null;
    this.returnButton.disabled = this.busy;
    this.prepareMap.hidden = !!this.inspection;
    this.prepareMap.disabled = this.busy || this.loading || this.editorContent.hidden;
    this.chooseSource.hidden = !this.inspection;
    this.chooseSource.disabled = blocked || !this.inspection || this.editorContent.hidden;
    this.editRoot.disabled = blocked || this.editing !== null;
    this.more.hidden = this.next === null;
    this.more.disabled = this.busy || this.loading || this.stale;
    this.planName.parentElement!.hidden = !!this.plan.value;
    this.visitTitle.parentElement!.hidden = !!this.visit.value;
    this.plan.parentElement!.hidden = this.preparing && this.plan.options.length === 1;
    this.visit.parentElement!.hidden = this.preparing && this.visit.options.length === 1;
    this.add.disabled = blocked || !this.additions.size;
    this.use.disabled = blocked || !this.root || (!picked.size && !this.includeRoot.checked);
    for (const box of this.reading.querySelectorAll<HTMLInputElement>(
      'input[data-thread-source]',
    )) {
      const e = this.entries.get(box.value);
      box.disabled = blocked || !e || e.unavailable;
      box.checked = picked.has(box.value);
    }
    for (const box of this.candidates.querySelectorAll<HTMLInputElement>('input[type=checkbox]'))
      box.checked = this.additions.has(box.value);
    this.choice.textContent =
      picked.size +
      Number(this.includeRoot.checked) +
      ' Originalnotizen ausgewählt. Vorhandene Besuchsnotizen bleiben erhalten.';
    this.targetHint.textContent =
      !this.plan.value && !this.planName.value.trim()
        ? 'Spielabend auswählen oder neuen Spielabend benennen.'
        : !this.visit.value && !this.visitTitle.value.trim()
          ? 'Besuch auswählen oder neuen Besuch benennen.'
          : '';
    this.targetHint.hidden = !this.targetHint.textContent;
  }
  private async load(append: boolean, reviewed?: { id: string; selected: boolean }) {
    if (!this.owner?.current() || this.busy) return;
    const epoch = this.epoch,
      n = ++this.request,
      offset = append ? (this.next ?? 0) : 0,
      active = this.active.checked;
    this.loading = true;
    this.stale = false;
    this.controls();
    this.status.textContent = 'Notizmappe wird gelesen…';
    try {
      const r = await this.options.api.noteThread(this.owner.token, this.owner.id, offset, active);
      if (!this.current(epoch) || n !== this.request) return;
      if (!r.ok) throw Error(r.error);
      if (r.value.root.id !== this.owner.id)
        throw Error('Notizmappe gehört zu einer anderen Quelle.');
      if (append && r.value.root.revision !== this.root?.revision) {
        this.stale = true;
        throw Error('Übersichtsnotiz geändert. Notizmappe aktualisieren.');
      }
      const initial = !this.root;
      this.root = r.value.root;
      if (!append) {
        this.sourceLinks = noteSourceLinks(this.root);
        const members = this.memberIds();
        for (const id of this.additions) if (members.has(id)) this.additions.delete(id);
        for (const card of this.candidates.querySelectorAll<HTMLElement>('article'))
          if (members.has(card.dataset.noteId!)) card.remove();
      }
      this.total = r.value.total;
      this.next = r.value.next;
      this.heading.textContent = 'Notizmappe: ' + this.root.title;
      if (!append) {
        this.entries.clear();
        this.sources.replaceChildren();
        this.sourceChoices.replaceChildren();
        this.rootChoice.replaceChildren(
          this.includeRoot,
          node('span', 'Übersicht: ' + this.root.title),
        );
        this.body.replaceChildren(node('h3', this.root.title));
        if (this.root.readAloud)
          this.body.append(node('h4', 'Zum Vorlesen'), markdownView(this.root.readAloud, 3));
        this.body.append(node('h4', 'GM-Notizen'), markdownView(this.root.gmNotes, 3));
        this.drawRecoveryLoader();
        if (initial) {
          this.visitTitle.value = '';
          this.planName.value = '';
          this.visitTitle.placeholder = this.root.title;
          this.planName.placeholder = 'Fortsetzung: ' + this.root.title;
        }
      }
      for (const e of r.value.entries) {
        this.entries.set(e.id, e);
        const previous = this.choices.get(e.id);
        const selected =
          !e.unavailable &&
          (reviewed?.id === e.id
            ? reviewed.selected && e.status !== 'closed' && e.status !== 'unknown'
            : previous
              ? previous.stamp === e.stamp && previous.selected
              : initial && !append && e.status !== 'closed' && e.status !== 'unknown');
        // Reading a page restores source order; later explicit selections append in choice order.
        this.choices.delete(e.id);
        this.choices.set(e.id, { stamp: e.stamp, selected });
        this.drawSource(e, epoch);
      }
      this.summary.textContent =
        this.entries.size +
        ' von ' +
        this.total +
        ' verknüpften Quellen angezeigt' +
        (active ? ' · geschlossene Spuren ausgeblendet.' : '.');
      this.status.textContent = this.entries.size
        ? this.preparing
          ? ''
          : 'Quelltexte lesen und Auswahl für die Vorbereitung prüfen.'
        : this.next !== null
          ? 'Noch keine passenden Quellen. Weitere Quellen laden.'
          : 'Noch keine passenden Quellen. Oben vorhandene Notizen verknüpfen.';
    } catch (error) {
      if (this.current(epoch) && n === this.request) {
        this.stale = true;
        this.status.textContent = (error as Error).message;
      }
    } finally {
      if (this.current(epoch) && n === this.request) {
        this.loading = false;
        this.controls();
      }
    }
  }
  private async reload(
    ids: Iterable<string> = this.entries.keys(),
    reviewed?: { id: string; selected: boolean },
  ) {
    const epoch = this.epoch;
    // Retain identities across partial failures; a row count cannot survive reordering.
    for (const id of ids) this.reloadIds.add(id);
    await this.load(false, reviewed);
    if (!this.current(epoch) || this.stale || !this.root) return;
    let target = 0,
      offset = 0;
    for (const id of noteThreadMembers(this.root).keys()) {
      offset++;
      if (this.reloadIds.has(id)) target = offset;
    }
    // next counts scanned members, including filtered closed sources. Removed IDs
    // have no target; a hidden source therefore cannot force an unrelated full read.
    while (this.current(epoch) && !this.stale && this.next !== null && this.next < target)
      await this.load(true, reviewed);
    if (this.current(epoch) && !this.stale) this.reloadIds.clear();
  }
  private drawSource(e: NoteThreadEntry, epoch: number) {
    const card = node('article'),
      box = node('input'),
      header = node('div');
    box.type = 'checkbox';
    box.dataset.threadSource = 'true';
    box.value = e.id;
    box.checked = this.isPicked(e.id);
    box.setAttribute('aria-label', 'Für Spielabend auswählen: ' + e.title);
    header.className = 'toolbar';
    header.append(
      box,
      node('h3', e.title),
      node(
        'span',
        (e.kind ? kinds[e.kind] : 'Quelle') +
          ' · ' +
          (e.trashed
            ? 'Papierkorb'
            : {
                open: 'Offen',
                closed: 'Geschlossen',
                untracked: 'kein Aufgabenstatus',
                unknown: 'Status nicht lesbar',
              }[e.status]),
      ),
    );
    card.dataset.noteId = e.id;
    card.append(header, node('p', e.labels.join(' · ')));
    if (e.notice) card.append(node('p', e.notice));
    box.onchange = () => {
      if (this.current(epoch) && card.isConnected && !box.disabled) {
        this.choices.delete(e.id);
        this.choices.set(e.id, { stamp: e.stamp, selected: box.checked });
        this.controls();
      }
    };
    const compact = node('input');
    compact.type = 'checkbox';
    compact.dataset.threadSource = 'true';
    compact.value = e.id;
    compact.onchange = () => {
      if (
        this.current(epoch) &&
        compact.isConnected &&
        !compact.disabled &&
        this.entries.get(e.id) === e
      ) {
        box.checked = compact.checked;
        box.onchange!(new Event('change'));
      }
    };
    const state = e.trashed
      ? 'Papierkorb'
      : { open: 'Offen', closed: 'Geschlossen', unknown: 'Status nicht lesbar', untracked: '' }[
          e.status
        ];
    this.sourceChoices.append(
      label(
        e.title + ' · ' + (e.kind ? kinds[e.kind] : 'Quelle') + (state ? ' · ' + state : ''),
        compact,
      ),
    );
    const canInspect = !!e.trashed && e.revision !== null && e.kind !== null;
    const edit = node(
      'button',
      canInspect ? 'Original im Papierkorb ansehen…' : 'Notiz bearbeiten…',
    );
    edit.type = 'button';
    edit.disabled = e.unavailable && !canInspect;
    edit.dataset.unavailable = String(e.unavailable && !canInspect);
    edit.onclick = () => {
      if (this.current(epoch) && card.isConnected && !edit.disabled) void this.editNote(e.id);
    };
    card.append(edit);
    if (!e.unavailable && !e.trashed) {
      const open = node('button', 'Notizmappe öffnen…');
      open.type = 'button';
      open.onclick = () => {
        if (this.current(epoch) && card.isConnected && !open.disabled)
          void (async () => {
            if (await this.editNote(e.id)) await this.open();
          })();
      };
      card.append(open);
    }
    const removal = this.sourceLinks.get(e.id);
    if (removal?.family) {
      card.append(
        node(
          'p',
          'Diese Quelle ist durch eine Familienbeziehung verbunden. Ändere diese Beziehung als Paar unter „Zusammenhänge“.',
        ),
      );
    } else if (removal) {
      const detach = node('details'),
        review = node('summary', 'Quelle aus dieser Mappe lösen…');
      detach.append(
        review,
        node(
          'p',
          `Nur Verknüpfungen in „${this.root!.title}“ lösen. Die Originalnotiz und andere Verwendungen bleiben erhalten.`,
        ),
      );
      const effects = node('ul');
      if (removal.relationships.length)
        effects.append(
          node(
            'li',
            `${removal.relationships.length} Beziehungen entfernen: ${removal.relationships.join(' · ')}`,
          ),
        );
      for (const [field, count] of [
        ['Zum Vorlesen', removal.readAloud],
        ['GM-Notizen', removal.gmNotes],
      ] as const)
        if (count)
          effects.append(
            node(
              'li',
              `${count} Textverweis${count === 1 ? '' : 'e'} in „${field}“ in normalen Text umwandeln; die geschriebenen Namen bleiben stehen.`,
            ),
          );
      const confirm = node('button', 'Verknüpfungen hier lösen'),
        keep = node('button', 'Verknüpfungen behalten');
      confirm.type = keep.type = 'button';
      confirm.onclick = () => {
        if (this.current(epoch) && card.isConnected && !confirm.disabled)
          void this.detachSource(e.id);
      };
      keep.onclick = () => {
        if (!keep.disabled) {
          detach.open = false;
          review.focus();
        }
      };
      detach.append(effects, confirm, keep);
      card.append(detach);
    }
    const detail = node('details'),
      summary = node('summary', 'Originaltext und Raumhinweise lesen'),
      content = node('div');
    detail.append(summary, content);
    let loaded = false;
    const read = async () => {
      if (loaded || !this.current(epoch) || !detail.isConnected) return;
      loaded = true;
      content.replaceChildren(node('p', 'Quelle wird gelesen…'));
      try {
        const r = await this.options.api.deskContent(this.owner!.token, {
          kind: 'note',
          id: e.id,
        });
        if (!this.current(epoch) || !detail.isConnected) return;
        if (!r.ok) throw Error(r.error);
        if (
          r.value.unavailable ||
          r.value.ref.id !== e.id ||
          r.value.ref.kind !== 'note' ||
          !r.value.note ||
          r.value.note.id !== e.id ||
          r.value.note.revision !== e.revision ||
          r.value.revision !== e.revision
        ) {
          this.stale = true;
          throw Error('Quelle geändert oder nicht verfügbar. Mappe aktualisieren.');
        }
        content.replaceChildren();
        for (const [title, text] of [
          ['Zum Vorlesen', r.value.note.readAloud],
          ['GM-Notizen', r.value.note.gmNotes],
        ])
          if (text) content.append(node('h4', title), markdownView(text!, 3));
        const uses = node('p', 'Raumverweise werden geladen…');
        content.append(uses);
        try {
          const rooms = await this.options.api.noteRoomUses(this.owner!.token, e.id, 0);
          if (!this.current(epoch) || !detail.isConnected) return;
          if (!rooms.ok) throw Error(rooms.error);
          uses.textContent =
            (rooms.value.entries.length
              ? 'Raumhinweise: ' +
                rooms.value.entries
                  .slice(0, 4)
                  .map((r) => r.title + ' · Raum ' + r.number)
                  .join('; ') +
                (rooms.value.next !== null || rooms.value.entries.length > 4
                  ? ' · weitere Räume'
                  : '')
              : 'Keine gespeicherten Raumverweise.') +
            (rooms.value.notice ? ' ' + rooms.value.notice : '');
          for (const room of rooms.value.entries.slice(0, 4)) {
            const b = node('button', 'Raum öffnen: ' + room.title);
            b.type = 'button';
            b.dataset.unavailable = String(room.unavailable);
            b.disabled = room.unavailable;
            b.onclick = () => {
              if (this.current(epoch) && b.isConnected && !b.disabled)
                void this.owner!.room(
                  room.id,
                  () => this.current(epoch) && b.isConnected,
                  () => {
                    if (this.current(epoch) && b.isConnected) b.focus({ preventScroll: true });
                  },
                ).catch((error) => {
                  if (this.current(epoch)) this.status.textContent = (error as Error).message;
                });
            };
            content.append(b);
          }
          this.controls();
        } catch {
          if (this.current(epoch) && detail.isConnected)
            uses.textContent = 'Raumverweise gerade nicht lesbar.';
        }
      } catch (error) {
        if (this.current(epoch) && detail.isConnected) {
          loaded = false;
          content.replaceChildren(node('p', (error as Error).message));
          this.controls();
        }
      }
    };
    if (!e.unavailable) {
      detail.ontoggle = () => {
        if (detail.open) void read();
      };
      card.append(node('p', e.preview), detail);
    }
    this.sources.append(card);
    if (!e.unavailable && this.entries.size <= 10 && e.status !== 'closed') {
      detail.open = true;
      void read();
    }
  }
  private async editNote(id: string, candidateRequest?: number): Promise<boolean> {
    if (this.busy || this.loading || this.editing || !this.owner?.current() || this.owner.blocked())
      return false;
    const epoch = this.epoch;
    this.readingScroll = this.dialog.scrollTop;
    this.editing = id;
    this.inspection =
      candidateRequest === undefined ? null : { id, searchRequest: candidateRequest };
    this.busy = true;
    this.controls();
    this.reading.hidden = true;
    this.editor.hidden = false;
    this.editorContent.hidden = true;
    this.editorStatus.textContent = 'Originalnotiz wird geöffnet…';
    this.editorStatus.dataset.error = 'false';
    try {
      this.restoreEditor = mountNoteEditor(this.editorContent, () => this.reset());
      const valid = () => this.current(epoch) && this.editing === id;
      if (!(await this.owner.edit(id, valid)))
        throw Error(
          'Originalnotiz kann gerade nicht geöffnet werden. Zur Mappe zurückkehren oder Speicherstatus prüfen.',
        );
      if (!valid()) return false;
      this.editorContent.hidden = false;
      this.editorStatus.textContent = this.entries.get(id)?.trashed
        ? 'Diese Originalnotiz liegt im Papierkorb. Mit „Wiederherstellen“ wird sie für ihre vorhandenen Verweise wieder verfügbar.'
        : this.inspection
          ? 'Prüfe dieses Original. „Diese Quelle vormerken“ wählt es aus; verknüpft wird anschließend in der Mappe.'
          : 'Original bearbeiten. Text und narrativer Status verwenden die bisherigen Speicherfunktionen.';
      this.dialog.scrollTop = 0;
      focusNoteEditor();
      return true;
    } catch (error) {
      if (this.current(epoch)) this.feedback((error as Error).message, true);
      return false;
    } finally {
      if (epoch === this.epoch) {
        this.busy = false;
        this.controls();
      }
    }
  }
  async followNote(id: string): Promise<boolean> {
    if (
      !this.editing ||
      this.busy ||
      this.loading ||
      !this.owner?.current() ||
      this.owner.blocked()
    )
      return false;
    const epoch = this.epoch,
      previous = this.editing;
    this.openingNote = id;
    this.busy = true;
    this.controls();
    try {
      const valid = () =>
        this.current(epoch) && this.editing === previous && this.openingNote === id;
      if (!(await this.owner.edit(id, valid)))
        throw Error('Originalnotiz kann gerade nicht geöffnet werden. Speicherstatus prüfen.');
      if (!valid()) return false;
      this.editing = id;
      this.inspection = null;
      this.editorStatus.textContent =
        'Original bearbeiten. Über „Zur Notizmappe“ zur bisherigen Auswahl zurückkehren.';
      focusNoteEditor();
      return true;
    } catch (error) {
      if (this.current(epoch)) this.feedback((error as Error).message, true);
      return false;
    } finally {
      if (epoch === this.epoch) {
        this.openingNote = null;
        this.busy = false;
        this.controls();
      }
    }
  }
  private async chooseInspectedSource() {
    const candidate = this.inspection,
      owner = this.owner,
      epoch = this.epoch;
    if (
      !candidate ||
      !owner ||
      this.busy ||
      this.loading ||
      this.stale ||
      this.editorContent.hidden ||
      owner.blocked() ||
      !this.current(epoch) ||
      candidate.id !== this.editing ||
      candidate.searchRequest !== this.searchRequest
    )
      return;
    if (
      !(await this.finishEditing()) ||
      !this.current(epoch) ||
      this.stale ||
      candidate.searchRequest !== this.searchRequest
    )
      return;
    this.loading = true;
    this.controls();
    try {
      const result = await this.options.api.deskContent(owner.token, {
        kind: 'note',
        id: candidate.id,
      });
      if (!this.current(epoch) || candidate.searchRequest !== this.searchRequest) return;
      if (!result.ok) throw Error(result.error);
      const value = result.value;
      if (
        value.unavailable ||
        value.ref.kind !== 'note' ||
        value.ref.id !== candidate.id ||
        !value.note ||
        value.note.id !== candidate.id ||
        value.note.revision !== value.revision
      )
        throw Error(
          'Diese Quelle ist nicht verlässlich verfügbar. Suche erneut ausführen und das Original prüfen.',
        );
      if (this.memberIds().has(candidate.id)) {
        this.status.textContent = 'Diese Quelle gehört bereits zur Notizmappe.';
        return;
      }
      this.additions.add(candidate.id);
      const card = [...this.candidates.querySelectorAll<HTMLElement>('article')].find(
        (c) => c.dataset.noteId === candidate.id,
      );
      const title = card?.querySelector('strong');
      if (title) title.textContent = value.note.title;
      this.status.textContent = `„${value.note.title}“ ist vorgemerkt. Mit „Ausgewählte Quellen verknüpfen“ zur Übersicht hinzufügen.`;
      card?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    } catch (error) {
      if (this.current(epoch)) this.status.textContent = (error as Error).message;
    } finally {
      if (epoch === this.epoch) {
        this.loading = false;
        this.controls();
      }
    }
  }
  private drawRecoveryLoader() {
    const section = node('section'),
      action = node('button', 'Gelöste Quellen wiederherstellen…');
    section.id = 'note-thread-recoveries';
    action.type = 'button';
    action.onclick = () => {
      if (!action.disabled) void this.loadRecoveries(section);
    };
    section.append(action);
    this.body.append(section);
  }
  private async loadRecoveries(section: HTMLElement) {
    const owner = this.owner,
      root = this.root,
      epoch = this.epoch;
    if (
      !owner ||
      !root ||
      !this.current(epoch) ||
      this.loading ||
      this.busy ||
      this.stale ||
      owner.blocked()
    )
      return;
    this.loading = true;
    this.controls();
    try {
      const result = await this.options.api.noteThread(
        owner.token,
        root.id,
        0,
        this.active.checked,
        true,
      );
      if (!this.current(epoch) || !section.isConnected) return;
      if (!result.ok) throw Error(result.error);
      if (result.value.root.id !== root.id || result.value.root.revision !== root.revision) {
        this.stale = true;
        throw Error('Übersichtsnotiz geändert. Notizmappe aktualisieren.');
      }
      section.replaceChildren();
      this.drawRecoveries(result.value.recoveries ?? [], section);
    } catch (error) {
      if (this.current(epoch)) this.status.textContent = (error as Error).message;
    } finally {
      if (epoch === this.epoch) {
        this.loading = false;
        this.controls();
      }
    }
  }
  private drawRecoveries(recoveries: NoteSourceRecovery[], section: HTMLElement) {
    section.append(
      node('h3', 'Gelöste Quellen'),
      node(
        'p',
        'Letzte 20 Quellenlösungen dieser Übersicht. Spätere Texte und Beziehungen bleiben erhalten; geänderte Verweiszeilen müssen Sie im Original prüfen.',
      ),
    );
    for (const recovery of recoveries) {
      const card = node('article'),
        action = node('button', 'Verknüpfungen wiederherstellen');
      const links = noteSourceLinks(recovery.before).get(recovery.sourceId)!;
      card.append(
        node('h4', recovery.title),
        node(
          'p',
          `Stand ${recovery.before.revision} → ${recovery.after.revision}: ${links.relationships.length} Beziehungen, ${links.readAloud} Verweise zum Vorlesen, ${links.gmNotes} Verweise in GM-Notizen.`,
        ),
      );
      let notice = '';
      try {
        restoreNoteSource(this.root!, recovery);
      } catch (error) {
        notice = (error as Error).message;
      }
      if (notice) card.append(node('p', notice));
      const old = node('details');
      old.append(
        node('summary', 'Gesicherte Verweise ansehen'),
        node('p', links.relationships.join(', ')),
      );
      for (const field of ['readAloud', 'gmNotes'] as const) {
        const before = recovery.before[field].split('\n'),
          after = recovery.after[field].split('\n');
        const changed = before.filter((line, index) => line !== after[index]);
        if (changed.length)
          old.append(
            node('h5', field === 'readAloud' ? 'Zum Vorlesen' : 'GM-Notizen'),
            node('pre', changed.join('\n')),
          );
      }
      action.type = 'button';
      action.dataset.unavailable = String(
        !!notice || !!recovery.unavailable || !this.owner?.restore,
      );
      action.onclick = () => {
        if (!action.disabled) void this.restoreSource(recovery);
      };
      card.append(old, action);
      section.append(card);
    }
    if (!recoveries.length)
      section.append(
        node(
          'p',
          'Keine gelöste Quelle in den letzten 20 Quellenlösungen verfügbar. Bereits erneut verwendete Quellen stehen in der normalen Mappe. Quellenlösungen vor dieser Appversion haben keinen gesicherten Verlauf.',
        ),
      );
  }
  private async restoreSource(recovery: NoteSourceRecovery) {
    const root = this.root,
      owner = this.owner,
      epoch = this.epoch;
    if (
      !root ||
      !owner?.restore ||
      !this.current(epoch) ||
      this.stale ||
      this.busy ||
      this.loading ||
      owner.blocked()
    )
      return;
    if (!(await this.editNote(root.id)) || !this.current(epoch)) return;
    const current = () => this.current(epoch) && this.editing === root.id;
    this.busy = true;
    this.controls();
    let saved = false;
    try {
      saved = await owner.restore(root, recovery, current);
      if (current() && !saved)
        throw Error(
          'Wiederherstellung noch nicht bestätigt. Original bleibt geöffnet; Speicherstatus prüfen.',
        );
    } catch (error) {
      if (current()) this.feedback((error as Error).message, true);
    } finally {
      if (epoch === this.epoch) {
        this.busy = false;
        this.controls();
      }
    }
    if (saved && current()) await this.finishEditing();
  }
  private async detachSource(id: string) {
    const root = this.root,
      owner = this.owner,
      epoch = this.epoch;
    if (!root || !owner || !this.current(epoch) || this.stale || this.busy || this.loading) return;
    // The original editor also exposes its existing receipt/recovery controls on failure.
    if (!(await this.editNote(root.id)) || !this.current(epoch)) return;
    const current = () => this.current(epoch) && this.editing === root.id;
    this.busy = true;
    this.controls();
    let saved = false;
    try {
      saved = await owner.detach(root, id, current);
      if (!current()) return;
      if (!saved)
        throw Error(
          'Verknüpfungen noch nicht bestätigt. Original bleibt geöffnet; Speicherstatus prüfen.',
        );
      this.choices.delete(id);
    } catch (error) {
      if (current()) this.feedback((error as Error).message, true);
    } finally {
      if (epoch === this.epoch) {
        this.busy = false;
        this.controls();
      }
    }
    if (saved && current()) await this.finishEditing();
  }
  // Editing a member does not change which dossier the GM is preparing.
  private async prepareCurrentMap() {
    const epoch = this.epoch;
    if ((await this.finishEditing()) && this.current(epoch)) this.placeTarget(true);
  }
  private async finishEditing(refresh = true): Promise<boolean> {
    if (this.busy || !this.editing || !this.owner?.current()) return false;
    const epoch = this.epoch,
      id = this.editing,
      selected = this.isPicked(id);
    this.busy = true;
    this.controls();
    try {
      if (!(await this.owner.returnToRoot(() => this.current(epoch) && this.editing === id)))
        throw Error(
          'Eingabe noch nicht übernommen. Original bleibt geöffnet; Speicherstatus prüfen.',
        );
      if (!this.current(epoch) || this.editing !== id) return false;
      this.restoreEditor?.();
      this.restoreEditor = null;
      this.editing = null;
      this.inspection = null;
      this.chooseSource.hidden = true;
      this.editor.hidden = true;
      this.reading.hidden = false;
      this.busy = false;
      if (refresh) {
        await this.reload(this.entries.keys(), { id, selected });
        if (!this.current(epoch)) return false;
        this.dialog.scrollTop = this.readingScroll;
        const card = [...this.sources.querySelectorAll<HTMLElement>('article')].find(
            (e) => e.dataset.noteId === id,
          ),
          focus = card?.querySelector<HTMLButtonElement>('button') ?? this.heading;
        focus.focus({ preventScroll: true });
      }
      return true;
    } catch (error) {
      if (this.current(epoch)) this.feedback((error as Error).message, true);
      return false;
    } finally {
      if (epoch === this.epoch) {
        this.busy = false;
        this.controls();
      }
    }
  }
  private async closeContext() {
    if (this.editing) {
      if (!(await this.finishEditing(false))) return;
    }
    this.reset();
  }
  private memberIds() {
    return new Set([this.owner!.id, ...this.sourceLinks.keys()]);
  }
  private async search(retain: ReadonlySet<string> = new Set()) {
    if (this.busy || !this.owner?.current()) return;
    const epoch = this.epoch,
      n = ++this.searchRequest,
      query = this.query.value;
    this.candidates.replaceChildren();
    this.additions.clear();
    this.searchStatus.textContent = 'Notizen werden gesucht…';
    this.controls();
    try {
      const r = await this.options.api.searchDesk(this.owner.token, 'note', query, 0);
      if (!this.current(epoch) || n !== this.searchRequest) return;
      if (!r.ok) throw Error(r.error);
      const members = this.memberIds();
      for (const e of r.value.entries.filter((e) => !members.has(e.ref.id))) {
        const card = node('article'),
          l = node('label'),
          b = node('input');
        card.dataset.noteId = e.ref.id;
        b.type = 'checkbox';
        b.value = e.ref.id;
        b.disabled = !!e.unavailable;
        b.dataset.unavailable = String(!!e.unavailable);
        l.append(b, node('strong', e.title), node('span', e.label));
        b.onchange = () => {
          if (this.current(epoch) && n === this.searchRequest && l.isConnected && !b.disabled) {
            if (b.checked) this.additions.add(e.ref.id);
            else this.additions.delete(e.ref.id);
            this.controls();
          }
        };
        const header = node('div');
        header.className = 'toolbar';
        header.append(l);
        card.append(header);
        if (e.preview && 'parts' in e.preview) {
          const excerpt = node('p', e.preview.owner + ': ');
          for (const part of e.preview.parts)
            excerpt.append(node(part.matched ? 'mark' : 'span', part.text));
          card.append(excerpt);
        }
        const inspect = node('button', 'Original prüfen…');
        inspect.type = 'button';
        inspect.dataset.unavailable = String(!!e.unavailable);
        inspect.disabled = !!e.unavailable;
        inspect.onclick = () => {
          if (
            this.current(epoch) &&
            n === this.searchRequest &&
            card.isConnected &&
            !inspect.disabled
          )
            void this.editNote(e.ref.id, n);
        };
        header.append(inspect);
        this.candidates.append(card);
      }
      for (const e of r.value.entries)
        if (!e.unavailable && !members.has(e.ref.id) && retain.has(e.ref.id))
          this.additions.add(e.ref.id);
      this.searchStatus.textContent =
        (r.value.notice ?? '') +
        (r.value.next !== null ? ' Weitere Treffer: Suche genauer eingeben.' : '');
      if (!this.candidates.childNodes.length)
        this.searchStatus.textContent += ' Keine neuen passenden Quellen.';
      this.controls();
    } catch (error) {
      if (this.current(epoch) && n === this.searchRequest)
        this.searchStatus.textContent = (error as Error).message;
    }
  }
  private async addSources() {
    if (
      this.busy ||
      this.loading ||
      this.stale ||
      !this.owner?.current() ||
      this.owner.blocked() ||
      !this.root ||
      !this.additions.size
    )
      return;
    const owner = this.owner,
      epoch = this.epoch,
      root = this.root,
      ids = [...this.additions];
    if (!(await this.editNote(root.id)) || !this.current(epoch)) return;
    const current = () => this.current(epoch) && this.editing === root.id;
    this.busy = true;
    this.controls();
    this.editorStatus.textContent = 'Ausgewählte Quellen werden mit dieser Übersicht verknüpft…';
    let saved = false;
    try {
      saved = await owner.add(root, ids);
      if (!current()) return;
      if (!saved)
        throw Error(
          'Verknüpfung noch nicht bestätigt. Original bleibt geöffnet; Speicherstatus prüfen.',
        );
      this.additions.clear();
      this.candidates.replaceChildren();
    } catch (error) {
      if (current()) this.feedback((error as Error).message, true);
    } finally {
      if (epoch === this.epoch) {
        this.busy = false;
        this.controls();
      }
    }
    if (saved && current()) await this.finishEditing();
  }
  private async prepareVisit() {
    if (
      this.busy ||
      this.loading ||
      this.stale ||
      !this.root ||
      !this.owner?.current() ||
      this.owner.blocked()
    )
      return;
    const epoch = this.epoch,
      selection: NoteThreadSelection = {
        rootId: this.root.id,
        rootRevision: this.root.revision,
        includeRoot: this.includeRoot.checked,
        entries: this.selectedEntries().map(({ id, stamp }) => ({
          id,
          stamp,
        })),
      },
      target: NoteThreadTarget = {
        planId: this.plan.value || null,
        visitId: this.visit.value || null,
        title: this.visitTitle.value,
        planName: this.planName.value,
      };
    if (!selection.entries.length && !selection.includeRoot) return;
    if ((!target.visitId && !target.title.trim()) || (!target.planId && !target.planName.trim())) {
      this.controls();
      const missing =
        !target.planId && !target.planName.trim()
          ? this.plan.options.length > 1
            ? this.plan
            : this.planName
          : this.visit.options.length > 1
            ? this.visit
            : this.visitTitle;
      missing.focus();
      return;
    }
    this.busy = true;
    this.controls();
    this.status.textContent = 'Quellen und Status werden geprüft…';
    try {
      const checked = await this.options.api.checkNoteThread(this.owner.token, selection);
      if (!this.current(epoch)) return;
      if (!checked.ok) throw Error(checked.error);
      if (!(await this.owner.use(target, selection, () => this.current(epoch))))
        throw Error(
          'Vorbereitung noch nicht bestätigt. Speicherstatus prüfen; keine automatische Wiederholung.',
        );
      if (this.current(epoch)) {
        this.options.tell('Ausgewählte Originalnotizen sind mit dem Besuch verknüpft.');
        this.reset();
      }
    } catch (error) {
      if (this.current(epoch)) {
        this.status.textContent = (error as Error).message;
        this.options.tell((error as Error).message, true);
      }
    } finally {
      if (epoch === this.epoch) {
        this.busy = false;
        this.controls();
      }
    }
  }
}
