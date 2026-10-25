import type { WorkspaceGeometry } from './contracts';
import type { ChronicleCategory, ChroniclePage, ChronicleCursor } from './chronicle-contracts';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let workspace: WorkspaceGeometry | null = null,
  data: ChroniclePage | null = null,
  generation = 0,
  tell: (message: string, error?: boolean) => void,
  openFollowUp: ((id: string, token: string) => Promise<void>) | null = null;
let searchTimer: ReturnType<typeof setTimeout> | null = null,
  loading = false,
  pageIndex = 0,
  cursors: (ChronicleCursor | null)[] = [null],
  exporting: { id: string; token: string } | null = null;
const labels: Record<ChronicleCategory, string> = {
  combat: 'Kampf',
  narrative: 'Quest',
  reward: 'Beute',
  travel: 'Reise',
  party: 'Party',
  world: 'Welt',
};
function draw() {
  const list = el('chronicle-list');
  list.replaceChildren();
  if (!data) return;
  const viewed = data,
    token = workspace?.token,
    version = generation;
  const entries = data.entries;
  el('chronicle-count').textContent =
    'Seite ' +
    (pageIndex + 1) +
    ' · ' +
    entries.length +
    ' ' +
    (entries.length === 1 ? 'Eintrag' : 'Einträge') +
    (data.next ? ' · weitere ältere Ereignisse verfügbar' : ' · Ende dieses Lesestands');
  if (!entries.length) {
    const p = document.createElement('p');
    p.className = 'chronicle-empty';
    p.textContent = 'Keine passenden bestätigten Ereignisse.';
    list.append(p);
    return;
  }
  let day = '';
  for (const entry of entries) {
    const when = new Date(entry.recordedAt),
      nextDay = Number.isNaN(when.valueOf())
        ? 'Ohne Datum'
        : when.toLocaleDateString('de-DE', { dateStyle: 'full' });
    if (nextDay !== day) {
      day = nextDay;
      const heading = document.createElement('h3');
      heading.textContent = day;
      list.append(heading);
    }
    const article = document.createElement('article');
    article.className = 'chronicle-entry';
    article.dataset.category = entry.category;
    const header = document.createElement('div'),
      badge = document.createElement('span'),
      title = document.createElement('h4'),
      time = document.createElement('time');
    header.className = 'chronicle-entry-heading';
    badge.className = 'chronicle-badge';
    badge.textContent = labels[entry.category];
    title.textContent = entry.title;
    time.dateTime = entry.recordedAt;
    time.textContent = Number.isNaN(when.valueOf())
      ? ''
      : when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    header.append(badge, title, time);
    article.append(header);
    if (entry.summary) {
      const p = document.createElement('p');
      p.textContent = entry.summary;
      article.append(p);
    }
    const context = [
      entry.scene && 'Gruppe: ' + entry.scene,
      entry.location && 'Ort: ' + entry.location,
      entry.people.length && 'Beteiligte: ' + [...new Set(entry.people)].join(', '),
    ].filter(Boolean);
    if (context.length) {
      const p = document.createElement('p');
      p.className = 'caption';
      p.textContent = context.join(' · ');
      article.append(p);
    }
    if (entry.followUp && openFollowUp) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = (entry.followUp.kind === 'quest' ? 'Quest' : 'Gerücht') + ' öffnen';
      button.onclick = () => {
        if (!token || workspace?.token !== token || generation !== version || data !== viewed)
          return;
        void openFollowUp!(entry.followUp!.id, token).catch((e) => {
          if (workspace?.token === token && generation === version) tell(problem(e), true);
        });
      };
      article.append(button);
    }
    if (entry.handoff) {
      const box = document.createElement('section'),
        heading = document.createElement('strong'),
        p = document.createElement('p');
      box.className = 'chronicle-handoff';
      heading.textContent = 'Nächster Spielabend';
      p.textContent = entry.handoff;
      box.append(heading, p);
      article.append(box);
    }
    list.append(article);
  }
}
function lock() {
  if (!document.getElementById('chronicle-next')) return;
  for (const suffix of ['', '-bottom']) {
    el<HTMLButtonElement>('chronicle-previous' + suffix).disabled =
      loading || !data || pageIndex === 0 || !!exporting;
    el<HTMLButtonElement>('chronicle-next' + suffix).disabled =
      loading || !data?.next || !!exporting;
  }
  el('chronicle-navigation-bottom').hidden = !data || (!data.next && pageIndex === 0);
  el('chronicle-page-bottom').textContent = 'Seite ' + (pageIndex + 1);
  const filtered =
    el<HTMLSelectElement>('chronicle-category').value !== 'all' ||
    !!el<HTMLInputElement>('chronicle-search').value.trim();
  el('chronicle-export').textContent = filtered
    ? 'Treffer als Markdown…'
    : 'Gesamte Chronik als Markdown…';
  el<HTMLButtonElement>('chronicle-export').disabled = loading || !data || !!exporting;
  el<HTMLButtonElement>('chronicle-export-cancel').hidden = !exporting;
  for (const id of ['chronicle-refresh', 'chronicle-category', 'chronicle-search'])
    el<HTMLInputElement>(id).disabled = !!exporting;
}
function navigate(direction: number, button: HTMLButtonElement) {
  if (button.disabled || loading || exporting || !data) return;
  if (direction < 0 && pageIndex > 0)
    void loadPage(cursors[pageIndex - 1] ?? null, pageIndex - 1, button);
  if (direction > 0 && data.next) void loadPage(data.next, pageIndex + 1, button);
}
function releaseRead() {
  const token = workspace?.token,
    id = data?.snapshotId;
  if (token && id) void window.campaign.closeChroniclePage(token, id);
}
export function suspendChronicle() {
  generation++;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = null;
  releaseRead();
  if (exporting) void window.campaign.cancelChronicleExport(exporting.id);
  data = null;
  loading = false;
  cursors = [null];
  pageIndex = 0;
  el('chronicle-list').replaceChildren();
  lock();
}
export function initChronicle(status: typeof tell, open?: typeof openFollowUp) {
  tell = status;
  openFollowUp = open ?? null;
  el('chronicle-refresh').onclick = () => void openChronicle();
  el('chronicle-search').oninput = () => {
    if (searchTimer) clearTimeout(searchTimer);
    generation++;
    releaseRead();
    clearChronicle();
    el('chronicle-count').textContent = 'Chronik wird geladen…';
    searchTimer = setTimeout(() => void openChronicle(), 150);
  };
  el('chronicle-category').onchange = () => void openChronicle();
  el('chronicle-export').onclick = () => void exportChronicle();
  el('chronicle-count').tabIndex = -1;
  for (const suffix of ['', '-bottom']) {
    const nav = document.createElement('div');
    nav.className = 'toolbar chronicle-navigation';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', suffix ? 'Chronikseiten am Listenende' : 'Chronikseiten');
    if (suffix) {
      nav.id = 'chronicle-navigation-bottom';
      const position = document.createElement('span');
      position.id = 'chronicle-page-bottom';
      nav.append(position);
    }
    for (const [id, title, direction] of [
      ['chronicle-previous', 'Vorige Seite', -1],
      ['chronicle-next', 'Ältere Ereignisse', 1],
    ] as const) {
      const button = document.createElement('button');
      button.id = id + suffix;
      button.textContent = title;
      button.type = 'button';
      button.onclick = () => navigate(direction, button);
      nav.append(button);
    }
    if (suffix) el('chronicle-list').after(nav);
    else el('chronicle-list').before(nav);
  }
  const cancel = document.createElement('button');
  cancel.id = 'chronicle-export-cancel';
  cancel.type = 'button';
  cancel.textContent = 'Ausgabe abbrechen';
  cancel.hidden = true;
  el('chronicle-export').after(cancel);
  cancel.onclick = () => {
    if (exporting) {
      cancel.disabled = true;
      void window.campaign.cancelChronicleExport(exporting.id);
    }
  };
  const progress = document.createElement('p');
  progress.id = 'chronicle-export-status';
  progress.setAttribute('role', 'status');
  el('chronicle-count').after(progress);
  window.campaign.onChronicleExport((p) => {
    if (exporting?.id === p.requestId && exporting.token === workspace?.token)
      progress.textContent = p.written + ' Ereignisse ausgegeben…';
  });
  lock();
}
function problem(error: unknown) {
  return (error as Error).message.replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    '',
  );
}
function clearChronicle() {
  data = null;
  el('chronicle-list').replaceChildren();
  el('chronicle-count').textContent = '';
  el('chronicle-export-status').textContent = '';
  lock();
}
export function activateChronicle(next: WorkspaceGeometry | null) {
  suspendChronicle();
  workspace = next;
  generation++;
  clearChronicle();
  el('chronicle-export-status').textContent = '';
  el('chronicle').setAttribute('aria-busy', 'false');
}
export async function openChronicle() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = null;
  releaseRead();
  cursors = [null];
  pageIndex = 0;
  clearChronicle();
  await loadPage(null, 0);
}
async function loadPage(
  cursor: ChronicleCursor | null,
  index: number,
  navigation?: HTMLButtonElement,
) {
  const current = workspace,
    version = ++generation;
  if (!current) return;
  const category = el<HTMLSelectElement>('chronicle-category').value as ChronicleCategory | 'all',
    search = el<HTMLInputElement>('chronicle-search').value;
  loading = true;
  lock();
  el('chronicle').setAttribute('aria-busy', 'true');
  el('chronicle-count').textContent = 'Chronikseite wird geladen…';
  try {
    const result = await window.campaign.chroniclePage(current.token, category, search, cursor);
    if (version !== generation || workspace?.token !== current.token) {
      if (result.ok)
        void window.campaign.closeChroniclePage(current.token, result.value.snapshotId);
      return;
    }
    if (!result.ok) throw new Error(result.error);
    data = result.value;
    pageIndex = index;
    cursors[index] = cursor ?? { snapshotId: data.snapshotId, after: null };
    draw();
    if (
      navigation &&
      (document.activeElement === navigation || document.activeElement === document.body)
    ) {
      const position = el('chronicle-count');
      position.scrollIntoView({ block: 'start' });
      position.focus({ preventScroll: true });
    }
  } catch (error) {
    if (version !== generation || workspace?.token !== current.token) return;
    releaseRead();
    clearChronicle();
    const message =
        'Chronikseite konnte nicht geladen werden. ' +
        problem(error) +
        ' Mit Aktualisieren erneut versuchen.',
      alert = document.createElement('p');
    alert.setAttribute('role', 'alert');
    alert.textContent = message;
    el('chronicle-list').append(alert);
    el('chronicle-count').textContent = 'Chronik derzeit nicht verfügbar.';
    tell(message, true);
  } finally {
    if (version === generation) {
      loading = false;
      el('chronicle').setAttribute('aria-busy', 'false');
      lock();
    }
  }
}
async function exportChronicle() {
  if (!workspace || !data || exporting) return;
  const owner = { id: crypto.randomUUID(), token: workspace.token },
    category = el<HTMLSelectElement>('chronicle-category').value as ChronicleCategory | 'all',
    search = el<HTMLInputElement>('chronicle-search').value;
  exporting = owner;
  el<HTMLButtonElement>('chronicle-export-cancel').disabled = false;
  el('chronicle-export-status').textContent = 'Vollständige Chronik-Ausgabe wird vorbereitet…';
  lock();
  try {
    const result = await window.campaign.exportChronicle(owner.token, category, search, owner.id);
    if (exporting !== owner || workspace?.token !== owner.token) return;
    if (!result.ok) throw new Error(result.error);
    const message = result.value.cancelled
      ? 'Chronik-Ausgabe abgebrochen.'
      : (result.value.written ?? 0) + ' Ereignisse vollständig als Markdown gespeichert.';
    el('chronicle-export-status').textContent = message;
    tell(message);
  } catch (error) {
    if (exporting === owner && workspace?.token === owner.token) {
      el('chronicle-export-status').textContent = problem(error);
      tell(problem(error), true);
    }
  } finally {
    if (exporting === owner) {
      exporting = null;
      lock();
    }
  }
}
