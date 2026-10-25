import type { WorkspaceGeometry } from '../shared/contracts';
import type { CityActivityPage, CityActivitySite } from './city-activity-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
export interface CityActivityContext {
  workspace: WorkspaceGeometry;
  cityId: string;
  revision: number;
  unit: { id: string; name: string } | null;
}
export class CityActivityBinder {
  private root = node('details');
  private scene = node('select');
  private search = node('input');
  private house = node('input');
  private houseLabel = node('span');
  private status = node('p');
  private rows = node('div');
  private previous = node('button', 'Vorige 40');
  private next = node('button', 'Weitere 40');
  private offset = 0;
  private nextOffset: number | null = null;
  private request = 0;
  private key = '';
  private scope = '';
  private sceneChoiceRequired = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private context: () => CityActivityContext | null,
    private openHouse: (site: CityActivitySite, current: () => boolean) => Promise<void>,
    private openNpc: (id: string, current: () => boolean) => Promise<void>,
    private openLocation: (id: string, current: () => boolean) => Promise<void> = async () => {},
  ) {
    this.root.id = 'city-activity';
    this.root.className = 'city-activity';
    this.scene.id = 'city-activity-scene';
    this.scene.setAttribute('aria-label', 'Gruppenuhr für Stadtaktivitäten');
    this.search.id = 'city-activity-search';
    this.search.type = 'search';
    this.search.placeholder = 'NSC, Aktivität oder Tagesausnahme';
    this.house.type = 'checkbox';
    this.house.id = 'city-activity-house';
    this.status.id = 'city-activity-status';
    this.status.setAttribute('role', 'status');
    this.rows.id = 'city-activity-rows';
    this.previous.type = this.next.type = 'button';
    this.previous.disabled = this.next.disabled = true;
    const refresh = node('button', 'Aktivitäten aktualisieren');
    refresh.id = 'city-activity-refresh';
    refresh.type = 'button';
    const toolbar = node('div'),
      sceneLabel = node('label', 'Gruppenuhr'),
      searchLabel = node('label', 'Suche'),
      houseLabel = node('label');
    toolbar.className = 'toolbar';
    sceneLabel.append(this.scene);
    searchLabel.append(this.search);
    houseLabel.append(this.house, this.houseLabel);
    toolbar.append(sceneLabel, searchLabel, houseLabel, refresh);
    this.root.append(
      node('summary', 'Stadt am Spieltisch · NSC-Aktivitäten'),
      node(
        'p',
        'Bewohner und Beschäftigte mit bestätigter Hausbindung. Geplante Aktivitäten folgen der ausgewählten Gruppenuhr; aktuelle Ortsangaben stehen separat. Die Auswahl verändert weder Fokusgruppe noch Zeit.',
      ),
      toolbar,
      this.status,
      this.rows,
      this.previous,
      this.next,
    );
    document.getElementById('city-factions')!.after(this.root);
    this.root.ontoggle = () => {
      if (this.root.open) void this.read();
    };
    refresh.onclick = () => {
      this.offset = 0;
      void this.read();
    };
    this.scene.onchange = () => {
      this.offset = 0;
      if (this.scene.value) {
        this.sceneChoiceRequired = false;
        void this.read();
      }
    };
    this.house.onchange = () => {
      this.key = this.contextKey();
      this.offset = 0;
      void this.read();
    };
    this.search.oninput = () => {
      this.request++;
      this.rows.replaceChildren();
      this.previous.disabled = this.next.disabled = true;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.offset = 0;
        void this.read();
      }, 180);
    };
    this.previous.onclick = () => {
      this.offset = Math.max(0, this.offset - 40);
      void this.read();
    };
    this.next.onclick = () => {
      if (this.nextOffset !== null) {
        this.offset = this.nextOffset;
        void this.read();
      }
    };
  }
  private contextKey() {
    const c = this.context();
    return c
      ? [
          c.workspace.token,
          c.cityId,
          c.revision,
          this.house.checked ? (c.unit?.id ?? '') : '',
        ].join(':')
      : '';
  }
  contextChanged() {
    const c = this.context(),
      old = this.key,
      scope = c ? c.workspace.token + '\u0000' + c.cityId : '';
    this.house.disabled = !c?.unit;
    if (!c?.unit) this.house.checked = false;
    this.houseLabel.textContent = c?.unit
      ? ' Nur ausgewähltes Haus: ' + (c.unit.name || 'Unbenannt')
      : ' Zum Hausfilter ein Haus in der Karte wählen';
    const next = this.contextKey();
    if (next === old) return;
    this.request++;
    this.key = next;
    this.rows.replaceChildren();
    this.offset = 0;
    this.previous.disabled = this.next.disabled = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!c) {
      this.scene.replaceChildren();
      this.status.textContent = 'Stadt öffnen.';
      return;
    }
    if (scope !== this.scope) {
      this.scene.replaceChildren();
      this.sceneChoiceRequired = false;
    }
    this.scope = scope;
    if (this.root.open) void this.read();
  }
  private async read() {
    const c = this.context();
    if (!c || !this.root.open) return;
    const n = ++this.request,
      key = this.contextKey();
    this.key = key;
    const current = () => n === this.request && this.contextKey() === key && this.root.isConnected;
    this.previous.disabled = this.next.disabled = true;
    this.rows.replaceChildren();
    this.status.textContent = 'Bestätigte Stadtaktivitäten werden gelesen…';
    try {
      const result = await window.campaign.cityActivities(c.workspace.token, {
        cityId: c.cityId,
        sceneId: this.scene.value || null,
        focusFallback: !this.sceneChoiceRequired,
        unitId: this.house.checked ? (c.unit?.id ?? null) : null,
        text: this.search.value,
        offset: this.offset,
      });
      if (!current()) return;
      if (!result.ok) throw new Error(result.error);
      const page = result.value;
      if (page.cityId !== c.cityId || page.cityRevision !== c.revision)
        throw new Error(
          'Stadt wurde inzwischen geändert. Stadt aktualisieren und Aktivitäten erneut öffnen.',
        );
      this.draw(page, current);
    } catch (e) {
      if (current()) this.status.textContent = (e as Error).message;
    }
  }
  private draw(page: CityActivityPage, current: () => boolean) {
    this.scene.replaceChildren();
    if (!page.sceneId) {
      const choice = node(
        'option',
        page.scenes.length ? 'Gruppenuhr wählen' : 'Keine Gruppenuhr verfügbar',
      );
      choice.value = '';
      this.scene.append(choice);
    }
    for (const s of page.scenes) {
      const option = node('option', s.title);
      option.value = s.id;
      this.scene.append(option);
    }
    this.scene.disabled = !page.scenes.length;
    this.scene.value = page.sceneId ?? '';
    this.sceneChoiceRequired = !page.sceneId && page.scenes.length > 0;
    this.nextOffset = page.next;
    this.previous.disabled = !this.offset;
    this.next.disabled = page.next === null;
    this.status.textContent =
      page.sceneTitle +
      ' · ' +
      page.date +
      (page.rows.length
        ? ' · ' +
          (this.offset + 1) +
          '–' +
          (this.offset + page.rows.length) +
          ' · bestätigte Bewohner / Beschäftigte'
        : '');
    if (!page.rows.length)
      this.rows.append(
        node(
          'p',
          page.sceneId
            ? 'Keine passenden Bewohner oder Beschäftigten. Andere Suche oder Hausfilter wählen.'
            : page.scenes.length
              ? 'Eine verfügbare Gruppenuhr auswählen.'
              : 'Unter Welt und Spielabend zuerst eine Gruppe anlegen.',
        ),
      );
    const control = (text: string, work: () => Promise<void>) => {
      const b = node('button', text);
      b.type = 'button';
      b.onclick = () => {
        if (!b.isConnected || !current()) return;
        b.disabled = true;
        void work()
          .catch((e) => {
            if (current()) this.status.textContent = (e as Error).message;
          })
          .finally(() => {
            if (current() && b.isConnected) b.disabled = false;
          });
      };
      return b;
    };
    for (const row of page.rows) {
      const article = node('article'),
        heading = node('h3', row.name + (row.defeated ? ' · ausgeschieden' : '')),
        columns = node('div'),
        planned = node('section'),
        actual = node('section'),
        actions = node('div');
      article.className = 'city-activity-row';
      article.dataset.cityActivityNpc = row.id;
      columns.className = 'city-activity-columns';
      planned.append(node('h4', 'Jetzt geplant'));
      if (row.overrideLabel) planned.append(node('p', 'Tagesausnahme: ' + row.overrideLabel));
      if (row.problem) planned.append(node('p', row.problem));
      else if (row.current) {
        planned.append(node('strong', row.current.activity), node('p', row.current.time));
        if (row.current.notes) planned.append(node('p', row.current.notes));
        const target = row.current.target;
        if (target) {
          const b = control('Geplantes Ziel: ' + target.title, () =>
            this.openHouse(target, current),
          );
          b.disabled = !target.available;
          planned.append(b, node('p', target.detail));
        } else if (row.current.locationTarget) {
          const target = row.current.locationTarget,
            b = control('Geplantes Ziel: ' + target.title, () =>
              this.openLocation(target.locationId, current),
            );
          b.dataset.cityActivityLocation = target.locationId;
          b.disabled = !target.available;
          planned.append(b);
        } else
          planned.append(
            node(
              'p',
              row.current.place === 'other'
                ? 'Ziel frei beschrieben.'
                : (row.current.place === 'home' ? 'Wohnhaus' : 'Arbeitsplatz') +
                    ' noch nicht gebunden.',
            ),
          );
      } else planned.append(node('p', 'Keine Aktivität geplant.'));
      if (row.next)
        planned.append(node('p', 'Als Nächstes: ' + row.next.date + ' · ' + row.next.activity));
      actual.append(
        node('h4', 'Aktueller Standort'),
        node('p', row.actualLocation + (row.atCityLocation ? ' · am Stadtort' : '')),
      );
      if (row.actualRoom) actual.append(node('p', 'Dungeonraum: ' + row.actualRoom));
      for (const [title, site] of [
        ['Wohnhaus', row.home],
        ['Arbeitsplatz', row.work],
      ] as const)
        if (site) {
          const b = control(title + ': ' + site.title, () => this.openHouse(site, current));
          b.disabled = !site.available;
          actual.append(b);
        }
      columns.append(planned, actual);
      actions.className = 'toolbar';
      const profile = control('NSC-Profil öffnen', () => this.openNpc(row.id, current));
      profile.dataset.cityActivityProfile = row.id;
      actions.append(profile);
      article.append(heading, columns, actions);
      this.rows.append(article);
    }
  }
}
