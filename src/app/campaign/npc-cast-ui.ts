import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type { LiveScene } from '../runtime/live-contracts';
import type { NpcDossier, NpcCastQuery } from './npc-cast-contracts';
import { dailyTime } from './npc-daily-plan';
import { loadCreatureDetail } from '../catalog/creature-detail-ui';
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
export class NpcCastBinder {
  private dialog = node('dialog');
  private search = node('input');
  private scope = node('select');
  private status = node('p');
  private heading = node('h2', 'NSCs am Spieltisch');
  private caption = node('p');
  private list = node('div');
  private document = node('section');
  private owner: Context | null = null;
  private offset = 0;
  private selected: string | null = null;
  private history: string[] = [];
  private request = 0;
  private detailRequest = 0;
  private busy: object | null = null;
  private prev = button('Vorige 50', () => {
    this.offset = Math.max(0, this.offset - 50);
    void this.read();
  });
  private next = button('Nächste 50', () => {
    this.offset += 50;
    void this.read();
  });
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private tell: (s: string, error?: boolean) => void,
    private context: () => Context | null,
    private flush: () => Promise<boolean>,
    private readAloud: (
      text: string,
      title: string,
      sceneId: string,
      stillCurrent: () => boolean,
    ) => Promise<void>,
    private encounter: (id: string, stillCurrent: () => boolean) => Promise<void>,
    private edit: (
      id: string,
      contact: { date: string; sceneTitle: string } | undefined,
      stillCurrent: () => boolean,
    ) => Promise<void>,
    private openNote: (id: string, stillCurrent: () => boolean) => Promise<void>,
    private openGroup: (id: string, stillCurrent: () => boolean) => Promise<void>,
    private openAutonomy: (id: string, stillCurrent: () => boolean) => Promise<void>,
    private places: (id: string, stillCurrent: () => boolean) => Promise<void> = async () => {},
    private openLocation: (
      id: string,
      stillCurrent: () => boolean,
    ) => Promise<void> = async () => {},
  ) {
    this.dialog.id = 'npc-cast';
    this.dialog.className = 'npc-cast';
    this.dialog.setAttribute('aria-labelledby', 'npc-cast-heading');
    this.heading.id = 'npc-cast-heading';
    this.status.id = 'npc-cast-status';
    this.status.setAttribute('role', 'status');
    this.list.id = 'npc-cast-list';
    this.document.id = 'npc-cast-document';
    this.search.id = 'npc-cast-search';
    this.search.type = 'search';
    this.search.placeholder = 'Name, Verhalten oder Notiz';
    this.search.setAttribute('aria-label', 'NSCs durchsuchen');
    this.scope.id = 'npc-cast-scope';
    this.scope.setAttribute('aria-label', 'NSC-Ortsfilter');
    for (const [id, title] of [
      ['current', 'Am aktuellen Gruppenort'],
      ['all', 'Alle Kampagnen-NSCs'],
      ['unplaced', 'Ohne Ortsbindung'],
    ] as const)
      this.scope.add(new Option(title, id));
    const head = node('div');
    head.className = 'toolbar';
    head.append(
      this.heading,
      button('Stand aktualisieren', () => void this.read()),
      button('Schließen', () => {
        if (!this.busy) this.reset();
      }),
    );
    const nav = node('section'),
      pages = node('div'),
      searchLabel = node('label', 'Suche'),
      scopeLabel = node('label', 'Ort');
    searchLabel.append(this.search);
    scopeLabel.append(this.scope);
    pages.className = 'toolbar';
    pages.append(this.prev, this.next);
    nav.append(searchLabel, scopeLabel, this.caption, this.list, pages);
    const body = node('div');
    body.className = 'npc-cast-columns';
    body.append(nav, this.document);
    this.dialog.append(head, this.status, body);
    document.body.append(this.dialog);
    this.scope.onchange = () => {
      this.request++;
      this.clear();
      this.offset = 0;
      void this.read();
    };
    this.search.oninput = () => {
      this.request++;
      this.clear();
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.offset = 0;
        void this.read();
      }, 180);
    };
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (!this.busy) this.reset();
    });
  }
  private clear() {
    this.detailRequest++;
    this.list.replaceChildren();
    this.document.replaceChildren();
    this.prev.disabled = this.next.disabled = true;
  }
  reset() {
    this.request++;
    this.clear();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.owner = null;
    this.selected = null;
    this.history = [];
    this.busy = null;
    this.dialog.close();
  }
  contextChanged() {
    if (this.owner && !this.matches(this.owner)) this.reset();
  }
  private matches(owner: Context | null) {
    const c = this.context();
    return (
      !!owner &&
      c?.workspace.token === owner.workspace.token &&
      c.scene.id === owner.scene.id &&
      c.scene.locationId === owner.scene.locationId
    );
  }
  private current(owner = this.owner) {
    return this.owner === owner && this.matches(owner) && this.dialog.open;
  }
  private control(text: string, fn: () => void, detail = true) {
    const o = this.owner,
      n = this.request,
      d = this.detailRequest,
      b = button(text, () => {
        if (
          b.isConnected &&
          this.current(o) &&
          n === this.request &&
          (!detail || d === this.detailRequest)
        )
          fn();
      });
    return b;
  }
  private handoff(work: (current: () => boolean) => Promise<void>) {
    const o = this.owner;
    this.reset();
    const n = this.request,
      current = () => n === this.request && this.matches(o);
    void work(current).catch((e) => {
      if (n === this.request && this.matches(o)) this.report(e);
    });
  }
  private report(e: unknown) {
    const text = (e as Error).message;
    this.status.textContent = text;
    this.tell(text, true);
  }
  async open() {
    if (this.dialog.open) return;
    const c = this.context(),
      n = this.request,
      locationId = c?.scene.locationId;
    if (!c) return;
    if (
      !(await this.flush()) ||
      n !== this.request ||
      this.context()?.workspace.token !== c.workspace.token ||
      this.context()?.scene.id !== c.scene.id ||
      this.context()?.scene.locationId !== locationId
    )
      return;
    this.reset();
    this.owner = { workspace: c.workspace, scene: { ...c.scene } };
    this.search.value = '';
    this.scope.value = 'current';
    this.offset = 0;
    this.dialog.showModal();
    await this.read();
  }
  private async read() {
    const o = this.owner;
    if (!o || !this.current(o) || this.busy) return;
    const n = ++this.request;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const query: NpcCastQuery = {
      sceneId: o.scene.id,
      text: this.search.value,
      scope: this.scope.value as NpcCastQuery['scope'],
      offset: this.offset,
    };
    this.clear();
    this.status.textContent = 'NSCs werden gelesen…';
    try {
      let page = unwrap(await window.campaign.npcCast(o.workspace.token, query));
      if (!this.current() || n !== this.request) return;
      if (this.offset && this.offset >= page.total) {
        this.offset = Math.max(0, Math.floor((page.total - 1) / 50) * 50);
        page = unwrap(
          await window.campaign.npcCast(o.workspace.token, { ...query, offset: this.offset }),
        );
        if (!this.current() || n !== this.request) return;
      }
      this.caption.textContent =
        page.sceneTitle +
        ' · ' +
        page.locationTitle +
        ' · ' +
        page.total +
        ' NSCs · ' +
        (page.rows.length
          ? this.offset + 1 + '–' + (this.offset + page.rows.length)
          : 'keine Treffer');
      this.prev.disabled = !this.offset;
      this.next.disabled = this.offset + 50 >= page.total;
      for (const row of page.rows) {
        const b = this.control(
          row.name +
            ' · ' +
            (row.lifecycle === 'defeated'
              ? 'besiegt'
              : { friendly: 'verbündet', neutral: 'neutral', hostile: 'feindlich' }[row.role]),
          () => void this.load(row.id),
          false,
        );
        b.dataset.npcId = row.id;
        b.setAttribute('aria-pressed', String(row.id === this.selected));
        this.list.append(b);
      }
      this.status.textContent =
        'Gespräch führen, Stand lesen oder einen bestehenden Fachbereich öffnen.';
      const id = page.rows.find((row) => row.id === this.selected)?.id ?? page.rows[0]?.id;
      if (id) await this.load(id, false);
      else {
        this.selected = null;
        this.document.replaceChildren(
          node('p', 'Keine NSCs in diesem Filter. Andere Orte oder die ganze Kampagne wählen.'),
        );
      }
    } catch (e) {
      if (this.current() && n === this.request) this.report(e);
    }
  }
  private async load(id: string, remember = true) {
    const o = this.owner;
    if (!o || !this.current(o) || this.busy) return;
    const n = ++this.detailRequest;
    if (remember && this.selected && this.selected !== id) {
      this.history.push(this.selected);
      if (this.history.length > 30) this.history.shift();
    }
    this.selected = id;
    this.document.replaceChildren(node('p', 'NSC-Dossier wird gelesen…'));
    for (const b of this.list.querySelectorAll<HTMLButtonElement>('button'))
      b.setAttribute('aria-pressed', String(b.dataset.npcId === id));
    try {
      const d = unwrap(await window.campaign.npcDossier(o.workspace.token, o.scene.id, id));
      if (!this.current() || n !== this.detailRequest) return;
      this.draw(d, n);
    } catch (e) {
      if (this.current() && n === this.detailRequest) this.report(e);
    }
  }
  private async act(
    kind: 'read-aloud' | 'encounter' | 'edit' | 'contact' | 'autonomy' | 'places' | 'plan-location',
    shown: NpcDossier,
  ) {
    const o = this.owner,
      id = this.selected;
    let n = this.request;
    const d = this.detailRequest,
      owns = () => n === this.request && this.matches(o);
    if (!o || !id || !this.current(o) || this.busy) return;
    const work = {};
    this.busy = work;
    try {
      if (!(await this.flush()) || !owns() || !this.current(o) || d !== this.detailRequest) return;
      const dossier = unwrap(await window.campaign.npcDossier(o.workspace.token, o.scene.id, id));
      if (!owns() || !this.current(o) || d !== this.detailRequest || this.selected !== id) return;
      const basis = (v: NpcDossier) =>
        JSON.stringify([
          v.npc.id,
          v.npc.noteRevision,
          v.npc.record.revision,
          v.npc.actorRevision,
          v.npc.positionRevision,
          v.npc.locationId,
          v.npc.role,
          v.npc.disposition,
        ]);
      if (dossier.scene.id !== o.scene.id || basis(dossier) !== basis(shown))
        throw new Error('NSC seit Anzeige geändert. Stand aktualisieren und Aktion erneut wählen.');
      if (
        (kind === 'contact' || kind === 'plan-location') &&
        (dossier.date !== shown.date ||
          dossier.scene.title !== shown.scene.title ||
          dossier.scene.clock?.revision !== shown.scene.clock?.revision ||
          dossier.scene.clock?.instantMs !== shown.scene.clock?.instantMs)
      )
        throw new Error(
          'Gruppenzeit seit Anzeige geändert. Stand aktualisieren und Gespräch erneut wählen.',
        );
      const target = dossier.dailyPlan?.targets?.find(
        (t) => t.locationId === dossier.dailyPlan?.current?.locationId,
      );
      if (
        kind === 'plan-location' &&
        (!target?.available ||
          dossier.dailyPlan?.current?.locationId !== shown.dailyPlan?.current?.locationId)
      )
        throw new Error('Geplantes Ortsziel geändert oder nicht verfügbar. Stand aktualisieren.');
      this.reset();
      n = this.request;
      if (kind === 'read-aloud')
        await this.readAloud(dossier.npc.readAloud, dossier.npc.name, dossier.scene.id, owns);
      else if (kind === 'encounter') await this.encounter(id, owns);
      else if (kind === 'plan-location') await this.openLocation(target!.locationId, owns);
      else if (kind === 'places') await this.places(id, owns);
      else if (kind === 'autonomy') await this.openAutonomy(id, owns);
      else
        await this.edit(
          id,
          kind === 'contact' ? { date: dossier.date, sceneTitle: dossier.scene.title } : undefined,
          owns,
        );
    } catch (e) {
      if (owns()) this.report(e);
    } finally {
      if (this.busy === work) {
        this.busy = null;
        if (this.current(o) && n !== this.request) void this.read();
      }
    }
  }
  private text(title: string, text: string) {
    if (!text) return;
    this.document.append(node('h3', title), node('pre', text));
  }
  private draw(d: NpcDossier, n: number) {
    const v = d.npc,
      o = this.owner;
    this.document.replaceChildren();
    const actions = node('div');
    actions.className = 'toolbar';
    if (this.history.length)
      actions.append(
        this.control('Voriger NSC', () => {
          const id = this.history.pop()!;
          void this.load(id, false);
        }),
      );
    for (const [label, kind] of [
      ['Gespräch festhalten…', 'contact'],
      ['Profil bearbeiten…', 'edit'],
      ['Wohnorte, Arbeit und Tagesziel…', 'places'],
      ['NSC-Verhalten öffnen…', 'autonomy'],
      ['Vorlesetext zur Szene', 'read-aloud'],
      ['In aktuelle Begegnung übernehmen', 'encounter'],
    ] as const) {
      const b = this.control(label, () => void this.act(kind, d));
      b.disabled =
        (kind === 'read-aloud' && !v.readAloud.trim()) ||
        (kind === 'encounter' &&
          (v.actorRevision === null || v.record.lifecycle === 'defeated' || !v.health?.hp));
      actions.append(b);
    }
    this.document.append(
      node('h3', v.name),
      node(
        'p',
        d.locationTitle +
          ' · ' +
          (v.record.lifecycle === 'defeated'
            ? 'besiegt'
            : { friendly: 'verbündet', neutral: 'neutral', hostile: 'feindlich' }[v.role]) +
          ' · Haltung ' +
          v.disposition,
      ),
      node('p', 'Gruppenzeit: ' + d.date),
      actions,
    );
    if (v.health)
      this.document.append(
        node(
          'p',
          'HP ' +
            v.health.hp +
            '/' +
            v.health.maxHp +
            ' · temporär ' +
            v.health.tempHp +
            (v.health.conditions ? ' · ' + v.health.conditions : '') +
            (v.health.concentrating ? ' · Konzentration' : ''),
        ),
      );
    this.text('Aussehen', v.record.appearance);
    this.text('Verhalten / Spielweise', v.record.behavior);
    this.text('Zum Vorlesen', v.readAloud);
    this.text('GM-Notizen', v.gmNotes);
    this.text('Geschichte und Gespräche', v.record.history);
    const plan = d.dailyPlan;
    if (plan) {
      const summary = node('section');
      summary.id = 'npc-cast-daily-plan';
      summary.append(
        node('h3', 'Tagesplan · Gruppenzeit'),
        node(
          'p',
          'Kampagnentag ' +
            (plan.day ?? '') +
            ' · ' +
            (plan.weekdayTitle ?? '') +
            (plan.overrideLabel ? ' · Datumsausnahme: ' + plan.overrideLabel : ''),
        ),
        node('p', 'Autorenplan; tatsächlicher Standort: ' + d.locationTitle),
      );
      if (plan.problem)
        summary.append(
          node('p', plan.problem + ' Plan im Profil an den Kampagnenkalender anpassen.'),
        );
      else {
        const slot = plan.current;
        summary.append(
          node(
            'strong',
            slot ? 'Jetzt geplant: ' + slot.activity : 'Jetzt keine Aktivität geplant.',
          ),
        );
        if (slot) {
          summary.append(
            node(
              'p',
              dailyTime(slot.startMinute) +
                '–' +
                dailyTime(slot.endMinute) +
                (slot.startMinute > slot.endMinute
                  ? ' · über Mitternacht' + (plan.startsOnPreviousDay ? ' · gestern begonnen' : '')
                  : ''),
            ),
          );
          if (slot.notes) summary.append(node('pre', slot.notes));
          const target = plan.targets?.find((t) => t.locationId === slot.locationId);
          if (slot.place === 'location') {
            const b = this.control(
              'Geplantes Ziel: ' + (target?.title ?? 'Ort nicht verfügbar'),
              () => void this.act('plan-location', d),
            );
            b.dataset.npcPlanLocation = slot.locationId;
            b.disabled = !target?.available;
            summary.append(b);
          }
          const site = d.places?.sites.find((s) => s.kind === slot.place);
          if (slot.place !== 'location')
            summary.append(
              node(
                'p',
                slot.place === 'other'
                  ? 'Geplantes Ziel: frei beschrieben' + (slot.notes ? ' · siehe Hinweise' : '')
                  : site
                    ? 'Geplantes Ziel: ' +
                      site.title +
                      ' · ' +
                      site.detail +
                      (site.available ? '' : ' · nicht verfügbar')
                    : 'Geplantes Ziel: ' +
                      (slot.place === 'home' ? 'Wohnhaus' : 'Arbeitsplatz') +
                      ' noch nicht gebunden.',
              ),
            );
        }
        if (plan.next)
          summary.append(
            node(
              'p',
              'Als Nächstes: ' +
                (plan.nextDate ?? dailyTime(plan.next.startMinute)) +
                ' · ' +
                plan.next.activity +
                ' · in ' +
                Math.ceil((plan.secondsUntilNext ?? 0) / 60) +
                ' min',
            ),
          );
      }
      const all = node('details');
      all.append(
        node('summary', 'Alle täglichen Aktivitäten · ' + (v.record.dailyPlan?.length ?? 0)),
      );
      for (const slot of [...(v.record.dailyPlan ?? [])].sort(
        (a, b) => a.startMinute - b.startMinute,
      )) {
        const entry = node('article'),
          days = slot.weekdays
            ?.map((index) => plan.weekdayTitles?.[index] ?? 'Wochentag ' + (index + 1))
            .join(', ');
        entry.append(
          node(
            'p',
            dailyTime(slot.startMinute) +
              '–' +
              dailyTime(slot.endMinute) +
              (slot.startMinute > slot.endMinute ? ' · über Mitternacht' : '') +
              ' · ' +
              slot.activity +
              ' · ' +
              {
                home: 'Wohnhaus',
                work: 'Arbeitsplatz',
                other: 'anderer Ort',
                location:
                  plan.targets?.find((t) => t.locationId === slot.locationId)?.title ??
                  'Ort nicht verfügbar',
              }[slot.place] +
              (days ? ' · ' + days : ' · jeden Tag'),
          ),
        );
        if (slot.notes) entry.append(node('pre', slot.notes));
        all.append(entry);
      }
      summary.append(all);
      this.document.append(summary);
    }
    const demographics = v.record.demographics;
    if (
      demographics &&
      (demographics.ancestry || demographics.gender || demographics.ageYears !== null)
    )
      this.document.append(
        node(
          'p',
          [
            demographics.ancestry,
            demographics.gender,
            demographics.ageYears === null ? '' : demographics.ageYears + ' Jahre',
          ]
            .filter(Boolean)
            .join(' · '),
        ),
      );
    if (d.faction) {
      const b = this.control('Fraktion: ' + d.faction.title, () => {
        this.handoff((current) => this.openNote(d.faction!.id, current));
      });
      b.disabled = !d.faction.available;
      this.document.append(b);
    }
    if (d.relations.length) {
      this.document.append(node('h3', 'Beziehungen · ' + d.relationCount));
      for (const r of d.relations) {
        const b = this.control((r.incoming ? '← ' : '→ ') + r.label + ' · ' + r.title, () => {
          if (r.kind === 'npc') void this.load(r.id);
          else {
            this.handoff((current) => this.openNote(r.id, current));
          }
        });
        b.disabled = !r.available;
        this.document.append(b);
      }
      if (d.relationCount > d.relations.length)
        this.document.append(node('p', 'Weitere Beziehungen im Weltprofil lesen.'));
    }
    if (d.groups.length) {
      this.document.append(node('h3', 'Physische Gruppen · erste 20'));
      for (const g of d.groups)
        this.document.append(
          this.control(g.title, () => {
            this.handoff((current) => this.openGroup(g.id, current));
          }),
        );
    }
    const a = d.autonomy;
    this.document.append(node('h3', 'Bestätigtes NPC-Verhalten'));
    if (a) {
      this.document.append(
        node(
          'p',
          (a.enabled ? (a.paused ? 'Pausiert' : 'Freigegeben') : 'Ausgeschaltet') +
            (a.role ? ' · ' + a.role : '') +
            (a.jobName
              ? ' · ' + a.jobName + ' · ' + Math.floor(a.progressSeconds / 60) + ' min Fortschritt'
              : ''),
        ),
        node(
          'p',
          a.remainingIntervals +
            ' ausstehende Zeitintervalle' +
            (a.pending ? ' · GM-Entscheidung: ' + a.pending : ''),
        ),
      );
      if (a.needs.length)
        this.document.append(
          node('p', a.needs.map((n) => n.name + ': ' + n.value.toFixed(1)).join(' · ')),
        );
    } else this.document.append(node('p', 'Keine Autonomie freigegeben.'));
    for (const log of d.logs) this.document.append(node('p', log.text));
    if (v.creatureId) {
      const details = node('details'),
        body = node('section');
      details.append(node('summary', 'Kreatur / Statblock'), body);
      let loaded = false;
      details.addEventListener('toggle', () => {
        if (
          !details.isConnected ||
          !this.current(o) ||
          n !== this.detailRequest ||
          !details.open ||
          loaded
        )
          return;
        loaded = true;
        void loadCreatureDetail(
          body,
          v.creatureId!,
          () => this.current(o) && n === this.detailRequest,
        );
      });
      this.document.append(details);
    }
  }
}
