import type { WorkspaceGeometry } from './contracts';
import type { AudioAsset, AudioPage, AudioQuery, MusicAction, MusicView } from './music-contracts';
import { onMusicChanged, refreshMusic, runLiveMusic } from './music-ui';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
let workspace: WorkspaceGeometry | null = null,
  view: MusicView | null = null,
  busy = false,
  library: AudioPage = { items: [], next: null, problems: [] },
  favorites: AudioPage = { items: [], next: null, problems: [] },
  libraryRequest = 0,
  favoriteRequest = 0,
  favoriteBasis = '',
  queueLimit = 40,
  timer: ReturnType<typeof setTimeout> | null = null;
const selectedSongs = new Set<string>();
let tell: (s: string, error?: boolean) => void;
function button(label: string, build: (v: MusicView) => MusicAction) {
  const b = node('button', label),
    token = workspace?.token;
  b.type = 'button';
  b.disabled = busy || !view;
  b.onclick = () => {
    if (workspace?.token !== token || !b.isConnected) return;
    void mutate(build);
  };
  return b;
}
async function mutate(build: (v: MusicView) => MusicAction) {
  const w = workspace;
  if (!w || !view || busy) return false;
  busy = true;
  render();
  try {
    return await runLiveMusic(w.token, build);
  } catch (e) {
    if (workspace?.token === w.token) tell((e as Error).message, true);
    return false;
  } finally {
    if (workspace?.token === w.token) {
      busy = false;
      render();
    }
  }
}
async function loadLibrary(more = false) {
  const w = workspace;
  if (!w) return;
  const n = ++libraryRequest,
    q: AudioQuery = {
      search: el<HTMLInputElement>('soundboard-search').value,
      kind: el<HTMLSelectElement>('soundboard-kind').value as AudioQuery['kind'],
      includeTrashed: false,
      after: more ? library.next : null,
    };
  if (!more) clearLibrary();
  el('soundboard-library-status').textContent = 'Audiodateien werden gelesen…';
  try {
    const r = await window.campaign.audioAssets(q);
    if (workspace?.token !== w.token || n !== libraryRequest) return;
    if (!r.ok) throw new Error(r.error);
    library = more
      ? {
          items: [...library.items, ...r.value.items],
          next: r.value.next,
          problems: r.value.problems,
        }
      : r.value;
    drawLibrary();
  } catch (e) {
    if (n === libraryRequest) el('soundboard-library-status').textContent = (e as Error).message;
  }
}
async function loadFavorites(more = false) {
  const w = workspace;
  if (!w) return;
  const n = ++favoriteRequest;
  try {
    const r = await window.campaign.musicFavorites(w.token, more ? favorites.next : null);
    if (workspace?.token !== w.token || n !== favoriteRequest) return;
    if (!r.ok) throw new Error(r.error);
    favorites = more
      ? {
          items: [...favorites.items, ...r.value.items],
          next: r.value.next,
          problems: r.value.problems,
        }
      : r.value;
    drawFavorites();
  } catch (e) {
    if (n === favoriteRequest) el('soundboard-favorite-status').textContent = (e as Error).message;
  }
}
function card(a: AudioAsset, withSelection = false) {
  const root = node('article'),
    token = workspace?.token;
  root.className = 'soundboard-card';
  root.dataset.assetId = a.id;
  root.append(
    node('h4', a.name),
    node(
      'p',
      (a.kind === 'song' ? 'Musik' : 'Umgebung') +
        (a.vibes.length ? ' · ' + a.vibes.join(', ') : ''),
    ),
  );
  const unavailable = a.trashed || !a.available || !!a.problem;
  if (unavailable) root.append(node('p', a.problem || 'Audiodatei nicht verfügbar.'));
  const actions = node('div');
  actions.className = 'toolbar';
  if (a.kind === 'song') {
    const play = button('▶ Titel spielen', (v) => ({
      kind: 'select',
      expectedRevision: v.state.revision,
      assetId: a.id,
    }));
    play.dataset.soundboardAction = 'play';
    play.disabled = play.disabled || unavailable;
    const queue = button('+ Warteschlange', (v) => ({
      kind: 'queue-add',
      expectedRevision: v.state.revision,
      assetIds: [a.id],
    }));
    queue.disabled = queue.disabled || unavailable;
    actions.append(play, queue);
    if (withSelection) {
      const label = node('label', ' Für gemeinsame Warteschlange auswählen'),
        box = node('input');
      box.type = 'checkbox';
      box.checked = selectedSongs.has(a.id);
      box.disabled = unavailable || busy;
      box.setAttribute('aria-label', a.name + ' auswählen');
      box.onchange = () => {
        if (workspace?.token !== token || !root.contains(box)) return;
        if (box.checked) selectedSongs.add(a.id);
        else selectedSongs.delete(a.id);
        selection();
      };
      label.className = 'check-label';
      label.prepend(box);
      root.append(label);
    }
  } else {
    const forced = view?.state.forcedAmbience.includes(a.id),
      muted = view?.state.mutedAmbience.includes(a.id),
      automatic = view?.layers.some((l) => l.assetId === a.id && !l.manual);
    const use = button(forced ? 'Umgebung entfernen' : 'Umgebung hinzufügen', (v) => ({
      kind: 'ambience',
      expectedRevision: v.state.revision,
      assetId: a.id,
      operation: v.state.forcedAmbience.includes(a.id) ? 'remove' : 'add',
    }));
    use.dataset.soundboardAction = 'ambience';
    use.disabled = use.disabled || unavailable;
    actions.append(use);
    if (automatic || muted)
      actions.append(
        button(muted ? 'Unterdrückung aufheben' : 'Automatik unterdrücken', (v) => ({
          kind: 'ambience',
          expectedRevision: v.state.revision,
          assetId: a.id,
          operation: v.state.mutedAmbience.includes(a.id) ? 'unmute' : 'mute',
        })),
      );
  }
  const favorite = button(
    view?.state.favoriteAssets?.includes(a.id) ? '★ Favorit lösen' : '☆ Favorit merken',
    (v) => ({
      kind: 'favorite',
      expectedRevision: v.state.revision,
      assetId: a.id,
      favorite: !v.state.favoriteAssets?.includes(a.id),
    }),
  );
  favorite.dataset.soundboardAction = 'favorite';
  favorite.setAttribute('aria-pressed', String(!!view?.state.favoriteAssets?.includes(a.id)));
  actions.append(favorite);
  root.append(actions);
  return root;
}
function drawFavorites() {
  const root = el('soundboard-favorites');
  root.replaceChildren();
  for (const a of favorites.items) root.append(card(a));
  if (!favorites.items.length)
    root.append(node('p', 'Merke Musik und Umgebungsgeräusche aus der Bibliothek als Favoriten.'));
  el('soundboard-favorite-status').textContent =
    (view?.state.favoriteAssets?.length ?? 0) +
    ' Favoriten für diese Kampagne' +
    (favorites.problems.length ? ' · ' + favorites.problems.join(' · ') : '');
  el('soundboard-favorites-more').hidden = !favorites.next;
}
function clearLibrary() {
  library = { items: [], next: null, problems: [] };
  drawLibrary();
}
function drawLibrary() {
  const root = el('soundboard-library');
  root.replaceChildren();
  for (const a of library.items) root.append(card(a, true));
  el('soundboard-library-status').textContent =
    library.items.length +
    ' Audiodateien angezeigt' +
    (library.problems.length ? ' · ' + library.problems.join(' · ') : '');
  el('soundboard-library-more').hidden = !library.next;
  selection();
}
function selection() {
  const visible = new Set(library.items.map((a) => a.id)),
    hidden = [...selectedSongs].filter((id) => !visible.has(id)).length;
  el('soundboard-selection').textContent =
    selectedSongs.size +
    ' Titel ausgewählt' +
    (hidden ? ' · ' + hidden + ' außerhalb der Suche' : '');
  el<HTMLButtonElement>('soundboard-queue-selected').disabled =
    busy || !view || !selectedSongs.size;
}
function render() {
  el('soundboard-now').textContent = el('music-mini-title')?.textContent || 'Musik wird gelesen…';
  el('soundboard-context').textContent = view
    ? 'Musikbezug: ' +
      view.context.name +
      (view.state.manualHold !== 'none' ? ' · Manuelle Auswahl hat Vorrang' : '')
    : 'Musikbezug wird gelesen…';
  const transport = el('soundboard-transport');
  transport.replaceChildren();
  for (const [operation, label] of [
    ['play', '▶ Start / Fortsetzen'],
    ['pause', 'Pause'],
    ['stop', 'Alles stoppen'],
    ['skip', 'Weiter →'],
    ['release', 'Automatik freigeben'],
  ] as const)
    transport.append(
      button(label, (v) => ({ kind: 'transport', expectedRevision: v.state.revision, operation })),
    );
  const queue = el('soundboard-queue');
  queue.replaceChildren();
  for (const entry of view?.state.queue.slice(0, queueLimit) ?? []) {
    const row = node('div');
    row.className = 'soundboard-queue-row';
    row.append(
      node(
        'span',
        (view?.assets.find((a) => a.id === entry.assetId)?.name ?? 'Musiktitel') +
          ' · ' +
          (entry.mode === 'manual' ? 'manuell' : 'Automatik'),
      ),
      button('↑', (v) => ({
        kind: 'queue-move',
        expectedRevision: v.state.revision,
        id: entry.id,
        direction: -1,
      })),
      button('↓', (v) => ({
        kind: 'queue-move',
        expectedRevision: v.state.revision,
        id: entry.id,
        direction: 1,
      })),
      button('Entfernen', (v) => ({
        kind: 'queue-remove',
        expectedRevision: v.state.revision,
        id: entry.id,
      })),
    );
    queue.append(row);
  }
  if (!view?.state.queue.length) queue.append(node('p', 'Keine Titel in der Warteschlange.'));
  el('soundboard-queue-more').hidden = (view?.state.queue.length ?? 0) <= queueLimit;
  el('soundboard-problems').textContent = view?.problems.join(' · ') || '';
  drawFavorites();
  drawLibrary();
}
export function activateSoundboard(w: WorkspaceGeometry) {
  if (timer) clearTimeout(timer);
  timer = null;
  workspace = w;
  view = null;
  busy = false;
  libraryRequest++;
  favoriteRequest++;
  favoriteBasis = '';
  queueLimit = 40;
  selectedSongs.clear();
  library = { items: [], next: null, problems: [] };
  favorites = { items: [], next: null, problems: [] };
  el<HTMLDetailsElement>('live-soundboard').open = false;
  el<HTMLInputElement>('soundboard-search').value = '';
  el<HTMLSelectElement>('soundboard-kind').value = '';
  render();
}
export function initSoundboard(
  status: typeof tell,
  openLibrary: () => Promise<void>,
  showBoard: () => Promise<void>,
) {
  tell = status;
  const shortcut = node('button', 'Soundboard');
  shortcut.id = 'soundboard-shortcut';
  shortcut.type = 'button';
  shortcut.onclick = () => void showBoard().catch((e) => tell(e.message, true));
  el('music-mini-open').after(shortcut);
  const root = node('details');
  root.id = 'live-soundboard';
  root.innerHTML =
    '<summary>Soundboard · Musik und Umgebung</summary><h3 id="soundboard-now"></h3><p id="soundboard-context"></p><div id="soundboard-transport" class="toolbar"></div><p>Nach erneutem Öffnen gibt erst ein ausdrücklicher Start Ton frei. Ein manueller Stopp hält auch die Automatik an.</p><p id="soundboard-problems" role="status"></p><div class="toolbar"><button id="soundboard-refresh" type="button">Aktualisieren</button><button id="soundboard-open-library" type="button">Bibliothek und Musikbezug bearbeiten…</button></div><h3>Favoriten</h3><p id="soundboard-favorite-status"></p><div id="soundboard-favorites" class="soundboard-grid"></div><button id="soundboard-favorites-more" type="button" hidden>Weitere Favoriten</button><details><summary>Warteschlange</summary><div id="soundboard-queue"></div><button id="soundboard-queue-more" type="button" hidden>Weitere Titel</button></details><details id="soundboard-browser"><summary>Musik und Geräusche suchen</summary><label for="soundboard-search">Audiodateien suchen</label><input id="soundboard-search" type="search" maxlength="1000" placeholder="Name, Vibe, Genre oder Notiz"><label for="soundboard-kind">Art</label><select id="soundboard-kind"><option value="">Musik und Umgebung</option><option value="song">Musik</option><option value="ambience">Umgebung</option></select><p id="soundboard-library-status" role="status"></p><p id="soundboard-selection"></p><div class="toolbar"><button id="soundboard-queue-selected" type="button" disabled>Ausgewählte Titel gemeinsam vormerken</button><button id="soundboard-clear-selection" type="button">Auswahl leeren</button></div><div id="soundboard-library" class="soundboard-grid"></div><button id="soundboard-library-more" type="button" hidden>Weitere Audiodateien</button></details>';
  el('running-editor').append(root);
  root.addEventListener('toggle', () => {
    if (root.open) {
      void refreshMusic();
      void loadFavorites();
      void loadLibrary();
    }
  });
  onMusicChanged((value) => {
    const catalogChanged =
      !!value && view?.registry.catalogRevision !== value.registry.catalogRevision;
    view = value;
    render();
    const basis =
      (value?.state.favoriteAssets ?? []).join('|') + '|' + (value?.registry.catalogRevision ?? -1);
    if (basis !== favoriteBasis) {
      favoriteBasis = basis;
      favoriteRequest++;
      if (root.open) void loadFavorites();
    }
    if (catalogChanged && root.open) void loadLibrary();
  });
  el('soundboard-refresh').onclick = () => {
    void refreshMusic();
    void loadFavorites();
    void loadLibrary();
  };
  el('soundboard-open-library').onclick = () =>
    void openLibrary().catch((e) => tell(e.message, true));
  el('soundboard-library-more').onclick = () => void loadLibrary(true);
  el('soundboard-favorites-more').onclick = () => void loadFavorites(true);
  el('soundboard-queue-more').onclick = () => {
    queueLimit += 40;
    render();
  };
  el('soundboard-search').oninput = () => {
    libraryRequest++;
    if (timer) clearTimeout(timer);
    clearLibrary();
    el('soundboard-library-status').textContent = 'Audiodateien werden gelesen…';
    timer = setTimeout(() => {
      timer = null;
      void loadLibrary();
    }, 200);
  };
  el('soundboard-search').onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (timer) clearTimeout(timer);
      timer = null;
      void loadLibrary();
    }
  };
  el('soundboard-kind').onchange = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    void loadLibrary();
  };
  el('soundboard-clear-selection').onclick = () => {
    selectedSongs.clear();
    drawLibrary();
  };
  el('soundboard-queue-selected').onclick = () => {
    const ids = [...selectedSongs],
      token = workspace?.token;
    void mutate((v) => ({
      kind: 'queue-add',
      expectedRevision: v.state.revision,
      assetIds: ids,
    })).then((ok) => {
      if (ok && workspace?.token === token) {
        selectedSongs.clear();
        drawLibrary();
      }
    });
  };
}
