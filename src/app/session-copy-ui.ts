import {
  writeConfirmed,
  hasPendingCommit,
  onCommitState,
  onCommitResolved,
} from './commit-confirmation';
import type { WorkspaceGeometry, Result } from './contracts';
import type { Preparation } from './preparation-contracts';
import type { ManualPlan } from '../features/planner/manual-planner';
import type { SessionView, SessionSnapshot, SessionCommand } from './session-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const button = (text: string, click: () => void) => {
  const n = node('button', text);
  n.type = 'button';
  n.onclick = click;
  return n;
};
const unwrap = <T>(r: Result<T>) => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
type Context = { workspace: WorkspaceGeometry; plan: ManualPlan; sources: Preparation };
export class SessionCopy {
  private dialog = node('dialog');
  private source = node('select');
  private target = node('select');
  private name = node('input');
  private party = node('input');
  private search = node('input');
  private list = node('div');
  private order = node('ol');
  private summary = node('p');
  private message = node('p');
  private confirm = button('Szenen übernehmen', () => void this.submit());
  private selected: string[] = [];
  private data: Preparation | null = null;
  private sourceView: SessionSnapshot | null = null;
  private targetView: SessionView | null = null;
  private owner: Context | null = null;
  private generation = 0;
  private sourceRequest = 0;
  private targetRequest = 0;
  private renderVersion = 0;
  private busy = false;
  private page = 0;
  constructor(
    private tell: (text: string, error?: boolean) => void,
    private context: () => Context | null,
    private flush: () => Promise<boolean>,
    private completed: (planId: string, visitId: string) => Promise<void>,
  ) {
    this.dialog.id = 'session-copy-dialog';
    this.dialog.className = 'session-copy-dialog';
    this.source.id = 'session-copy-source';
    this.target.id = 'session-copy-target';
    this.name.id = 'session-copy-name';
    this.party.id = 'session-copy-party';
    this.party.type = 'checkbox';
    this.search.id = 'session-copy-search';
    this.search.type = 'search';
    this.search.placeholder = 'Titel, Text, Ort oder Begegnung suchen';
    this.search.setAttribute('aria-label', 'Vorbereitete Szenen durchsuchen');
    this.list.id = 'session-copy-list';
    this.order.id = 'session-copy-order';
    this.summary.id = 'session-copy-summary';
    this.summary.setAttribute('aria-live', 'polite');
    this.message.id = 'session-copy-message';
    this.message.setAttribute('role', 'status');
    this.confirm.id = 'session-copy-confirm';
    const label = (text: string, input: HTMLElement) => {
        const l = node('label', text + ' ');
        l.append(input);
        return l;
      },
      head = node('div');
    head.className = 'toolbar';
    head.append(
      node('h2', 'Vorbereitete Szenen wiederverwenden'),
      button('Schließen', () => {
        if (!this.busy) this.reset();
      }),
    );
    const choices = node('div');
    choices.className = 'toolbar';
    choices.append(
      label('Quellplan', this.source),
      label('Ziel', this.target),
      label('Name des neuen Abends', this.name),
      label('Planungsparty mitnehmen', this.party),
    );
    const tools = node('div');
    tools.className = 'toolbar';
    tools.append(
      this.search,
      button('Sichtbare auswählen', () => {
        for (const s of this.matches().slice(this.page * 40, (this.page + 1) * 40))
          if (!this.selected.includes(s.id)) this.selected.push(s.id);
        this.draw();
      }),
      button('Auswahl leeren', () => {
        this.selected = [];
        this.draw();
      }),
    );
    const body = node('div');
    body.className = 'session-copy-columns';
    const selection = node('section'),
      review = node('section');
    selection.append(node('h3', 'Szenen auswählen'), tools, this.list);
    review.append(node('h3', 'Reihenfolge im Ziel'), this.summary, this.order);
    body.append(selection, review);
    const foot = node('div');
    foot.className = 'toolbar';
    foot.append(
      this.confirm,
      button('Abbrechen', () => {
        if (!this.busy) this.reset();
      }),
    );
    this.dialog.append(
      head,
      choices,
      body,
      node(
        'p',
        'Ausgewählte Besuche werden hinten angefügt. Texte und Weltverweise bleiben erhalten. Offene Begegnungen werden unabhängig vorbereitet; platzierte Gruppen bleiben dieselben NPCs. Bereits vergebene oder platzierte Belohnungen behalten ihre Zuordnung. Laufende Gruppen und Besuchsergebnisse werden nicht kopiert.',
      ),
      this.message,
      foot,
    );
    document.body.append(this.dialog);
    const open = button(
      'Szenen wiederverwenden…',
      () => void this.open().catch((e) => this.error(e)),
    );
    open.id = 'session-copy-open';
    document.getElementById('plan-replace')!.after(open);
    onCommitState(() => {
      this.confirm.disabled = !this.ready();
    });
    onCommitResolved(async (event) => {
      const meta = event.meta as
          | {
              owner?: string;
              token: string;
              generation: number;
              renderVersion: number;
              action: Extract<SessionCommand['action'], { kind: 'copy-visits' }>;
            }
          | undefined,
        o = this.owner;
      if (
        event.ref.family === 'session' &&
        meta?.owner === 'session-copy' &&
        o?.workspace.token === meta.token &&
        event.ref.campaignId === o.workspace.campaign.id
      )
        await this.finish(
          meta.action,
          event.value as SessionView,
          o,
          meta.generation,
          meta.renderVersion,
        );
    });
    this.source.onchange = () => void this.loadSource().catch((e) => this.error(e));
    this.target.onchange = () => void this.loadTarget().catch((e) => this.error(e));
    this.search.oninput = () => {
      this.page = 0;
      this.draw();
    };
    this.dialog.addEventListener('cancel', (e) => {
      if (this.busy) e.preventDefault();
      else this.reset();
    });
  }
  reset() {
    this.generation++;
    this.sourceRequest++;
    this.targetRequest++;
    this.renderVersion++;
    this.busy = false;
    this.owner = null;
    this.selected = [];
    this.sourceView = null;
    this.targetView = null;
    this.dialog.close();
  }
  private get sourcePlan() {
    return this.sourceView?.plan ?? null;
  }
  private ready() {
    const o = this.owner,
      source = this.sourceView,
      target = this.target.value;
    return (
      !!o &&
      this.current(o) &&
      this.dialog.open &&
      !this.busy &&
      !hasPendingCommit(o.workspace.campaign.id) &&
      !!source?.replacementBasis &&
      source.plan.id === this.source.value &&
      this.selected.length > 0 &&
      this.selected.every((id) => source.plan.scenes.some((s) => s.id === id)) &&
      (!target || !!this.targetView?.replacementBasis)
    );
  }
  private matchesContext(o: Context | null) {
    const c = this.context();
    return !!o && c?.workspace.token === o.workspace.token && c.plan.id === o.plan.id;
  }
  private current(o = this.owner) {
    return !!o && this.owner === o && this.matchesContext(o);
  }
  private error(e: unknown) {
    const text = e instanceof Error ? e.message : String(e);
    this.message.textContent = text;
    this.tell(text, true);
  }
  private options(select: HTMLSelectElement, empty: string | null) {
    select.replaceChildren();
    if (empty !== null) {
      const o = node('option', empty);
      o.value = '';
      select.append(o);
    }
    for (const p of this.data?.plans ?? []) {
      const o = node(
        'option',
        (p.name || 'Unbenannter Abend') + ' · ' + p.scenes.length + ' Besuche',
      );
      o.value = p.id;
      select.append(o);
    }
  }
  private async open() {
    const c = this.context(),
      request = ++this.generation;
    if (!c || !(await this.flush()) || request !== this.generation || !this.matchesContext(c))
      return;
    this.reset();
    this.owner = c;
    const g = this.generation;
    this.message.textContent = '';
    try {
      const result = await window.campaign.preparation(c.workspace.token, '');
      if (!this.current(c) || g !== this.generation) return;
      this.data = unwrap(result);
      this.options(this.source, null);
      this.options(this.target, 'Neuen Abend erstellen');
      this.source.value = c.plan.id;
      this.target.value = '';
      this.party.checked = true;
      this.search.value = '';
      this.dialog.showModal();
      await this.loadSource();
    } catch (e) {
      if (this.current(c) && g === this.generation) this.error(e);
    }
  }
  private async loadSource(keepSelection = false) {
    const o = this.owner,
      g = this.generation,
      n = ++this.sourceRequest,
      id = this.source.value;
    this.targetRequest++;
    this.sourceView = null;
    if (!keepSelection) this.selected = [];
    this.renderVersion++;
    this.confirm.disabled = true;
    this.list.replaceChildren();
    this.order.replaceChildren();
    this.summary.textContent = 'Vorbereitung wird gelesen…';
    this.message.textContent = '';
    if (!o || !this.current(o) || !id) return;
    try {
      const result = await window.campaign.session(o.workspace.token, id);
      if (!this.current(o) || g !== this.generation || n !== this.sourceRequest) return;
      this.sourceView = unwrap(result);
      if (!keepSelection) {
        this.page = 0;
        this.selected = this.sourcePlan!.scenes.map((s) => s.id);
        this.name.value = (this.sourcePlan!.name || 'Spielabend') + ' (Kopie)';
      }
      await this.loadTarget();
    } catch (e) {
      if (this.current(o) && g === this.generation && n === this.sourceRequest) this.error(e);
    }
  }
  private async loadTarget() {
    const o = this.owner,
      g = this.generation,
      n = ++this.targetRequest,
      id = this.target.value;
    this.renderVersion++;
    this.targetView = null;
    this.confirm.disabled = true;
    this.name.disabled = !!id;
    this.party.disabled = !!id;
    if (!o || !this.current(o)) return;
    try {
      const result = id ? await window.campaign.session(o.workspace.token, id) : null;
      if (!this.current(o) || g !== this.generation || n !== this.targetRequest) return;
      this.targetView = result ? unwrap(result) : null;
      this.draw();
    } catch (e) {
      if (this.current(o) && g === this.generation && n === this.targetRequest) this.error(e);
    }
  }
  private matches() {
    const q = this.search.value.trim().toLocaleLowerCase();
    return (
      this.sourcePlan?.scenes.filter((s) => {
        const v = this.sourceView?.visits.find((v) => v.visitId === s.id),
          location =
            this.data?.locations.find((l) => l.document.id === s.locationId)?.document.name ?? '';
        return (
          !q ||
          [
            s.title,
            s.notes,
            v?.readAloud ?? '',
            location,
            ...(v?.groupIds.map(
              (id) => this.sourceView?.groups.find((g) => g.id === id)?.title ?? '',
            ) ?? []),
          ]
            .join('\n')
            .toLocaleLowerCase()
            .includes(q)
        );
      }) ?? []
    );
  }
  private draw() {
    const o = this.owner,
      g = this.generation,
      version = ++this.renderVersion;
    const act = (fn: () => void) => () => {
      if (
        this.current(o) &&
        g === this.generation &&
        version === this.renderVersion &&
        this.dialog.open &&
        !this.busy
      ) {
        fn();
      }
    };
    const matches = this.matches(),
      count = Math.max(1, Math.ceil(matches.length / 40));
    this.page = Math.min(this.page, count - 1);
    this.list.replaceChildren();
    for (const s of matches.slice(this.page * 40, (this.page + 1) * 40)) {
      const v = this.sourceView?.visits.find((v) => v.visitId === s.id),
        row = node('article'),
        box = node('input');
      box.type = 'checkbox';
      box.dataset.visitId = s.id;
      box.checked = this.selected.includes(s.id);
      box.onchange = act(() => {
        this.selected = box.checked
          ? [...this.selected, s.id]
          : this.selected.filter((id) => id !== s.id);
        this.draw();
      });
      const label = node('label');
      label.className = 'check-label';
      label.append(box, node('strong', s.title || 'Unbenannte Szene'));
      const location =
        this.data?.locations.find((l) => l.document.id === s.locationId)?.document.name ??
        (s.locationId ? 'Erhaltener Ortsverweis' : 'Ohne Ort');
      row.append(
        label,
        node(
          'p',
          location +
            ' · ' +
            (v?.groupIds.length ?? 0) +
            ' Gruppen · ' +
            (v?.reward
              ? String(v.reward.poolXp) +
                ' Story-XP' +
                (v.reward.awarded
                  ? ' · vergeben'
                  : v.reward.placedTreasureId
                    ? ' · Beute platziert'
                    : ' · vorbereitet')
              : 'Ohne Belohnung'),
        ),
      );
      const details = node('details');
      details.append(
        node('summary', 'Vorlesetext und GM-Notizen'),
        node('h4', 'Vorlesetext'),
        node('pre', v?.readAloud ?? ''),
        node('h4', 'GM-Notizen'),
        node('pre', s.notes),
      );
      row.append(details);
      this.list.append(row);
    }
    const pages = node('div');
    pages.className = 'toolbar';
    const prev = button(
        'Zurück',
        act(() => {
          this.page--;
          this.draw();
        }),
      ),
      next = button(
        'Weiter',
        act(() => {
          this.page++;
          this.draw();
        }),
      );
    prev.disabled = this.page === 0;
    next.disabled = this.page + 1 >= count;
    pages.append(
      prev,
      node('span', this.page + 1 + ' / ' + count + ' · ' + matches.length + ' Treffer'),
      next,
    );
    this.list.append(pages);
    this.order.replaceChildren();
    for (const [i, id] of this.selected.entries()) {
      const s = this.sourcePlan?.scenes.find((s) => s.id === id),
        row = node('li');
      row.append(node('span', s ? s.title || 'Unbenannte Szene' : 'Besuch fehlt inzwischen'));
      const up = button(
          '↑',
          act(() => {
            [this.selected[i - 1], this.selected[i]] = [id, this.selected[i - 1]!];
            this.draw();
          }),
        ),
        down = button(
          '↓',
          act(() => {
            [this.selected[i + 1], this.selected[i]] = [id, this.selected[i + 1]!];
            this.draw();
          }),
        );
      up.setAttribute('aria-label', 'Nach oben: ' + s?.title);
      down.setAttribute('aria-label', 'Nach unten: ' + s?.title);
      up.disabled = i === 0;
      down.disabled = i + 1 === this.selected.length;
      row.append(
        up,
        down,
        button(
          'Entfernen',
          act(() => {
            this.selected = this.selected.filter((v) => v !== id);
            this.draw();
          }),
        ),
      );
      this.order.append(row);
    }
    const missing = this.selected.filter(
      (id) => !this.sourcePlan?.scenes.some((s) => s.id === id),
    ).length;
    const hidden = this.selected.filter((id) => !matches.some((s) => s.id === id)).length;
    this.summary.textContent =
      this.selected.length +
      ' ausgewählt' +
      (missing ? ' · ' + missing + ' Besuche fehlen inzwischen' : '') +
      (hidden ? ' · ' + hidden + ' außerhalb des Filters' : '') +
      ' · ' +
      (this.target.value
        ? (this.targetView?.visits.length ?? 0) + ' vorhandene Besuche bleiben erhalten'
        : 'Neuer unabhängiger Plan');
    this.confirm.disabled = !this.ready();
    this.confirm.textContent = this.target.value
      ? 'Auswahl an Plan anfügen'
      : 'Abend aus Auswahl erstellen';
  }
  private async finish(
    action: Extract<SessionCommand['action'], { kind: 'copy-visits' }>,
    result: SessionView,
    o: Context,
    g: number,
    version: number,
  ) {
    if (!this.current(o) || g !== this.generation) return;
    if (
      version !== this.renderVersion ||
      action.name !== this.name.value ||
      action.copyParty !== (!this.target.value && this.party.checked)
    ) {
      await this.loadSource(true);
      return;
    }
    this.dialog.close();
    await this.completed(
      action.planId,
      result.visits[result.visits.length - action.visitIds.length]!.visitId,
    );
    if (!this.current(o) || g !== this.generation) return;
    this.tell(action.visitIds.length + ' Szenen mit Vorbereitung übernommen.');
    this.reset();
  }
  private async submit() {
    if (!this.ready()) return;
    const g = this.generation,
      version = this.renderVersion,
      o = this.owner!,
      source = this.sourceView!,
      target = this.targetView;
    const action = {
      kind: 'copy-visits' as const,
      planId: this.target.value || crypto.randomUUID(),
      expectedBasis: target?.replacementBasis ?? null,
      name: this.name.value,
      sourcePlanId: this.source.value,
      expectedSourceBasis: source.replacementBasis,
      visitIds: [...this.selected],
      copyParty: !this.target.value && this.party.checked,
    };
    const request = {
      commandId: crypto.randomUUID(),
      campaignId: o.workspace.campaign.id,
      token: o.workspace.token,
      action,
    };
    this.busy = true;
    for (const c of this.dialog.querySelectorAll<
      HTMLInputElement | HTMLButtonElement | HTMLSelectElement
    >('input,button,select'))
      c.disabled = true;
    try {
      const result = await writeConfirmed(
        'session',
        request,
        () => window.campaign.executeSession(request),
        () => this.current(o) && g === this.generation,
        {
          owner: 'session-copy',
          token: o.workspace.token,
          generation: g,
          renderVersion: version,
          action,
        },
      );
      await this.finish(action, result, o, g, version);
    } catch (e) {
      if (this.current(o) && g === this.generation) this.error(e);
    } finally {
      if (this.current(o) && g === this.generation) {
        this.busy = false;
        for (const c of this.dialog.querySelectorAll<
          HTMLInputElement | HTMLButtonElement | HTMLSelectElement
        >('input,button,select'))
          c.disabled = false;
        this.name.disabled = !!this.target.value;
        this.party.disabled = !!this.target.value;
        this.confirm.disabled = !this.ready();
      }
    }
  }
}
