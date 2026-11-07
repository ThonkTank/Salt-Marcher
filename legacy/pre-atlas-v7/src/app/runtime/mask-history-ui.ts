import {
  checkedMaskHistoryPage,
  type MaskKind,
  type MaskHistoryQuery,
  type MaskHistoryItem,
} from './mask-history-contracts';
interface Owner {
  token: string;
  campaignId: string;
  sceneId: string;
  kind: MaskKind;
  current: () => boolean;
  select: (item: MaskHistoryItem) => void | Promise<void>;
}
let owner: Owner | null = null,
  serial = 0,
  timer: ReturnType<typeof setTimeout> | undefined,
  composing = false,
  cursors: (string | null)[] = [null],
  index = 0,
  next: string | null = null,
  loading = false,
  failed = false;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
export function closeMaskHistory() {
  if (timer) clearTimeout(timer);
  timer = undefined;
  serial++;
  owner = null;
  loading = false;
  const dialog = document.getElementById('mask-history-dialog') as HTMLDialogElement | null;
  if (dialog?.open) dialog.close();
}
function init() {
  if (document.getElementById('mask-history-dialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'mask-history-dialog';
  dialog.innerHTML =
    '<div class="toolbar"><h3 id="mask-history-title"></h3><button id="mask-history-close" type="button">Schließen</button></div><label>Suche in Titel, Notizen, Ziel und Ergebnis<input id="mask-history-search" type="search" maxlength="1000" placeholder="Zum Beispiel Kupfersiegel"></label><label>Status<select id="mask-history-state"><option value="all">Alle</option><option value="active">Laufend / vorbereitet</option><option value="finished">Abgeschlossen</option><option value="retired">Archiviert</option></select></label><p id="mask-history-summary" role="status"></p><button id="mask-history-retry" type="button" hidden>Erneut laden</button><div id="mask-history-results" class="selection-list"></div><div class="toolbar"><button id="mask-history-prev" type="button">Vorherige Seite</button><button id="mask-history-next" type="button">Nächste Seite</button></div>';
  document.body.append(dialog);
  el('mask-history-close').onclick = closeMaskHistory;
  dialog.addEventListener('close', () => {
    if (!dialog.open) closeMaskHistory();
  });
  const invalidate = () => {
    serial++;
    next = null;
    failed = false;
    el('mask-history-results').replaceChildren();
    el('mask-history-summary').setAttribute('role', 'status');
    el('mask-history-summary').textContent = 'Suche wird vorbereitet …';
    controls();
  };
  el('mask-history-search').oninput = () => {
    if (timer) clearTimeout(timer);
    cursors = [null];
    index = 0;
    invalidate();
    if (!composing)
      timer = setTimeout(() => {
        timer = undefined;
        void load(null, 0);
      }, 200);
  };
  el('mask-history-search').addEventListener('compositionstart', () => {
    composing = true;
    if (timer) clearTimeout(timer);
    timer = undefined;
    invalidate();
  });
  el('mask-history-search').addEventListener('compositionend', () => {
    composing = false;
    el('mask-history-search').oninput?.(new Event('input'));
  });
  el('mask-history-state').onchange = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    cursors = [null];
    index = 0;
    void load(null, 0);
  };
  el('mask-history-prev').onclick = () => {
    if (!loading && index > 0) void load(cursors[index - 1] ?? null, index - 1);
  };
  el('mask-history-next').onclick = () => {
    if (!loading && !failed && next) void load(next, index + 1);
  };
  el('mask-history-retry').onclick = () => {
    if (!loading) void load(cursors[index] ?? null, index);
  };
}
function controls() {
  el<HTMLButtonElement>('mask-history-prev').disabled = loading || index === 0;
  el<HTMLButtonElement>('mask-history-next').disabled = loading || failed || !next;
  el('mask-history-retry').hidden = !failed;
  el<HTMLButtonElement>('mask-history-retry').disabled = loading;
  el('mask-history-dialog').setAttribute('aria-busy', String(loading));
}
async function load(after: string | null, pageIndex: number) {
  if (!owner) return;
  if (!owner.current()) {
    closeMaskHistory();
    return;
  }
  const selectedOwner = owner,
    request = ++serial;
  index = pageIndex;
  cursors[index] = after;
  loading = true;
  failed = false;
  next = null;
  el('mask-history-results').replaceChildren();
  const summary = el('mask-history-summary');
  summary.setAttribute('role', 'status');
  summary.textContent = 'Gespeicherte Begegnungen werden geladen …';
  controls();
  const query: MaskHistoryQuery = {
    kind: owner.kind,
    state: el<HTMLSelectElement>('mask-history-state').value as MaskHistoryQuery['state'],
    search: el<HTMLInputElement>('mask-history-search').value,
    after,
  };
  const current = () => {
    if (owner !== selectedOwner || request !== serial) return false;
    if (!selectedOwner.current()) {
      closeMaskHistory();
      return false;
    }
    return true;
  };
  try {
    const r = await window.campaign.maskHistory(selectedOwner.token, selectedOwner.sceneId, query);
    if (!current()) return;
    if (!r.ok) throw new Error(r.error);
    const p = checkedMaskHistoryPage(
      r.value,
      selectedOwner.campaignId,
      selectedOwner.sceneId,
      query,
    );
    next = p.next;
    const root = el('mask-history-results');
    for (const item of p.items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent =
        item.title +
        ' · ' +
        {
          preparing: 'vorbereitet',
          running: 'laufend',
          finished: 'abgeschlossen',
          retired: 'archiviert',
        }[item.state] +
        ' · Runde ' +
        item.round +
        (item.summary ? ' · ' + item.summary : '');
      button.onclick = () => {
        if (!current() || loading || failed) return;
        const target = selectedOwner;
        closeMaskHistory();
        if (target.current()) void target.select(item);
      };
      root.append(button);
    }
    summary.textContent = p.items.length
      ? `${index * 20 + 1}–${index * 20 + p.items.length} von ${p.total}`
      : 'Keine passenden gespeicherten Begegnungen.';
  } catch (e) {
    if (!current()) return;
    failed = true;
    summary.setAttribute('role', 'alert');
    summary.textContent = (e as Error).message;
  } finally {
    if (current()) {
      loading = false;
      controls();
    }
  }
}
export function openMaskHistory(nextOwner: Owner) {
  init();
  closeMaskHistory();
  owner = nextOwner;
  cursors = [null];
  index = 0;
  composing = false;
  el<HTMLInputElement>('mask-history-search').value = '';
  el<HTMLSelectElement>('mask-history-state').value = 'all';
  el('mask-history-title').textContent =
    nextOwner.kind === 'combat' ? 'Alle gespeicherten Kämpfe' : 'Alle gespeicherten Verfolgungen';
  el<HTMLDialogElement>('mask-history-dialog').showModal();
  el('mask-history-search').focus();
  void load(null, 0);
}
