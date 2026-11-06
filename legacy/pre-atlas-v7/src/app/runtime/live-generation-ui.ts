import {
  renderEncounterComposition,
  compositionPreferences,
  preferenceSelect,
  type CompositionPreference,
} from '../catalog/encounter-composition-ui';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type { LiveView } from './live-contracts';
import type { CombatAction } from './combat-contracts';
import type {
  GenerationRequest,
  GenerationRun,
  GeneratorRegistry,
  EncounterTable,
  WorldSources,
} from '../campaign/generation-contracts';
import type { EncounterParty } from '../catalog/encounter-contracts';
import { encounterEntryLabel } from '../catalog/encounter-contracts';
import { xpLevel } from './progression';
import { renderCreatureDetail } from '../catalog/creature-detail-ui';
import { requiredNpcPicker } from '../campaign/required-npc-picker';
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
  };
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
type Context = { workspace: WorkspaceGeometry; live: LiveView };
const key = (c: Context | null) =>
  c
    ? JSON.stringify([
        c.workspace.token,
        c.live.scene?.id,
        c.live.scene?.membershipRevision,
        c.live.focusRevision,
        c.live.scene?.locationId,
      ])
    : '';
export class LiveEncounterGenerator {
  private dialog = node('dialog');
  private fields = node('div');
  private cards = node('div');
  private status = node('p');
  private summary = node('p');
  private tablePicks = node('div');
  private factionPicks = node('div');
  private history = node('select');
  private seed = node('input');
  private title = node('input');
  private filter = node('input');
  private habitat = node('input');
  private difficulty = node('select');
  private time = node('select');
  private count = node('select');
  private location = node('input');
  private npcs = node('select');
  private make = button('Vorschläge erzeugen', () => void this.generate());
  private fresh = button('Neue Auswahl mit neuem Seed', () => {
    this.seed.value = crypto.randomUUID();
    void this.generate();
  });
  private required: ReturnType<typeof requiredNpcPicker>;
  private preferences = {} as Record<CompositionPreference, HTMLSelectElement>;
  private owner: Context | null = null;
  private ownerKey = '';
  private generation = 0;
  private busy = false;
  private party: EncounterParty[] = [];
  private tables: EncounterTable[] = [];
  private sources: WorldSources | null = null;
  private registry: GeneratorRegistry | null = null;
  private run: GenerationRun | null = null;
  private previewFields = '';
  constructor(
    private tell: (text: string, error?: boolean) => void,
    private context: () => Context | null,
    private flush: () => Promise<boolean>,
    private prepare: (action: Extract<CombatAction, { kind: 'create' }>) => Promise<boolean>,
  ) {
    this.dialog.id = 'live-generation-dialog';
    this.dialog.className = 'live-generation-dialog';
    this.fields.className = 'live-generation-fields';
    this.cards.id = 'live-generation-preview';
    this.cards.className = 'live-generation-cards';
    this.status.id = 'live-generation-status';
    this.status.setAttribute('role', 'status');
    this.summary.id = 'live-generation-party';
    this.seed.id = 'live-generation-seed';
    this.title.id = 'live-generation-title';
    this.filter.id = 'live-generation-filter';
    this.habitat.id = 'live-generation-habitat';
    this.history.id = 'live-generation-history';
    this.difficulty.id = 'live-generation-difficulty';
    this.time.id = 'live-generation-time';
    this.count.id = 'live-generation-count';
    this.location.id = 'live-generation-location';
    this.location.type = 'checkbox';
    this.npcs.id = 'live-generation-npcs';
    this.make.id = 'live-generation-make';
    this.fresh.id = 'live-generation-fresh';
    this.tablePicks.id = 'live-generation-tables';
    this.factionPicks.id = 'live-generation-factions';
    const option = (s: HTMLSelectElement, v: string, text: string) => {
      const o = node('option', text);
      o.value = v;
      s.append(o);
    };
    for (const [v, t] of [
      ['weighted', 'Gewichtete Schwierigkeit'],
      ['trivial', 'Trivial'],
      ['easy', 'Leicht'],
      ['medium', 'Mittel'],
      ['hard', 'Schwer'],
      ['deadly', 'Tödlich'],
    ])
      option(this.difficulty, v!, t!);
    for (const [v, t] of [
      ['any', 'Jede Tageszeit'],
      ['day', 'Tag'],
      ['night', 'Nacht'],
    ])
      option(this.time, v!, t!);
    for (const v of ['1', '3', '5']) option(this.count, v, v + ' Vorschläge');
    for (const [v, t] of [
      ['none', 'Katalog / Tabellen'],
      ['mixed', 'NPCs und Katalog'],
      ['only', 'Nur NPCs'],
    ])
      option(this.npcs, v!, t!);
    const label = (text: string, input: HTMLElement) => {
      const l = node('label', text + ' ');
      l.append(input);
      return l;
    };
    this.fields.append(
      label('Titel', this.title),
      label('Kreaturfilter', this.filter),
      label('Schwierigkeit', this.difficulty),
      label('Anzahl', this.count),
      label('Gelände / Habitat', this.habitat),
      label('Tageszeit', this.time),
      label('Gegnerquellen', this.npcs),
      label('Seed', this.seed),
      label('Quellen des aktuellen Ortes verwenden', this.location),
    );
    for (const key of Object.keys(compositionPreferences) as CompositionPreference[]) {
      const select = preferenceSelect(key, 'live-generation-' + key);
      this.preferences[key] = select;
      this.fields.append(label(compositionPreferences[key].label, select));
    }
    const head = node('div');
    head.className = 'toolbar';
    head.append(
      node('h2', 'Begegnung für die aktuelle Gruppe'),
      button('Schließen', () => {
        if (!this.busy) this.reset();
      }),
    );
    const advanced = node('details');
    advanced.append(
      node('summary', 'Tabellen, Fraktionen und verbindliche NPCs'),
      node('h3', 'Encounter-Tabellen'),
      this.tablePicks,
      node('h3', 'Fraktionen'),
      this.factionPicks,
    );
    const host = node('div');
    host.id = 'live-generation-required';
    advanced.append(node('h3', 'Verbindliche Gegner'), host);
    const actions = node('div');
    actions.className = 'toolbar';
    actions.append(this.make, this.fresh, label('Gespeicherte Vorschau', this.history));
    this.dialog.append(
      head,
      this.summary,
      this.fields,
      advanced,
      actions,
      this.status,
      this.cards,
      node(
        'p',
        'Erzeugen speichert eine Vorschau. Erst „Für diese Gruppe vorbereiten“ übernimmt den Vorschlag in eine neue Kampfmaske samt Vorlage. Initiative, Start, Verlauf und Abschluss bleiben bei den normalen Kampfwerkzeugen. Beute wird separat vorbereitet oder vergeben.',
      ),
    );
    document.body.append(this.dialog);
    this.required = requiredNpcPicker(host.id, (text, error) => this.report(text, error));
    const open = button(
      'Begegnung erzeugen…',
      () => void this.open().catch((e) => this.report((e as Error).message, true)),
    );
    open.id = 'live-generation-open';
    document.getElementById('combat-resume')!.after(open);
    this.dialog.addEventListener('cancel', (e) => {
      if (this.busy) e.preventDefault();
      else this.reset();
    });
    this.dialog.addEventListener('input', () => this.update());
    this.dialog.addEventListener('change', () => this.update());
    this.history.onchange = () =>
      void this.loadHistory().catch((e) => this.report((e as Error).message, true));
  }
  reset() {
    this.generation++;
    this.busy = false;
    this.owner = null;
    this.ownerKey = '';
    this.run = null;
    this.registry = null;
    this.party = [];
    this.required.context(null, true);
    this.cards.replaceChildren();
    this.dialog.close();
  }
  contextChanged() {
    if (this.owner && key(this.context()) !== this.ownerKey) this.reset();
  }
  private current(o = this.owner, g = this.generation) {
    return (
      !!o && this.owner === o && g === this.generation && key(this.context()) === this.ownerKey
    );
  }
  private report(text: string, error = false) {
    this.status.textContent = text;
    this.tell(text, error);
  }
  private lock(on: boolean) {
    this.busy = on;
    for (const c of this.dialog.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLButtonElement
    >('input,select,button'))
      c.disabled = on;
    this.update();
  }
  private fieldsValue() {
    return JSON.stringify([
      this.title.value,
      this.seed.value,
      this.filter.value,
      this.habitat.value,
      this.time.value,
      this.difficulty.value,
      this.count.value,
      this.location.checked,
      this.npcs.value,
      [...this.tablePicks.querySelectorAll<HTMLInputElement>('input:checked')].map((n) => n.value),
      [...this.factionPicks.querySelectorAll<HTMLInputElement>('input:checked')].map(
        (n) => n.value,
      ),
      this.required.ids(),
      ...Object.values(this.preferences).map((s) => s.value),
    ]);
  }
  private update() {
    const ready =
      !!this.party.length && this.party.every((p) => p.level !== null) && !!this.registry;
    this.make.disabled = this.fresh.disabled = this.busy || !ready;
    for (const b of this.cards.querySelectorAll<HTMLButtonElement>('[data-prepare]'))
      b.disabled =
        this.busy ||
        !this.current() ||
        this.previewFields !== this.fieldsValue() ||
        !ready ||
        !this.run ||
        (!!this.run.request.locationId &&
          this.run.request.locationId !== this.owner?.live.scene?.locationId) ||
        JSON.stringify(this.party) !==
          JSON.stringify([...this.run.request.party].sort((a, b) => a.id.localeCompare(b.id)));
  }
  private picks(host: HTMLElement, rows: { id: string; name: string }[]) {
    host.replaceChildren();
    for (const r of rows) {
      const label = node('label');
      label.className = 'check-label';
      const box = node('input');
      box.type = 'checkbox';
      box.value = r.id;
      label.append(box, document.createTextNode(r.name));
      host.append(label);
    }
    if (!rows.length) host.textContent = 'Keine eigenen Quellen vorhanden.';
  }
  private async open() {
    const c = this.context(),
      request = ++this.generation;
    if (!c?.live.scene) return;
    let flushed: boolean;
    try {
      flushed = await this.flush();
    } catch (e) {
      if (request === this.generation) this.report((e as Error).message, true);
      return;
    }
    if (!flushed || request !== this.generation || key(this.context()) !== key(c)) return;
    this.reset();
    this.owner = c;
    this.ownerKey = key(c);
    const g = ++this.generation;
    this.status.textContent = 'Gruppe und Quellen werden gelesen…';
    this.dialog.showModal();
    this.lock(true);
    try {
      const [progress, tables, registry, sources, history] = await Promise.all([
        window.campaign.progress(c.workspace.token),
        window.campaign.encounterTables(c.workspace.token, false),
        window.campaign.generatorRegistry(c.workspace.token),
        window.campaign.generationSources(c.workspace.token),
        window.campaign.generationRuns(c.workspace.token),
      ]);
      if (!this.current() || g !== this.generation) return;
      const p = unwrap(progress);
      this.party = c.live.roster
        .filter((ch) => ch.active && ch.sceneId === c.live.scene!.id)
        .map((ch) => ({
          id: ch.id,
          name: ch.profile.name,
          level:
            p.characters.find((p) => p.characterId === ch.id)?.xp === null
              ? null
              : xpLevel(p.characters.find((p) => p.characterId === ch.id)!.xp!).level,
          count: 1,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      this.tables = unwrap(tables);
      this.registry = unwrap(registry);
      this.sources = unwrap(sources);
      this.picks(this.tablePicks, this.tables);
      this.picks(this.factionPicks, this.sources.factions);
      this.history.replaceChildren(node('option', 'Frühere Vorschau auswählen'));
      this.history.options[0]!.value = '';
      for (const h of unwrap(history)) {
        const o = node('option', h.title + ' · ' + h.count + ' Vorschläge');
        o.value = h.id;
        this.history.append(o);
      }
      this.title.value = 'Begegnung · ' + c.live.scene.title;
      this.seed.value = crypto.randomUUID();
      this.filter.value = this.habitat.value = '';
      this.count.value = '3';
      this.time.value = 'any';
      this.npcs.value = 'none';
      this.location.checked = !!c.live.scene.locationId;
      const defaults = this.registry.presets.find((p) => p.id === this.registry!.effectiveId)!
        .config.generationDefaults;
      this.difficulty.value = defaults.difficulty;
      for (const key of Object.keys(this.preferences) as CompositionPreference[])
        this.preferences[key].value = defaults[key];
      this.summary.textContent =
        c.live.scene.title +
        ' · ' +
        (this.party.map((p) => p.name + ' (Level ' + (p.level ?? 'unbekannt') + ')').join(' · ') ||
          'Keine Figuren in dieser Gruppe');
      this.status.textContent = this.party.some((p) => p.level === null)
        ? 'Für die Automatik fehlen bekannte XP/Level. Trage die XP in der Partyverwaltung ein und öffne die Begegnung erneut.'
        : 'Aktuelle Gruppe wird für die Vorschau verwendet. Die Planungsparty anderer Abende bleibt erhalten.';
      this.required.context(c.workspace.token, true);
    } catch (e) {
      if (this.current(c, g)) this.report((e as Error).message, true);
    } finally {
      if (this.current(c, g)) this.lock(false);
    }
  }
  private async generate() {
    const o = this.owner;
    if (!o || !this.current() || this.busy || !this.registry) return;
    const g = this.generation,
      request: GenerationRequest = {
        title: this.title.value,
        seed: this.seed.value,
        count: Number(this.count.value),
        party: structuredClone(this.party),
        filters: { text: this.filter.value },
        habitat: this.habitat.value,
        time: this.time.value as GenerationRequest['time'],
        difficulty: this.difficulty.value as GenerationRequest['difficulty'],
        amount: this.preferences.amount.value as GenerationRequest['amount'],
        balance: this.preferences.balance.value as GenerationRequest['balance'],
        diversity: this.preferences.diversity.value as GenerationRequest['diversity'],
        locationId: this.location.checked ? o.live.scene!.locationId : null,
        includeNpcs: this.npcs.value === 'mixed',
        npcOnly: this.npcs.value === 'only',
        requiredNpcIds: this.required.ids(),
        factionIds: [...this.factionPicks.querySelectorAll<HTMLInputElement>('input:checked')].map(
          (n) => n.value,
        ),
        tableIds: [...this.tablePicks.querySelectorAll<HTMLInputElement>('input:checked')].map(
          (n) => n.value,
        ),
      };
    const input = this.fieldsValue();
    this.lock(true);
    this.status.textContent = 'Vorschläge werden erzeugt…';
    try {
      const r = unwrap(await window.campaign.generateEncounters(o.workspace.token, request));
      if (!this.current() || g !== this.generation) return;
      this.run = r;
      this.previewFields = input;
      this.render();
      const h = node('option', r.request.title + ' · ' + r.plans.length + ' Vorschläge');
      h.value = r.id;
      this.history.append(h);
      this.history.value = r.id;
      this.report(
        r.plans.length + ' Vorschläge gespeichert. Wähle eine Begegnung für diese Gruppe.',
      );
    } catch (e) {
      if (this.current(o, g)) this.report((e as Error).message, true);
    } finally {
      if (this.current(o, g)) this.lock(false);
    }
  }
  private render() {
    this.cards.replaceChildren();
    const run = this.run,
      o = this.owner,
      g = this.generation;
    if (!run) return;
    const provenance = node(
      'p',
      'Seed ' +
        run.seed +
        ' · ' +
        run.preset.name +
        ' r' +
        run.preset.revision +
        ' · ' +
        run.candidates.length +
        ' Kreaturtypen',
    );
    provenance.className = 'live-generation-provenance';
    this.cards.append(provenance);
    if (run.warnings.length) {
      const warnings = node('details');
      warnings.className = 'live-generation-provenance';
      warnings.append(
        node('summary', run.warnings.length + ' Hinweise zu Quellen und Komposition'),
      );
      const list = node('ul');
      for (const warning of run.warnings) list.append(node('li', warning));
      warnings.append(list);
      this.cards.append(warnings);
    }
    for (const [index, plan] of run.plans.entries()) {
      const card = node('article');
      card.dataset.proposalIndex = String(index);
      card.append(
        node('h3', plan.name),
        node(
          'p',
          plan.assessment.difficulty +
            ' · ' +
            plan.assessment.adjustedXp +
            ' angepasste XP · ' +
            plan.assessment.baseXp +
            ' Basis-XP',
        ),
        node('p', plan.entries.map((e) => encounterEntryLabel(e, plan.sources)).join('\n')),
      );
      renderEncounterComposition(card, plan.composition, run.request, !!run.fixedRoster);
      const prepare = button('Für diese Gruppe vorbereiten', () => {
        if (this.current(o, g) && this.run === run) void this.accept(index);
      });
      prepare.dataset.prepare = String(index);
      card.append(prepare);
      const notes = node('details');
      notes.append(node('summary', 'Statblocks und Quellen'), node('pre', plan.notes));
      for (const c of plan.sources) {
        const d = node('details');
        d.append(node('summary', c.name));
        d.addEventListener('toggle', () => {
          if (d.open && !d.dataset.rendered) {
            d.dataset.rendered = 'true';
            const body = node('div');
            renderCreatureDetail(body, c);
            d.append(body);
          }
        });
        notes.append(d);
      }
      card.append(notes);
      this.cards.append(card);
    }
    this.update();
  }
  private async loadHistory() {
    const o = this.owner,
      id = this.history.value,
      g = this.generation;
    if (!o || !id || this.busy) return;
    this.lock(true);
    try {
      const run = unwrap(await window.campaign.generationRun(o.workspace.token, id));
      if (!this.current() || g !== this.generation) return;
      const r = run.request;
      this.title.value = r.title;
      this.seed.value = r.seed;
      this.filter.value = r.filters.text ?? '';
      this.habitat.value = r.habitat;
      this.difficulty.value = r.difficulty;
      for (const key of Object.keys(this.preferences) as CompositionPreference[])
        this.preferences[key].value = r[key];
      this.count.value = String(r.count);
      this.time.value = r.time;
      this.location.checked = !!r.locationId;
      this.npcs.value = r.npcOnly ? 'only' : r.includeNpcs ? 'mixed' : 'none';
      for (const n of this.tablePicks.querySelectorAll<HTMLInputElement>('input'))
        n.checked = r.tableIds.includes(n.value);
      for (const n of this.factionPicks.querySelectorAll<HTMLInputElement>('input'))
        n.checked = r.factionIds?.includes(n.value) ?? false;
      this.required.set(
        (r.requiredNpcIds ?? []).map((id) => ({
          id,
          name: run.npcBasis?.find((n) => n.id === id)?.name ?? id,
        })),
      );
      this.run = run;
      this.previewFields = this.fieldsValue();
      this.render();
      this.report(
        'Gespeicherte Vorschau geladen. Bei Übernahme werden Quellen und tatsächliche Gruppe erneut abgeglichen.',
      );
    } catch (e) {
      if (this.current(o, g)) this.report((e as Error).message, true);
    } finally {
      if (this.current(o, g)) this.lock(false);
    }
  }
  private async accept(index: number) {
    const o = this.owner,
      run = this.run,
      registry = this.registry;
    if (
      !o?.live.scene ||
      !run ||
      !registry ||
      !this.current() ||
      this.busy ||
      this.previewFields !== this.fieldsValue()
    )
      return;
    const g = this.generation;
    this.lock(true);
    try {
      const ok = await this.prepare({
        kind: 'create',
        sceneId: o.live.scene.id,
        title: run.plans[index]!.name,
        includeParty: true,
        expectedMembershipRevision: o.live.scene.membershipRevision,
        generation: {
          runId: run.id,
          index,
          expectedRegistryRevision: registry.revision,
          expectedFocusRevision: o.live.focusRevision,
          locationId: o.live.scene.locationId,
        },
      });
      if (ok && this.current(o, g)) {
        this.reset();
        this.tell(
          'Begegnung für diese Gruppe vorbereitet. Initiative und Start sind am Spieltisch bereit.',
        );
      } else if (this.current(o, g))
        this.status.textContent =
          'Begegnung wurde nicht übernommen. Hinweis im Kampagnenstatus prüfen; bei geänderten Quellen neu erzeugen.';
    } catch (e) {
      if (this.current(o, g)) this.report((e as Error).message, true);
    } finally {
      if (this.current(o, g)) this.lock(false);
    }
  }
}
