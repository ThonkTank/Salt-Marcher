import { editorInstanceEvents, clearEditorHandlers } from '../shared/editor-instance';
import { createEditorSurface } from '../shared/editor-surface';
import { EditorSession } from '../shared/editor-session';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type { Preparation } from '../campaign/preparation-contracts';
import type {
  AudioAsset,
  AudioPage,
  AudioQuery,
  MusicView,
  MusicAction,
  MusicSceneSettings,
  MusicSubject,
  MoodAxis,
} from './music-contracts';
import { LocalAudioPlayer } from './music-player';
import { preserveLiteralEdit } from '../shared/literal-text-edit';

export function createMusicEditor(host: {
  roots: readonly HTMLElement[];
  api: Window['campaign'];
}) {
  const { document, get } = createEditorSurface(host.roots);
  const window = { campaign: host.api };
  const { cleanups } = editorInstanceEvents();
  let initialized = false,
    disposed = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const editorSession = new EditorSession();
  const pendingWork = editorSession.operation<Promise<boolean>>();

  const el = get,
    value = (id: string) => el<HTMLInputElement>(id).value;
  const unwrap = <T>(r: Result<T>): T => {
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
  const tags = (s: string) => [
    ...new Set(
      s
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
  const time = (s: number) =>
    Number.isFinite(s)
      ? Math.floor(s / 60) +
        ':' +
        Math.floor(s % 60)
          .toString()
          .padStart(2, '0')
      : '0:00';
  const musicListeners = new Set<(value: MusicView | null) => void>();
  function onMusicChanged(listener: (value: MusicView | null) => void) {
    musicListeners.add(listener);
    return () => {
      musicListeners.delete(listener);
    };
  }
  async function runLiveMusic(token: string, build: (value: MusicView) => MusicAction) {
    const owner = workspace;
    if (!owner || owner.token !== token) return false;
    if (view && isStop(build(view))) return !!(await stopMusic(owner));
    const stoppedAt = stopRevision;
    if (!(await flushMusic()) || !current(owner) || stoppedAt !== stopRevision) return false;
    await refreshMusic();
    if (!current(owner) || !view || stoppedAt !== stopRevision) return false;
    return !!(await change(build(view), false, owner));
  }
  let workspace: WorkspaceGeometry | null = null,
    view: MusicView | null = null,
    sources: Preparation | null = null,
    page: AudioPage = { items: [], next: null, problems: [] },
    selected: AudioAsset | null = null,
    sceneDraft: MusicSceneSettings | null = null,
    subjectDraft: MusicSubject | null = null,
    axisDraft: MoodAxis[] = [];
  let assetDirty = false,
    sceneDirty = false,
    subjectDirty = false,
    axesDirty = false,
    timer: ReturnType<typeof setTimeout> | null = null,
    request = 0,
    libraryRequest = 0,
    openRequest = 0,
    subjectRequest = 0,
    assetRequest = 0,
    axisRevision = 0,
    transferBusy = false;
  let combatSources: { id: string; name: string }[] = [];
  let tell: (text: string, error?: boolean) => void,
    open: () => Promise<void>,
    player: LocalAudioPlayer,
    duration = 0;
  let stopRevision = -1,
    songRevision = -1,
    ambienceRevision = -1;
  const authorizedLayers = new Set<string>(),
    layerRevisions = new Map<string, number>();
  let refreshPending: { token: string; task: Promise<void> } | null = null;
  function option(s: HTMLSelectElement, id: string, name: string) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = name;
    s.append(o);
  }
  function button(label: string, fn: (owner: WorkspaceGeometry) => Promise<unknown> | void) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = () => run(fn);
    return b;
  }
  function current(owner: WorkspaceGeometry) {
    return workspace === owner && workspace.token === owner.token;
  }
  function run(fn: (owner: WorkspaceGeometry) => Promise<unknown> | void) {
    const owner = workspace;
    if (!owner) return;
    void Promise.resolve()
      .then(() => {
        if (!current(owner)) return;
        return fn(owner);
      })
      .catch((e) => {
        if (current(owner)) tell(e.message, true);
      });
  }
  function resetOutputAuthority() {
    for (const listener of musicListeners) listener(null);
    authorizedLayers.clear();
    layerRevisions.clear();
    stopRevision = songRevision = ambienceRevision = -1;
  }
  function grantOutput(action: MusicAction, revision: number) {
    if (action.kind === 'transport' && action.operation === 'stop') {
      stopRevision = Math.max(stopRevision, revision);
      for (const id of authorizedLayers)
        if ((layerRevisions.get(id) ?? -1) <= stopRevision) authorizedLayers.delete(id);
      return;
    }
    if (revision <= stopRevision) return;
    if (
      action.kind === 'select' ||
      (action.kind === 'transport' &&
        ['play', 'back', 'skip', 'release'].includes(action.operation))
    ) {
      songRevision = Math.max(songRevision, revision);
      ambienceRevision = Math.max(ambienceRevision, revision);
    } else if (action.kind === 'ambience') {
      if (action.operation === 'release-all') {
        ambienceRevision = Math.max(ambienceRevision, revision);
      } else if (revision >= (layerRevisions.get(action.assetId) ?? -1)) {
        layerRevisions.set(action.assetId, revision);
        if (action.operation === 'add' || action.operation === 'unmute')
          authorizedLayers.add(action.assetId);
        else authorizedLayers.delete(action.assetId);
      }
    }
  }
  function applyRuntime(value: MusicView) {
    if (value.state.manualHold === 'stop')
      grantOutput(
        { kind: 'transport', operation: 'stop', expectedRevision: value.state.revision },
        value.state.revision,
      );
    const asset = value.assets.find((a) => a.id === value.state.current?.assetId),
      playSong =
        songRevision > stopRevision &&
        !!asset &&
        asset.kind === 'song' &&
        asset.available &&
        !asset.trashed &&
        !asset.problem;
    const layers =
        ambienceRevision > stopRevision
          ? value.layers
          : value.layers.filter((layer) => authorizedLayers.has(layer.assetId)),
      scale = layers.length ? Math.sqrt(value.layers.length / layers.length) : 1;
    player.apply({
      ...value,
      state: playSong ? value.state : { ...value.state, current: null, status: 'stopped' },
      layers: layers.map((layer) => ({ ...layer, gain: Math.min(1, layer.gain * scale) })),
    });
  }
  async function checkpoint(owner = workspace) {
    if (!owner || !current(owner) || !player) return;
    const p = player.position();
    if (p)
      unwrap(
        await editorSession.start(() =>
          window.campaign.musicPosition(owner.token, p.playbackId, p.seconds),
        ),
      );
  }
  function isStop(action: MusicAction) {
    return action.kind === 'transport' && action.operation === 'stop';
  }
  async function preparePlayback(owner: WorkspaceGeometry) {
    const stoppedAt = stopRevision;
    return (await flushMusic()) && current(owner) && stoppedAt === stopRevision;
  }
  async function stopMusic(owner: WorkspaceGeometry) {
    // Stop owns its zero-position write; unrelated drafts and checkpoints cannot gate silence.
    if (!current(owner) || !view) return null;
    return change(
      { kind: 'transport', operation: 'stop', expectedRevision: view.state.revision },
      false,
      owner,
    );
  }
  async function change(action: MusicAction, quiet = false, owner = workspace) {
    if (!owner || !current(owner)) return null;
    const stoppedAt = stopRevision,
      command = {
        commandId: crypto.randomUUID(),
        campaignId: owner.campaign.id,
        token: owner.token,
        action: structuredClone(action),
      };
    if (!isStop(action)) await checkpoint(owner);
    if (!current(owner) || (!isStop(action) && stoppedAt !== stopRevision)) return null;
    const response = await editorSession.start(() => window.campaign.executeMusic(command));
    if (!current(owner)) return null;
    const result = unwrap(response);
    grantOutput(action, result.state.revision);
    if (
      view &&
      (result.state.revision < view.state.revision ||
        result.registry.catalogRevision < view.registry.catalogRevision)
    ) {
      applyRuntime(view);
      renderRuntime();
      return result;
    }
    request++;
    refreshPending = null;
    view = result;
    applyRuntime(result);
    renderRuntime();
    if (!quiet) tell(isStop(action) ? 'Wiedergabe gestoppt.' : 'Musik gespeichert.');
    return result;
  }
  async function refreshMusic() {
    const owner = workspace;
    if (!owner) return;
    if (refreshPending?.token === owner.token) return refreshPending.task;
    const number = ++request,
      operation = {
        token: owner.token,
        task: Promise.resolve().then(async () => {
          try {
            const response = await window.campaign.music(owner.token);
            if (!current(owner) || number !== request) return;
            const result = unwrap(response);
            if (
              view &&
              (result.state.revision < view.state.revision ||
                result.registry.catalogRevision < view.registry.catalogRevision)
            )
              return;
            view = result;
            applyRuntime(result);
            renderRuntime();
          } catch (e) {
            if (current(owner) && number === request)
              el('music-error').textContent = (e as Error).message;
          }
        }),
      };
    refreshPending = operation;
    await operation.task;
    if (refreshPending === operation) refreshPending = null;
  }
  function deactivateMusic() {
    resetOutputAuthority();
    workspace = null;
    view = null;
    request++;
    player.reset();
    el('music-mini').hidden = true;
  }
  function activateMusic(w: WorkspaceGeometry) {
    editorSession.generation++;
    request++;
    openRequest++;
    subjectRequest++;
    assetRequest++;
    refreshPending = null;
    if (timer) clearTimeout(timer);
    timer = null;
    pendingWork.value = null;
    libraryRequest++;
    resetOutputAuthority();
    workspace = { ...w };
    view = null;
    sources = null;
    selected = null;
    sceneDraft = null;
    subjectDraft = null;
    axisDraft = [];
    axisRevision = 0;
    page = { items: [], next: null, problems: [] };
    assetDirty = sceneDirty = subjectDirty = axesDirty = false;
    player.reset();
    renderAsset();
    renderScene();
    renderSubject();
    el<HTMLSelectElement>('music-subject-select').value = '';
    renderSubjects();
    renderLibrary();
    el('music-axes').replaceChildren();
    el('music-queue').replaceChildren();
    el('music-layers').replaceChildren();
    el('music-now').textContent = el('music-mini-title').textContent = 'Kein Titel';
    el('music-error').textContent = '';
    el('music-mini').hidden = false;
    void refreshMusic();
  }
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void flushMusic();
    }, 700);
  }
  function collectAsset(): AudioAsset {
    if (!selected) throw new Error('Audiodatei auswählen.');
    const moods = { ...selected.moods };
    for (const input of el('audio-moods').querySelectorAll<HTMLInputElement>('input[data-axis]'))
      moods[input.dataset.axis!] = Number(input.value);
    return {
      ...selected,
      name: value('audio-name'),
      kind: value('audio-kind') as AudioAsset['kind'],
      intensity: Number(value('audio-intensity')),
      moods,
      moodTags: tags(value('audio-mood-tags')),
      vibes: tags(value('audio-vibes')),
      genres: tags(value('audio-genres')),
      notes: preserveLiteralEdit(selected.notes, value('audio-notes')),
      trashed: el<HTMLInputElement>('audio-trashed').checked,
    };
  }
  function assetInput(a: AudioAsset) {
    return JSON.stringify([
      a.name,
      a.kind,
      a.intensity,
      a.moods,
      a.moodTags,
      a.vibes,
      a.genres,
      a.notes,
      a.trashed,
    ]);
  }
  function collectScene(): MusicSceneSettings {
    if (!sceneDraft) throw new Error('Fokussierte Gruppe auswählen.');
    const moods = { ...sceneDraft.moods };
    for (const input of el('music-scene-moods').querySelectorAll<HTMLInputElement>(
      'input[data-axis]',
    ))
      moods[input.dataset.axis!] = Number(input.value);
    return {
      ...sceneDraft,
      moods,
      intensity: Number(value('music-scene-intensity')),
      vibes: tags(value('music-scene-vibes')),
      genres: tags(value('music-scene-genres')),
    };
  }
  function collectSubject(): MusicSubject {
    if (!subjectDraft) throw new Error('Musikquelle auswählen.');
    return {
      ...subjectDraft,
      vibes: tags(value('music-subject-vibes')),
      genres: tags(value('music-subject-genres')),
      vibeMode: value('music-subject-vibe-mode') as MusicSubject['vibeMode'],
      genreMode: value('music-subject-genre-mode') as MusicSubject['genreMode'],
    };
  }
  async function flushMusic(): Promise<boolean> {
    if (timer) clearTimeout(timer);
    timer = null;
    const owner = workspace;
    if (!owner) return true;
    if (pendingWork.value) {
      const running = pendingWork.value;
      if (!(await running) || !current(owner)) return false;
      return flushMusic();
    }
    const task = Promise.resolve().then(async () => {
      try {
        if (!current(owner)) return false;
        if (assetDirty && selected) {
          const draft = collectAsset();
          if (
            !(await change(
              { kind: 'asset', asset: draft, expectedRevision: draft.revision },
              false,
              owner,
            )) ||
            !current(owner)
          )
            return false;
          assetDirty =
            !!selected &&
            selected.id === draft.id &&
            assetInput(collectAsset()) !== assetInput(draft);
          selected = { ...draft, revision: draft.revision + 1 };
          if (!assetDirty) renderAsset();
        }
        if (axesDirty && view) {
          const draft = structuredClone(axisDraft),
            revision = axisRevision;
          if (
            !(await change(
              { kind: 'registry', axes: draft, expectedRevision: revision },
              false,
              owner,
            )) ||
            !current(owner)
          )
            return false;
          axesDirty = JSON.stringify(axisDraft) !== JSON.stringify(draft);
          axisRevision = revision + 1;
          renderAxes();
          if (!assetDirty) renderAsset();
        }
        if (sceneDirty && sceneDraft) {
          const draft = collectScene();
          if (
            !(await change(
              { kind: 'scene-settings', expectedRevision: draft.revision, settings: draft },
              false,
              owner,
            )) ||
            !current(owner)
          )
            return false;
          sceneDirty =
            !!sceneDraft &&
            sceneDraft.sceneId === draft.sceneId &&
            JSON.stringify(collectScene()) !== JSON.stringify(draft);
          sceneDraft = { ...draft, revision: draft.revision + 1 };
          if (!sceneDirty) renderScene();
        }
        if (subjectDirty && subjectDraft) {
          const draft = collectSubject();
          if (
            !(await change(
              { kind: 'subject', subject: draft, expectedRevision: draft.revision || null },
              false,
              owner,
            )) ||
            !current(owner)
          )
            return false;
          subjectDirty =
            !!subjectDraft &&
            subjectDraft.id === draft.id &&
            JSON.stringify(collectSubject()) !== JSON.stringify(draft);
          subjectDraft = { ...draft, revision: draft.revision + 1 };
          if (!subjectDirty) renderSubject();
        }
        await checkpoint(owner);
        return current(owner);
      } catch (error) {
        if (current(owner)) tell((error as Error).message + ' Musikeingabe bleibt offen.', true);
        return false;
      }
    });
    pendingWork.value = task;
    const ok = await task;
    if (pendingWork.value === task) pendingWork.value = null;
    if (!ok || !current(owner)) return false;
    return assetDirty || axesDirty || sceneDirty || subjectDirty ? flushMusic() : true;
  }
  async function openMusic() {
    const owner = workspace;
    if (!owner) return;
    const number = ++openRequest,
      owns = () => current(owner) && number === openRequest;
    try {
      await refreshMusic();
      if (!owns()) return;
      const sceneId = view?.context.sceneId;
      const [prepared, combat] = await Promise.all([
        window.campaign.preparation(owner.token, ''),
        sceneId ? window.campaign.combat(owner.token, sceneId) : Promise.resolve(null),
      ]);
      if (!owns() || sceneId !== view?.context.sceneId) return;
      sources = unwrap(prepared);
      combatSources = combat?.ok
        ? (combat.value.combat?.sources?.map((c) => ({ id: c.id, name: c.name })) ?? [])
        : [];
      await search();
      if (!owns()) return;
      renderAxes();
      renderScene();
      renderSubjects();
      if (!assetDirty) renderAsset();
    } catch (error) {
      if (owns()) throw error;
    }
  }

  async function search(more = false) {
    const number = ++libraryRequest,
      token = workspace?.token,
      query: AudioQuery = {
        search: value('audio-search'),
        kind: value('audio-filter-kind') as AudioQuery['kind'],
        includeTrashed: el<HTMLInputElement>('audio-show-trash').checked,
        after: more ? page.next : null,
      },
      result = unwrap(await window.campaign.audioAssets(query));
    if (workspace?.token !== token || number !== libraryRequest) return;
    page = more
      ? {
          items: [...page.items, ...result.items],
          next: result.next,
          problems: [...page.problems, ...result.problems],
        }
      : result;
    renderLibrary();
  }
  async function selectAsset(
    owner: WorkspaceGeometry,
    id: string,
    accept: () => boolean = () => true,
  ) {
    const number = ++assetRequest,
      response = await window.campaign.audioAsset(id);
    if (!current(owner) || number !== assetRequest || !accept()) return false;
    selected = unwrap(response);
    renderAsset();
    return true;
  }
  function renderLibrary() {
    const root = el('audio-list');
    root.replaceChildren();
    for (const a of page.items) {
      const card = document.createElement('article');
      card.className = 'audio-card';
      const name = document.createElement('h4'),
        meta = document.createElement('p'),
        controls = document.createElement('div');
      name.textContent = a.name;
      meta.textContent =
        (a.kind === 'song' ? 'Musik' : 'Umgebung') +
        ' · Intensität ' +
        a.intensity +
        (a.vibes.length ? ' · ' + a.vibes.join(', ') : '') +
        (a.genres.length ? ' · ' + a.genres.join(', ') : '') +
        (a.trashed ? ' · Papierkorb' : '') +
        (!a.available ? ' · Datei fehlt oder wurde verändert' : a.problem ? ' · ' + a.problem : '');
      controls.className = 'toolbar';
      controls.append(
        button('Beschreibung bearbeiten', async (owner) => {
          if (!(await flushMusic()) || !current(owner)) return;
          await selectAsset(owner, a.id);
        }),
      );
      if (a.kind === 'song') {
        const play = button('Abspielen', async (owner) => {
          if ((await preparePlayback(owner)) && view)
            await change(
              { kind: 'select', expectedRevision: view.state.revision, assetId: a.id },
              false,
              owner,
            );
        });
        const queue = button('In Warteschlange', async (owner) => {
          if ((await preparePlayback(owner)) && view)
            await change(
              { kind: 'queue-add', expectedRevision: view.state.revision, assetIds: [a.id] },
              false,
              owner,
            );
        });
        play.disabled = queue.disabled = !a.available || a.trashed;
        controls.append(play, queue);
      } else {
        const add = button('Sound hinzufügen', async (owner) => {
          if ((await preparePlayback(owner)) && view)
            await change(
              {
                kind: 'ambience',
                expectedRevision: view.state.revision,
                assetId: a.id,
                operation: 'add',
              },
              false,
              owner,
            );
        });
        add.disabled = !a.available || a.trashed;
        controls.append(add);
      }
      if (a.problem)
        controls.append(
          button('Erneut versuchen', async (owner) => {
            if ((await change({ kind: 'retry-asset', id: a.id }, false, owner)) && current(owner))
              await search();
          }),
        );
      card.append(name, meta, controls);
      root.append(card);
    }
    el('audio-more').hidden = !page.next;
    el('audio-problems').textContent = page.problems.join(' · ');
  }

  function moodInputs(root: HTMLElement, moods: Record<string, number>, oninput: () => void) {
    root.replaceChildren();
    for (const axis of view?.registry.axes ?? []) {
      const label = document.createElement('label'),
        input = document.createElement('input'),
        caption = document.createElement('small');
      label.textContent = axis.name;
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '1';
      input.value = String(moods[axis.id] ?? 50);
      input.dataset.axis = axis.id;
      caption.textContent = axis.lowLabel + ' ← ' + input.value + ' → ' + axis.highLabel;
      input.oninput = () => {
        caption.textContent = axis.lowLabel + ' ← ' + input.value + ' → ' + axis.highLabel;
        oninput();
      };
      label.append(input, caption);
      root.append(label);
    }
  }
  function renderAsset() {
    el('audio-editor').hidden = !selected;
    if (!selected) return;
    const a = selected;
    for (const [id, v] of Object.entries({
      'audio-name': a.name,
      'audio-kind': a.kind,
      'audio-intensity': String(a.intensity),
      'audio-mood-tags': a.moodTags.join(', '),
      'audio-vibes': a.vibes.join(', '),
      'audio-genres': a.genres.join(', '),
      'audio-notes': a.notes,
    }))
      el<HTMLInputElement>(id).value = v;
    el<HTMLInputElement>('audio-trashed').checked = a.trashed;
    el('audio-source').textContent =
      a.media.originalName +
      ' · ' +
      (a.media.bytes / 1048576).toFixed(1) +
      ' MB · ' +
      (a.available ? 'Lokal verfügbar' : 'Datei fehlt oder wurde verändert');
    moodInputs(el('audio-moods'), a.moods, () => {
      assetDirty = true;
      schedule();
    });
  }
  function renderAxes() {
    if (!view || axesDirty) return;
    axisDraft = structuredClone(view.registry.axes);
    axisRevision = view.registry.revision;
    renderAxesDraft();
  }
  function renderAxesDraft() {
    const root = el('music-axes');
    root.replaceChildren();
    for (const axis of axisDraft) {
      const row = document.createElement('div');
      row.className = 'music-axis-row';
      for (const [key, placeholder] of [
        ['name', 'Achsenname'],
        ['lowLabel', 'Niedrig'],
        ['highLabel', 'Hoch'],
      ] as const) {
        const input = document.createElement('input');
        input.value = axis[key];
        input.placeholder = placeholder;
        input.setAttribute('aria-label', placeholder);
        input.oninput = () => {
          axis[key] = input.value;
          axesDirty = true;
          schedule();
        };
        row.append(input);
      }
      row.append(
        button('Entfernen', () => {
          axisDraft = axisDraft.filter((a) => a.id !== axis.id);
          axesDirty = true;
          renderAxesDraft();
          schedule();
        }),
      );
      root.append(row);
    }
  }

  function renderScene() {
    if (sceneDirty) return;
    sceneDraft = view?.sceneSettings ? structuredClone(view.sceneSettings) : null;
    el('music-scene-editor').hidden = !sceneDraft;
    el('music-context-description').textContent = view
      ? view.context.name +
        ' · ' +
        view.context.vibes.join(', ') +
        (view.context.genres.length ? ' · ' + view.context.genres.join(', ') : '')
      : '';
    if (!sceneDraft) return;
    for (const [id, v] of Object.entries({
      'music-scene-intensity': String(sceneDraft.intensity),
      'music-scene-vibes': sceneDraft.vibes.join(', '),
      'music-scene-genres': sceneDraft.genres.join(', '),
    }))
      el<HTMLInputElement>(id).value = v;
    moodInputs(el('music-scene-moods'), sceneDraft.moods, () => {
      sceneDirty = true;
      schedule();
    });
  }
  function renderSubject() {
    el('music-subject-editor').hidden = !subjectDraft;
    if (!subjectDraft) return;
    for (const [id, v] of Object.entries({
      'music-subject-vibes': subjectDraft.vibes.join(', '),
      'music-subject-genres': subjectDraft.genres.join(', '),
      'music-subject-vibe-mode': subjectDraft.vibeMode,
      'music-subject-genre-mode': subjectDraft.genreMode,
    }))
      el<HTMLInputElement>(id).value = v;
  }
  function renderSubjects() {
    const target = subjectDraft
      ? subjectDraft.kind + ':' + subjectDraft.id
      : value('music-subject-select');
    const s = el<HTMLSelectElement>('music-subject-select');
    s.replaceChildren();
    option(s, '', 'Quelle auswählen');
    for (const l of sources?.locations ?? [])
      if (!l.trashed) option(s, 'location:' + l.document.id, 'Ort: ' + l.document.name);
    for (const n of sources?.notes ?? [])
      if (!n.trashed)
        option(
          s,
          'note:' + n.note.id,
          {
            note: 'Notiz',
            npc: 'NPC',
            faction: 'Fraktion',
            quest: 'Quest',
            rumor: 'Gerücht',
            rule: 'Regel',
          }[n.note.kind] +
            ': ' +
            n.note.title,
        );
    const creatures = new Map<string, string>();
    for (const n of sources?.notes ?? [])
      if (n.note.creatureId) creatures.set(n.note.creatureId, n.note.title);
    for (const c of combatSources) creatures.set(c.id, c.name);
    for (const [id, name] of creatures) option(s, 'creature:' + id, 'Kreaturprofil: ' + name);
    if (target) {
      if (![...s.options].some((o) => o.value === target))
        option(s, target, subjectDraft?.name ?? 'Gewählte Quelle');
      s.value = target;
    }
  }
  function renderRuntime() {
    if (!view) return;
    const s = view.state,
      current = view.assets.find((a) => a.id === s.current?.assetId),
      caption =
        (current?.name ?? 'Kein Titel') +
        ' · ' +
        (s.current &&
        (!current ||
          !current.available ||
          current.trashed ||
          current.problem ||
          current.kind !== 'song')
          ? 'Nicht verfügbar'
          : s.status === 'playing' && songRevision <= stopRevision
            ? 'Bereit · ▶ starten'
            : { playing: 'Spielt', paused: 'Pausiert', stopped: 'Gestoppt' }[s.status]) +
        (s.manualHold !== 'none' ? ' · Manuelle Wahl' : '');
    const activeSounds = view.layers.filter(
        (layer) => ambienceRevision > stopRevision || authorizedLayers.has(layer.assetId),
      ).length,
      hint = activeSounds
        ? ' · ' + activeSounds + ' ' + (activeSounds === 1 ? 'Sound' : 'Sounds') + ' aktiv'
        : '';
    el('music-now').textContent = caption + hint;
    el('music-mini-title').textContent = caption + hint;
    el('music-error').textContent = [s.lastError, ...view.problems].filter(Boolean).join(' · ');
    el<HTMLInputElement>('music-autoplay').checked = s.autoplay;
    el<HTMLInputElement>('music-auto-ambience').checked = s.autoAmbience;
    el<HTMLInputElement>('music-volume').value = String(s.volume * 100);
    el<HTMLInputElement>('music-ambience-volume').value = String(s.ambienceVolume * 100);
    el<HTMLInputElement>('music-fade').value = String(s.fadeSeconds);
    el<HTMLSelectElement>('music-loop').value = s.loop;
    const queue = el('music-queue');
    queue.replaceChildren();
    for (const entry of s.queue) {
      const a = view.assets.find((a) => a.id === entry.assetId),
        row = document.createElement('div'),
        label = document.createElement('span');
      row.className = 'music-queue-row';
      label.textContent =
        (a?.name ?? 'Datei nicht verfügbar') +
        ' · ' +
        (entry.mode === 'auto' ? 'Automatisch' : 'Manuell');
      row.append(
        label,
        button('↑', () =>
          change({
            kind: 'queue-move',
            expectedRevision: view!.state.revision,
            id: entry.id,
            direction: -1,
          }),
        ),
        button('↓', () =>
          change({
            kind: 'queue-move',
            expectedRevision: view!.state.revision,
            id: entry.id,
            direction: 1,
          }),
        ),
        button('Entfernen', () =>
          change({ kind: 'queue-remove', expectedRevision: view!.state.revision, id: entry.id }),
        ),
      );
      queue.append(row);
    }
    const layers = el('music-layers');
    layers.replaceChildren();
    for (const layer of view.layers) {
      const row = document.createElement('div'),
        label = document.createElement('span');
      row.className = 'music-queue-row';
      label.textContent =
        (view.assets.find((a) => a.id === layer.assetId)?.name ?? 'Umgebung') +
        ' · ' +
        (layer.manual ? 'Manuell' : 'Umgebung / Wetter') +
        ' · ' +
        (ambienceRevision > stopRevision || authorizedLayers.has(layer.assetId)
          ? 'Freigegeben'
          : 'Bereit');
      row.append(
        label,
        button(layer.manual ? 'Entfernen' : 'Unterdrücken', () =>
          change({
            kind: 'ambience',
            expectedRevision: view!.state.revision,
            assetId: layer.assetId,
            operation: layer.manual ? 'remove' : 'mute',
          }),
        ),
      );
      layers.append(row);
    }
    for (const id of s.mutedAmbience) {
      const name = view.assets.find((a) => a.id === id)?.name ?? 'Sound nicht lesbar (' + id + ')',
        row = document.createElement('p');
      row.textContent = name + ' · Unterdrückt ';
      const restore = button('Wieder freigeben', () =>
        change({
          kind: 'ambience',
          expectedRevision: view!.state.revision,
          assetId: id,
          operation: 'unmute',
        }),
      );
      restore.setAttribute('aria-label', name + ' wieder freigeben');
      row.append(restore);
      layers.append(row);
    }
    if (selected && !assetDirty) {
      const latest = view.assets.find((a) => a.id === selected!.id);
      if (latest && latest.revision !== selected.revision) {
        selected = latest;
        renderAsset();
      }
    }
    renderScene();
    for (const listener of musicListeners) listener(view);
  }
  function initMusic(status: typeof tell, show: typeof open) {
    if (initialized || disposed) throw new Error('Editor already initialized or disposed');
    initialized = true;
    tell = status;
    open = show;
    el('music').innerHTML =
      `<div class="catalog-heading"><h2>Musik und Ambience</h2><p>Lokale Bibliothek · manuelle Auswahl · optionaler Szenenbezug</p></div><div class="music-console"><h3 id="music-now">Kein Titel</h3><div class="toolbar"><button data-music-transport="play">▶ Abspielen</button><button data-music-transport="pause">Pause</button><button data-music-transport="stop">Stopp</button><button data-music-transport="back">← Zurück</button><button data-music-transport="skip">Weiter →</button><button data-music-transport="release">Automatik freigeben</button></div><div class="music-timeline"><input id="music-seek" type="range" min="0" max="0" value="0" step=".1" aria-label="Wiedergabeposition"><span id="music-time">0:00 / 0:00</span></div><form id="music-settings"><div class="toolbar"><label class="check-label"><input id="music-autoplay" type="checkbox"> Musik-Autoplay</label><label class="check-label"><input id="music-auto-ambience" type="checkbox"> Umgebungsautomatik</label><label>Loop<select id="music-loop"><option value="none">Keiner</option><option value="track">Aktueller Titel</option><option value="queue">Warteschlange</option></select></label></div><div class="combat-fields"><label>Musiklautstärke<input id="music-volume" type="range" min="0" max="100" value="70"></label><label>Umgebungslautstärke<input id="music-ambience-volume" type="range" min="0" max="100" value="30"></label><label>Blende in Sekunden<input id="music-fade" type="number" min="0" max="20" step="any" value="2"></label></div></form><p id="music-error" role="status"></p><div class="music-columns"><section><h3>Warteschlange</h3><div id="music-queue"></div></section><section><h3>Umgebung und Wetter</h3><div id="music-layers"></div><button id="music-ambience-release">Manuelle Soundwahl freigeben</button></section></div></div><div class="toolbar music-library-tools"><button id="audio-pick">Audiodateien hinzufügen</button><button id="audio-export">Bibliothek mit Medien exportieren</button><button id="audio-import">Musikbibliothek importieren</button><button id="audio-cancel-transfer" hidden>Übertragung abbrechen</button><p id="audio-transfer-status"></p></div><div class="music-columns"><section><form id="audio-search-form"><label for="audio-search">Bibliothek durchsuchen</label><input id="audio-search" type="search" placeholder="Name, Stimmung, Vibe, Genre oder Notiz"><div class="toolbar"><select id="audio-filter-kind" aria-label="Audioart"><option value="">Musik und Umgebung</option><option value="song">Musik</option><option value="ambience">Umgebung</option></select><label class="check-label"><input id="audio-show-trash" type="checkbox"> Papierkorb</label><button type="submit">Suchen</button></div></form><div id="audio-list"></div><button id="audio-more" hidden>Weitere Dateien</button><p id="audio-problems"></p></section><section><form id="audio-editor" hidden><h3>Dateibeschreibung</h3><label>Name<input id="audio-name"></label><label>Art<select id="audio-kind"><option value="song">Musik</option><option value="ambience">Umgebungs-Sound</option></select></label><label>Intensität<input id="audio-intensity" type="range" min="0" max="100" value="50"></label><div id="audio-moods"></div><label>Stimmungstags, kommagetrennt<input id="audio-mood-tags"></label><label>Vibe / Umgebungstags, kommagetrennt<input id="audio-vibes" placeholder="Zum Beispiel Wald, Sturm, Reise …"></label><label>Genre, kommagetrennt<input id="audio-genres"></label><label>GM-Notizen<textarea id="audio-notes" rows="4"></textarea></label><p id="audio-source" class="caption"></p><label class="check-label"><input id="audio-trashed" type="checkbox"> Papierkorb</label><div class="toolbar"><button type="submit">Beschreibung speichern</button><button id="audio-clone" type="button">Eigene Beschreibung als Kopie</button></div></form><details><summary>Eigene Stimmungsachsen</summary><p>Benenn die Achsen und ihre Endpunkte für deine Musik. Die Szenenregler verwenden dieselben Achsen.</p><div id="music-axes"></div><div class="toolbar"><button id="music-axis-add">Achse hinzufügen</button><button id="music-axis-save">Achsen speichern</button></div></details></section></div><div class="music-columns"><section><h3>Musik der fokussierten Gruppe</h3><p id="music-context-description"></p><form id="music-scene-editor" hidden><label>Intensität<input id="music-scene-intensity" type="range" min="0" max="100" value="50"></label><div id="music-scene-moods"></div><label>Zusätzliche Vibes<input id="music-scene-vibes"></label><label>Zusätzliche Genres<input id="music-scene-genres"></label><button type="submit">Szenenmusik speichern</button></form></section><section><h3>Musik aus Weltinhalten</h3><label>Ort, NPC, Fraktion oder andere Quelle<select id="music-subject-select"></select></label><form id="music-subject-editor" hidden><label>Vibes<input id="music-subject-vibes"></label><label>Vibes anwenden<select id="music-subject-vibe-mode"><option value="add">Ergänzen</option><option value="replace">Ersetzen</option></select></label><label>Genres<input id="music-subject-genres"></label><label>Genres anwenden<select id="music-subject-genre-mode"><option value="add">Ergänzen</option><option value="replace">Ersetzen</option></select></label><button type="submit">Musikquelle speichern</button></form></section></div>`;
    el('music-mini').innerHTML =
      `<button id="music-mini-open" title="Musikbibliothek öffnen">♫</button><span id="music-mini-title">Kein Titel</span><button data-music-transport="play">▶</button><button data-music-transport="pause">Pause</button><button data-music-transport="stop">Stopp</button><button data-music-transport="skip">Weiter →</button>`;
    player = new LocalAudioPlayer(
      {
        timing: (seconds, total) => {
          duration = total;
          el('music-time').textContent = time(seconds) + ' / ' + time(total);
          const input = el<HTMLInputElement>('music-seek');
          input.max = String(total);
          input.disabled = !total;
          if (document.activeElement !== input) input.value = String(seconds);
        },
        ended: (id) =>
          run(async () => {
            if (view && workspace)
              await change(
                {
                  kind: 'transport',
                  expectedRevision: view.state.revision,
                  operation: 'ended',
                  playbackId: id,
                },
                true,
              );
          }),
        failed: (assetId, playbackId, message) =>
          run(async () => {
            if (workspace) await change({ kind: 'failure', assetId, playbackId, message }, true);
          }),
      },
      host.roots[0]!,
    );
    for (const b of host.roots.flatMap((root) =>
      Array.from(root.querySelectorAll<HTMLButtonElement>('[data-music-transport]')),
    ))
      b.onclick = () => {
        run(async (owner) => {
          if (b.dataset.musicTransport === 'stop') {
            await stopMusic(owner);
            return;
          }
          if (!view || !(await preparePlayback(owner))) return;
          await change({
            kind: 'transport',
            expectedRevision: view.state.revision,
            operation: b.dataset.musicTransport as 'play' | 'pause' | 'skip' | 'back' | 'release',
          });
        });
      };
    el('music-mini-open').onclick = () => run(open);
    el('music-seek').onchange = () =>
      run(async (owner) => {
        if (!view?.state.current || !duration) return;
        const seconds = Number(value('music-seek')),
          playbackId = view.state.current.playbackId;
        const result = await change(
          { kind: 'seek', expectedRevision: view.state.revision, playbackId, seconds },
          false,
          owner,
        );
        if (result && current(owner) && view?.state.current?.playbackId === playbackId)
          player.seek(seconds);
      });
    const settings = async () => {
      if (!view) return;
      await change({
        kind: 'settings',
        expectedRevision: view.state.revision,
        autoplay: el<HTMLInputElement>('music-autoplay').checked,
        autoAmbience: el<HTMLInputElement>('music-auto-ambience').checked,
        volume: Number(value('music-volume')) / 100,
        ambienceVolume: Number(value('music-ambience-volume')) / 100,
        fadeSeconds: Number(value('music-fade')),
        loop: value('music-loop') as MusicView['state']['loop'],
      });
    };
    for (const id of [
      'music-autoplay',
      'music-auto-ambience',
      'music-volume',
      'music-ambience-volume',
      'music-fade',
      'music-loop',
    ])
      el(id).onchange = () => run(settings);
    el('music-settings').onsubmit = (e) => e.preventDefault();
    el('audio-editor').oninput = () => {
      assetDirty = true;
      schedule();
    };
    el('audio-editor').onchange = () => {
      assetDirty = true;
      schedule();
    };
    el('audio-editor').onsubmit = (e) => {
      e.preventDefault();
      run(async () => {
        if (await flushMusic()) await search();
      });
    };
    el('audio-clone').onclick = () =>
      run(async (owner) => {
        if (!(await flushMusic()) || !current(owner) || !selected) return;
        const source = selected,
          selection = assetRequest,
          copyId = crypto.randomUUID();
        if (
          !(await change(
            { kind: 'clone', id: source.id, expectedRevision: source.revision, copyId },
            false,
            owner,
          )) ||
          !current(owner)
        )
          return;
        if (
          selected === source &&
          !assetDirty &&
          assetRequest === selection &&
          (await selectAsset(owner, copyId, () => selected === source && !assetDirty)) &&
          current(owner) &&
          selected?.id === copyId &&
          !assetDirty
        ) {
          el('audio-name').scrollIntoView({ block: 'center' });
          el('audio-name').focus({ preventScroll: true });
        }
        if (current(owner)) await search();
      });
    el('audio-search-form').onsubmit = (e) => {
      e.preventDefault();
      run(() => search());
    };
    el('audio-more').onclick = () => run(() => search(true));
    el('audio-pick').onclick = () =>
      run(async (owner) => {
        if (!(await flushMusic()) || !current(owner)) return;
        const response = await window.campaign.pickAudio(owner.token);
        if (!current(owner)) return;
        const result = unwrap(response);
        if (!result.cancelled) {
          await refreshMusic();
          if (!current(owner)) return;
          await search();
          if (!current(owner)) return;
          if (result.ids[0]) await selectAsset(owner, result.ids[0]);
          if (current(owner)) tell('Audiodateien hinzugefügt.');
        }
      });
    el('audio-export').onclick = () =>
      run(async (owner) => {
        if (!(await flushMusic()) || !current(owner)) return;
        const response = await window.campaign.exportAudioLibrary(owner.token);
        if (!current(owner)) return;
        if (!unwrap(response).cancelled) tell('Musikbibliothek mit Medien exportiert.');
      });
    el('audio-import').onclick = () =>
      run(async (owner) => {
        if (!(await flushMusic()) || !current(owner)) return;
        const response = await window.campaign.importAudioLibrary(owner.token);
        if (!current(owner)) return;
        if (!unwrap(response).cancelled) {
          await refreshMusic();
          if (!current(owner)) return;
          await search();
          if (!current(owner)) return;
          renderAxes();
          tell('Musikbibliothek importiert.');
        }
      });
    el('audio-cancel-transfer').onclick = () =>
      run(async () => {
        unwrap(await window.campaign.cancelAudioTransfer());
      });
    el('music-axis-add').onclick = () => {
      axisDraft.push({
        id: crypto.randomUUID(),
        name: 'Neue Stimmungsachse',
        lowLabel: 'Niedrig',
        highLabel: 'Hoch',
      });
      axesDirty = true;
      renderAxesDraft();
      schedule();
    };
    el('music-axis-save').onclick = () =>
      run(async () => {
        if (await flushMusic()) {
          renderScene();
          tell('Stimmungsachsen gespeichert.');
        }
      });
    el('music-scene-editor').oninput = () => {
      sceneDirty = true;
      schedule();
    };
    el('music-scene-editor').onchange = () => {
      sceneDirty = true;
      schedule();
    };
    el('music-scene-editor').onsubmit = (e) => {
      e.preventDefault();
      run(() => flushMusic());
    };
    el('music-subject-select').onchange = () => {
      const target = value('music-subject-select'),
        number = ++subjectRequest;
      run(async (owner) => {
        if (
          !(await flushMusic()) ||
          !current(owner) ||
          number !== subjectRequest ||
          value('music-subject-select') !== target
        )
          return;
        const i = target.indexOf(':'),
          response = target
            ? await window.campaign.musicSubject(
                owner.token,
                target.slice(0, i) as MusicSubject['kind'],
                target.slice(i + 1),
              )
            : null;
        if (
          !current(owner) ||
          number !== subjectRequest ||
          value('music-subject-select') !== target
        )
          return;
        subjectDraft = response ? unwrap(response) : null;
        renderSubject();
      });
    };
    el('music-subject-editor').oninput = () => {
      subjectDirty = true;
      schedule();
    };
    el('music-subject-editor').onchange = () => {
      subjectDirty = true;
      schedule();
    };
    el('music-subject-editor').onsubmit = (e) => {
      e.preventDefault();
      run(() => flushMusic());
    };
    el('music-ambience-release').onclick = () =>
      run(async () => {
        if (view)
          await change({
            kind: 'ambience',
            expectedRevision: view.state.revision,
            assetId: '',
            operation: 'release-all',
          });
      });
    cleanups.push(
      window.campaign.onAudioTransfer((progress) => {
        transferBusy = progress.busy;
        el('audio-transfer-status').textContent =
          progress.phase +
          (progress.busy ? ' · ' + (progress.bytes / 1048576).toFixed(1) + ' MB' : '');
        el('audio-cancel-transfer').hidden = !transferBusy;
        for (const id of ['audio-pick', 'audio-export', 'audio-import'])
          el<HTMLButtonElement>(id).disabled = transferBusy;
      }),
    );
    pollTimer = setInterval(() => {
      if (workspace) {
        void checkpoint().catch(() => {});
        void refreshMusic();
      }
    }, 5000);
  }

  editorSession.onDeactivate(() => {
    if (timer) clearTimeout(timer);
    timer = null;
  });

  editorSession.observeDraft(() => ({
    openInput: assetDirty || sceneDirty || subjectDirty || axesDirty,
    retainedDraft: false,
    unresolvedCommand: false,
  }));

  async function dispose(): Promise<boolean> {
    if (disposed) return true;
    if (initialized && !(await flushMusic())) return false;
    await editorSession.settle();
    disposed = true;
    editorSession.deactivate();
    workspace = null;
    for (const cleanup of cleanups) cleanup();
    if (initialized) {
      clearEditorHandlers(el('music'));
      clearEditorHandlers(el('music-mini'));
      if (timer) clearTimeout(timer);
      if (pollTimer) clearInterval(pollTimer);
      player?.dispose();
      musicListeners.clear();
      el('music').replaceChildren();
      el('music-mini').replaceChildren();
    }
    return true;
  }
  function alive<T extends (...args: never[]) => unknown>(fn: T): T {
    return ((...args: never[]) => {
      if (disposed) throw new Error('Editor disposed');
      return fn(...args);
    }) as T;
  }
  return {
    editorSession,
    onMusicChanged: alive(onMusicChanged),
    runLiveMusic: alive(runLiveMusic),
    refreshMusic: alive(refreshMusic),
    deactivateMusic: alive(deactivateMusic),
    activateMusic: alive(activateMusic),
    flushMusic: alive(flushMusic),
    openMusic: alive(openMusic),
    initMusic: alive(initMusic),
    dispose,
  };
}
export type MusicEditor = ReturnType<typeof createMusicEditor>;
