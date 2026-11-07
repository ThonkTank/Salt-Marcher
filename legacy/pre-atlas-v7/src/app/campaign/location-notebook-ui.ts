import { LocationActivityBinder } from './location-activity-ui';
import { chooseNpcPlace } from './npc-places-ui';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type { DeskContent } from '../runtime/scene-desk-contracts';
import type { LocationMaterialKind } from './location-notebook-contracts';
import { textReferences } from './text-references';
import { showLocationGroup } from './location-group-ui';
import { openQuickReference } from '../catalog/quick-reference-ui';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  },
  field = (text: string, control: HTMLElement) => {
    const label = node('label', text);
    label.append(control);
    return label;
  },
  unwrap = <T>(r: Result<T>) => {
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
export type NewLocationMaterial = 'npc' | 'quest' | 'rumor' | 'shop' | 'group';
export type LocationNotebookAction = (
  | {
      kind: 'new-material';
      id: string;
      title: string;
      name: string;
      materialKind: NewLocationMaterial;
    }
  | {
      kind: 'bind-material';
      id: string;
      materialKind: 'npc' | 'narrative' | 'shop' | 'group';
      locationId: string;
      title: string;
    }
  | { kind: 'city-person'; assignment: import('./npc-places-contracts').NpcBuildingAssignment }
  | { kind: 'city-unit'; id: string; unitId: string }
  | { kind: 'room'; id: string }
  | { kind: 'edit' | 'graph'; id: string }
  | { kind: 'npc' | 'narrative' | 'group' | 'shop' | 'faction'; id: string }
  | { kind: 'event'; id: string; locationId: string; title: string }
  | { kind: 'new-event' | 'agenda' | 'sources'; id: string; title: string }
  | { kind: 'faction-source'; id: string }
  | { kind: 'map'; id: string; mapKind: 'city' | 'dungeon' }
  | {
      kind: 'read-aloud';
      id: string;
      sectionId: string;
      revision: number;
      sceneId: string;
      focusRevision: number;
      text: string;
      title: string;
    }
) & { origin?: { id: string; title: string } };
export class LocationNotebook {
  private activities: LocationActivityBinder;
  private dialog = node('dialog');
  private index = node('section');
  private article = node('article');
  private related = node('section');
  private status = node('p');
  private search = node('input');
  private category = node('select');
  private scope = node('select');
  private materialSearch = node('input');
  private items = node('div');
  private more = node('button', 'Weitere 40');
  private owner: WorkspaceGeometry | null = null;
  private content: DeskContent | null = null;
  private generation = 0;
  private materialsRequest = 0;
  private directoryRequest = 0;
  private next: number | null = null;
  private directoryTimer: ReturnType<typeof setTimeout> | null = null;
  private materialsTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private workspace: () => WorkspaceGeometry | null,
    private drain: () => Promise<boolean>,
    private tell: (s: string, error?: boolean) => void,
    private navigate: (action: LocationNotebookAction) => Promise<void>,
  ) {
    this.activities = new LocationActivityBinder(
      () =>
        this.owner && this.content && this.dialog.open
          ? {
              workspace: this.owner,
              locationId: this.content.ref.id,
              revision: this.content.revision,
            }
          : null,
      async (id, current) => {
        if (current()) await this.use({ kind: 'npc', id }, current);
      },
      async (site, current) => {
        if (current())
          await this.use({ kind: 'city-unit', id: site.cityId, unitId: site.unitId }, current);
      },
    );
    this.dialog.id = 'location-notebook';
    this.dialog.className = 'location-notebook';
    this.dialog.setAttribute('aria-label', 'Ortsmappe');
    this.search.type = this.materialSearch.type = 'search';
    this.search.id = 'location-notebook-search';
    this.search.placeholder = 'Ort suchen';
    this.search.setAttribute('aria-label', 'Ort suchen');
    this.materialSearch.id = 'location-material-search';
    this.materialSearch.placeholder = 'Material filtern';
    this.materialSearch.setAttribute('aria-label', 'Ortsmaterial filtern');
    this.scope.id = 'location-material-scope';
    this.scope.add(new Option('Nur Material am Ort', 'location'));
    this.scope.add(new Option('Vorhandenes Kampagnenmaterial', 'campaign'));
    this.category.id = 'location-material-kind';
    this.category.setAttribute('aria-label', 'Materialart');
    for (const [id, label] of [
      ['npc', 'NSCs'],
      ['narrative', 'Aufträge und Gerüchte'],
      ['group', 'Figurengruppen'],
      ['shop', 'Shops'],
      ['faction', 'Fraktionen'],
      ['event', 'Kalenderfristen'],
    ])
      this.category.add(new Option(label, id));
    this.article.id = 'location-notebook-document';
    this.items.id = 'location-material-list';
    this.status.id = 'location-notebook-status';
    this.status.setAttribute('role', 'status');
    const header = node('div');
    header.className = 'toolbar';
    header.append(
      node('h2', 'Ortsmappe'),
      this.button('Stand aktualisieren', () => this.select(this.content?.ref.id ?? null)),
      this.button('Schließen', async () => this.close()),
    );
    this.index.id = 'location-notebook-index';
    this.index.append(field('Ortssuche', this.search));
    this.related.append(
      node('h3', 'Material am Ort'),
      field('Materialart', this.category),
      field('Suchbereich', this.scope),
      field('Materialsuche', this.materialSearch),
      this.items,
      this.more,
    );
    const body = node('div');
    body.className = 'location-notebook-columns';
    body.append(this.index, this.article, this.related);
    this.dialog.append(header, this.status, body);
    document.body.append(this.dialog);
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });
    this.search.oninput = () => {
      this.directoryRequest++;
      if (this.directoryTimer) clearTimeout(this.directoryTimer);
      this.clearDirectory();
      this.directoryTimer = setTimeout(() => {
        this.directoryTimer = null;
        void this.directory(0);
      }, 180);
    };
    this.category.onchange = this.scope.onchange = () => {
      if (this.materialsTimer) clearTimeout(this.materialsTimer);
      this.materialsTimer = null;
      void this.materials(0);
    };
    this.materialSearch.oninput = () => {
      this.materialsRequest++;
      if (this.materialsTimer) clearTimeout(this.materialsTimer);
      this.items.replaceChildren(node('p', 'Material wird gesucht…'));
      this.more.hidden = true;
      this.materialsTimer = setTimeout(() => {
        this.materialsTimer = null;
        void this.materials(0);
      }, 180);
    };
    this.more.type = 'button';
    this.more.onclick = () => {
      if (this.next !== null) void this.materials(this.next);
    };
  }
  private button(text: string, action: () => Promise<unknown>, contentBound = true) {
    const b = node('button', text),
      bound = this.owner,
      g = this.generation,
      directory = this.directoryRequest,
      token = bound?.token,
      campaignId = bound?.campaign.id;
    b.type = 'button';
    b.onclick = () => {
      if (
        !b.isConnected ||
        b.disabled ||
        !this.dialog.open ||
        (bound &&
          (this.owner !== bound ||
            bound.token !== token ||
            bound.campaign.id !== campaignId ||
            (contentBound ? this.generation !== g : this.directoryRequest !== directory)))
      )
        return;
      const owner = this.owner,
        run = this.generation,
        clickedToken = owner?.token,
        clickedCampaign = owner?.campaign.id,
        current = () =>
          owner?.token === clickedToken &&
          owner?.campaign.id === clickedCampaign &&
          this.dialog.open &&
          this.owner === owner &&
          this.workspace() === owner &&
          this.generation === run;
      if (!current()) return;
      b.disabled = true;
      void action()
        .catch((e) => {
          if (current()) {
            this.status.textContent = e.message;
            this.tell(e.message, true);
          }
        })
        .finally(() => {
          if (
            b.isConnected &&
            (!bound ||
              (this.workspace() === bound &&
                (contentBound ? this.generation === g : this.directoryRequest === directory)))
          )
            b.disabled = false;
        });
    };
    return b;
  }

  private current(token: string, g: number) {
    return (
      this.dialog.open &&
      this.owner?.token === token &&
      this.workspace() === this.owner &&
      this.workspace()?.token === token &&
      this.generation === g
    );
  }
  close() {
    this.generation++;
    this.directoryRequest++;
    this.materialsRequest++;
    if (this.directoryTimer) clearTimeout(this.directoryTimer);
    if (this.materialsTimer) clearTimeout(this.materialsTimer);
    this.directoryTimer = this.materialsTimer = null;
    this.content = null;
    this.owner = null;
    this.activities.contextChanged();
    this.dialog.close();
  }
  contextChanged() {
    if (this.owner?.token !== this.workspace()?.token) this.close();
  }
  async open(id?: string, current: () => boolean = () => true) {
    const w = this.workspace();
    if (
      !w ||
      !current() ||
      document.querySelector('dialog:modal') ||
      !(await this.drain()) ||
      !current() ||
      this.workspace() !== w
    )
      return;
    this.close();
    this.owner = w;
    this.search.value = '';
    this.materialSearch.value = '';
    this.category.value = 'npc';
    this.scope.value = 'location';
    this.scope.disabled = false;
    this.dialog.showModal();
    this.article.replaceChildren(node('p', 'Ort wählen.'));
    this.items.replaceChildren();
    this.more.hidden = true;
    await this.directory(0);
    if (!current()) return;
    if (!id) {
      const live = unwrap(await window.campaign.live(w.token));
      id = live.scene?.locationId ?? undefined;
    }
    if (id && current() && this.owner === w && this.workspace() === w) await this.select(id);
  }
  private clearDirectory() {
    this.index
      .querySelectorAll(
        '.location-directory-row,.location-directory-more,.location-directory-state',
      )
      .forEach((e) => e.remove());
    const pending = node('p', 'Orte werden gesucht…');
    pending.className = 'location-directory-state';
    this.index.append(pending);
  }
  private async directory(offset: number) {
    const w = this.owner,
      g = this.generation,
      n = ++this.directoryRequest;
    if (!w) return;
    if (!offset) this.clearDirectory();
    try {
      const p = unwrap(
        await window.campaign.locationMaterials(w.token, {
          locationId: null,
          kind: 'directory',
          text: this.search.value,
          offset,
        }),
      );
      if (!this.current(w.token, g) || n !== this.directoryRequest) return;
      if (!offset) this.index.querySelector('.location-directory-state')?.remove();
      if (!offset)
        this.index.querySelectorAll('.location-directory-row').forEach((e) => e.remove());
      this.index.querySelector('.location-directory-more')?.remove();
      for (const item of p.items) {
        const b = this.button(item.title + ' · ' + item.detail, () => this.select(item.id), false);
        b.className = 'location-directory-row';
        b.dataset.locationId = item.id;
        this.index.append(b);
      }
      if (p.next !== null) {
        const b = this.button('Weitere Orte', () => this.directory(p.next!), false);
        b.className = 'location-directory-more';
        this.index.append(b);
      }
    } catch (e) {
      if (this.current(w.token, g)) this.tell((e as Error).message, true);
    }
  }
  private async use(action: LocationNotebookAction, sourceCurrent: () => boolean = () => true) {
    const w = this.owner,
      g = this.generation,
      c = this.content;
    if (!w || !c) return;
    const token = w.token,
      campaignId = w.campaign.id,
      current = () =>
        sourceCurrent() &&
        this.owner === w &&
        w.campaign.id === campaignId &&
        this.current(token, g);
    if (!current() || !(await this.drain()) || !current()) return;
    const now = unwrap(await window.campaign.deskContent(token, c.ref));
    if (!current()) return;
    if (
      now.unavailable ||
      now.ref.kind !== c.ref.kind ||
      now.ref.id !== c.ref.id ||
      now.revision !== c.revision
    )
      throw new Error('Ort geändert. Stand aktualisieren.');
    if (action.kind === 'read-aloud') {
      const live = unwrap(await window.campaign.live(token));
      if (!current()) return;
      if (live.focusRevision !== action.focusRevision || live.focusId !== action.sceneId)
        throw new Error('Fokusgruppe geändert. Ortsmappe aktualisieren.');
    }
    this.close();
    await this.navigate({ ...action, origin: { id: c.ref.id, title: c.title } });
  }

  private async select(id: string | null) {
    const w = this.owner,
      g = ++this.generation;
    this.materialsRequest++;
    this.content = null;
    this.activities.contextChanged();
    this.items.replaceChildren();
    this.article.replaceChildren(node('p', id ? 'Ort wird gelesen…' : 'Ort wählen.'));
    if (!w || !id) return;
    try {
      const c = unwrap(await window.campaign.deskContent(w.token, { kind: 'location', id }));
      if (!this.current(w.token, g) || !c.location) return;
      this.content = c;
      this.article.replaceChildren(node('h3', c.title));
      const tools = node('div');
      tools.className = 'toolbar';
      tools.append(
        this.button('Texte und Karten bearbeiten…', () => this.use({ kind: 'edit', id })),
        this.button('Zusammenhänge öffnen…', () => this.use({ kind: 'graph', id })),
      );
      tools.append(
        this.button('Material hier anlegen…', () => this.createMaterial()),
        this.button('Fraktionen und Begegnungsquellen…', () =>
          this.use({ kind: 'sources', id, title: c.title }),
        ),
        this.button('Fristen dieses Ortes…', () =>
          this.use({ kind: 'agenda', id, title: c.title }),
        ),
        this.button('Neue Frist an diesem Ort…', () =>
          this.use({ kind: 'new-event', id, title: c.title }),
        ),
      );
      this.article.append(tools, this.activities.element);
      this.activities.contextChanged();
      if (c.referenceNotice) this.article.append(node('p', c.referenceNotice));
      let displayedReferences = 0;
      for (const section of c.location.sections) {
        const block = node('section');
        block.dataset.sectionId = section.id;
        block.append(node('h4', section.title));
        const prose = node('div');
        prose.className = 'location-notebook-prose';
        let at = 0;
        for (const ref of textReferences(
          section.markdown,
          Math.max(0, 200 - displayedReferences),
        )) {
          displayedReferences++;
          prose.append(document.createTextNode(section.markdown.slice(at, ref.start)));
          const b = this.button(ref.label, async () => {
            this.close();
            await openQuickReference(ref.ref);
          });
          b.className = 'text-reference-inline';
          b.disabled = !!c.links?.find(
            (l) => l.entry.ref.kind === ref.ref.kind && l.entry.ref.id === ref.ref.id,
          )?.entry.unavailable;
          prose.append(b);
          at = ref.end;
        }
        prose.append(document.createTextNode(section.markdown.slice(at)));
        block.append(prose);
        this.article.append(block);
      }

      for (const map of c.location.detailMaps)
        this.article.append(
          this.button(map.kind === 'city' ? 'Stadtkarte öffnen…' : 'Dungeonkarte öffnen…', () =>
            this.use({ kind: 'map', id: map.documentId, mapKind: map.kind }),
          ),
        );
      this.status.textContent =
        'Abschnitte lesen, Material wählen oder einen einzelnen Text ausdrücklich am Spieltisch verwenden.';
      // Reading the source and its material does not require a healthy scene clock.
      void (async () => {
        try {
          const live = unwrap(await window.campaign.live(w.token));
          if (
            !this.current(w.token, g) ||
            !live.scene ||
            live.focusRevision === null ||
            c.unavailable
          )
            return;
          const scene = live.scene,
            focusRevision = live.focusRevision;
          for (const block of this.article.querySelectorAll<HTMLElement>('[data-section-id]')) {
            const section = c.location!.sections.find((s) => s.id === block.dataset.sectionId);
            if (section?.markdown.trim())
              block.append(
                this.button(
                  'Nur diesen Abschnitt als Vorlesetext in „' +
                    (scene.title || 'Gruppe') +
                    '“ übernehmen',
                  () =>
                    this.use({
                      kind: 'read-aloud',
                      id,
                      sectionId: section.id,
                      revision: c.revision,
                      sceneId: scene.id,
                      focusRevision,
                      text: section.markdown,
                      title: c.title + ' · ' + section.title,
                    }),
                ),
              );
          }
        } catch (e) {
          if (this.current(w.token, g)) {
            const notice = node(
              'p',
              'Vorlesen zur Gruppe nicht verfügbar: ' + (e as Error).message,
            );
            notice.setAttribute('role', 'status');
            this.article.append(notice);
          }
        }
      })();
      await this.materials(0);
    } catch (e) {
      if (this.current(w.token, g)) {
        this.article.append(node('p', (e as Error).message));
        this.tell((e as Error).message, true);
      }
    }
  }
  private async createMaterial() {
    const w = this.owner,
      c = this.content,
      g = this.generation;
    if (!w || !c) return;
    const dialog = node('dialog'),
      form = node('form'),
      name = node('input'),
      kind = node('select'),
      create = node('button', 'Anlegen und bearbeiten'),
      cancel = node('button', 'Abbrechen');
    dialog.id = 'location-material-create';
    dialog.setAttribute('aria-label', 'Material am Ort anlegen');
    name.id = 'location-material-name';
    name.required = true;
    name.maxLength = 500;
    kind.id = 'location-material-new-kind';
    for (const [id, title] of [
      ['npc', 'NSC'],
      ['quest', 'Auftrag'],
      ['rumor', 'Gerücht'],
      ['shop', 'Shop'],
      ['group', 'Figurengruppe'],
    ])
      kind.add(new Option(title, id));
    kind.value =
      this.category.value === 'narrative'
        ? 'quest'
        : ['npc', 'shop', 'group'].includes(this.category.value)
          ? this.category.value
          : 'npc';
    create.type = 'submit';
    cancel.type = 'button';
    form.append(
      node('h3', 'Neues Material · ' + c.title),
      field('Art', kind),
      field('Name', name),
      node(
        'p',
        'Der gewählte Ort wird übernommen. Profil, Texte, Belohnung oder Warenbestand anschließend im Fachbereich bearbeiten.',
      ),
      create,
      cancel,
    );
    dialog.append(form);
    document.body.append(dialog);
    const draft = await new Promise<{ name: string; kind: NewLocationMaterial } | null>(
      (resolve) => {
        const finish = (value: { name: string; kind: NewLocationMaterial } | null) => {
          dialog.close();
          dialog.remove();
          resolve(value);
        };
        form.onsubmit = (e) => {
          e.preventDefault();
          if (name.value.trim())
            finish({ name: name.value, kind: kind.value as NewLocationMaterial });
        };
        cancel.onclick = () => finish(null);
        dialog.oncancel = (e) => {
          e.preventDefault();
          finish(null);
        };
        dialog.showModal();
        name.focus();
      },
    );
    if (!draft || !this.current(w.token, g) || this.content !== c) return;
    await this.use({
      kind: 'new-material',
      id: c.ref.id,
      title: c.title,
      name: draft.name,
      materialKind: draft.kind,
    });
  }
  private async inspectGroup(id: string) {
    const w = this.owner,
      c = this.content,
      g = this.generation;
    if (!w || !c) return;
    const action = await showLocationGroup(w.token, id, c.title);
    if (!action || !this.current(w.token, g) || this.content !== c) return;
    if (action.kind === 'places') await this.inspectNpcPlaces(action.id);
    else if (action.kind === 'npc') await this.use({ kind: 'npc', id: action.id });
    else if (action.kind === 'bind')
      await this.use({
        kind: 'bind-material',
        id,
        materialKind: 'group',
        locationId: c.ref.id,
        title: c.title,
      });
    else await this.use({ kind: 'group', id });
  }
  private async inspectNpcPlaces(id: string) {
    const w = this.owner,
      c = this.content,
      g = this.generation;
    if (!w || !c) return;
    const site = await chooseNpcPlace(w.token, id);
    if (!site || !this.current(w.token, g) || this.content !== c) return;
    await this.use(
      site.kind === 'assign'
        ? { kind: 'city-person', assignment: site }
        : site.kind === 'dungeon'
          ? { kind: 'room', id: site.roomId }
          : { kind: 'city-unit', id: site.cityId, unitId: site.unitId },
    );
  }
  private async materials(offset: number) {
    const w = this.owner,
      c = this.content,
      g = this.generation,
      n = ++this.materialsRequest;
    if (!w || !c) return;
    if (!offset) this.items.replaceChildren(node('p', 'Material wird gelesen…'));
    this.more.hidden = true;
    try {
      const kind = this.category.value as LocationMaterialKind;
      this.scope.disabled = !['npc', 'narrative', 'shop', 'group'].includes(kind);
      if (this.scope.disabled) this.scope.value = 'location';
      const campaign = this.scope.value === 'campaign',
        p = unwrap(
          await window.campaign.locationMaterials(w.token, {
            locationId: c.ref.id,
            kind,
            text: this.materialSearch.value,
            offset,
            scope: campaign ? 'campaign' : 'location',
          }),
        );
      if (!this.current(w.token, g) || n !== this.materialsRequest) return;
      if (p.locationRevision !== c.revision) throw new Error('Ort geändert. Stand aktualisieren.');
      if (!offset) this.items.replaceChildren();
      for (const item of p.items) {
        const b = this.button(item.title + ' · ' + item.detail, () =>
          kind === 'group'
            ? this.inspectGroup(item.id)
            : this.use(
                kind === 'event'
                  ? { kind: 'event', id: item.id, locationId: c.ref.id, title: c.title }
                  : {
                      kind: kind as 'npc' | 'narrative' | 'group' | 'shop' | 'faction',
                      id: item.id,
                    },
              ),
        );
        b.dataset.materialId = item.id;
        this.items.append(b);
        if (kind === 'npc') {
          const places = this.button('Schauplätze: ' + item.title + '…', () =>
            this.inspectNpcPlaces(item.id),
          );
          places.dataset.npcPlacesId = item.id;
          this.items.append(places);
        }
        if (campaign) {
          const bind = this.button('Ortsbindung für „' + c.title + '“ bearbeiten…', () =>
            this.use({
              kind: 'bind-material',
              id: item.id,
              materialKind: kind as 'npc' | 'narrative' | 'shop' | 'group',
              locationId: c.ref.id,
              title: c.title,
            }),
          );
          bind.dataset.materialBindId = item.id;
          this.items.append(bind);
        }
        if (kind === 'faction') {
          const stock = this.button('Bestände und Haltung: ' + item.title + '…', () =>
            this.use({ kind: 'faction-source', id: item.id }),
          );
          stock.dataset.factionSourceId = item.id;
          this.items.append(stock);
        }
      }
      if (!p.items.length && !offset)
        this.items.append(
          node('p', campaign ? 'Kein passendes Kampagnenmaterial.' : 'Kein zugeordnetes Material.'),
        );
      this.next = p.next;
      this.more.hidden = p.next === null;
    } catch (e) {
      if (this.current(w.token, g) && n === this.materialsRequest) {
        this.items.replaceChildren(node('p', (e as Error).message));
        this.tell((e as Error).message, true);
      }
    }
  }
}
