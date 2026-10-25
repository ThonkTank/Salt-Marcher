import { renderCreatureDetail } from '../catalog/creature-detail-ui';
import { KeyDocumentReader } from '../campaign/key-document-ui';
import {
  keyDocumentSources,
  type KeyPassageTarget,
  type KeyBookmark,
} from '../campaign/key-reading-model';
import type { DrawingElement } from './drawing-contracts';
import type { WorkspaceGeometry, Room } from '../shared/contracts';
import { DungeonBinderIndex, unplacedBinderPublicText } from './dungeon-binder-model';
import type { KeyRendered } from '../campaign/key-contracts';
import { renderDungeonKey } from '../campaign/key-model';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const button = (text: string, fn: () => void) => {
  const b = node('button', text);
  b.type = 'button';
  b.onclick = fn;
  return b;
};
export class DungeonBinder {
  private dialog = node('dialog');
  private list = node('div');
  private document = node('article');
  private search = node('input');
  private scopes = node('select');
  private floors = node('select');
  private filter = node('select');
  private caption = node('p');
  private status = node('p');
  private previous = button('Vorige Seite', () => {
    this.page--;
    this.drawList();
  });
  private next = button('Nächste Seite', () => {
    this.page++;
    this.drawList();
  });
  private back = button('Zurück im Binder', () => {
    const id = this.history.pop();
    if (id) this.select(id, false);
  });
  private refresh = button('Aktualisieren', () => void this.load());
  private reader: KeyDocumentReader | null = null;
  private token: string | null = null;
  private index: DungeonBinderIndex | null = null;
  private selected: string | null = null;
  private page = 0;
  private request = 0;
  private readVersion = 0;
  private history: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listVersion = 0;
  constructor(
    private workspace: () => WorkspaceGeometry | null,
    private flush: () => Promise<boolean>,
    private tell: (s: string, error?: boolean) => void,
    private navigate: (id: string, action: 'target' | 'map' | 'edit') => Promise<void>,
    private edit?: (
      id: string,
      target: KeyPassageTarget | undefined,
      current: () => boolean,
      returned: () => void,
      left: () => void,
    ) => Promise<boolean>,
  ) {
    this.dialog.id = 'dungeon-binder';
    this.dialog.className = 'dungeon-binder';
    this.dialog.setAttribute('aria-labelledby', 'dungeon-binder-title');
    this.document.id = 'dungeon-binder-document';
    this.list.id = 'dungeon-binder-list';
    this.status.id = 'dungeon-binder-status';
    this.status.setAttribute('role', 'status');
    this.search.id = 'dungeon-binder-search';
    this.search.type = 'search';
    this.search.placeholder = 'Raum, Level, Text, Geheimnis oder Falle finden';
    this.search.setAttribute('aria-label', 'Alle Räume und Inhalte durchsuchen');
    this.scopes.id = 'dungeon-binder-scope';
    this.scopes.setAttribute('aria-label', 'Dungeon');
    this.floors.id = 'dungeon-binder-floor';
    this.floors.setAttribute('aria-label', 'Geschoss');
    this.filter.id = 'dungeon-binder-filter';
    this.filter.setAttribute('aria-label', 'Raumfilter');
    for (const [id, label] of [
      ['all', 'Alle Räume'],
      ['secret', 'Geheime Räume / Abschnitte'],
      ['feature', 'Mit Fallen / Inhalten'],
      ['unplaced', 'Ohne Geometrie'],
    ] as const)
      this.filter.add(new Option(label, id));
    const heading = node('h2', 'Dungeon-Binder');
    heading.id = 'dungeon-binder-title';
    const head = node('div');
    head.className = 'toolbar';
    head.append(
      heading,
      this.back,
      button('Aktuellen Gruppenraum lesen', () => {
        const id = this.index?.view.position?.roomId;
        if (id) this.select(id);
      }),
      this.refresh,
      button('Schließen', () => this.reset()),
    );
    const body = node('div');
    body.className = 'dungeon-binder-columns';
    const sidebar = node('section');
    sidebar.className = 'dungeon-binder-nav';
    sidebar.append(this.search, this.scopes, this.floors, this.filter, this.caption, this.list);
    const pages = node('div');
    pages.className = 'toolbar';
    pages.append(this.previous, this.next);
    sidebar.append(pages);
    body.append(sidebar, this.document);
    this.dialog.append(head, this.status, body);
    document.body.append(this.dialog);
    for (const id of ['dungeon-binder-open', 'dungeon-binder-live'])
      document.getElementById(id)!.onclick = () => void this.open();
    this.search.oninput = () => {
      if (this.timer) clearTimeout(this.timer);
      const token = this.token,
        n = this.request;
      this.timer = setTimeout(() => {
        if (!this.current(token) || n !== this.request) return;
        this.timer = null;
        this.page = 0;
        this.drawList();
      }, 150);
    };
    this.scopes.onchange = () => {
      this.options();
      this.page = 0;
      this.drawList();
    };
    this.floors.onchange = this.filter.onchange = () => {
      this.page = 0;
      this.drawList();
    };
    this.dialog.addEventListener('cancel', () => this.reset());
  }
  reset() {
    this.reader = null;
    this.request++;
    this.readVersion = 0;
    this.listVersion++;
    this.refresh.disabled = false;
    this.status.textContent = '';
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.token = null;
    this.index = null;
    this.selected = null;
    this.history = [];
    this.list.replaceChildren();
    this.document.replaceChildren();
    this.dialog.close();
  }
  private current(token = this.token) {
    return !!token && this.workspace()?.token === token && this.token === token && this.dialog.open;
  }
  private report(message: string) {
    this.status.textContent = message;
    this.tell(message, true);
  }
  private async open() {
    const w = this.workspace();
    if (!w) return;
    this.reset();
    const n = this.request;
    try {
      if (!(await this.flush()) || this.request !== n || this.workspace()?.token !== w.token)
        return;
      this.token = w.token;
      this.search.value = '';
      this.scopes.value = '';
      this.floors.value = '';
      this.filter.value = 'all';
      this.page = 0;
      this.dialog.showModal();
      await this.load();
    } catch (e) {
      if (this.request === n && this.workspace()?.token === w.token)
        this.report((e as Error).message);
    }
  }
  private bound(control: HTMLElement, fn: () => void, valid: () => boolean = () => true) {
    const token = this.token,
      n = this.request;
    return () => {
      if (
        control.isConnected &&
        this.current(token) &&
        n === this.request &&
        n === this.readVersion &&
        valid()
      )
        fn();
    };
  }
  private control(text: string, fn: () => void) {
    const b = button(text, () => {});
    b.disabled = this.request !== this.readVersion;
    b.onclick = this.bound(b, fn);
    return b;
  }
  private async load(bookmark?: KeyBookmark | null) {
    const token = this.token,
      n = ++this.request;
    if (!token || !this.current(token)) return;
    this.refresh.disabled = true;
    this.index = null;
    this.readVersion = 0;
    this.listVersion++;
    this.list.replaceChildren();
    this.document.replaceChildren();
    this.caption.textContent = '';
    this.previous.disabled = this.next.disabled = this.back.disabled = true;
    this.status.textContent = 'Dungeon-Keys werden gelesen…';
    try {
      const r = await window.campaign.dungeon(token);
      if (!this.current(token) || n !== this.request) return;
      if (!r.ok) throw new Error(r.error);
      this.index = new DungeonBinderIndex(r.value);
      this.readVersion = n;
      this.options();
      this.selected = this.index.rooms.some((room) => room.id === this.selected)
        ? this.selected
        : (r.value.position?.roomId ??
          this.workspace()?.selectedId ??
          this.index.rooms[0]?.id ??
          null);
      this.drawList();
      this.drawDocument(bookmark);
      this.status.textContent =
        (r.value.sceneId
          ? 'Gruppenwissen: ' + r.value.sceneTitle + '. '
          : 'Keine fokussierte Gruppe. ') +
        'Lesen und Blättern verändern keine Entdeckung, Position oder Zeit.';
    } catch (e) {
      if (this.current(token) && n === this.request) this.report((e as Error).message);
    } finally {
      if (this.current(token) && n === this.request) this.refresh.disabled = false;
    }
  }
  private options() {
    const idx = this.index;
    if (!idx) return;
    const scope = this.scopes.value,
      floor = this.floors.value;
    this.scopes.replaceChildren(new Option('Alle Dungeons', ''));
    const ids = [...new Set(idx.rooms.map((r) => r.scopeId))];
    for (const id of ids)
      this.scopes.add(new Option(idx.scope(idx.rooms.find((r) => r.scopeId === id)!), id));
    this.scopes.value = ids.includes(scope) ? scope : '';
    this.floors.replaceChildren(new Option('Alle Geschosse', ''));
    const rows = idx.rooms.filter((r) => !this.scopes.value || r.scopeId === this.scopes.value),
      seen = new Set<string>();
    for (const r of rows) {
      const id = JSON.stringify([r.scopeId, r.floorId]);
      if (!seen.has(id)) {
        seen.add(id);
        this.floors.add(new Option(idx.floor(r), id));
      }
    }
    this.floors.value = seen.has(floor) ? floor : '';
  }
  private drawList() {
    const idx = this.index;
    if (!idx) return;
    const version = ++this.listVersion,
      valid = () => version === this.listVersion;
    this.previous.onclick = this.bound(
      this.previous,
      () => {
        this.page--;
        this.drawList();
      },
      valid,
    );
    this.next.onclick = this.bound(
      this.next,
      () => {
        this.page++;
        this.drawList();
      },
      valid,
    );
    this.back.onclick = this.bound(
      this.back,
      () => {
        const id = this.history.pop();
        if (id) this.select(id, false);
      },
      valid,
    );
    const q = this.search.value.trim().toLocaleLowerCase(),
      mode = this.filter.value,
      rooms = idx.rooms.filter((r) => {
        const key = idx.keys.get(r.id);
        return (
          (!this.scopes.value || r.scopeId === this.scopes.value) &&
          (!this.floors.value || JSON.stringify([r.scopeId, r.floorId]) === this.floors.value) &&
          (mode === 'all' ||
            (mode === 'unplaced' && !idx.geometric.has(r.id)) ||
            (mode === 'feature' && idx.features.has(r.id)) ||
            (mode === 'secret' &&
              (key?.secret ||
                idx.view.drawing.styles.some((s) => s.id === r.id && s.secret) ||
                idx.searchBlocks(r).some((b) => b.visibility === 'secret')))) &&
          idx.matches(r, q)
        );
      });
    this.page = Math.max(0, Math.min(this.page, Math.ceil(rooms.length / 40) - 1));
    this.caption.textContent =
      rooms.length +
      ' von ' +
      idx.rooms.length +
      ' Räumen' +
      (rooms.length
        ? ' · ' + (this.page * 40 + 1) + '–' + Math.min(rooms.length, (this.page + 1) * 40)
        : '');
    this.previous.disabled = this.page === 0;
    this.next.disabled = (this.page + 1) * 40 >= rooms.length;
    this.list.replaceChildren();
    for (const r of rooms.slice(this.page * 40, (this.page + 1) * 40)) {
      const b = this.control(idx.label(r), () => this.select(r.id));
      b.dataset.roomId = r.id;
      b.setAttribute('aria-pressed', String(r.id === this.selected));
      b.append(
        node(
          'small',
          idx.floor(r) +
            (r.id === idx.view.position?.roomId ? ' · Gruppe hier' : '') +
            (!idx.geometric.has(r.id) ? ' · ohne Geometrie' : ''),
        ),
      );
      this.list.append(b);
    }
    if (!rooms.length)
      this.list.append(node('p', 'Keine passenden Räume. Suche oder Filter ändern.'));
    this.back.disabled = !this.history.length;
  }
  private select(id: string, history = true) {
    if (!this.index?.rooms.some((r) => r.id === id)) return;
    if (history && this.selected && this.selected !== id) {
      this.history.push(this.selected);
      if (this.history.length > 100) this.history.shift();
    }
    this.selected = id;
    this.drawList();
    this.drawDocument();
  }
  private async go(id: string, action: 'target' | 'map' | 'edit') {
    if (action === 'edit' && this.edit) {
      await this.editPassage(id, undefined, this.reader?.bookmark());
      return;
    }
    const token = this.token;
    if (!this.current(token)) return;
    this.reset();
    const n = this.request;
    if (this.workspace()?.token !== token) return;
    try {
      await this.navigate(id, action);
    } catch (e) {
      if (this.request === n && this.workspace()?.token === token)
        this.tell((e as Error).message, true);
    }
  }
  private drawDocument(bookmark?: KeyBookmark | null) {
    this.reader = null;
    const idx = this.index,
      room = idx?.rooms.find((r) => r.id === this.selected);
    this.document.replaceChildren();
    if (!idx || !room) {
      this.document.append(node('p', 'Einen Raum im Verzeichnis wählen.'));
      return;
    }
    const key = idx.keys.get(room.id),
      geometry = idx.geometric.has(room.id),
      known = new Set(idx.view.keyDiscoveries ?? []),
      records = idx.view.drawing.keyContent ?? [];
    const heading = idx.view.position?.roomId === room.id ? (idx.view.keyHeading ?? null) : null;
    this.document.append(
      node('h3', idx.label(room)),
      node(
        'p',
        idx.scope(room) +
          ' · ' +
          idx.floor(room) +
          (key?.status ? ' · ' + key.status : '') +
          (key?.tags.length ? ' · ' + key.tags.join(', ') : ''),
      ),
    );
    const actions = node('div');
    actions.className = 'toolbar';
    for (const [action, label] of [
      ['target', 'Als Reiseziel wählen'],
      ['map', 'Auf der Karte öffnen'],
      ['edit', 'Key bearbeiten'],
    ] as const) {
      const b = this.control(label, () => void this.go(room.id, action));
      b.disabled = b.disabled || !geometry || (action === 'target' && !idx.view.sceneId);
      actions.append(b);
    }
    this.document.append(actions);
    if (!geometry)
      this.document.append(
        node(
          'p',
          'Raumidentität und Texte bleiben erhalten. Ohne aktuelle Geometrie ist er kein Reiseziel.',
        ),
      );
    if (key?.secret || idx.view.drawing.styles.some((s) => s.id === room.id && s.secret))
      this.document.append(node('p', 'Geheimer Raum · GM-Verzeichnis.'));
    const rendered: KeyRendered = geometry
      ? renderDungeonKey(room, records, idx.view, {
          audience: 'gm',
          discovered: new Set(),
          heading,
        })
      : {
          text: '',
          blocks: idx
            .blocks(room)
            .filter((b) => b.kind === 'text' || b.kind === 'legacy')
            .map((b) => ({
              ...b,
              discovered: known.has(b.id),
              text:
                b.kind === 'legacy'
                  ? room.sections
                      .filter((s) => s.kind === 'markdown')
                      .map((s) => s.markdown ?? '')
                      .join('\n\n')
                  : b.text,
            })),
          attributes: [],
        };
    if (!geometry && !key)
      rendered.blocks.push({
        id: room.id,
        visibility: 'gm',
        text: room.sections
          .filter((s) => s.kind === 'markdown')
          .map((s) => s.markdown ?? '')
          .join('\n\n'),
        discovered: false,
        dc: null,
        searchMethod: '',
        discoveryNotes: '',
      });
    this.document.append(node('h4', 'Raum-Key für die Spielleitung'));
    const host = node('section'),
      token = this.token,
      n = this.request;
    this.document.append(host);
    this.reader = new KeyDocumentReader(
      host,
      keyDocumentSources(room, records, rendered, known),
      this.search.value,
      () =>
        this.current(token) && n === this.request && this.selected === room.id && host.isConnected,
      (target, place) => {
        void this.editPassage(room.id, target, place);
      },
    );
    if (!rendered.blocks.length)
      this.document.append(
        node('p', 'Noch kein Beschreibungstext. Über „Key bearbeiten“ ergänzen.'),
      );
    if (rendered.attributes.length) {
      const details = node('details');
      details.append(
        node('summary', 'Wirksame Attribute und Herkunft'),
        node(
          'pre',
          rendered.attributes
            .map((a) => a.key + ': ' + (a.value ?? 'unterdrückt') + ' ← ' + a.origin)
            .join('\n'),
        ),
      );
      this.document.append(details);
    }
    const publicPreview = node('details');
    publicPreview.id = 'dungeon-binder-public';
    publicPreview.append(node('summary', 'Öffentliche Textvorschau mit bestätigten Abschnitten'));
    const publicText = geometry
      ? renderDungeonKey(room, records, idx.view, {
          audience: 'public',
          discovered: known,
          heading,
        }).text
      : unplacedBinderPublicText(room, idx.blocks(room), known);
    publicPreview.append(
      node(
        'p',
        'Textvorschau im GM-Binder. Die Spieleranzeige berücksichtigt weiterhin die tatsächliche Position und Wahrnehmung.',
      ),
      node('pre', publicText || 'Keine öffentlichen Beschreibungsabschnitte.'),
    );
    this.document.append(publicPreview);
    this.document.append(node('h4', 'Ausgänge und Verbindungen'));
    for (const exit of idx.exits.get(room.id) ?? []) {
      const target = idx.rooms.find((r) => r.id === exit.targetId),
        row = node('section');
      row.className = 'dungeon-binder-exit';
      row.append(
        node('strong', exit.name + (exit.secret ? ' · geheim' : '')),
        node('p', exit.state),
        node('pre', exit.description),
      );
      if (target)
        row.append(this.control('Weiterlesen: ' + idx.label(target), () => this.select(target.id)));
      else row.append(node('p', 'Ohne verfügbare Raumverknüpfung.'));
      this.document.append(row);
    }
    if (!idx.exits.has(room.id))
      this.document.append(node('p', 'Keine zugeordneten Türen, Treppen oder Passagen.'));
    this.drawFeatures(idx, room);
    if (key?.references.length) {
      this.document.append(node('h4', 'Verweise aus dem Key'));
      for (const r of key.references) this.document.append(node('p', r.kind + ': ' + r.label));
    }
    this.document.scrollTop = 0;
    this.reader?.start(bookmark);
  }
  private async editPassage(id: string, target?: KeyPassageTarget, bookmark?: KeyBookmark | null) {
    const token = this.token,
      n = this.request,
      current = () => this.current(token) && n === this.request && this.selected === id;
    if (!current()) return;
    if (!this.edit) {
      await this.go(id, 'edit');
      return;
    }
    try {
      await this.edit(
        id,
        target,
        current,
        () => {
          if (current()) void this.load(bookmark).catch((e) => this.report(e.message));
        },
        () => this.reset(),
      );
    } catch (error) {
      if (current()) this.report((error as Error).message);
    }
  }
  private async reference(f: DrawingElement, root: HTMLElement) {
    const token = this.token,
      n = this.request,
      ref = f.content?.reference;
    const current = () =>
      this.current(token) && n === this.request && n === this.readVersion && root.isConnected;
    if (!token || !ref || !current()) return;
    root.append(node('p', 'Gebundener Inhalt wird gelesen…'));
    try {
      const physical = this.index?.view.contents?.find((c) => c.id === f.id)?.groupId;
      const groupId = ref.kind === 'group' ? ref.id : physical;
      if (groupId) {
        const r = await window.campaign.preparedGroup(token, groupId);
        if (!current()) return;
        if (!r.ok) throw new Error(r.error);
        root.replaceChildren(
          node('h5', r.value.title + ' · aktuelle Figuren'),
          node('pre', r.value.notes),
          node(
            'pre',
            r.value.actors
              .map(
                (a) =>
                  a.name +
                  ' · HP ' +
                  a.hp +
                  '/' +
                  a.maxHp +
                  (a.conditions ? ' · ' + a.conditions : '') +
                  (a.defeated ? ' · besiegt' : ''),
              )
              .join('\n'),
          ),
        );
        this.statblocks(root, r.value.plan.sources);
      } else if (ref.kind === 'encounter') {
        const r = await window.campaign.encounterPlan(token, ref.id);
        if (!current()) return;
        if (!r.ok) throw new Error(r.error);
        root.replaceChildren(
          node('h5', r.value.name + ' · Encountervorlage'),
          node('pre', r.value.notes),
          node(
            'pre',
            r.value.entries
              .map(
                (e) =>
                  e.count +
                  ' × ' +
                  (r.value.sources.find((c) => c.id === e.creatureId)?.name ?? 'Unbekannte Quelle'),
              )
              .join('\n'),
          ),
        );
        this.statblocks(root, r.value.sources);
      } else {
        const r = await window.campaign.treasure(token, ref.id);
        if (!current()) return;
        if (!r.ok) throw new Error(r.error);
        root.replaceChildren(
          node('h5', r.value.title + ' · aktueller unvergebener Bestand'),
          node(
            'pre',
            r.value.items
              .map((i) => Math.max(0, i.quantity - i.allocated) + ' × ' + i.name)
              .join('\n'),
          ),
        );
      }
    } catch (e) {
      if (current())
        root.replaceChildren(
          node('p', 'Gebundener Inhalt nicht verfügbar: ' + (e as Error).message),
        );
    }
  }
  private statblocks(root: HTMLElement, sources: Parameters<typeof renderCreatureDetail>[1][]) {
    for (const c of sources) {
      const d = node('details');
      d.append(node('summary', 'Statblock: ' + c.name));
      let drawn = false;
      d.addEventListener('toggle', () => {
        if (d.open && !drawn) {
          drawn = true;
          const body = node('div');
          renderCreatureDetail(body, c);
          d.append(body);
        }
      });
      root.append(d);
    }
  }
  private drawFeatures(idx: DungeonBinderIndex, room: Room) {
    const features = idx.features.get(room.id) ?? [];
    this.document.append(node('h4', 'Fallen und Rauminhalte'));
    for (const f of features) {
      const details = node('details');
      details.dataset.featureId = f.id;
      details.append(
        node(
          'summary',
          f.name +
            ' · ' +
            {
              trap: 'Falle',
              puzzle: 'Rätsel',
              curiosity: 'Kuriosität',
              encounter: 'Begegnung',
              loot: 'Schatz',
            }[f.feature] +
            (f.secret ? ' · geheim' : ''),
        ),
      );
      let drawn = false;
      details.addEventListener(
        'toggle',
        this.bound(details, () => {
          if (!details.open || drawn) return;
          drawn = true;
          details.append(
            node('h5', 'Öffentliche Beschreibung'),
            node('pre', f.content?.publicText ?? ''),
            node('h5', 'GM-Notizen / Bedienung / Lösung'),
            node('pre', f.notes),
          );
          const search = f.content?.search;
          if (search)
            details.append(
              node(
                'p',
                [search.method, search.dc === null ? '' : 'DC ' + search.dc, search.notes]
                  .filter(Boolean)
                  .join(' · '),
              ),
            );
          if (f.feature === 'trap') {
            const state = idx.view.drawing.features.find((s) => s.id === f.id);
            details.append(
              node(
                'p',
                'Charges: ' +
                  (state?.charges ?? f.maxCharges) +
                  ' / ' +
                  f.maxCharges +
                  ' · Reset ' +
                  f.resetSeconds +
                  ' s' +
                  (state?.resetStartedMs ? ' · Countdown läuft' : ''),
              ),
            );
          }
          if (f.content?.reference) {
            const content = node('section');
            details.append(content);
            void this.reference(f, content);
          }
          details.append(
            node(
              'p',
              'Entdeckung, Fallenaktivierung, Kampf und Beute werden im Dungeon-Leitablauf ausdrücklich bestätigt.',
            ),
          );
        }),
      );
      this.document.append(details);
    }
    if (!features.length) this.document.append(node('p', 'Keine aktiven Rauminhalte platziert.'));
  }
}
