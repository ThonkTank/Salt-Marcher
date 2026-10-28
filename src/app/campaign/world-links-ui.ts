import { plainReferenceText } from './text-references';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type { DeskContent } from '../runtime/scene-desk-contracts';
import type { PreparationCommand, PreparationDraft } from './preparation-contracts';
import type { Note } from './note-data';
import { campaignLocalId } from '../../features/campaign/campaign-contracts';
import type { WorldLinksPage, WorldLinkRef, WorldLinksQuery } from './world-links-contracts';
import { worldLinkKey, worldLinkKinds } from './world-links-contracts';
import { WorldLinksMap } from './world-links-map';
import { renderCreatureDetail } from '../catalog/creature-detail-ui';
import { encounterEntryLabel } from '../catalog/encounter-contracts';
import { openQuickReference } from '../catalog/quick-reference-ui';
import type {
  WorldRelationPairCommand,
  WorldRelationPairHistoryCommand,
  WorldRelationPairHistoryView,
} from './world-relation-pair-contracts';
import {
  inverseWorldFamilyRelationKind,
  type WorldFamilyRelationKind,
} from '../../features/world/world-notes';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  },
  button = (text: string, fn: () => void) => {
    const n = node('button', text);
    n.type = 'button';
    n.onclick = () => {
      if (n.isConnected) fn();
    };
    return n;
  },
  field = (text: string, control: HTMLElement) => {
    const label = node('label', text);
    label.append(control);
    return label;
  },
  unwrap = <T>(r: Result<T>): T => {
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
const familyLabels: Record<WorldFamilyRelationKind, string> = {
  parent: 'Elternteil',
  child: 'Kind',
  sibling: 'Geschwister',
  partner: 'Partner',
};
export class WorldLinksWorkbench {
  private dialog = node('dialog');
  private status = node('p');
  private search = node('input');
  private kind = node('select');
  private list = node('div');
  private inspector = node('section');
  private caption = node('p');
  private targetSearch = node('input');
  private targetList = node('div');
  private label = node('input');
  private paired = node('input');
  private familyKind = node('select');
  private reverseLabel = node('input');
  private reverseField = node('label');
  private form = node('section');
  private targetCaption = node('p');
  private target: WorldLinkRef | null = null;
  private content: DeskContent | null = null;
  private draftNote: Note | null = null;
  private owner: WorkspaceGeometry | null = null;
  private focus: WorldLinkRef | null = null;
  private offset = 0;
  private request = 0;
  private detailRequest = 0;
  private targetRequest = 0;
  private inputRevision = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchComposing = false;
  private busy = false;
  private keeping: Promise<boolean> | null = null;
  private newKind = node('select');
  private newTitle = node('input');
  private prose = node('div');
  private graph: WorldLinksMap;
  private page: WorldLinksPage | null = null;
  private familyOnly = false;
  private writeId: string | null = null;
  private pairWriteId: string | null = null;
  private foreignDraft = false;
  private uncertain: PreparationCommand | null = null;
  private pairUncertain: WorldRelationPairCommand | null = null;
  private historyUncertain: WorldRelationPairHistoryCommand | null = null;
  private history: WorldLinkRef[] = [];
  private save = button('Beziehung übernehmen', () => void this.add());
  private check = button('Auftrag prüfen', () => void this.reconcile());
  private prev = button('Vorige 40', () => {
    if (this.leaveSource()) {
      this.offset = Math.max(0, this.offset - 40);
      void this.read();
    }
  });
  private next = button('Nächste 40', () => {
    if (this.leaveSource()) {
      this.offset = this.page?.next ?? this.offset;
      void this.read();
    }
  });
  private familyToggle = button('Familienansicht', () => this.toggleFamily());
  constructor(
    private workspace: () => WorkspaceGeometry | null,
    private drain: () => Promise<boolean>,
    private tell: (text: string, error?: boolean) => void,
    private openSource: (ref: WorldLinkRef, current: () => boolean) => Promise<void>,
  ) {
    this.graph = new WorldLinksMap((ref) => void this.select(ref));
    this.dialog.id = 'world-links';
    this.dialog.className = 'world-links';
    this.dialog.setAttribute('aria-labelledby', 'world-links-heading');
    const heading = node('h2', 'Zusammenhänge der Kampagne');
    heading.id = 'world-links-heading';
    const head = node('div');
    head.className = 'toolbar';
    head.append(
      heading,
      button('Stand aktualisieren', () => {
        if (this.leaveSource()) void this.read();
      }),
      button('Schließen', () => {
        if (!this.busy && this.leaveSource()) this.reset();
      }),
    );
    this.status.id = 'world-links-status';
    this.status.setAttribute('role', 'status');
    this.search.id = 'world-links-search';
    this.search.type = 'search';
    this.search.placeholder = 'Name, Notiz oder Ort suchen';
    this.search.setAttribute('aria-label', 'Kampagnenzusammenhänge durchsuchen');
    this.kind.id = 'world-links-kind';
    this.kind.setAttribute('aria-label', 'Inhaltsart');
    this.kind.add(new Option('Welt der Kampagne', 'world'));
    this.kind.add(new Option('Welt und Kataloge', 'all'));
    this.kind.add(new Option('Verknüpfte Begriffe', 'reference'));
    for (const [id, label] of Object.entries(worldLinkKinds)) this.kind.add(new Option(label, id));
    this.list.id = 'world-links-list';
    const pages = node('div');
    pages.className = 'toolbar';
    pages.append(this.prev, this.next);
    const nav = node('section');
    nav.className = 'world-links-nav';
    this.newKind.id = 'world-links-new-kind';
    this.newKind.setAttribute('aria-label', 'Art des neuen Inhalts');
    for (const [id, label] of Object.entries(worldLinkKinds))
      if (['note', 'npc', 'faction', 'quest', 'rumor', 'rule'].includes(id))
        this.newKind.add(new Option(label, id));
    this.newTitle.id = 'world-links-new-title';
    this.newTitle.placeholder = 'Neuer Inhalt: Name';
    this.newTitle.setAttribute('aria-label', 'Name des neuen Inhalts');
    nav.append(
      field('Suche', this.search),
      field('Inhalte', this.kind),
      this.caption,
      this.list,
      pages,
      node('h3', 'Neuen Weltinhalt anlegen'),
      field('Art', this.newKind),
      field('Name', this.newTitle),
      button('Inhalt anlegen', () => void this.create()),
    );
    const map = node('section'),
      tools = node('div');
    tools.className = 'toolbar';
    this.familyToggle.id = 'world-links-family';
    this.familyToggle.setAttribute('aria-pressed', 'false');
    tools.append(
      button('+ Näher', () => this.graph.zoom(0.8)),
      button('− Weiter', () => this.graph.zoom(1.25)),
      button('Einpassen', () => this.graph.fit()),
      button('Trefferübersicht', () => this.drawGraph(true)),
      this.familyToggle,
      node('span', 'Durchgezogen: Beziehungen · gestrichelt: Verweise aus Fachquellen'),
    );
    map.append(tools, this.graph.root);
    this.inspector.id = 'world-links-inspector';
    const body = node('div');
    body.className = 'world-links-columns';
    body.append(nav, map, this.inspector);
    this.targetSearch.id = 'world-link-target-search';
    this.targetSearch.type = 'search';
    this.targetSearch.placeholder = 'Beziehungsziel suchen';
    this.targetSearch.setAttribute('aria-label', 'Beziehungsziel suchen');
    this.targetList.id = 'world-link-targets';
    this.label.id = 'world-link-label';
    this.label.placeholder = 'Zum Beispiel: schuldet Geld / sucht / beschützt';
    this.label.setAttribute('aria-label', 'Beziehungsname');
    this.label.maxLength = 1000;
    this.paired.id = 'world-link-paired';
    this.paired.type = 'checkbox';
    this.familyKind.id = 'world-link-family-kind';
    this.familyKind.add(new Option('Keine ausdrückliche Familienbeziehung', ''));
    for (const kind of ['parent', 'child', 'sibling', 'partner'] as const)
      this.familyKind.add(
        new Option(
          familyLabels[kind] + ' ↔ ' + familyLabels[inverseWorldFamilyRelationKind(kind)],
          kind,
        ),
      );
    this.reverseLabel.id = 'world-link-reverse-label';
    this.reverseLabel.placeholder = 'Zum Beispiel: wird beschützt von';
    this.reverseLabel.maxLength = 1000;
    this.reverseField = field('Bezeichnung der Rückrichtung', this.reverseLabel);
    this.reverseField.hidden = true;
    this.form.id = 'world-link-form';
    this.form.append(
      node('h3', 'Neue gerichtete Beziehung'),
      field('Beziehungsziel', this.targetSearch),
      this.targetList,
      this.targetCaption,
      field('Bezeichnung', this.label),
      field('Als gegenseitiges Paar speichern', this.paired),
      field('Familientyp dieser Richtung', this.familyKind),
      this.reverseField,
      this.save,
    );
    head.append(this.check);
    this.check.hidden = true;
    this.dialog.append(head, this.status, body);
    document.body.append(this.dialog);
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (!this.busy && this.leaveSource()) this.reset();
    });
    this.search.addEventListener('input', () => this.scheduleSearch());
    this.search.onchange = () => this.scheduleSearch();
    this.search.addEventListener('compositionstart', () => {
      this.searchComposing = true;
      this.scheduleSearch();
    });
    this.search.addEventListener('compositionend', () => {
      this.searchComposing = false;
      this.scheduleSearch();
    });
    this.kind.onchange = () => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = null;
      if (this.leaveSource()) {
        this.offset = 0;
        this.invalidateQuery();
        void this.read();
      }
    };
    this.targetSearch.oninput = () => void this.searchTargets();
    this.label.oninput = () => {
      this.inputRevision++;
      this.updateSave();
      if (this.timer) clearTimeout(this.timer);
      if (!this.paired.checked)
        this.timer = setTimeout(() => {
          this.timer = null;
          void this.keep();
        }, 400);
    };
    this.reverseLabel.oninput = () => {
      this.inputRevision++;
      this.updateSave();
    };
    this.paired.onchange = () => void this.changePairMode();
    this.familyKind.onchange = () => this.changeFamilyKind();
  }
  reset() {
    this.keeping = null;
    this.busy = false;
    this.form.inert = false;
    this.request++;
    this.detailRequest++;
    this.targetRequest++;
    if (this.timer) clearTimeout(this.timer);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.timer = null;
    this.searchTimer = null;
    this.searchComposing = false;
    this.owner = null;
    this.content = null;
    this.draftNote = null;
    this.focus = null;
    this.page = null;
    this.target = null;
    this.label.value = '';
    this.reverseLabel.value = '';
    this.paired.checked = false;
    this.familyKind.value = '';
    this.familyOnly = false;
    this.familyToggle.setAttribute('aria-pressed', 'false');
    this.reverseField.hidden = true;
    this.targetSearch.value = '';
    this.writeId = null;
    this.pairWriteId = null;
    this.foreignDraft = false;
    this.uncertain = null;
    this.pairUncertain = null;
    this.historyUncertain = null;
    this.history = [];
    this.inspector.replaceChildren();
    this.list.replaceChildren();
    this.graph.root.replaceChildren();
    this.dialog.close();
  }
  private current() {
    return !!this.owner && this.workspace()?.token === this.owner.token && this.dialog.open;
  }
  private sourceGuard() {
    const owner = this.owner,
      request = this.request,
      detail = this.detailRequest,
      content = this.content;
    return () =>
      this.current() &&
      this.owner === owner &&
      this.request === request &&
      this.detailRequest === detail &&
      this.content === content;
  }
  private report(e: unknown) {
    const text = (e as Error).message;
    this.status.textContent = text;
    this.tell(text, true);
  }
  private handoff(work: (current: () => boolean) => Promise<void>) {
    const w = this.owner!;
    this.reset();
    const n = this.request,
      current = () => this.request === n && this.workspace()?.token === w.token;
    void work(current).catch((e) => {
      if (current()) this.tell((e as Error).message, true);
    });
  }
  private dirty() {
    return (
      !!this.label.value.trim() ||
      !!this.reverseLabel.value.trim() ||
      !!this.familyKind.value ||
      !!this.target ||
      !!this.uncertain ||
      !!this.pairUncertain ||
      !!this.historyUncertain
    );
  }
  private leaveSource() {
    if (this.busy || this.uncertain || this.pairUncertain || this.historyUncertain) {
      this.status.textContent = 'Laufenden Auftrag zuerst prüfen.';
      return false;
    }
    if (this.dirty()) {
      this.status.textContent = this.paired.checked
        ? 'Beziehungspaar übernehmen oder Eingabe verwerfen.'
        : 'Beziehung übernehmen oder Eingabe verwerfen; der gültige Entwurf bleibt gespeichert.';
      return false;
    }
    return true;
  }
  private updateSave() {
    this.save.disabled =
      !this.target ||
      !this.label.value.trim() ||
      (this.paired.checked && !this.reverseLabel.value.trim()) ||
      this.foreignDraft ||
      !!this.uncertain ||
      !!this.pairUncertain ||
      !!this.historyUncertain;
  }
  private async changePairMode() {
    this.inputRevision++;
    this.reverseField.hidden = !this.paired.checked;
    if (!this.paired.checked) this.familyKind.value = '';
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.paired.checked && this.writeId) {
      const w = this.owner,
        id = this.content?.ref.id,
        writeId = this.writeId;
      if (w && id)
        try {
          unwrap(await window.campaign.discardPreparationDraft(w.token, 'note', id, writeId));
          this.writeId = null;
        } catch (e) {
          this.paired.checked = false;
          this.familyKind.value = '';
          this.reverseField.hidden = true;
          this.report(e);
        }
    }
    this.updateSave();
  }
  private changeFamilyKind() {
    this.inputRevision++;
    if (this.familyKind.value) {
      this.paired.checked = true;
      this.reverseField.hidden = false;
    }
    this.updateSave();
  }
  private drawGraph(overview = false) {
    if (!this.page) return;
    const focus = overview ? null : this.page.focus;
    if (!this.familyOnly) {
      this.graph.draw({ ...this.page, focus });
      return;
    }
    const edges = this.page.edges.filter((edge) => !!edge.familyKind),
      ids = new Set(
        edges.flatMap((edge) => [worldLinkKey(edge.source), worldLinkKey(edge.target)]),
      );
    if (focus) ids.add(worldLinkKey(focus.ref));
    this.graph.draw({
      ...this.page,
      focus,
      nodes: this.page.nodes.filter((entry) => ids.has(worldLinkKey(entry.ref))),
      edges,
    });
  }
  private toggleFamily() {
    this.familyOnly = !this.familyOnly;
    this.familyToggle.setAttribute('aria-pressed', String(this.familyOnly));
    this.drawGraph();
    const count = this.page?.edges.filter((edge) => edge.familyKind).length ?? 0;
    this.status.textContent = this.familyOnly
      ? 'Familienansicht: ' +
        count +
        ' ausdrücklich typisierte Verbindungen. Freie Beziehungen bleiben in der Gesamtansicht sichtbar.'
      : 'Alle Kampagnenzusammenhänge werden gezeigt.';
  }
  private invalidateQuery() {
    this.request++;
    this.detailRequest++;
    this.focus = null;
    this.history = [];
    this.page = null;
    this.list.replaceChildren();
    this.graph.root.replaceChildren();
    this.inspector.replaceChildren(node('p', 'Passende Inhalte werden gesucht…'));
    this.caption.textContent = 'Suche wird aktualisiert…';
    this.prev.disabled = this.next.disabled = true;
    this.status.textContent = 'Zusammenhänge werden aktualisiert…';
  }
  private scheduleSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = null;
    if (!this.leaveSource()) return;
    this.invalidateQuery();
    if (this.searchComposing) return;
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.offset = 0;
      void this.read();
    }, 180);
  }
  async open(ref?: WorldLinkRef) {
    const w = this.workspace(),
      n = ++this.request;
    if (!w || !(await this.drain()) || this.workspace()?.token !== w.token || this.request !== n)
      return;
    this.reset();
    this.owner = w;
    this.search.value = '';
    this.kind.value = 'world';
    this.focus = ref ?? null;
    this.offset = 0;
    this.dialog.showModal();
    await this.read();
  }
  contextChanged() {
    if (this.owner && this.workspace()?.token !== this.owner.token) this.reset();
  }
  private async read(whileBusy = false) {
    const w = this.owner,
      n = ++this.request;
    if (!w || (this.busy && !whileBusy)) return;
    ++this.detailRequest;
    this.list.replaceChildren();
    this.graph.root.replaceChildren();
    this.inspector.replaceChildren(node('p', 'Passende Inhalte werden gelesen…'));
    this.caption.textContent = 'Zusammenhänge werden gelesen…';
    this.prev.disabled = this.next.disabled = true;
    this.status.textContent = 'Zusammenhänge werden gelesen…';
    try {
      const q: WorldLinksQuery = {
          text: this.search.value,
          kind: this.kind.value as WorldLinksQuery['kind'],
          offset: this.offset,
          focus: this.focus,
        },
        page = unwrap(await window.campaign.worldLinks(w.token, q));
      if (!this.current() || n !== this.request) return;
      this.page = page;
      this.focus = page.focus?.ref ?? null;
      this.caption.textContent =
        (page.matches.length
          ? this.offset + 1 + '–' + (this.offset + page.matches.length)
          : 'Keine Treffer') +
        ' · ' +
        page.edges.length +
        ' Verbindungen' +
        (page.hiddenLinks ? ' · weitere Verbindungen an den Quellen lesen' : '');
      this.prev.disabled = !this.offset;
      this.next.disabled = page.next === null;
      for (const entry of page.matches) {
        const b = button(
          (entry.alias ? entry.alias + ' → ' : '') +
            entry.title +
            ' · ' +
            worldLinkKinds[entry.kind],
          () => void this.select(entry.ref),
        );
        b.dataset.worldRef = worldLinkKey(entry.ref);
        b.setAttribute(
          'aria-pressed',
          String(this.focus && worldLinkKey(this.focus) === worldLinkKey(entry.ref)),
        );
        this.list.append(b);
      }
      this.drawGraph();
      this.status.textContent =
        page.notice ??
        (this.focus
          ? 'Knoten auswählen, Verbindungen erkunden oder eine Quelle bearbeiten.'
          : 'Keine passenden Kampagneninhalte gefunden.');
      if (this.focus) await this.load(this.focus);
      else this.inspector.replaceChildren(node('p', 'Keine Inhalte gefunden.'));
    } catch (e) {
      if (this.current() && n === this.request) this.report(e);
    }
  }
  private async select(ref: WorldLinkRef) {
    if (!this.leaveSource()) return;
    if (this.focus && worldLinkKey(this.focus) !== worldLinkKey(ref)) {
      this.history.push(this.focus);
      if (this.history.length > 30) this.history.shift();
    }
    this.focus = ref;
    await this.read();
  }
  private async load(ref: WorldLinkRef) {
    const w = this.owner,
      n = ++this.detailRequest;
    if (!w) return;
    this.content = null;
    this.draftNote = null;
    this.writeId = null;
    this.pairWriteId = null;
    this.foreignDraft = false;
    this.uncertain = null;
    this.pairUncertain = null;
    this.historyUncertain = null;
    this.target = null;
    this.label.value = '';
    this.reverseLabel.value = '';
    this.paired.checked = false;
    this.familyKind.value = '';
    this.reverseField.hidden = true;
    this.targetSearch.value = '';
    this.targetList.replaceChildren();
    this.targetCaption.textContent = 'Ziel noch nicht gewählt.';
    this.check.hidden = true;
    this.inspector.replaceChildren(node('p', 'Quelle wird gelesen…'));
    try {
      const c = unwrap(await window.campaign.deskContent(w.token, ref));
      if (!this.current() || n !== this.detailRequest) return;
      this.content = c;
      if (c.referenceNotice) this.caption.textContent += ' · ' + c.referenceNotice;
      const tools = node('div');
      tools.className = 'toolbar';
      tools.append(
        button(
          ref.kind === 'note' ? 'Quelle und Beziehungen bearbeiten…' : 'Quelle bearbeiten…',
          () => {
            if (!this.leaveSource()) return;
            this.handoff((current) => this.openSource(ref, current));
          },
        ),
      );
      tools.append(
        button('Referenz lesen…', () => {
          if (!this.leaveSource()) return;
          this.handoff((current) => openQuickReference(ref, current));
        }),
      );
      if (this.history.length)
        tools.append(
          button('Zurück', () => {
            if (this.leaveSource()) {
              this.focus = this.history.pop()!;
              void this.read();
            }
          }),
        );
      this.prose.replaceChildren();
      this.inspector.replaceChildren(
        node('h3', c.title),
        node('p', c.label + (c.unavailable ? ' · nicht verfügbar' : '')),
        tools,
        this.prose,
      );
      if (c.note) {
        this.familyKind.disabled = c.note.kind !== 'npc';
        const pairHistory = unwrap(await window.campaign.worldRelationPairHistory(w.token));
        if (!this.current() || n !== this.detailRequest) return;
        const undo = button(
            pairHistory.undoLabel
              ? 'Rückgängig · ' + pairHistory.undoLabel
              : 'Kein Beziehungspaar rückgängig',
            () => void this.changeHistory(pairHistory, 'undo'),
          ),
          redo = button(
            pairHistory.redoLabel
              ? 'Wiederholen · ' + pairHistory.redoLabel
              : 'Kein Beziehungspaar wiederholen',
            () => void this.changeHistory(pairHistory, 'redo'),
          );
        undo.id = 'world-link-pair-undo';
        redo.id = 'world-link-pair-redo';
        undo.disabled = !pairHistory.canUndo;
        redo.disabled = !pairHistory.canRedo;
        tools.append(undo, redo);
        this.text('Zum Vorlesen', c.note.readAloud);
        this.text('GM-Notizen', c.note.gmNotes);
        this.inspector.append(node('h3', 'Ausgehende Beziehungen'));
        for (const r of c.note.relations) {
          const link = c.links?.find(
              (l) => l.entry.ref.kind === 'note' && l.entry.ref.id === r.targetId,
            ),
            line = node('div'),
            go = button(
              (r.familyKind ? 'Familie · ' + familyLabels[r.familyKind] + ' · ' : '') +
                r.label +
                ' → ' +
                (link?.entry.title ?? r.targetId),
              () => void this.select({ kind: 'note', id: r.targetId }),
            );
          go.disabled = !!link?.entry.unavailable;
          line.append(go);
          if (!r.familyKind)
            line.append(button('Lösen', () => void this.remove(r.targetId, r.label)));
          for (const reverse of this.page?.edges.filter(
            (e) =>
              e.authored &&
              e.source.kind === 'note' &&
              e.source.id === r.targetId &&
              e.target.kind === 'note' &&
              e.target.id === c.note!.id &&
              (r.familyKind
                ? e.familyKind === inverseWorldFamilyRelationKind(r.familyKind)
                : e.familyKind === undefined),
          ) ?? [])
            line.append(
              button(
                'Paar lösen: ' + reverse.label,
                () =>
                  void this.removePair(
                    r.targetId,
                    r.label,
                    reverse.label,
                    r.familyKind,
                    reverse.familyKind,
                  ),
              ),
            );
          this.inspector.append(line);
        }
        this.inspector.append(this.form);
        this.form.hidden = !!c.unavailable;
        const d = unwrap(await window.campaign.preparationDraft(w.token, 'note', ref.id));
        if (!this.current() || n !== this.detailRequest) return;
        if (d) {
          if (!d.writeId.startsWith('world-links-')) {
            this.foreignDraft = true;
            this.status.textContent =
              'Ein vorhandener Notizentwurf bleibt erhalten. Beziehungen an dieser Quelle im Editor abschließen.';
          } else if (d.change.kind === 'note') {
            this.writeId = d.writeId;
            this.uncertain = d.failedCommand;
            this.draftNote = d.change.note;
            const added = d.change.note.relations.find(
              (r) =>
                !c.note!.relations.some(
                  (old) => old.targetId === r.targetId && old.label === r.label,
                ),
            );
            if (added) {
              this.target = { kind: 'note', id: added.targetId };
              this.label.value = added.label;
              this.targetCaption.textContent =
                'Gesicherter Beziehungsentwurf · ' +
                (this.page?.nodes.find((n) => n.ref.kind === 'note' && n.ref.id === added.targetId)
                  ?.title ?? added.targetId);
            }
            if (d.change.expectedRevision !== c.revision)
              this.status.textContent =
                'Notizbasis geändert. Eingabe behalten und aktuelle Basis ausdrücklich laden.';
          }
        }
        const pairDraft = unwrap(await window.campaign.worldRelationPairDraft(w.token, ref.id));
        if (!this.current() || n !== this.detailRequest) return;
        if (pairDraft) {
          const a = pairDraft.command.action;
          this.pairWriteId = pairDraft.writeId;
          this.pairUncertain = pairDraft.command;
          this.target = { kind: 'note', id: a.targetId };
          this.label.value = a.forwardLabel;
          this.reverseLabel.value = a.reverseLabel;
          this.paired.checked = true;
          this.familyKind.value = a.forwardFamilyKind ?? '';
          this.reverseField.hidden = false;
          this.targetCaption.textContent =
            'Gesicherter Paarauftrag · ' +
            (this.page?.nodes.find((node) => node.ref.kind === 'note' && node.ref.id === a.targetId)
              ?.title ?? a.targetId);
          this.status.textContent = 'Ein Beziehungspaarauftrag wartet auf Prüfung.';
        }
        const controls = node('div');
        controls.className = 'toolbar';
        controls.append(
          button('Eingabe verwerfen', () => void this.discard()),
          button('Nur gespeicherte Basis laden', () => void this.rebase()),
        );
        controls.className = 'world-link-controls toolbar';
        this.form.querySelector('.world-link-controls')?.remove();
        this.form.append(controls);
        this.updateSave();
        this.check.hidden = !this.uncertain && !this.pairUncertain;
      } else if (c.location) {
        this.inspector.append(
          node('p', c.location.type === 'city' ? 'Stadt' : 'Interessanter Ort'),
        );
        for (const section of c.location.sections) this.text(section.title, section.markdown);
        if (c.location.detailMaps.length)
          this.inspector.append(
            node(
              'p',
              c.location.detailMaps
                .map((m) => (m.kind === 'city' ? 'Stadtkarte vorhanden' : 'Dungeonkarte vorhanden'))
                .join(' · '),
            ),
          );
        this.inspector.append(
          node(
            'p',
            'Orts- und Fraktionsbindungen sind abgeleitet. Ändere ihre bestehenden Fachquellen.',
          ),
        );
      } else if (c.creature) {
        const detail = node('section');
        this.prose.append(detail);
        renderCreatureDetail(detail, c.creature);
        this.inspector.append(
          node(
            'p',
            'Installationsweite Katalogquelle. Encounter-Vorlagen behalten ihren eingefrorenen Quellenstand.',
          ),
        );
      } else if (c.item) {
        const item = c.item;
        this.text(
          'Aktuelle Definition',
          item.name +
            ' · Revision ' +
            item.revision +
            ' · ' +
            item.category +
            (item.magic ? ' · magisch' : ''),
        );
        this.text('Beschreibung', item.description);
        this.text('Eigenschaften', item.properties.join(', '));
        this.text(
          'Quelle',
          item.source.label + (item.source.license ? '\n' + item.source.license : ''),
        );
        this.inspector.append(
          node(
            'p',
            'Die Verbindungen zeigen historische Belohnungsrevisionen. Die aktuelle Definition berechnet abgeschlossene Belohnungen nicht neu.',
          ),
        );
      } else if (c.encounter) {
        this.text('Vorbereitungsnotizen', c.encounter.notes);
        this.text(
          'Teilnehmer',
          c.encounter.entries.map((e) => encounterEntryLabel(e, c.encounter!.sources)).join('\n'),
        );
        this.text(
          'Eingefrorener Quellenstand',
          c.encounter.sources
            .map((s) => s.name + ' · HG ' + s.challengeRating + ' · TP ' + s.hp + ' · XP ' + s.xp)
            .join('\n'),
        );
        this.inspector.append(
          node(
            'p',
            'Vorlage und gespeicherte Quellen bleiben erhalten. Der Kreaturknoten öffnet die aktuelle Katalogdefinition.',
          ),
        );
      }
      const derived = this.page?.edges.filter(
        (e) => !e.authored && worldLinkKey(e.source) === worldLinkKey(ref),
      );
      if (derived?.length) {
        this.inspector.append(node('h3', 'Verweise aus Fachquellen'));
        for (const e of derived) {
          const title =
            this.page!.nodes.find((n) => worldLinkKey(n.ref) === worldLinkKey(e.target))?.title ??
            e.target.id;
          this.inspector.append(button(e.label + ' → ' + title, () => void this.select(e.target)));
        }
      }
      const near = this.page?.edges.filter((e) => worldLinkKey(e.target) === worldLinkKey(ref));
      if (near?.length) {
        this.inspector.append(node('h3', 'Eingehende / abgeleitete Verbindungen'));
        for (const e of near) {
          const title =
            this.page!.nodes.find((n) => worldLinkKey(n.ref) === worldLinkKey(e.source))?.title ??
            e.source.id;
          this.inspector.append(button(title + ' → ' + e.label, () => void this.select(e.source)));
        }
      }
    } catch (e) {
      if (this.current() && n === this.detailRequest) this.report(e);
    }
  }
  private text(title: string, text: string) {
    if (text) this.prose.append(node('h4', title), node('pre', plainReferenceText(text)));
  }
  private async searchTargets() {
    const w = this.owner,
      n = ++this.targetRequest;
    if (!w) return;
    try {
      const result = unwrap(
        await window.campaign.searchDesk(w.token, 'world', this.targetSearch.value, 0),
      );
      if (!this.current() || n !== this.targetRequest) return;
      this.targetList.replaceChildren();
      for (const row of result.entries.filter((e) => e.ref.kind === 'note').slice(0, 25))
        this.targetList.append(
          button(row.title + ' · ' + row.label, () => {
            this.inputRevision++;
            this.target = { kind: 'note', id: row.ref.id };
            this.targetCaption.textContent = 'Ziel: ' + row.title;
            this.updateSave();
            if (!this.paired.checked) void this.keep();
          }),
        );
    } catch (e) {
      if (this.current() && n === this.targetRequest) this.report(e);
    }
  }
  private proposed(): Note | null {
    const note = this.draftNote ?? this.content?.note;
    if (!note || !this.target || !this.label.value.trim()) return null;
    const relations = note.relations.some(
      (r) => r.targetId === this.target!.id && r.label === this.label.value,
    )
      ? note.relations
      : [...note.relations, { targetId: campaignLocalId(this.target.id), label: this.label.value }];
    return { ...note, relations };
  }
  async flush() {
    if (this.busy) return true;
    if (this.uncertain || this.pairUncertain || this.historyUncertain) return false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.paired.checked && this.proposed() && !this.foreignDraft) return await this.keep();
    return true;
  }
  private async keep(): Promise<boolean> {
    const current = this.sourceGuard();
    if (this.keeping) {
      if (!(await this.keeping) || !current()) return false;
      return this.keep();
    }
    const w = this.owner,
      note = this.proposed();
    if (!w || !note || this.foreignDraft || this.uncertain) return false;
    const expected = this.writeId,
      writeId = 'world-links-' + crypto.randomUUID(),
      draft: PreparationDraft = {
        version: 1,
        writeId,
        change: { kind: 'note', expectedRevision: note.revision, note },
        failedCommand: null,
      };
    const task = Promise.resolve().then(async () => {
      try {
        if (!current()) return false;
        unwrap(await window.campaign.keepDeskDraft(w.token, draft, expected));
        if (!current()) return false;
        this.writeId = writeId;
        this.draftNote = note;
        return true;
      } catch (e) {
        if (current()) this.report(e);
        return false;
      } finally {
        if (this.keeping === task) this.keeping = null;
      }
    });
    this.keeping = task;
    return task;
  }

  private async add() {
    if (this.paired.checked) {
      await this.addPair();
      return;
    }
    const note = this.proposed();
    if (!note || this.busy || this.foreignDraft || this.uncertain || this.pairUncertain) return;
    if (note.relations.length === this.content!.note!.relations.length) {
      this.status.textContent = 'Diese Beziehung ist bereits vorhanden.';
      return;
    }
    const current = this.sourceGuard(),
      input = this.inputRevision;
    this.busy = true;
    this.form.inert = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      if (!(await this.keep()) || !current()) return;
      if (input !== this.inputRevision) {
        this.status.textContent = 'Eingabe geändert. Beziehung erneut ausdrücklich übernehmen.';
        return;
      }
      await this.commit({ kind: 'note', expectedRevision: note.revision, note });
    } finally {
      if (current()) {
        this.busy = false;
        this.form.inert = false;
        this.updateSave();
      }
    }
  }
  private async remove(id: string, label: string) {
    const note = this.content?.note;
    if (!note || this.busy || this.foreignDraft || !this.leaveSource()) return;
    await this.commit({
      kind: 'note',
      expectedRevision: note.revision,
      note: {
        ...note,
        relations: note.relations.filter((r) => r.targetId !== id || r.label !== label),
      },
    });
  }
  private async addPair() {
    const source = this.content?.note,
      target = this.target,
      w = this.owner;
    if (
      !source ||
      !target ||
      target.kind !== 'note' ||
      !w ||
      this.busy ||
      this.foreignDraft ||
      this.uncertain ||
      this.pairUncertain ||
      !this.label.value.trim() ||
      !this.reverseLabel.value.trim()
    )
      return;
    const current = this.sourceGuard(),
      input = this.inputRevision,
      forwardLabel = this.label.value,
      reverseLabel = this.reverseLabel.value,
      familyKind = this.familyKind.value as WorldFamilyRelationKind | '';
    this.busy = true;
    this.form.inert = true;
    try {
      const targetContent = unwrap(await window.campaign.deskContent(w.token, target));
      if (!current()) return;
      if (input !== this.inputRevision) {
        this.status.textContent =
          'Eingabe geändert. Beziehungspaar erneut ausdrücklich übernehmen.';
        return;
      }
      if (!targetContent.note || targetContent.unavailable)
        throw new Error('Ziel des Beziehungspaars ist nicht verfügbar.');
      if (familyKind && (source.kind !== 'npc' || targetContent.note.kind !== 'npc'))
        throw new Error('Familienbeziehungen verbinden ausschließlich NPCs.');
      await this.commitPair({
        kind: 'add',
        sourceId: source.id,
        targetId: target.id,
        sourceRevision: source.revision,
        targetRevision: targetContent.note.revision,
        forwardLabel,
        reverseLabel,
        ...(familyKind
          ? {
              forwardFamilyKind: familyKind,
              reverseFamilyKind: inverseWorldFamilyRelationKind(familyKind),
            }
          : {}),
      });
    } catch (e) {
      if (current()) this.report(e);
    } finally {
      if (current()) {
        this.busy = false;
        this.form.inert = false;
        this.updateSave();
      }
    }
  }
  private async removePair(
    targetId: string,
    forwardLabel: string,
    reverseLabel: string,
    forwardFamilyKind?: WorldFamilyRelationKind,
    reverseFamilyKind?: WorldFamilyRelationKind,
  ) {
    const source = this.content?.note,
      w = this.owner;
    if (!source || !w || this.busy || this.foreignDraft || !this.leaveSource()) return;
    const current = this.sourceGuard(),
      input = this.inputRevision;
    this.busy = true;
    this.form.inert = true;
    try {
      const target = unwrap(
        await window.campaign.deskContent(w.token, { kind: 'note', id: targetId }),
      );
      if (!current()) return;
      if (input !== this.inputRevision) {
        this.status.textContent = 'Eingabe geändert. Paar lösen erneut ausdrücklich bestätigen.';
        return;
      }
      if (!target.note || target.unavailable)
        throw new Error('Ziel des Beziehungspaars ist nicht verfügbar.');
      await this.commitPair({
        kind: 'remove',
        sourceId: source.id,
        targetId,
        sourceRevision: source.revision,
        targetRevision: target.note.revision,
        forwardLabel,
        reverseLabel,
        ...(forwardFamilyKind ? { forwardFamilyKind, reverseFamilyKind } : {}),
      });
    } catch (e) {
      if (current()) this.report(e);
    } finally {
      if (current()) {
        this.busy = false;
        this.form.inert = false;
        this.updateSave();
      }
    }
  }
  private async commitPair(action: WorldRelationPairCommand['action']) {
    const w = this.owner;
    if (!w) return;
    const current = this.sourceGuard(),
      request = this.request,
      input = this.inputRevision,
      active = () =>
        this.current() &&
        this.owner === w &&
        (this.request === request || this.request === request + 1);
    this.busy = true;
    this.form.inert = true;
    this.save.disabled = true;
    const writeId = 'world-links-pair-' + crypto.randomUUID(),
      command: WorldRelationPairCommand = {
        commandId: crypto.randomUUID(),
        campaignId: w.campaign.id,
        token: w.token,
        draftWriteId: writeId,
        action,
      };
    try {
      unwrap(
        await window.campaign.keepWorldRelationPairDraft(
          w.token,
          { version: 1, writeId, command },
          this.pairWriteId,
        ),
      );
      if (!current()) return;
      this.pairWriteId = writeId;
      if (!(await this.drain()) || !current()) return;
      unwrap(await window.campaign.executeWorldRelationPair(command));
      if (!current()) return;
      this.pairWriteId = null;
      this.pairUncertain = null;
      if (input !== this.inputRevision) {
        this.status.textContent =
          'Beziehungspaar gespeichert; neuere Eingaben bleiben erhalten. Vor Übernahme nur die gespeicherte Basis laden.';
        return;
      }
      this.label.value = '';
      this.reverseLabel.value = '';
      this.familyKind.value = '';
      this.target = null;
      this.paired.checked = false;
      this.reverseField.hidden = true;
      await this.read(true);
      if (active())
        this.status.textContent =
          this.foreignDraft || this.uncertain || this.pairUncertain
            ? 'Paarauftrag gespeichert; ein vorhandener Entwurf bleibt offen.'
            : action.kind === 'add'
              ? 'Beziehungspaar in beiden Richtungen gespeichert.'
              : 'Beziehungspaar in beiden Richtungen gelöst.';
    } catch (e) {
      if (current()) {
        this.pairUncertain = command;
        this.check.hidden = false;
        this.report(e);
      }
    } finally {
      if (active()) {
        this.busy = false;
        this.form.inert = false;
        this.updateSave();
      }
    }
  }
  private async changeHistory(view: WorldRelationPairHistoryView, direction: 'undo' | 'redo') {
    const w = this.owner;
    if (!w || this.busy || !this.leaveSource()) return;
    const current = this.sourceGuard(),
      request = this.request,
      input = this.inputRevision,
      active = () =>
        this.current() &&
        this.owner === w &&
        (this.request === request || this.request === request + 1),
      command: WorldRelationPairHistoryCommand = {
        commandId: crypto.randomUUID(),
        campaignId: w.campaign.id,
        token: w.token,
        expectedCursor: view.cursor,
        direction,
      };
    this.busy = true;
    this.form.inert = true;
    try {
      if (!(await this.drain()) || !current()) return;
      unwrap(await window.campaign.executeWorldRelationPairHistory(command));
      if (!current()) return;
      if (input !== this.inputRevision) {
        this.status.textContent =
          'Paar-History gespeichert; neuere Eingaben bleiben erhalten. Vor Übernahme nur die gespeicherte Basis laden.';
        return;
      }
      await this.read(true);
      if (active())
        this.status.textContent =
          this.foreignDraft || this.uncertain || this.pairUncertain
            ? 'Paar-History gespeichert; ein vorhandener Entwurf bleibt offen.'
            : direction === 'undo'
              ? 'Beziehungspaar gemeinsam rückgängig gemacht.'
              : 'Beziehungspaar gemeinsam wiederholt.';
    } catch (e) {
      if (current()) {
        this.historyUncertain = command;
        this.check.hidden = false;
        this.report(e);
      }
    } finally {
      if (active()) {
        this.busy = false;
        this.form.inert = false;
        this.updateSave();
      }
    }
  }
  private async commit(change: PreparationCommand['change']) {
    const w = this.owner;
    if (!w) return false;
    const current = this.sourceGuard(),
      request = this.request,
      input = this.inputRevision,
      active = () =>
        this.current() &&
        this.owner === w &&
        (this.request === request || this.request === request + 1);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.busy = true;
    this.form.inert = true;
    this.save.disabled = true;
    const writeId =
        change.kind === 'note' && change.expectedRevision !== null
          ? 'world-links-' + crypto.randomUUID()
          : null,
      command: PreparationCommand = {
        commandId: crypto.randomUUID(),
        campaignId: w.campaign.id,
        token: w.token,
        ...(writeId ? { draftWriteId: writeId } : {}),
        change,
      };
    try {
      if (writeId && change.kind === 'note') {
        const draft: PreparationDraft = {
          version: 1,
          writeId,
          change: { ...change, expectedRevision: change.expectedRevision! },
          failedCommand: command,
        };
        unwrap(await window.campaign.keepDeskDraft(w.token, draft, this.writeId));
        if (!current()) return false;
        this.writeId = writeId;
      }
      if (!(await this.drain()) || !current()) return false;
      const result = unwrap(await window.campaign.changePreparationContent(command));
      if (!current()) return false;
      this.writeId = null;
      this.uncertain = null;
      if (input !== this.inputRevision) {
        this.status.textContent =
          'Auftrag gespeichert; neuere Eingaben bleiben erhalten. Vor Übernahme nur die gespeicherte Basis laden.';
        return true;
      }
      this.focus = { kind: result.ref.kind as WorldLinkRef['kind'], id: result.ref.id };
      this.label.value = '';
      this.target = null;
      await this.read(true);
      if (!active()) return false;
      this.status.textContent =
        this.foreignDraft || this.uncertain || this.pairUncertain
          ? 'Auftrag gespeichert; ein vorhandener Entwurf bleibt offen.'
          : change.kind === 'note' && change.expectedRevision === null
            ? 'Weltinhalt angelegt. Texte im vorhandenen Editor bearbeiten.'
            : 'Beziehung gespeichert. Originaltexte und sonstige Bindungen bleiben erhalten.';
      return true;
    } catch (e) {
      if (current()) {
        this.uncertain = command;
        this.check.hidden = false;
        this.report(e);
      }
      return false;
    } finally {
      if (active()) {
        this.busy = false;
        this.form.inert = false;
        this.updateSave();
      }
    }
  }
  private async create() {
    const w = this.owner,
      title = this.newTitle.value;
    if (!w || !title.trim() || this.busy || !this.leaveSource()) return;
    const note: Note = {
      version: 1,
      id: campaignLocalId(crypto.randomUUID()),
      revision: 1,
      kind: this.newKind.value as Note['kind'],
      title,
      readAloud: '',
      gmNotes: '',
      relations: [],
      creatureId: null,
      deleted: false,
    };
    if (
      (await this.commit({ kind: 'note', expectedRevision: null, note })) &&
      this.newTitle.value === title
    )
      this.newTitle.value = '';
  }

  private async reconcile() {
    const w = this.owner;
    if (!w || this.busy) return;
    if (this.pairUncertain) {
      await this.reconcilePair(this.pairUncertain, w);
      return;
    }
    const historyCommand = this.historyUncertain,
      command = historyCommand ? null : this.uncertain;
    if (!command && !historyCommand) return;
    const request = this.request,
      current = () =>
        this.current() &&
        this.owner === w &&
        this.request === request &&
        (historyCommand ? this.historyUncertain === historyCommand : this.uncertain === command);
    const addition =
      command?.change.kind === 'note'
        ? command.change.note.relations.find(
            (relation) =>
              !this.content?.note?.relations.some(
                (old) => old.targetId === relation.targetId && old.label === relation.label,
              ),
          )
        : undefined;
    const unchanged = () =>
      (!this.target &&
        !this.label.value &&
        !this.reverseLabel.value &&
        !this.familyKind.value &&
        !this.paired.checked) ||
      (!!addition &&
        !historyCommand &&
        !this.paired.checked &&
        !this.reverseLabel.value &&
        !this.familyKind.value &&
        this.target?.kind === 'note' &&
        this.target.id === addition.targetId &&
        this.label.value === addition.label);
    const clear = () => {
      if (historyCommand) this.historyUncertain = null;
      else this.uncertain = null;
      this.check.hidden = !this.uncertain && !this.pairUncertain && !this.historyUncertain;
    };
    const confirmed = historyCommand
      ? 'Paar-Historyauftrag als gespeichert bestätigt.'
      : 'Auftrag als gespeichert bestätigt.';
    this.busy = true;
    this.form.inert = true;
    try {
      const result = historyCommand
        ? unwrap(await window.campaign.reconcileWorldRelationPairHistory(historyCommand, w.token))
        : unwrap(await window.campaign.reconcilePreparationContent(command!, w.token));
      if (!current()) return;
      if (result.outcome !== 'applied') {
        clear();
        this.status.textContent = historyCommand
          ? 'Paar-Historyauftrag nicht gespeichert. Stand aktualisieren und erneut ausführen.'
          : 'Auftrag nicht gespeichert. Eingaben bleiben; aktuelle Basis laden und erneut ausdrücklich bestätigen.';
        return;
      }
      if (command?.change.kind === 'note') {
        const id = command.change.note.id,
          draft = unwrap(await window.campaign.preparationDraft(w.token, 'note', id));
        if (!current()) return;
        if (draft && draft.writeId !== command.draftWriteId) {
          clear();
          this.writeId = null;
          if (!unchanged()) {
            this.foreignDraft = true;
            this.status.textContent =
              'Auftrag bestätigt. Neuere lokale Eingaben und ein anderer gespeicherter Entwurf bleiben erhalten. Eingabe verwerfen lädt nur den gespeicherten Entwurf.';
            return;
          }
          this.focus = { kind: 'note', id };
          await this.read(true);
          if (this.current() && this.owner === w && this.request === request + 1)
            this.status.textContent = 'Auftrag bestätigt; ein vorhandener Entwurf bleibt offen.';
          return;
        }
        if (draft) {
          unwrap(await window.campaign.discardPreparationDraft(w.token, 'note', id, draft.writeId));
          if (!current()) return;
        }
        this.writeId = null;
      }
      const refresh = unchanged();
      clear();
      if (!refresh) {
        this.status.textContent =
          confirmed +
          ' Neuere Eingaben bleiben erhalten. Vor Übernahme nur die gespeicherte Basis laden.';
        return;
      }
      if (command?.change.kind === 'note') {
        this.focus = { kind: 'note', id: command.change.note.id };
        if (
          command.change.expectedRevision === null &&
          this.newTitle.value === command.change.note.title
        )
          this.newTitle.value = '';
      }
      this.label.value = '';
      this.reverseLabel.value = '';
      this.familyKind.value = '';
      this.target = null;
      this.paired.checked = false;
      this.reverseField.hidden = true;
      await this.read(true);
      if (this.current() && this.owner === w && this.request === request + 1)
        this.status.textContent =
          this.foreignDraft || this.uncertain || this.pairUncertain
            ? 'Auftrag bestätigt; ein vorhandener Entwurf bleibt offen.'
            : confirmed;
    } catch (e) {
      if (current()) this.report(e);
    } finally {
      if (
        this.owner === w &&
        this.current() &&
        (this.request === request || this.request === request + 1)
      ) {
        this.busy = false;
        this.form.inert = false;
        this.updateSave();
      }
    }
  }
  private async reconcilePair(command: WorldRelationPairCommand, w: WorkspaceGeometry) {
    const request = this.request,
      current = () =>
        this.current() &&
        this.owner === w &&
        this.request === request &&
        this.pairUncertain === command;
    const unchanged = () => {
      const a = command.action;
      return a.kind === 'remove'
        ? !this.label.value && !this.reverseLabel.value && !this.target && !this.familyKind.value
        : !!this.paired.checked &&
            this.target?.kind === 'note' &&
            this.target.id === a.targetId &&
            this.label.value === a.forwardLabel &&
            this.reverseLabel.value === a.reverseLabel &&
            this.familyKind.value === (a.forwardFamilyKind ?? '');
    };
    this.busy = true;
    this.form.inert = true;
    try {
      const result = unwrap(await window.campaign.reconcileWorldRelationPair(command, w.token));
      if (!current()) return;
      if (result.outcome !== 'applied') {
        this.pairUncertain = null;
        this.check.hidden = !this.uncertain;
        this.status.textContent =
          'Paarauftrag nicht gespeichert. Eingaben bleiben; aktuelle Basis laden und erneut bestätigen.';
        return;
      }
      const draft = unwrap(
        await window.campaign.worldRelationPairDraft(w.token, command.action.sourceId),
      );
      if (!current()) return;
      if (draft && draft.writeId !== command.draftWriteId) {
        if (!unchanged()) {
          this.pairUncertain = null;
          this.pairWriteId = null;
          this.foreignDraft = true;
          this.check.hidden = !this.uncertain;
          this.status.textContent =
            'Früherer Paarauftrag bestätigt. Neuere lokale Eingaben und ein anderer gespeicherter Paarentwurf bleiben erhalten. Eingabe verwerfen lädt nur den gespeicherten Entwurf.';
          return;
        }
        this.pairUncertain = null;
        this.pairWriteId = null;
        this.check.hidden = true;
        await this.read(true);
        if (this.current() && this.owner === w && this.request === request + 1)
          this.status.textContent =
            'Früherer Paarauftrag bestätigt; der neuere Paarentwurf bleibt zur Prüfung offen.';
        return;
      }
      if (draft) {
        unwrap(
          await window.campaign.discardWorldRelationPairDraft(
            w.token,
            command.action.sourceId,
            draft.writeId,
          ),
        );
        if (!current()) return;
      }
      const refresh = unchanged();
      this.pairUncertain = null;
      this.pairWriteId = null;
      this.check.hidden = !this.uncertain;
      if (!refresh) {
        this.status.textContent =
          'Beziehungspaarauftrag bestätigt; neuere Eingaben bleiben erhalten. Vor Übernahme nur die gespeicherte Basis laden.';
        return;
      }
      this.label.value = '';
      this.reverseLabel.value = '';
      this.familyKind.value = '';
      this.target = null;
      this.paired.checked = false;
      this.reverseField.hidden = true;
      await this.read(true);
      if (this.current() && this.owner === w && this.request === request + 1)
        this.status.textContent = this.pairUncertain
          ? 'Früherer Paarauftrag bestätigt; der neuere Paarentwurf bleibt zur Prüfung offen.'
          : 'Beziehungspaarauftrag als gespeichert bestätigt.';
    } catch (e) {
      if (current()) this.report(e);
    } finally {
      if (
        this.owner === w &&
        this.current() &&
        (this.request === request || this.request === request + 1)
      ) {
        this.busy = false;
        this.form.inert = false;
        this.updateSave();
      }
    }
  }
  private async rebase() {
    const w = this.owner,
      ref = this.content?.ref;
    if (
      !w ||
      !ref ||
      ref.kind !== 'note' ||
      this.uncertain ||
      this.pairUncertain ||
      this.historyUncertain ||
      this.busy
    )
      return;
    try {
      const c = unwrap(await window.campaign.deskContent(w.token, ref));
      if (!this.current() || this.content?.ref.id !== ref.id) return;
      this.content = c;
      this.draftNote = null;
      this.prose.replaceChildren();
      if (c.note) {
        this.text('Zum Vorlesen', c.note.readAloud);
        this.text('GM-Notizen', c.note.gmNotes);
      }
      this.inspector.querySelector('h3')!.textContent = c.title;
      if (!this.paired.checked) await this.keep();
      this.updateSave();
      this.status.textContent = 'Aktuelle Texte geladen; Beziehungsname und Ziel bleiben erhalten.';
    } catch (e) {
      this.report(e);
    }
  }
  private async discard() {
    const w = this.owner,
      id = this.content?.ref.id,
      writeId = this.writeId,
      pairWriteId = this.pairWriteId;
    if (!w || !id || this.busy || this.historyUncertain) return;
    try {
      if (writeId)
        unwrap(await window.campaign.discardPreparationDraft(w.token, 'note', id, writeId));
      if (pairWriteId)
        unwrap(await window.campaign.discardWorldRelationPairDraft(w.token, id, pairWriteId));
      this.label.value = '';
      this.reverseLabel.value = '';
      this.familyKind.value = '';
      this.target = null;
      this.writeId = null;
      this.pairWriteId = null;
      this.draftNote = null;
      this.uncertain = null;
      this.pairUncertain = null;
      this.paired.checked = false;
      this.reverseField.hidden = true;
      await this.read();
    } catch (e) {
      this.report(e);
    }
  }
}
