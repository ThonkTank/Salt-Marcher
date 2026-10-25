import { checkPendingCommit } from '../shared/commit-confirmation';
import { PartyLootPanel } from './party-loot-ui';
import { PartyRosterPanel } from './party-roster-ui';
import {
  partyMemberLabels,
  partyQuickFields,
  defaultPartyQuickFields,
  checkedPartyQuickFields,
  partyQuickFacts,
  partyRestOverview,
  characterRestHint,
  type PartyQuickField,
} from './party-overview';
import { bindAnchoredPopup } from '../shared/anchored-popup';
import { workspaceShortcutAvailable } from '../workspace/workspace-shortcuts';
import { initPartyAwards, resetPartyAwards } from './party-award-ui';
import { changeCharacterXp } from './party-xp-model';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import {
  checkedCharacterProfile,
  type Character,
  type CharacterProfile,
  type LiveView,
} from './live-contracts';
import {
  xpInput,
  xpLevel,
  levelXp,
  restFrame,
  type ProgressView,
  type ProgressAction,
} from './progression';
import { runPartyLive, runPartyProgress, openPartyMove } from './live';
import { onProgressChanged } from './progression-ui';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => el<HTMLInputElement>(id).value;
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const format = (n: number) => n.toLocaleString('de-DE');
const fields = [
  ['playerName', 'Spieler', 'text'],
  ['species', 'Volk', 'text'],
  ['characterClass', 'Klasse', 'text'],
  ['languages', 'Sprachen (Kommas, Reihenfolge bleibt)', 'text'],
  ['armorClass', 'RK', 'number'],
  ['passivePerception', 'Passive Wahrnehmung', 'number'],
  ['passiveInsight', 'Passive Einsicht', 'number'],
  ['passiveInvestigation', 'Passive Untersuchung', 'number'],
  ['speedFeet', 'Bewegung (Fuß)', 'number'],
] as const;
let workspace: WorkspaceGeometry | null = null,
  live: LiveView | null = null,
  progress: ProgressView | null = null,
  generation = 0,
  busy = false,
  loading = false,
  limit = 40;
let editor: Character | null = null,
  xpCharacterId: string | null = null;
let openLive: () => void,
  archiveOwner: Character | null = null,
  archived: Character[] = [],
  archiveNext: string | null = null,
  archiveRequest = 0,
  archiveTimer: ReturnType<typeof setTimeout> | null = null;
let lootPanel: PartyLootPanel | null = null;
let rosterPanel: PartyRosterPanel | null = null,
  partyWindowRevision = 0,
  rosterOpenRequest = 0;
let restConfirmation: string | null = null,
  restInputRevision = 0;
let quickFields: PartyQuickField[] = [...defaultPartyQuickFields];
const expanded = new Set<string>(),
  quickKey = 'party-quick-fields-v1';
const opened = () => el('party-popover').matches(':popover-open');
const message = (text: string, error = false, id = 'party-status') => {
  el(id).textContent = text;
  el(id).classList.toggle('error', error);
};
function clearRestConfirmation() {
  restConfirmation = null;
  el('party-short-rest').textContent = 'Kurze Rast';
  el('party-long-rest').textContent = 'Lange Rast';
  el('party-rest-cancel').hidden = true;
  message('', false, 'party-rest-status');
}
function invalidateRestConfirmation() {
  restInputRevision++;
  clearRestConfirmation();
}
function lock() {
  for (const b of el('party-popover').querySelectorAll<
    HTMLInputElement | HTMLButtonElement | HTMLSelectElement
  >('button,input,select'))
    b.disabled = busy || loading || b.dataset.readonly === 'true';
  for (const b of el('party-xp-form').querySelectorAll<HTMLButtonElement>(
    '.party-xp-actions button',
  ))
    b.disabled = busy || loading || !xpBasis();
  rosterPanel?.lock(busy || loading);
}
async function refresh() {
  const owner = workspace,
    request = ++generation;
  if (!owner) return;
  clearRestConfirmation();
  loading = true;
  lock();
  previewXp();
  message('Party wird geladen…');
  try {
    const [l, p] = await Promise.all([
      window.campaign.live(owner.token),
      window.campaign.progress(owner.token),
    ]);
    if (workspace?.token !== owner.token || request !== generation) return;
    live = unwrap(l);
    progress = unwrap(p);
    render();
    message('');
    if ((el('party-archive') as HTMLDetailsElement).open) void loadArchive();
  } catch (e) {
    if (workspace?.token === owner.token && request === generation) {
      el('party-rest-average').replaceChildren();
      live = null;
      progress = null;
      el('party-active').replaceChildren();
      el('party-roster').replaceChildren();
      message((e as Error).message, true);
    }
  } finally {
    if (workspace?.token === owner.token && request === generation) {
      loading = false;
      previewXp();
      lock();
    }
  }
}
async function act(task: (owner: WorkspaceGeometry) => Promise<void>, target = 'party-status') {
  const owner = workspace;
  if (!owner || busy || loading) return false;
  clearRestConfirmation();
  busy = true;
  generation++;
  lock();
  message('Wird gespeichert…', false, target);
  try {
    await task(owner);
    if (workspace?.token !== owner.token) return false;
    await refresh();
    message('', false, target);
    return true;
  } catch (e) {
    if (workspace?.token === owner.token) message((e as Error).message, true, target);
    return false;
  } finally {
    if (workspace?.token === owner.token) {
      busy = false;
      lock();
    }
  }
}
function button(text: string, run: () => void) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.onclick = run;
  return b;
}
function edit(c: Character | null) {
  editor = c ? structuredClone(c) : null;
  el('party-editor').hidden = false;
  el('party-editor-title').textContent = c ? 'Profil · ' + c.id : 'Neue Figur · zunächst inaktiv';
  el<HTMLInputElement>('party-name').value = c?.profile.name ?? '';
  for (const [key] of fields) {
    const v = c?.profile[key];
    el<HTMLInputElement>('party-field-' + key).value = Array.isArray(v)
      ? v.join(', ')
      : String(v ?? '');
  }
  message('', false, 'party-editor-status');
  el('party-editor').scrollIntoView({ block: 'nearest' });
  el('party-name').focus();
}
function closeXp() {
  el('party-xp-editor').hidden = true;
  el('party-popover').classList.remove('party-editing-xp');
  el('party-shortcut').focus();
}
function openXp(c: Character) {
  const p = progress?.characters.find((p) => p.characterId === c.id);
  if (!p) return;
  xpCharacterId = c.id;
  el('party-xp-editor').hidden = false;
  el('party-popover').classList.add('party-editing-xp');
  el('party-popover').scrollTop = 0;
  el('party-xp-title').textContent = 'XP · ' + c.profile.name + ' · ' + c.id;
  el<HTMLSelectElement>('party-xp-mode').value = 'set';
  el<HTMLInputElement>('party-xp-amount').value = '';
  el<HTMLSelectElement>('party-level').value = '';
  message('', false, 'party-xp-status');
  previewXp();
  lock();
  el('party-xp-amount').focus();
}
function xpBasis() {
  const character = live?.roster.find((c) => c.id === xpCharacterId),
    state = progress?.characters.find((p) => p.characterId === xpCharacterId);
  return character && state ? { character, state } : null;
}
function previewXp() {
  if (!xpCharacterId) return;
  const basis = xpBasis();
  if (loading || !basis) {
    el('party-xp-current').textContent = '';
    el('party-xp-preview').textContent = loading
      ? 'XP-Stand wird aktualisiert…'
      : 'XP-Stand dieser Figur nicht verfügbar. Party aktualisieren.';
    return;
  }
  el('party-xp-title').textContent = 'XP · ' + basis.character.profile.name;
  el('party-xp-title').title =
    basis.character.profile.name +
    ' · ' +
    (basis.character.profile.playerName ?? 'Spieler offen') +
    ' · ' +
    xpCharacterId;
  el('party-xp-current').textContent =
    'Bisher ' +
    (basis.state.xp === null
      ? 'XP offen'
      : format(basis.state.xp) + ' XP · Level ' + xpLevel(basis.state.xp).level);
  try {
    const amount = xpInput(value('party-xp-amount')),
      mode = value('party-xp-mode') as 'add' | 'subtract' | 'set',
      change = changeCharacterXp(basis.state, mode, amount),
      after = change.after.xp!;
    el('party-xp-preview').textContent =
      (mode === 'set'
        ? 'Gesamtstand setzen'
        : mode === 'add'
          ? '+ ' + format(amount) + ' XP'
          : '− ' + format(amount) + ' XP') +
      ' · Danach ' +
      format(after) +
      ' XP · Level ' +
      xpLevel(after).level +
      (mode === 'subtract' ? ' · Abzug ' + change.removed + ' XP' : '') +
      ' · Rastbelastung bleibt erhalten.';
  } catch (e) {
    el('party-xp-preview').textContent = (e as Error).message;
  }
}
function proposeArchive(c: Character) {
  archiveOwner = structuredClone(c);
  el('party-archive-confirm').hidden = false;
  el('party-archive-description').textContent =
    c.profile.name + ' · Roster-ID ' + c.id + (c.active ? ' · derzeit aktiv' : ' · inaktiv');
  el<HTMLInputElement>('party-archive-name').value = '';
  el<HTMLInputElement>('party-archive-reason').value = '';
  message('', false, 'party-archive-error');
  el('party-archive-name').focus();
}
function archiveAction(
  c: Character,
  archived: boolean,
  owner: WorkspaceGeometry,
  confirmName: string,
  reason: string,
) {
  if (!live) throw new Error('Party zuerst aktualisieren.');
  return runPartyLive(owner.token, {
    kind: 'archive-character',
    characterId: c.id,
    expectedRevision: c.profileRevision,
    expectedMembershipRevision: c.membershipRevision,
    expectedRosterRevision: live.rosterRevision,
    expectedFocusRevision: live.focusRevision,
    archived,
    confirmName,
    reason,
  });
}
async function loadArchive(more = false) {
  const owner = workspace,
    request = ++archiveRequest;
  if (!owner) return;
  const query = value('party-archive-search'),
    after = more ? archiveNext : null;
  message('Archiv wird geladen…', false, 'party-archive-status');
  try {
    const result = unwrap(await window.campaign.archivedRoster(owner.token, after, query));
    if (workspace?.token !== owner.token || request !== archiveRequest) return;
    archived = more ? [...archived, ...result.items] : result.items;
    archiveNext = result.next;
    const root = el('party-archive-list');
    root.replaceChildren();
    for (const c of archived) {
      const row = document.createElement('article'),
        title = document.createElement('strong'),
        detail = document.createElement('p');
      row.className = 'party-card';
      row.dataset.characterId = c.id;
      title.textContent = c.profile.name + ' · ' + (c.profile.playerName ?? 'Spieler offen');
      detail.textContent =
        'Roster-ID ' +
        c.id +
        ' · archiviert ' +
        new Date(c.profile.archive!.recordedAt).toLocaleString('de-DE') +
        (c.profile.archive?.reason ? ' · ' + c.profile.archive.reason : '');
      row.append(
        title,
        detail,
        button(
          'Inaktiv wiederherstellen',
          () =>
            void act(async (w) => {
              await archiveAction(
                c,
                false,
                w,
                c.profile.name,
                'Wiederhergestellt aus dem Rosterarchiv',
              );
            }),
        ),
      );
      root.append(row);
    }
    if (!archived.length) root.textContent = 'Keine passenden archivierten Figuren.';
    el('party-archive-more').hidden = !archiveNext;
    message('', false, 'party-archive-status');
    lock();
  } catch (e) {
    if (workspace?.token === owner.token && request === archiveRequest)
      message((e as Error).message, true, 'party-archive-status');
  }
}
function membership(c: Character) {
  if (!live) return;
  const { focusId, rosterRevision, focusRevision } = live;
  void act(async (owner) => {
    if (!focusId && !c.active) throw new Error('Zuerst am Spieltisch die Sitzung starten.');
    await runPartyLive(owner.token, {
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: rosterRevision,
      active: !c.active,
      targetSceneId: c.active ? null : focusId,
      expectedFocusRevision: focusRevision,
    });
  });
}
function restMeter(fill: number | null, sections: number | null, label: string, hint: string) {
  const meter = document.createElement('span');
  meter.className = 'party-rest-meter';
  meter.tabIndex = 0;
  meter.setAttribute('role', 'img');
  meter.setAttribute('aria-label', hint);
  meter.title = hint;
  meter.textContent = label;
  if (fill !== null) {
    meter.style.setProperty('--party-rest-fill', 100 * fill + '%');
    if (sections)
      for (let n = 1; n < sections; n++) {
        const mark = document.createElement('i');
        mark.style.left = (100 * n) / sections + '%';
        mark.setAttribute('aria-hidden', 'true');
        meter.append(mark);
      }
  } else meter.dataset.unknown = 'true';
  return meter;
}
function card(c: Character, active: boolean) {
  const p = progress?.characters.find((p) => p.characterId === c.id),
    root = document.createElement('article'),
    head = document.createElement('div'),
    details = document.createElement('div'),
    scope = (active ? 'active:' : 'roster:') + c.id;
  root.className = 'party-card';
  root.dataset.characterId = c.id;
  head.className = 'party-card-head';
  details.id = 'party-details-' + scope;
  details.className = 'party-card-details';
  details.hidden = !expanded.has(scope);
  const identity = button(c.profile.name, () => {
    const show = details.hidden;
    details.hidden = !show;
    identity.setAttribute('aria-expanded', String(show));
    if (show) expanded.add(scope);
    else expanded.delete(scope);
  });
  identity.className = 'party-member-toggle';
  identity.setAttribute('aria-expanded', String(!details.hidden));
  identity.setAttribute('aria-controls', details.id);
  identity.title =
    c.profile.name + ' · ' + (c.profile.playerName ?? 'Spieler offen') + ' · ' + c.id;
  const level = p?.xp == null ? null : xpLevel(p.xp),
    xp = button(level ? 'L' + level.level + ' · XP' : 'XP offen', () => openXp(c));
  xp.className = 'party-level-meter';
  const xpHint = level
    ? format(p!.xp!) +
      ' XP · ' +
      (level.next === null
        ? 'Höchster Level erreicht'
        : 'Nächster Level bei ' + format(level.next) + ' XP')
    : 'XP und Level offen · XP eintragen';
  xp.title = xpHint;
  xp.setAttribute('aria-label', c.profile.name + ' · ' + xpHint);
  if (level)
    xp.style.setProperty(
      '--party-xp-fill',
      (level.next === null ? 100 : (100 * (p!.xp! - level.floor)) / (level.next - level.floor)) +
        '%',
    );
  const frame = p ? restFrame(p) : null;
  head.append(
    identity,
    xp,
    restMeter(
      frame?.fill ?? null,
      frame?.sections ?? null,
      frame?.overdue ? 'LR fällig' : frame ? 'Rast' : 'Rast ?',
      c.profile.name + ' · ' + characterRestHint(p),
    ),
  );
  const all = document.createElement('dl');
  for (const fact of partyQuickFacts(c, p, quickFields)) {
    const term = document.createElement('dt'),
      value = document.createElement('dd');
    term.textContent = fact.label;
    value.textContent = fact.value;
    all.append(term, value);
  }
  const health = document.createElement('p');
  health.textContent = p?.health ? 'HP ' + p.health.hp + ' / ' + p.health.maxHp : 'HP offen';
  const rest = document.createElement('p');
  rest.textContent = characterRestHint(p);
  const id = document.createElement('small');
  id.textContent = (c.active ? 'Aktiv' : 'Inaktiv') + ' · Roster-ID ' + c.id;
  const actions = document.createElement('div');
  actions.className = 'toolbar';
  actions.append(
    button('Beute und Verlauf', () => openMemberLoot(c)),
    button('Im Charakter-Roster anzeigen', () => showRosterCharacter(c.id)),
    button('Profil bearbeiten', () => edit(c)),
    button(c.active ? 'Aus Party' : 'Zur Party', () => membership(c)),
    button('Archivieren…', () => proposeArchive(c)),
  );
  details.append(all, health, rest, id, actions);
  root.append(head, details);
  return root;
}
function openMemberLoot(c: Character) {
  const owner = workspace;
  if (!owner || busy || loading || !opened()) return;
  const revision = partyWindowRevision,
    current = () =>
      workspace?.token === owner.token &&
      partyWindowRevision === revision &&
      opened() &&
      !!live?.roster.some((row) => row.id === c.id && !row.archived);
  if (lootPanel?.open(owner.token, c.id, c.profile.name, current)) {
    el('party-popover').classList.add('party-editing-loot');
    el('party-popover').scrollTop = 0;
  }
}
function renderAverage() {
  const members =
      live?.roster.filter((c) => c.active && (!live!.scene || c.sceneId === live!.focusId)) ?? [],
    average = partyRestOverview(
      members.map((c) => progress?.characters.find((p) => p.characterId === c.id)),
    ),
    hint =
      average.fill === null
        ? 'Kein verlässlicher Raststand.'
        : 'Ungewichteter Mittelwert der verbleibenden Rastfenster · ' +
          average.included +
          ' von ' +
          average.total +
          ' aktiven Figuren' +
          (average.partial ? ' · Teilbasis' : '') +
          (average.sections === null ? ' · unterschiedliche Abschnittszahlen' : '');
  el('party-rest-average').replaceChildren(
    restMeter(
      average.fill,
      average.sections,
      average.fill === null ? 'Rast ?' : average.partial ? 'Rast · Teilbasis' : 'Rast Ø',
      hint,
    ),
  );
}
function quickControls() {
  const root = el('party-quick-fields');
  root.replaceChildren();
  for (const [key, title] of partyQuickFields) {
    const label = document.createElement('label'),
      input = document.createElement('input');
    input.type = 'checkbox';
    input.value = key;
    input.checked = quickFields.includes(key);
    label.className = 'check-label';
    input.onchange = () => {
      if (!input.isConnected || busy || loading) return;
      const next = partyQuickFields
        .filter(([key]) =>
          [...root.querySelectorAll<HTMLInputElement>('input:checked')].some(
            (i) => i.value === key,
          ),
        )
        .map(([key]) => key);
      try {
        window.localStorage.setItem(quickKey, JSON.stringify(next));
        quickFields = next;
        render();
        message('', false, 'party-quick-status');
      } catch {
        message(
          'Schnellwerte konnten nicht gespeichert werden. Erneut versuchen.',
          true,
          'party-quick-status',
        );
        quickControls();
      }
    };
    label.append(input, document.createTextNode(title));
    root.append(label);
  }
}

function restMembers(basis: LiveView) {
  return basis.roster.filter((c) => c.active && c.sceneId === basis.focusId);
}
function render() {
  if (!live || !progress) return;
  renderAverage();
  el('party-archive-heading').textContent =
    'Archivierte Figuren (' + (live.archivedRosterCount ?? 0) + ')';
  const active = el('party-active');
  active.replaceChildren();
  for (const c of live.roster.filter(
    (c) => c.active && (!live!.scene || c.sceneId === live!.focusId),
  ))
    active.append(card(c, true));
  if (!active.childElementCount) active.textContent = 'Heute noch keine aktive Party.';
  el('party-focus').textContent = live.scene
    ? 'Im Fokus: ' +
      (live.scene.title || 'Unbenannte Gruppe') +
      ' · ' +
      live.scene.members.length +
      ' Figuren'
    : 'Noch keine laufende Sitzung.';
  const picks = el('party-rest-members'),
    old = new Map(
      [...picks.querySelectorAll<HTMLInputElement>('input')].map((i) => [i.value, i.checked]),
    );
  picks.replaceChildren();
  const members = restMembers(live),
    labels = partyMemberLabels(members);
  for (const c of members) {
    const label = document.createElement('label'),
      input = document.createElement('input');
    input.type = 'checkbox';
    input.value = c.id;
    input.checked = old.get(c.id) ?? true;
    label.className = 'check-label';
    label.title = c.id;
    label.append(input, document.createTextNode(labels.get(c.id)!));
    picks.append(label);
  }
  renderRoster();
  lock();
}
function showRosterCharacter(id: string) {
  el<HTMLDetailsElement>('party-roster-panel').open = true;
  const search = el<HTMLInputElement>('party-search');
  search.value = id;
  limit = 40;
  renderRoster();
  search.scrollIntoView({ block: 'nearest' });
}
function renderRoster() {
  const root = el('party-roster');
  root.replaceChildren();
  const query = value('party-search').trim().toLocaleLowerCase('de-DE'),
    rows =
      live?.roster.filter(
        (c) =>
          !query ||
          [c.id, ...Object.values(c.profile).flat()].some(
            (v) =>
              (typeof v === 'string' || typeof v === 'number') &&
              String(v).toLocaleLowerCase('de-DE').includes(query),
          ),
      ) ?? [];
  for (const c of rows.slice(0, limit)) root.append(card(c, false));
  if (rows.length > limit)
    root.append(
      button('Weitere ' + Math.min(40, rows.length - limit) + ' Figuren', () => {
        limit += 40;
        renderRoster();
      }),
    );
  if (!rows.length) root.textContent = 'Keine passenden Figuren.';
  lock();
}
function rest(kind: 'short' | 'long') {
  if (!workspace || !live || !progress || busy || loading || !opened()) return;
  try {
    const basis = live,
      scene = basis.scene;
    if (!scene || basis.focusRevision === null) throw new Error('Keine laufende Gruppe im Fokus.');
    const ids = [
      ...el('party-rest-members').querySelectorAll<HTMLInputElement>('input:checked'),
    ].map((i) => i.value);
    if (!ids.length) throw new Error('Figuren der Gruppe im Fokus auswählen.');
    const labels = partyMemberLabels(restMembers(basis)),
      names: string[] = [],
      recipients = ids.map((characterId) => {
        const member = basis.roster.find((c) => c.id === characterId),
          p = progress!.characters.find((p) => p.characterId === characterId);
        if (!member?.active || member.sceneId !== scene.id || !scene.members.includes(characterId))
          throw new Error('Rastgruppe geändert. Party aktualisieren.');
        if (!p) throw new Error('Fortschritt einer gewählten Figur fehlt. Party aktualisieren.');
        names.push(labels.get(characterId)!);
        return { characterId, revision: p.revision };
      });
    const withTime = el<HTMLInputElement>('party-rest-time').checked,
      amount = Number(value('party-rest-' + kind)),
      restoreHp = kind === 'long' && el<HTMLInputElement>('party-rest-hp').checked;
    if (withTime && (!Number.isSafeInteger(amount) || amount <= 0))
      throw new Error('Positive ganze Dauer für die Rast eintragen.');
    const scope = {
      id: scene.id,
      expectedClockRevision: scene.clock.revision,
      expectedMembershipRevision: scene.membershipRevision,
      expectedFocusRevision: basis.focusRevision,
    };
    const action: Extract<ProgressAction, { kind: 'rest' }> = {
      kind: 'rest',
      rest: kind,
      recipients,
      restoreHp,
      scene: withTime ? { ...scope, amount, unit: kind === 'short' ? 'minutes' : 'hours' } : scope,
    };
    const key = JSON.stringify({ token: workspace.token, action });
    const restTitle = (kind === 'short' ? 'Kurze' : 'Lange') + ' Rast',
      timeFact = withTime
        ? amount + (kind === 'short' ? ' Minuten' : ' Stunden') + ' Szenenzeit'
        : 'ohne Zeitfortschreibung';
    const restFacts = restTitle + ' für ' + names.join(', ') + ' · ' + timeFact;
    const description =
      restFacts + (restoreHp ? ' · bekannte positive HP vollständig heilen' : ' · HP unverändert');
    if (restConfirmation !== key) {
      clearRestConfirmation();
      restConfirmation = key;
      el('party-' + kind + '-rest').textContent =
        (kind === 'short' ? 'Kurze' : 'Lange') + ' Rast bestätigen';
      el('party-rest-cancel').hidden = false;
      message(
        description + '. Zum Buchen dieselbe Rast erneut klicken.',
        false,
        'party-rest-status',
      );
      return;
    }
    const token = workspace.token,
      windowRevision = partyWindowRevision,
      inputRevision = restInputRevision;
    let healthResult = ' HP-Ergebnis nicht verfügbar.';
    clearRestConfirmation();
    void act(async (owner) => {
      const receipt = await runPartyProgress(owner.token, action);
      if (restoreHp && receipt)
        healthResult =
          ' HP nach der Rast: ' +
          recipients
            .map(({ characterId }) => {
              const state = receipt.characters.find((p) => p.characterId === characterId);
              return (
                labels.get(characterId) +
                ': ' +
                (!state
                  ? 'HP-Stand nicht verfügbar'
                  : state.health
                    ? state.health.hp + '/' + state.health.maxHp + ' HP'
                    : 'HP offen')
              );
            })
            .join(' · ') +
          '.';
    }, 'party-rest-status').then((saved) => {
      if (
        saved &&
        workspace?.token === token &&
        windowRevision === partyWindowRevision &&
        inputRevision === restInputRevision &&
        opened() &&
        el<HTMLDetailsElement>('party-rest').open &&
        live?.scene?.id === scene.id
      )
        message(
          'Gebucht: ' +
            (restoreHp
              ? restTitle + ' · ' + timeFact + '.' + healthResult
              : restFacts + ' · HP unverändert.'),
          false,
          'party-rest-status',
        );
    });
  } catch (error) {
    clearRestConfirmation();
    message((error as Error).message, true, 'party-rest-status');
  }
}
export async function openPartyRest(sceneId: string) {
  const owner = workspace;
  if (!owner || busy || loading)
    throw new Error('Party zunächst laden oder laufende Buchung abschließen.');
  await refresh();
  if (workspace?.token !== owner.token) return;
  if (live?.scene?.id !== sceneId) throw new Error('Reisegruppe gewechselt. Reise neu öffnen.');
  if (!progress) throw new Error('Partyfortschritt nicht verfügbar.');
  if (!opened()) el('party-popover').showPopover();
  el<HTMLDetailsElement>('party-rest').open = true;
  el('party-rest').scrollIntoView({ block: 'nearest' });
  el<HTMLInputElement>('party-rest-short').focus({ preventScroll: true });
}
export function activatePartyTopbar(next: WorkspaceGeometry | null) {
  lootPanel?.close();
  el('party-popover').classList.remove('party-editing-loot');
  partyWindowRevision++;
  rosterOpenRequest++;
  rosterPanel?.close();
  el('party-popover').classList.remove('party-editing-roster');
  resetPartyAwards();
  workspace = next;
  clearRestConfirmation();
  el<HTMLButtonElement>('party-shortcut').disabled = !next;
  generation++;
  expanded.clear();
  el('party-rest-average').replaceChildren();
  live = null;
  progress = null;
  editor = null;
  xpCharacterId = null;
  archiveOwner = null;
  archived = [];
  archiveNext = null;
  archiveRequest++;
  if (archiveTimer) clearTimeout(archiveTimer);
  archiveTimer = null;
  el('party-archive-list').replaceChildren();
  el('party-archive-confirm').hidden = true;
  busy = false;
  loading = false;
  limit = 40;
  el('party-popover').classList.remove('party-editing-xp');
  if (opened()) el('party-popover').hidePopover();
  el('party-editor').hidden = el('party-xp-editor').hidden = true;
  el<HTMLInputElement>('party-search').value = '';
  el('party-active').replaceChildren();
  el('party-roster').replaceChildren();
}
export function initPartyTopbar(navigate: () => void) {
  openLive = navigate;
  initPartyAwards(
    () => workspace,
    (token, action, done) =>
      void act(async (w) => {
        if (w.token !== token) throw new Error('Kampagne gewechselt. Abrechnung neu öffnen.');
        await runPartyProgress(token, action);
        done();
      }, 'party-award-status'),
  );
  for (const [key, label, type] of fields) {
    const l = document.createElement('label'),
      input = document.createElement('input');
    l.textContent = label;
    input.id = 'party-field-' + key;
    input.type = type;
    input.maxLength = 1000;
    if (type === 'number') {
      input.min = '0';
      input.step = '1';
    }
    l.append(input);
    el('party-profile-fields').append(l);
  }
  for (let n = 1; n <= 20; n++) {
    const o = document.createElement('option');
    o.value = String(n);
    o.textContent = 'Level ' + n + ' · ' + format(levelXp[n - 1]!) + ' XP';
    el('party-level').append(o);
  }
  try {
    const saved = window.localStorage.getItem(quickKey);
    if (saved !== null) quickFields = checkedPartyQuickFields(JSON.parse(saved));
  } catch {
    message(
      'Gespeicherte Schnellwerte nicht lesbar. Erneut auswählen und speichern.',
      true,
      'party-quick-status',
    );
  }
  quickControls();
  const lootRoot = document.createElement('section');
  el('party-popover').append(lootRoot);
  lootPanel = new PartyLootPanel(
    lootRoot,
    async (token, action, current) => {
      if (!current()) throw Error('Figur oder Partyfenster gewechselt. Beute erneut öffnen.');
      let saved = false;
      await act(async (owner) => {
        if (owner.token !== token || !current()) throw Error('Figur oder Kampagne gewechselt.');
        await runPartyProgress(token, action, current);
        saved = true;
      }, 'party-loot-detail-status');
      if (!saved)
        throw Error(
          el('party-loot-detail-status').textContent ||
            'Berichtigung nicht bestätigt. Buchungsstatus im Spieltisch prüfen.',
        );
    },
    () => {
      el('party-popover').classList.remove('party-editing-loot');
      el('party-shortcut').focus();
    },
    async () => {
      await checkPendingCommit();
    },
  );
  const rosterRoot = document.createElement('section');
  el('party-popover').append(rosterRoot);
  const closeRoster = () => {
    el('party-popover').classList.remove('party-editing-roster');
    el('party-shortcut').focus();
  };
  const openRoster = async () => {
    const owner = workspace;
    if (!owner || busy || loading) return;
    const request = ++rosterOpenRequest,
      windowRevision = partyWindowRevision;
    await refresh();
    if (
      request !== rosterOpenRequest ||
      windowRevision !== partyWindowRevision ||
      !opened() ||
      workspace?.token !== owner.token
    )
      return;
    if (!live?.scene) {
      message('Zuerst eine laufende Sitzung im Spieltisch starten.', true);
      return;
    }
    const basis = live;
    el('party-popover').classList.add('party-editing-roster');
    el('party-popover').scrollTop = 0;
    rosterPanel!.open(
      basis,
      () =>
        workspace?.token === owner.token &&
        opened() &&
        live?.focusId === basis.focusId &&
        live?.focusRevision === basis.focusRevision &&
        live?.rosterRevision === basis.rosterRevision &&
        live?.scene?.membershipRevision === basis.scene?.membershipRevision,
    );
  };
  rosterPanel = new PartyRosterPanel(
    rosterRoot,
    async (action, current) => {
      await act(async (owner) => {
        if (!current()) throw new Error('Auswahl inzwischen veraltet. Neu lesen.');
        await runPartyLive(owner.token, action, current);
        rosterPanel!.close();
        closeRoster();
      }, 'party-membership-status');
    },
    openRoster,
    closeRoster,
  );
  el('party-roster-open').onclick = () => {
    void openRoster();
  };
  el('party-move-open').onclick = () => {
    const owner = workspace;
    if (!owner || busy || loading) return;
    const windowRevision = partyWindowRevision,
      current = () =>
        workspace?.token === owner.token && partyWindowRevision === windowRevision && opened();
    void refresh()
      .then(async () => {
        if (!current()) return;
        const shown = await openPartyMove(owner.token, live?.focusId ?? undefined, current);
        if (shown && workspace?.token === owner.token && opened())
          el('party-popover').hidePopover();
      })
      .catch((error) => message(error.message, true));
  };
  const popup = bindAnchoredPopup(
    el<HTMLButtonElement>('party-shortcut'),
    el('party-popover'),
    360,
  );
  try {
    const size = JSON.parse(window.localStorage.getItem('party-window-size-v1') ?? 'null');
    if (size && Number.isFinite(size.width) && Number.isFinite(size.height)) {
      el('party-popover').style.width =
        Math.max(240, Math.min(window.innerWidth - 16, size.width)) + 'px';
      el('party-popover').style.height =
        Math.max(160, Math.min(window.innerHeight - 16, size.height)) + 'px';
    }
  } catch {}
  el('party-popover').addEventListener('beforetoggle', (event) => {
    if ((event as ToggleEvent).newState !== 'closed') return;
    const box = el('party-popover').getBoundingClientRect();
    if (box.width >= 240 && box.height >= 160)
      try {
        window.localStorage.setItem(
          'party-window-size-v1',
          JSON.stringify({ width: box.width, height: box.height }),
        );
      } catch {
        message('Fenstergröße konnte nicht gespeichert werden.', true, 'party-quick-status');
      }
  });
  el('party-shortcut').onclick = () => {
    if (popup.toggle()) void refresh();
  };
  el('party-close').onclick = popup.close;
  el('party-live').onclick = () => {
    el('party-popover').hidePopover();
    openLive();
  };
  el('party-refresh').onclick = () => void refresh();
  el('party-create').onclick = () => edit(null);
  el('party-editor-cancel').onclick = () => (el('party-editor').hidden = true);
  el('party-xp-cancel').onclick = closeXp;
  el('party-search').oninput = () => {
    limit = 40;
    renderRoster();
  };
  el('party-short-rest').onclick = () => rest('short');
  el('party-long-rest').onclick = () => rest('long');
  el('party-rest').addEventListener('input', invalidateRestConfirmation);
  el('party-rest').addEventListener('change', invalidateRestConfirmation);
  el('party-rest').addEventListener('toggle', () => {
    if (!el<HTMLDetailsElement>('party-rest').open) invalidateRestConfirmation();
  });
  el('party-popover').addEventListener('beforetoggle', (event) => {
    if ((event as ToggleEvent).newState === 'closed') {
      partyWindowRevision++;
      rosterOpenRequest++;
      invalidateRestConfirmation();
      lootPanel?.close();
      el('party-popover').classList.remove('party-editing-loot');
      rosterPanel?.close();
      el('party-popover').classList.remove('party-editing-roster');
    }
  });
  el('party-rest-cancel').onclick = clearRestConfirmation;
  el<HTMLFormElement>('party-profile-form').onsubmit = async (e) => {
    e.preventDefault();
    const before = editor ? structuredClone(editor) : null;
    let profile: CharacterProfile;
    try {
      profile = { name: value('party-name').trim() };
      for (const [key, , type] of fields) {
        const text = value('party-field-' + key).trim();
        if (!text) continue;
        if (key === 'languages')
          profile.languages = text
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        else if (type === 'number')
          (profile as unknown as Record<string, unknown>)[key] = Number(text);
        else (profile as unknown as Record<string, unknown>)[key] = text;
      }
      checkedCharacterProfile(profile);
    } catch (error) {
      message((error as Error).message, true, 'party-editor-status');
      return;
    }
    const token = workspace?.token,
      windowRevision = partyWindowRevision;
    let confirmedId: string | undefined;
    await act(async (owner) => {
      const ack = await runPartyLive(
        owner.token,
        before
          ? {
              kind: 'profile',
              characterId: before.id,
              expectedRevision: before.profileRevision,
              profile,
            }
          : { kind: 'create-character', profile },
      );
      if (workspace?.token !== owner.token) return;
      el('party-editor').hidden = true;
      if (ack.character) {
        confirmedId = ack.character.id;
        showRosterCharacter(confirmedId);
      }
    }, 'party-editor-status');
    // act owns the read and write locks. Focus only after its final unlock, and
    // never carry an old confirmation into another campaign or a closed window.
    const search = el<HTMLInputElement>('party-search');
    if (
      confirmedId &&
      workspace?.token === token &&
      partyWindowRevision === windowRevision &&
      opened() &&
      !search.disabled &&
      search.value === confirmedId
    )
      search.focus({ preventScroll: true });
  };
  for (const id of ['party-xp-mode', 'party-xp-amount']) el(id).oninput = previewXp;
  el('party-level').onchange = () => {
    if (!value('party-level')) return;
    el<HTMLSelectElement>('party-xp-mode').value = 'set';
    el<HTMLInputElement>('party-xp-amount').value = String(
      levelXp[Number(value('party-level')) - 1],
    );
    previewXp();
  };
  const submitXp = (mode: 'add' | 'subtract' | 'set') => {
    el<HTMLSelectElement>('party-xp-mode').value = mode;
    previewXp();
    if (!xpCharacterId) return;
    const basis = xpBasis();
    if (loading || !basis) {
      message('XP-Stand nicht verfügbar. Party aktualisieren.', true, 'party-xp-status');
      return;
    }
    const before = structuredClone(basis.state);
    let amount: number;
    try {
      amount = xpInput(value('party-xp-amount'));
    } catch (error) {
      message((error as Error).message, true, 'party-xp-status');
      return;
    }
    const reason = value('party-xp-reason');
    void act(async (owner) => {
      await runPartyProgress(owner.token, {
        kind: 'xp',
        characterId: before.characterId,
        expectedRevision: before.revision,
        mode,
        amount,
        reason,
      });
      if (workspace?.token === owner.token) closeXp();
    }, 'party-xp-status');
  };
  el<HTMLFormElement>('party-xp-form').onsubmit = (e) => {
    e.preventDefault();
    submitXp(value('party-xp-mode') as 'add' | 'subtract' | 'set');
  };
  for (const mode of ['add', 'subtract'] as const) {
    const action = el('party-xp-' + mode);
    action.onclick = () => submitXp(mode);
    action.onfocus = action.onmouseenter = () => {
      el<HTMLSelectElement>('party-xp-mode').value = mode;
      previewXp();
    };
  }
  el<HTMLFormElement>('party-xp-form').querySelector<HTMLButtonElement>(
    'button[type=submit]',
  )!.onfocus = () => {
    el<HTMLSelectElement>('party-xp-mode').value = 'set';
    previewXp();
  };
  const setXp =
    el<HTMLFormElement>('party-xp-form').querySelector<HTMLButtonElement>('button[type=submit]')!;
  setXp.onmouseenter = setXp.onfocus;
  setXp.onclick = () => {
    el<HTMLSelectElement>('party-xp-mode').value = 'set';
    previewXp();
  };
  el('party-archive').addEventListener('toggle', () => {
    if ((el('party-archive') as HTMLDetailsElement).open) void loadArchive();
  });
  el('party-archive-more').onclick = () => void loadArchive(true);
  el('party-archive-search').oninput = () => {
    archiveRequest++;
    if (archiveTimer) clearTimeout(archiveTimer);
    archiveTimer = setTimeout(() => {
      archiveTimer = null;
      void loadArchive();
    }, 180);
  };
  el('party-archive-cancel').onclick = () => (el('party-archive-confirm').hidden = true);
  el<HTMLFormElement>('party-archive-form').onsubmit = (e) => {
    e.preventDefault();
    const c = archiveOwner;
    if (!c) return;
    if (value('party-archive-name') !== c.profile.name) {
      message('Genauen Figurennamen eingeben: ' + c.profile.name, true, 'party-archive-error');
      return;
    }
    const name = value('party-archive-name'),
      reason = value('party-archive-reason');
    void act(async (w) => {
      await archiveAction(c, true, w, name, reason);
      if (workspace?.token === w.token) {
        el('party-archive-confirm').hidden = true;
        if (editor?.id === c.id) el('party-editor').hidden = true;
        if (xpCharacterId === c.id) el('party-xp-editor').hidden = true;
      }
    }, 'party-archive-error');
  };
  const update = () => {
    if (opened() && !busy) void refresh();
  };
  onProgressChanged(update);
  document.addEventListener('campaign-party-changed', update);
  document.addEventListener('keydown', (e) => {
    if (
      !document.body.classList.contains('atlas-workspace') &&
      workspaceShortcutAvailable(e) &&
      e.altKey &&
      e.key.toLowerCase() === 'p' &&
      !e.ctrlKey &&
      !e.metaKey &&
      workspace
    ) {
      e.preventDefault();
      el('party-shortcut').click();
    }
  });
}
