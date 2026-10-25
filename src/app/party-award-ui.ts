import type { WorkspaceGeometry, Result } from './contracts';
import type { LiveView } from './live-contracts';
import { xpLevel, type ProgressView, type ProgressAction } from './progression';
import { partyAwardShares } from './party-xp-model';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => el<HTMLInputElement>(id).value;
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const number = (n: number) => n.toLocaleString('de-DE');
type Choice = { xp: boolean; load: boolean };
let owner: WorkspaceGeometry | null = null,
  live: LiveView | null = null,
  progress: ProgressView | null = null,
  choices = new Map<string, Choice>(),
  generation = 0,
  loading = false,
  limit = 40;
let current: () => WorkspaceGeometry | null,
  save: (token: string, action: ProgressAction, done: () => void) => void;
export function resetPartyAwards() {
  generation++;
  owner = null;
  live = null;
  progress = null;
  choices.clear();
  el('party-award-panel').hidden = true;
  el<HTMLInputElement>('party-award-xp').value = '0';
  el<HTMLInputElement>('party-award-load').value = '0';
  el<HTMLInputElement>('party-award-reason').value = 'Spielabend abgeschlossen';
}
async function load(fresh = false) {
  const w = current(),
    request = ++generation;
  if (!w) return;
  loading = true;
  el('party-award-status').textContent = 'Figurenstände werden geladen…';
  el<HTMLButtonElement>('party-award-submit').disabled = true;
  try {
    const [l, p] = await Promise.all([
      window.campaign.live(w.token),
      window.campaign.progress(w.token),
    ]);
    if (w.token !== current()?.token || request !== generation) return;
    owner = w;
    live = unwrap(l);
    progress = unwrap(p);
    const old = fresh ? new Map<string, Choice>() : choices;
    choices = new Map(
      live.roster.map((c) => [
        c.id,
        old.get(c.id) ?? {
          xp: c.active && c.sceneId === live!.focusId,
          load: c.active && c.sceneId === live!.focusId,
        },
      ]),
    );
    for (const c of live.roster) if (!c.active) choices.get(c.id)!.load = false;
    loading = false;
    el('party-award-basis').textContent =
      'Bestätigte Figurenstände · Fokus: ' +
      (live.scene?.title || 'Keine laufende Gruppe') +
      ' · ' +
      live.roster.length +
      ' Rosterfiguren';
    render();
    preview();
    el('party-award-status').textContent = '';
  } catch (error) {
    if (w.token === current()?.token && request === generation) {
      live = null;
      progress = null;
      el('party-award-status').textContent = (error as Error).message;
    }
  } finally {
    if (w.token === current()?.token && request === generation) {
      loading = false;
      el<HTMLButtonElement>('party-award-submit').disabled = !progress;
    }
  }
}
function render() {
  const root = el('party-award-members');
  root.replaceChildren();
  const query = value('party-award-search').trim().toLocaleLowerCase('de-DE'),
    rows =
      live?.roster.filter((c) =>
        JSON.stringify([c.id, c.profile]).toLocaleLowerCase('de-DE').includes(query),
      ) ?? [];
  for (const c of rows.slice(0, limit)) {
    const row = document.createElement('div'),
      name = document.createElement('span'),
      choice = choices.get(c.id)!,
      p = progress?.characters.find((p) => p.characterId === c.id);
    row.className = 'party-award-row';
    row.dataset.characterId = c.id;
    name.textContent =
      c.profile.name +
      (c.active ? ' · aktiv' : ' · Reserve') +
      ' · ' +
      (p?.xp === null || !p
        ? 'XP offen'
        : 'Level ' + xpLevel(p.xp).level + ' · ' + number(p.xp) + ' XP');
    name.title = c.id;
    for (const [key, text] of [
      ['xp', 'XP'],
      ['load', 'Belastung'],
    ] as const) {
      const label = document.createElement('label'),
        input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = choice[key];
      input.dataset.role = key;
      input.dataset.readonly = String(key === 'load' && !c.active);
      input.disabled = loading || (key === 'load' && !c.active);
      input.onchange = () => {
        choice[key] = input.checked;
        preview();
      };
      label.className = 'check-label';
      label.append(input, document.createTextNode(text));
      row.append(label);
    }
    row.append(name);
    root.append(row);
  }
  if (rows.length > limit) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Weitere Figuren';
    b.onclick = () => {
      limit += 40;
      render();
    };
    root.append(b);
  }
  if (!rows.length) root.textContent = 'Keine passenden Figuren.';
}
function selected() {
  return (
    progress?.characters.filter((c) => {
      const choice = choices.get(c.characterId);
      return choice?.xp || choice?.load;
    }) ?? []
  );
}
function amounts() {
  const poolXp = Number(value('party-award-xp')),
    loadXp = Number(value('party-award-load'));
  if (!value('party-award-xp').trim() || !value('party-award-load').trim())
    throw new Error('XP und Tagesbelastung ausfüllen, auch 0 ist erlaubt.');
  const picked = selected();
  return {
    poolXp,
    loadXp,
    shares: partyAwardShares(
      poolXp,
      loadXp,
      picked.filter((p) => choices.get(p.characterId)!.xp).length,
      picked.filter((p) => choices.get(p.characterId)!.load).length,
    ),
  };
}
function preview() {
  const root = el('party-award-preview');
  root.replaceChildren();
  if (!progress) return;
  try {
    const { shares } = amounts(),
      picked = selected(),
      summary = document.createElement('p');
    summary.textContent =
      number(shares.xp.share) +
      ' XP je Empfänger · ' +
      number(shares.xp.total) +
      ' XP insgesamt (aufgerundet) · ' +
      number(shares.load.share) +
      ' Tagesbelastung je beteiligter Figur / ' +
      number(shares.load.total) +
      ' insgesamt';
    root.append(summary);
    for (const p of picked.slice(0, 40)) {
      const choice = choices.get(p.characterId)!,
        after = (p.xp ?? 0) + (choice.xp ? shares.xp.share : 0),
        line = document.createElement('p');
      line.textContent =
        p.name +
        ': ' +
        (choice.xp ? number(after) + ' XP · Level ' + xpLevel(after).level : 'XP unverändert') +
        ' · Belastung +' +
        number(choice.load ? shares.load.share : 0);
      root.append(line);
    }
    if (picked.length > 40)
      root.append(
        document.createTextNode(
          'Vorschau zeigt erste 40 Figuren; die Buchung umfasst alle ausgewählten.',
        ),
      );
  } catch (error) {
    root.textContent = (error as Error).message;
  }
}
export function initPartyAwards(getCurrent: typeof current, commit: typeof save) {
  current = getCurrent;
  save = commit;
  el('party-award-open').onclick = () => {
    el('party-award-panel').hidden = false;
    limit = 40;
    el<HTMLInputElement>('party-award-search').value = '';
    void load(true);
  };
  el('party-award-close').onclick = () => (el('party-award-panel').hidden = true);
  el('party-award-reload').onclick = () => void load();
  for (const [id, mode] of [
    ['party-award-focus', 'focus'],
    ['party-award-active', 'active'],
    ['party-award-none', 'none'],
  ] as const)
    el(id).onclick = () => {
      for (const c of live?.roster ?? []) {
        const picked =
          mode !== 'none' && c.active && (mode === 'active' || c.sceneId === live?.focusId);
        choices.set(c.id, { xp: picked, load: picked });
      }
      render();
      preview();
    };
  el('party-award-search').oninput = () => {
    limit = 40;
    render();
  };
  for (const id of ['party-award-xp', 'party-award-load']) el(id).oninput = preview;
  el<HTMLFormElement>('party-award-form').onsubmit = (e) => {
    e.preventDefault();
    if (loading || !owner || !live || owner.token !== current()?.token || !progress) return;
    try {
      const { poolXp, loadXp } = amounts(),
        reason = value('party-award-reason').trim(),
        token = owner.token,
        version = generation;
      if (!reason) throw new Error('Grund oder Titel des Spielabends eintragen.');
      const action: ProgressAction = {
        kind: 'party-award',
        expectedRosterRevision: live.rosterRevision,
        poolXp,
        loadXp,
        reason,
        participants: selected().map((p) => ({
          characterId: p.characterId,
          revision: p.revision,
          membershipRevision: p.membershipRevision,
          receiveXp: choices.get(p.characterId)!.xp,
          receiveLoad: choices.get(p.characterId)!.load,
        })),
      };
      save(token, action, () => {
        if (version !== generation || owner?.token !== token || current()?.token !== token) return;
        el('party-award-panel').hidden = true;
        el<HTMLInputElement>('party-award-xp').value = '0';
        el<HTMLInputElement>('party-award-load').value = '0';
      });
    } catch (error) {
      el('party-award-status').textContent = (error as Error).message;
    }
  };
}
