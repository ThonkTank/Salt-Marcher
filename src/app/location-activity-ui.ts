import type { WorkspaceGeometry } from './contracts';
import type { LocationActivityPage, LocationVisit } from './location-activity-contracts';
import type { CityActivitySite } from './city-activity-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
export interface LocationActivityContext {
  workspace: WorkspaceGeometry;
  locationId: string;
  revision: number;
}
export class LocationActivityBinder {
  readonly element = node('details');
  private scene = node('select');
  private search = node('input');
  private status = node('p');
  private rows = node('div');
  private previous = node('button', 'Vorige 40');
  private next = node('button', 'Weitere 40');
  private offset = 0;
  private nextOffset: number | null = null;
  private request = 0;
  private key = '';
  private sceneChoiceRequired = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private context: () => LocationActivityContext | null,
    private openNpc: (id: string, current: () => boolean) => Promise<void>,
    private openHouse: (site: CityActivitySite, current: () => boolean) => Promise<void>,
  ) {
    this.element.id = 'location-activity';
    this.element.className = 'location-activity';
    this.scene.id = 'location-activity-scene';
    this.scene.setAttribute('aria-label', 'Gruppenuhr für Ortsbesuche');
    this.search.id = 'location-activity-search';
    this.search.type = 'search';
    this.search.placeholder = 'NSC oder Besuchsaktivität';
    this.search.setAttribute('aria-label', 'Geplante Ortsbesuche durchsuchen');
    this.status.id = 'location-activity-status';
    this.status.setAttribute('role', 'status');
    this.rows.id = 'location-activity-rows';
    this.previous.type = this.next.type = 'button';
    this.previous.disabled = this.next.disabled = true;
    const refresh = node('button', 'Besuche aktualisieren'),
      toolbar = node('div'),
      sceneLabel = node('label', 'Gruppenuhr'),
      searchLabel = node('label', 'Suche');
    refresh.id = 'location-activity-refresh';
    refresh.type = 'button';
    toolbar.className = 'toolbar';
    sceneLabel.append(this.scene);
    searchLabel.append(this.search);
    toolbar.append(sceneLabel, searchLabel, refresh);
    this.element.append(
      node('summary', 'Geplante NSC-Besuche'),
      node(
        'p',
        'Wochenplan und Datumsausnahmen für diesen Ort: feste Ortsziele sowie Wohn- und Arbeitsgebäude. Die Gruppenuhr dient nur zum Lesen. Ein Plan beweist keine tatsächliche Anwesenheit.',
      ),
      toolbar,
      this.status,
      this.rows,
      this.previous,
      this.next,
    );
    this.element.ontoggle = () => {
      if (this.element.open) void this.read();
    };
    refresh.onclick = () => {
      this.offset = 0;
      void this.read();
    };
    this.scene.onchange = () => {
      if (!this.scene.value) return;
      this.sceneChoiceRequired = false;
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
    return c ? JSON.stringify([c.workspace.token, c.locationId, c.revision]) : '';
  }
  contextChanged() {
    const key = this.contextKey();
    if (key === this.key) return;
    this.key = key;
    this.request++;
    this.offset = 0;
    this.nextOffset = null;
    this.sceneChoiceRequired = false;
    this.scene.replaceChildren();
    this.search.value = '';
    this.rows.replaceChildren();
    this.previous.disabled = this.next.disabled = true;
    this.status.textContent = 'Ort wählen.';
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (key && this.element.open) void this.read();
  }
  private async read() {
    const c = this.context();
    if (!c || !this.element.open || !this.element.isConnected) return;
    const n = ++this.request,
      key = this.contextKey(),
      current = () =>
        n === this.request &&
        this.contextKey() === key &&
        this.element.isConnected &&
        this.element.open;
    this.previous.disabled = this.next.disabled = true;
    this.rows.replaceChildren();
    this.status.textContent = 'Geplante Besuche werden gelesen…';
    try {
      const result = await window.campaign.locationActivities(c.workspace.token, {
        locationId: c.locationId,
        sceneId: this.scene.value || null,
        focusFallback: !this.sceneChoiceRequired,
        text: this.search.value,
        offset: this.offset,
      });
      if (!current()) return;
      if (!result.ok) throw new Error(result.error);
      const page = result.value;
      if (page.locationId !== c.locationId || page.locationRevision !== c.revision)
        throw new Error('Ort geändert. Ortsmappe aktualisieren.');
      this.draw(page, current);
    } catch (e) {
      if (current()) this.status.textContent = (e as Error).message;
    }
  }
  private draw(page: LocationActivityPage, current: () => boolean) {
    this.scene.replaceChildren();
    if (!page.sceneId)
      this.scene.append(
        new Option(page.scenes.length ? 'Gruppenuhr wählen' : 'Keine Gruppenuhr verfügbar', ''),
      );
    for (const s of page.scenes) this.scene.append(new Option(s.title, s.id));
    this.scene.disabled = !page.scenes.length;
    this.scene.value = page.sceneId ?? '';
    this.sceneChoiceRequired = !page.sceneId && page.scenes.length > 0;
    this.nextOffset = page.next;
    this.previous.disabled = !this.offset;
    this.next.disabled = page.next === null;
    this.status.textContent =
      page.sceneTitle +
      ' · ' +
      page.date +
      (page.rows.length
        ? ' · ' +
          (this.offset + 1) +
          '–' +
          (this.offset + page.rows.length) +
          ' NSCs mit geplantem Ortsziel'
        : '');
    if (!page.rows.length)
      this.rows.append(
        node(
          'p',
          page.sceneId
            ? 'Keine passenden geplanten Besuche. Tagesziele im NSC-Profil festlegen.'
            : 'Eine verfügbare Gruppenuhr wählen.',
        ),
      );
    const control = (title: string, work: () => Promise<void>) => {
      const b = node('button', title);
      b.type = 'button';
      b.onclick = () => {
        if (!current() || !b.isConnected) return;
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
        planned = node('div'),
        actual = node('p');
      article.dataset.locationActivityNpc = row.id;
      article.className = 'location-activity-row';
      article.append(node('h4', row.name + (row.defeated ? ' · ausgeschieden' : '')));
      if (row.overrideLabel) planned.append(node('p', 'Tagesausnahme: ' + row.overrideLabel));
      if (row.problem) planned.append(node('p', row.problem));
      else {
        const describe = (visit: LocationVisit, title: string) => {
          planned.append(node('strong', title + visit.activity), node('p', visit.time));
          if (visit.notes) planned.append(node('p', visit.notes));
          if (visit.house) {
            const house = visit.house,
              b = control('Geplantes Gebäude: ' + house.title, () =>
                this.openHouse(house, current),
              );
            b.dataset.locationActivityHouse = house.unitId;
            b.disabled = !house.available;
            planned.append(b);
          }
        };
        if (row.current) describe(row.current, 'Jetzt hier geplant: ');
        else planned.append(node('p', 'Jetzt keine Aktivität hier geplant.'));
        if (row.next) {
          if (row.current)
            planned.append(
              node('p', 'Nächster Besuch: ' + row.next.date + ' · ' + row.next.activity),
            );
          else describe(row.next, 'Nächster Besuch: ' + row.next.date + ' · ');
        } else planned.append(node('p', 'Kein weiterer Besuch geplant.'));
      }
      actual.textContent =
        'Tatsächlicher Standort: ' +
        row.actualLocation +
        (row.atLocation ? ' · an diesem Ort' : '') +
        (row.actualRoom ? ' · Dungeonraum ' + row.actualRoom : '');
      const b = control('NSC-Profil öffnen', () => this.openNpc(row.id, current));
      b.dataset.locationActivityProfile = row.id;
      article.append(planned, actual, b);
      this.rows.append(article);
    }
  }
}
