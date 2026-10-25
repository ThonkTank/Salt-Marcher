import type { WorkspaceGeometry, Result } from './contracts';
import type { LiveScene } from './live-contracts';
import type { SceneVisit, SceneVisitPage } from './scene-visit-contracts';
import { visitOutcomeLabel } from './visit-outcome-contracts';
import { renderCreatureDetail } from './creature-detail-ui';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  },
  button = (text: string, fn: () => void) => {
    const n = node('button', text);
    n.type = 'button';
    n.onclick = fn;
    return n;
  },
  unwrap = <T>(r: Result<T>): T => {
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
type Context = { workspace: WorkspaceGeometry; scene: LiveScene };
export class SceneVisitBinder {
  private dialog = node('dialog');
  private list = node('div');
  private document = node('div');
  private search = node('input');
  private caption = node('p');
  private status = node('p');
  private prev = button('Neuere Besuche', () => {
    if (this.cursorStack.length) {
      this.cursor = this.cursorStack.pop()!;
      void this.load();
    }
  });
  private next = button('Ältere Besuche', () => {
    if (this.page?.next) {
      this.cursorStack.push(this.cursor);
      this.cursor = this.page.next;
      void this.load();
    }
  });
  private refresh = button('Aktualisieren', () => {
    this.cursor = null;
    this.cursorStack = [];
    void this.load();
  });
  private owner: Context | null = null;
  private page: SceneVisitPage | null = null;
  private selected: SceneVisit | null = null;
  private request = 0;
  private detailRequest = 0;
  private cursor: string | null = null;
  private cursorStack: (string | null)[] = [];
  constructor(
    private tell: (text: string, error?: boolean) => void,
    private context: () => Context | null,
    private flush: () => Promise<boolean>,
    private readAloud: (text: string, title: string, sceneId: string) => Promise<void>,
    private openNote: (id: string) => Promise<void>,
  ) {
    this.dialog.id = 'scene-visit-binder';
    this.dialog.className = 'scene-visit-binder';
    this.list.id = 'scene-visit-list';
    this.document.id = 'scene-visit-document';
    this.caption.id = 'scene-visit-caption';
    this.status.id = 'scene-visit-status';
    this.status.setAttribute('role', 'status');
    this.search.id = 'scene-visit-search';
    this.search.type = 'search';
    this.search.placeholder = 'Besuche auf dieser Seite durchsuchen';
    this.search.setAttribute('aria-label', 'Besuche auf dieser Seite durchsuchen');
    const head = node('div');
    head.className = 'toolbar';
    head.append(
      node('h2', 'Besuchsbinder der Gruppe'),
      this.refresh,
      button('Schließen', () => this.reset()),
    );
    const body = node('div');
    body.className = 'scene-visit-columns';
    const nav = node('section');
    nav.append(this.search, this.caption, this.list);
    const pages = node('div');
    pages.className = 'toolbar';
    pages.append(this.prev, this.next);
    nav.append(pages);
    body.append(nav, this.document);
    this.dialog.append(head, this.status, body);
    document.body.append(this.dialog);
    const open = button('Übernommene Besuche ansehen…', () => void this.open());
    open.id = 'scene-visit-open';
    document.getElementById('live-session-progress-refresh')!.after(open);
    this.search.oninput = () => {
      this.drawList();
      this.drawDocument();
    };
    this.dialog.addEventListener('cancel', () => this.reset());
  }
  reset() {
    this.request++;
    this.detailRequest++;
    this.owner = null;
    this.page = null;
    this.selected = null;
    this.list.replaceChildren();
    this.document.replaceChildren();
    this.dialog.close();
  }
  contextChanged() {
    if (
      this.owner &&
      (this.context()?.workspace.token !== this.owner.workspace.token ||
        this.context()?.scene.id !== this.owner.scene.id)
    )
      this.reset();
  }
  private current(owner = this.owner) {
    const c = this.context();
    return (
      !!owner &&
      this.owner === owner &&
      c?.workspace.token === owner.workspace.token &&
      c.scene.id === owner.scene.id &&
      this.dialog.open
    );
  }
  private report(message: string) {
    this.status.textContent = message;
    this.tell(message, true);
  }
  private async open() {
    const c = this.context();
    let run = ++this.request;
    if (!c) return;
    try {
      if (
        !(await this.flush()) ||
        run !== this.request ||
        this.context()?.workspace.token !== c.workspace.token ||
        this.context()?.scene.id !== c.scene.id
      )
        return;
      this.reset();
      run = this.request;
      this.owner = c;
      this.cursor = null;
      this.cursorStack = [];
      this.search.value = '';
      this.status.textContent = '';
      this.dialog.showModal();
      await this.load();
    } catch (e) {
      if (
        run === this.request &&
        this.context()?.workspace.token === c.workspace.token &&
        this.context()?.scene.id === c.scene.id
      )
        this.report((e as Error).message);
    }
  }
  private async load() {
    const o = this.owner,
      n = ++this.request,
      selectedId = this.selected?.adoptionId;
    if (!o || !this.current(o)) return;
    this.detailRequest++;
    this.page = null;
    this.selected = null;
    this.list.replaceChildren();
    this.document.replaceChildren();
    this.caption.textContent = '';
    this.prev.disabled = this.next.disabled = this.refresh.disabled = true;
    this.status.textContent = 'Übernommene Besuche werden gelesen…';
    try {
      const p = unwrap(
        await window.campaign.sceneVisits(o.workspace.token, o.scene.id, this.cursor),
      );
      if (!this.current(o) || n !== this.request) return;
      this.page = p;
      this.selected = p.items.find((v) => v.adoptionId === selectedId) ?? p.items[0] ?? null;
      this.drawList();
      this.drawDocument();
      this.status.textContent =
        'Gespeicherte Übernahmen für ' +
        p.sceneTitle +
        '. Texte stammen aus der Übernahme; Weltverweise und NPC-Werte zeigen ihren aktuellen Stand.';
    } catch (e) {
      if (n === this.request && this.current(o)) this.report((e as Error).message);
    } finally {
      if (n === this.request && this.current(o)) {
        this.prev.disabled = !this.cursorStack.length;
        this.next.disabled = !this.page?.next;
        this.refresh.disabled = false;
      }
    }
  }
  private drawList() {
    const owner = this.owner,
      n = this.request;
    if (!this.current(owner)) return;
    const q = this.search.value.trim().toLocaleLowerCase(),
      items =
        this.page?.items.filter(
          (v) =>
            !q ||
            [
              v.title,
              v.notes,
              v.readAloud,
              v.planName,
              v.location,
              v.outcome?.text,
              ...v.references.map((r) => r.title),
            ].some((t) => t?.toLocaleLowerCase().includes(q)),
        ) ?? [];
    this.selected =
      items.find((v) => v.adoptionId === this.selected?.adoptionId) ?? items[0] ?? null;
    this.caption.textContent =
      items.length + ' von ' + (this.page?.items.length ?? 0) + ' Besuchen auf dieser Seite';
    this.list.replaceChildren();
    for (const v of items) {
      const b = button(
        v.ordinal +
          1 +
          '. ' +
          (v.title || 'Unbenannter Besuch') +
          (v.current ? ' · aktuell' : '') +
          '\n' +
          v.planName +
          ' · ' +
          (v.outcome ? visitOutcomeLabel(v.outcome.status) : 'Ergebnis offen'),
        () => {
          if (!this.current(owner) || n !== this.request || !b.isConnected) return;
          this.selected = v;
          this.drawList();
          this.drawDocument();
        },
      );
      b.dataset.adoptionId = v.adoptionId;
      b.classList.toggle('selected', this.selected?.adoptionId === v.adoptionId);
      this.list.append(b);
    }
    if (!items.length)
      this.list.append(
        node('p', q ? 'Auf dieser Seite kein passender Besuch.' : 'Noch keine Besuche übernommen.'),
      );
  }
  private drawDocument() {
    const owner = this.owner,
      v = this.selected,
      n = ++this.detailRequest;
    this.document.replaceChildren();
    if (!v || !owner) return;
    const current = () => this.current(owner) && n === this.detailRequest;
    this.document.append(
      node('h3', v.title || 'Unbenannter Besuch'),
      node(
        'p',
        v.planName +
          ' · Planrevision ' +
          v.planRevision +
          ' · ' +
          (v.location || 'Ohne verfügbaren Ortsverweis') +
          (v.capturedAt ? ' · übernommen ' + new Date(v.capturedAt).toLocaleString('de-DE') : ''),
      ),
    );
    for (const warning of v.warnings) {
      const p = node('p', warning);
      p.className = 'scene-visit-warning';
      this.document.append(p);
    }
    const aloud = node('section');
    aloud.append(
      node('h4', 'Zum Vorlesen'),
      node('pre', v.readAloud || 'Kein festgehaltener Vorlesetext.'),
    );
    if (v.readAloud.trim()) {
      const use = button('In aktuelle Gruppe als Vorlesetext übernehmen', () => {
        if (!current() || !use.isConnected) return;
        use.disabled = true;
        void this.readAloud(v.readAloud, v.title, owner.scene.id)
          .then(() => {
            if (current() && use.isConnected)
              this.status.textContent = 'Vorlesetext in der aktuellen Gruppe gespeichert.';
          })
          .catch((e) => {
            if (current() && use.isConnected) this.report(e.message);
          })
          .finally(() => {
            if (use.isConnected) use.disabled = false;
          });
      });
      use.id = 'scene-visit-read-aloud';
      aloud.append(use);
    }
    this.document.append(
      aloud,
      node('h4', 'Übernommene GM-Notizen'),
      node('pre', v.notes || 'Keine GM-Notizen.'),
      node('h4', 'Bestätigtes Besuchsergebnis'),
      node(
        'p',
        v.outcome
          ? visitOutcomeLabel(v.outcome.status) +
              ' · ' +
              new Date(v.outcome.recordedAt).toLocaleString('de-DE')
          : 'Ergebnis noch offen',
      ),
      node('pre', v.outcome?.text ?? ''),
    );
    const refs = node('section');
    refs.append(node('h4', 'Gebundene Weltverweise'));
    for (const r of v.references) {
      const b = button(r.title + (r.available ? ' · ' + r.kind : ' · nicht verfügbar'), () => {
        if (!r.available || !current() || !b.isConnected) return;
        this.reset();
        void this.openNote(r.id).catch((e) => {
          if (this.context()?.workspace.token === owner.workspace.token) this.tell(e.message, true);
        });
      });
      b.disabled = !r.available;
      refs.append(b);
    }
    if (!v.references.length) refs.append(node('p', 'Keine festgehaltene Notizbindung.'));
    this.document.append(refs, node('h4', 'Übernommene Gruppen · aktueller Weltstand'));
    for (const g of v.groups) {
      const details = node('details');
      details.append(node('summary', g.title));
      let loaded = false;
      details.addEventListener('toggle', () => {
        if (!details.open || loaded || !current() || !details.isConnected) return;
        loaded = true;
        void window.campaign
          .preparedGroup(owner.workspace.token, g.id)
          .then((r) => {
            if (!current() || !details.isConnected) return;
            const group = unwrap(r);
            details.append(
              node('pre', group.notes),
              node(
                'p',
                group.actors
                  .map(
                    (a) =>
                      a.name +
                      ' · HP ' +
                      a.hp +
                      '/' +
                      a.maxHp +
                      (a.conditions ? ' · ' + a.conditions : '') +
                      (a.defeated ? ' · besiegt' : '') +
                      (a.unavailable ? ' · nicht verfügbar' : ''),
                  )
                  .join('\n'),
              ),
            );
            for (const c of group.plan.sources) {
              const d = node('details');
              d.append(node('summary', 'Statblock: ' + c.name));
              let drawn = false;
              d.addEventListener('toggle', () => {
                if (d.open && !drawn && current() && d.isConnected) {
                  drawn = true;
                  const body = node('div');
                  renderCreatureDetail(body, c);
                  d.append(body);
                }
              });
              details.append(d);
            }
          })
          .catch((e) => {
            if (current() && details.isConnected)
              details.append(node('p', 'Gruppeninhalt nicht verfügbar: ' + e.message));
          });
      });
      this.document.append(details);
    }
    if (!v.groups.length) this.document.append(node('p', 'Keine übernommenen Begegnungsgruppen.'));
  }
}
