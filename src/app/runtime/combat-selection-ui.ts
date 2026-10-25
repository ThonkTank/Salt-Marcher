import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type { LiveScene } from './live-contracts';
import type { CombatAction } from './combat-contracts';
import type { EncounterParty } from '../catalog/encounter-contracts';
import {
  sceneGroupMembers,
  sceneGroupIssue,
  assessSceneGroups,
  type SceneEncounterSelectionView,
} from './scene-encounter-selection';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const unwrap = <T>(r: Result<T>) => {
  if (!r.ok) throw Error(r.error);
  return r.value;
};
type Owner = { workspace: WorkspaceGeometry; scene: LiveScene; current: () => boolean };
/** Read-only group selection. Preparing initiative is one existing Combat command. */
export class CombatSelectionPanel {
  private request = 0;
  private reading = false;
  private writing = false;
  private basis: SceneEncounterSelectionView | null = null;
  private owner: Owner | null = null;
  private groups: SceneEncounterSelectionView['groups'] = [];
  private party: EncounterParty[] = [];
  private partyBasis = '';
  private selected = new Set<string>();
  private members = new Map<string, Set<string>>();
  private rows = node('div');
  private partyText = node('p');
  private result = node('p');
  private status = node('p');
  private thresholds = node('p');
  private meter = node('meter');
  private title = node('input');
  private refresh = node('button', 'Szenengruppen neu lesen');
  private prepare = node('button', 'Auswahl in Initiative übernehmen');
  constructor(
    root: HTMLElement,
    private context: () => Owner | null,
    private commit: (
      action: Extract<CombatAction, { kind: 'create' }>,
      current: () => boolean,
    ) => Promise<boolean>,
    private blocked: () => boolean,
  ) {
    root.id = 'combat-selection';
    this.rows.id = 'combat-selection-groups';
    this.partyText.id = 'combat-selection-party';
    this.result.id = 'combat-selection-result';
    this.status.id = 'combat-selection-status';
    this.status.setAttribute('role', 'status');
    this.thresholds.id = 'combat-selection-thresholds';
    this.meter.id = 'combat-selection-meter';
    this.meter.min = 0;
    this.meter.max = 1;
    this.meter.value = 0;
    this.title.id = 'combat-selection-title';
    this.title.maxLength = 1000;
    this.title.placeholder = 'Optionaler Begegnungsname';
    this.title.setAttribute('aria-label', 'Name der ausgewählten Begegnung');
    this.refresh.id = 'combat-selection-refresh';
    this.prepare.id = 'combat-selection-prepare';
    this.refresh.type = this.prepare.type = 'button';
    const actions = node('div');
    actions.className = 'toolbar';
    actions.append(this.refresh, this.prepare);
    root.append(
      node('h3', 'Begegnung aus Szenengruppen'),
      this.partyText,
      this.rows,
      this.thresholds,
      this.meter,
      this.result,
      this.title,
      this.status,
      actions,
    );
    this.refresh.onclick = () => void this.read();
    this.prepare.onclick = () => void this.accept();
    this.draw();
  }
  reset() {
    this.request++;
    this.owner = null;
    this.basis = null;
    this.groups = [];
    this.party = [];
    this.selected.clear();
    this.members.clear();
    this.title.value = '';
    this.status.textContent = '';
    this.reading = false;
    this.draw();
  }
  lock() {
    this.prepare.disabled =
      this.reading ||
      this.writing ||
      this.blocked() ||
      !this.owner?.current() ||
      !!assessSceneGroups(this.party, this.chosenGroups(), this.owner?.scene.locationId ?? null)
        .issue;
    this.refresh.disabled = this.reading || this.writing || this.blocked();
    this.title.disabled = this.writing;
    for (const input of this.rows.querySelectorAll<HTMLInputElement>('input'))
      input.disabled =
        this.writing ||
        this.reading ||
        this.blocked() ||
        input.dataset.unavailable === 'true' ||
        (!!input.dataset.actorId && !this.selected.has(input.dataset.ownerGroupId!));
  }
  async read() {
    const owner = this.context();
    if (!owner || this.writing || this.blocked()) return;
    const request = ++this.request;
    this.owner = owner;
    this.reading = true;
    this.status.textContent = 'Szenengruppen und zugewiesene Party werden gelesen…';
    this.lock();
    const current = () => request === this.request && owner.current();
    try {
      const response = await window.campaign.sceneEncounterSelection(
        owner.workspace.token,
        owner.scene.id,
      );
      if (!current()) return;
      const value = unwrap(response);
      if (
        value.sceneId !== owner.scene.id ||
        value.membershipRevision !== owner.scene.membershipRevision ||
        value.locationId !== owner.scene.locationId
      )
        throw Error('Fokussierte Szene geändert. Szene aktualisieren.');
      const groups = value.groups,
        same = this.basis?.sceneId === value.sceneId;
      this.members = new Map(
        groups.map((g) => {
          const ids = sceneGroupMembers(g).map((a) => a.id),
            previous = same ? this.members.get(g.id) : undefined;
          return [g.id, new Set(previous ? ids.filter((id) => previous.has(id)) : ids)];
        }),
      );
      this.basis = value;
      this.groups = groups;
      this.party = value.party;
      this.partyBasis = value.partyBasis;
      this.selected = new Set(
        same
          ? [...this.selected].filter((id) =>
              groups.some((g) => g.id === id && !sceneGroupIssue(g, owner.scene.locationId)),
            )
          : [],
      );
      this.status.textContent = '';
      this.draw();
    } catch (e) {
      if (current()) {
        this.basis = null;
        this.groups = [];
        this.party = [];
        this.selected.clear();
        this.status.textContent = 'Auswahl nicht verfügbar: ' + (e as Error).message;
        this.draw();
      }
    } finally {
      if (current()) {
        this.reading = false;
        this.lock();
      }
    }
  }
  private chosenGroups() {
    return this.groups
      .filter((g) => this.selected.has(g.id))
      .map((g) => ({ ...g, actors: g.actors.filter((a) => this.members.get(g.id)?.has(a.id)) }));
  }
  private draw() {
    if (!this.basis) {
      this.rows.replaceChildren(
        node(
          'p',
          this.status.textContent
            ? 'Gruppen konnten nicht geladen werden. Erneut lesen.'
            : 'Szenengruppen noch nicht gelesen.',
        ),
      );
      this.partyText.textContent = this.status.textContent
        ? 'Zugewiesene Party nicht verfügbar.'
        : 'Zugewiesene Party noch nicht gelesen.';
      this.thresholds.textContent = '';
      this.result.textContent = 'Bewertung nicht verfügbar.';
      this.meter.hidden = true;
      this.lock();
      return;
    }
    this.rows.replaceChildren();
    this.partyText.textContent = this.party.length
      ? 'Zugewiesene Party: ' +
        this.party
          .map((p) => p.name + ' · ' + (p.level === null ? 'Level offen' : 'Level ' + p.level))
          .join(', ')
      : 'Keine aktiven Partyfiguren in der fokussierten Szene.';
    for (const group of this.groups) {
      const row = node('article'),
        label = node('label'),
        box = node('input'),
        facts = node('span');
      row.className = 'combat-selection-group';
      row.dataset.groupId = group.id;
      box.type = 'checkbox';
      box.value = group.id;
      box.checked = this.selected.has(group.id);
      const issue = sceneGroupIssue(group, this.owner!.scene.locationId);
      box.dataset.unavailable = String(!!issue);
      box.disabled = !!issue;
      label.append(box, facts);
      row.append(label);
      this.rows.append(row);
      const details = node('details'),
        summary = node('summary', 'Figuren für diese Begegnung auswählen');
      details.append(summary);
      for (const actor of sceneGroupMembers(group)) {
        const member = node('label'),
          choice = node('input');
        member.className = 'check-label';
        choice.type = 'checkbox';
        choice.value = actor.id;
        choice.dataset.actorId = actor.id;
        choice.dataset.ownerGroupId = group.id;
        choice.checked = this.members.get(group.id)!.has(actor.id);
        choice.onchange = () => {
          const ids = this.members.get(group.id)!;
          if (choice.checked) ids.add(actor.id);
          else ids.delete(actor.id);
          this.evaluate();
        };
        member.append(
          choice,
          document.createTextNode(actor.name + ' · ' + actor.hp + '/' + actor.maxHp + ' HP'),
        );
        details.append(member);
      }
      row.append(details);
      box.onchange = () => {
        if (box.checked) this.selected.add(group.id);
        else this.selected.delete(group.id);
        this.evaluate();
      };
    }
    for (const group of this.basis.unavailableGroups) {
      const row = node('article');
      row.dataset.unavailableGroupId = group.id;
      row.title = group.id;
      row.append(
        node('strong', 'Gruppe nicht verfügbar' + (group.title ? ' · ' + group.title : '')),
        node('p', group.problem),
      );
      this.rows.append(row);
    }
    if (!this.groups.length && !this.basis.unavailableGroups.length)
      this.rows.append(
        node(
          'p',
          'Keine Gruppen am Szenenort oder vorbereiteten Besuch. Gruppen unter „NSCs und Monstergruppen“ anlegen, am Szenenort platzieren und hier neu lesen.',
        ),
      );
    this.evaluate();
  }
  private evaluate() {
    const selected = this.chosenGroups(),
      { assessment: a, issue } = assessSceneGroups(
        this.party,
        selected,
        this.owner?.scene.locationId ?? null,
      );
    for (const row of this.rows.querySelectorAll<HTMLElement>('[data-group-id]')) {
      const g = this.groups.find((g) => g.id === row.dataset.groupId)!,
        problem = sceneGroupIssue(g, this.owner!.scene.locationId),
        chosen = { ...g, actors: g.actors.filter((a) => this.members.get(g.id)?.has(a.id)) },
        own = assessSceneGroups(this.party, [chosen], this.owner!.scene.locationId).assessment;
      row.querySelector<HTMLInputElement>('input')!.indeterminate =
        this.selected.has(g.id) && sceneGroupMembers(chosen).length !== sceneGroupMembers(g).length;
      row.querySelector('details')!.hidden = !this.selected.has(g.id);
      row.querySelector('span')!.textContent =
        g.title +
        ' · ' +
        sceneGroupMembers(chosen).length +
        ' von ' +
        sceneGroupMembers(g).length +
        ' Figuren · ' +
        own.baseXp +
        ' Basis-XP · ' +
        (this.selected.has(g.id)
          ? Math.round(own.baseXp * a.multiplier) + ' angepasste XP (Anteil)'
          : own.adjustedXp + ' angepasste XP (allein)') +
        (problem ? ' · ' + problem : '');
    }
    this.thresholds.textContent =
      'Party-Schwellen: ' +
      a.thresholds
        .map((v, i) => ['Leicht', 'Mittel', 'Schwer', 'Tödlich'][i] + ' ' + v)
        .join(' · ') +
      (a.unknownLevels ? ' · ' + a.unknownLevels + ' Level offen' : '');
    this.result.textContent =
      a.count +
      ' Gegner · ' +
      a.baseXp +
      ' Basis-XP · ×' +
      a.multiplier +
      ' · ' +
      a.adjustedXp +
      ' angepasste XP · ' +
      (a.difficulty ?? 'Schwierigkeit unbekannt') +
      ' · ' +
      (issue ?? 'Bereit für Initiative.');
    this.meter.max = Math.max(1, a.thresholds[3]!, a.adjustedXp);
    this.meter.value = a.adjustedXp;
    this.meter.setAttribute('aria-label', this.result.textContent);
    this.meter.hidden = !!a.unknownLevels || !a.partySize;
    this.lock();
  }
  private async accept() {
    this.lock();
    if (this.prepare.disabled || !this.owner || !this.basis) return;
    const owner = this.owner,
      basis = this.basis,
      request = this.request,
      current = () => request === this.request && owner.current();
    const groups = this.groups.filter((g) => this.selected.has(g.id));
    this.writing = true;
    this.status.textContent = 'Auswahl wird gemeinsam in Initiative übernommen…';
    this.lock();
    try {
      const ok = await this.commit(
        {
          kind: 'create',
          sceneId: owner.scene.id,
          title: this.title.value,
          includeParty: true,
          expectedMembershipRevision: owner.scene.membershipRevision,
          sceneSelection: {
            expectedFocusRevision: basis.focusRevision,
            expectedRosterRevision: basis.rosterRevision,
            partyBasis: this.partyBasis,
            groups: groups.map((g) => ({
              id: g.id,
              revision: g.revision,
              basis: g.basis,
              ...(this.members.get(g.id)!.size === sceneGroupMembers(g).length
                ? {}
                : { worldActorIds: [...this.members.get(g.id)!] }),
            })),
          },
        },
        current,
      );
      if (current())
        this.status.textContent = ok
          ? 'Szenengruppen gemeinsam übernommen. Initiative festlegen und Kampf beginnen.'
          : 'Übernahme nicht bestätigt. Buchungsmeldung prüfen; Auswahl bleibt erhalten.';
    } catch (e) {
      if (current()) this.status.textContent = (e as Error).message;
    } finally {
      this.writing = false;
      if (current()) this.lock();
    }
  }
}
