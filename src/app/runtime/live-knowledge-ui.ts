import type { Preparation } from '../campaign/preparation-contracts';
import type { WorkspaceGeometry } from '../shared/contracts';
import { createEditorSurface } from '../shared/editor-surface';
import { type LiveView } from './live-contracts';
import { findLiveKnowledge } from './live-knowledge';
import type { NarrativeView } from './narrative-contracts';

type Host = {
  readonly context: WorkspaceGeometry | null;
  readonly data: LiveView | null;
  readonly sources: Preparation | null;
  readonly get: ReturnType<typeof createEditorSurface>['get'];
  readonly document: Document;
  readonly value: (id: string) => string;
  readonly window: { campaign: Window['campaign'] };
  readonly liveSourcesProblem: string;
  readonly preparedNoteIds: ReadonlySet<string>;
  readonly useKnowledgeReadAloud: (text: string, title: string) => void;
  readonly showLiveNpc: (id: string, current?: () => boolean) => Promise<boolean>;
  readonly openKnowledgeNote: (id: string, current?: () => boolean) => Promise<void>;
};

export function createLiveKnowledgeUI(host: Host) {
  let renderGeneration = 0,
    ownerGeneration = 0,
    narrativeGeneration = 0,
    narrativeCache = new Map<string, NarrativeView>(),
    narrativeProblems = new Map<string, string>(),
    narrativeLoading = new Set<string>();
  function loadLiveNarrative(noteId: string) {
    if (
      !host.context ||
      narrativeCache.has(noteId) ||
      narrativeProblems.has(noteId) ||
      narrativeLoading.has(noteId)
    )
      return;
    const token = host.context.token,
      generation = narrativeGeneration;
    narrativeLoading.add(noteId);
    void host.window.campaign
      .narrative(token, noteId)
      .then((result) => {
        if (host.context?.token !== token || generation !== narrativeGeneration) return;
        if (result.ok) narrativeCache.set(noteId, result.value);
        else narrativeProblems.set(noteId, result.error);
      })
      .catch((error) => {
        if (host.context?.token === token && generation === narrativeGeneration)
          narrativeProblems.set(noteId, (error as Error).message);
      })
      .finally(() => {
        if (generation === narrativeGeneration) {
          narrativeLoading.delete(noteId);
          renderLiveKnowledge();
        }
      });
  }
  function narrativeFacts(view: NarrativeView) {
    const state = view.state,
      location = state.locationId
        ? (host.sources?.locations.find((row) => row.document.id === state.locationId)?.document
            .name ?? 'Ort nicht verfügbar')
        : 'Ohne Ortsbindung',
      contributors = state.contributors.map(
        (id) =>
          host.data?.roster.find((character) => character.id === id)?.profile.name ??
          'Unbekannte Figur',
      );
    return (
      (state.status === 'closed' ? 'Abgeschlossen' : 'Offen') +
      ' · ' +
      location +
      (contributors.length ? ' · Beteiligte: ' + contributors.join(', ') : '') +
      (state.poolXp ? ' · ' + state.poolXp + ' XP vorgemerkt' : '') +
      (view.award ? ' · Belohnung vergeben' : '')
    );
  }
  function renderLiveKnowledge() {
    const root = host.get('live-knowledge-results'),
      generation = ++renderGeneration,
      owner = ownerGeneration,
      workspace = host.context,
      token = host.context?.token,
      sceneId = host.data?.scene?.id,
      locationId = host.data?.scene?.locationId,
      focusRevision = host.data?.focusRevision,
      ownsContext = () =>
        owner === ownerGeneration &&
        host.context === workspace &&
        host.context?.token === token &&
        host.data?.scene?.id === sceneId &&
        host.data?.scene?.locationId === locationId &&
        host.data?.focusRevision === focusRevision,
      current = () => generation === renderGeneration && ownsContext();
    root.replaceChildren();
    const query = host.value('live-knowledge-search').trim().toLocaleLowerCase('de');
    if (!host.sources) {
      host.get('live-knowledge-result').textContent = host.liveSourcesProblem;
      return;
    }
    const found = findLiveKnowledge(
        (host.sources?.notes ?? []).filter((row) => !row.trashed && row.note.kind !== 'rule'),
        query,
        30,
        (row) => host.preparedNoteIds.has(row.note.id),
      ),
      rows = found.rows;
    host.get('live-knowledge-result').textContent =
      rows.length === found.total
        ? found.total + ' Einträge angezeigt.'
        : rows.length + ' von ' + found.total + ' Einträgen angezeigt – Suche präzisieren.';
    for (const row of rows) {
      const note = row.note,
        card = host.document.createElement('article'),
        heading = host.document.createElement('div'),
        title = host.document.createElement('h4'),
        kind = host.document.createElement('small'),
        actions = host.document.createElement('div');
      heading.className = 'toolbar';
      title.textContent = note.title || 'Unbenannter Eintrag';
      kind.textContent =
        {
          note: 'Notiz',
          npc: 'NSC',
          faction: 'Fraktion',
          quest: 'Quest',
          rumor: 'Gerücht',
          rule: 'Regel',
        }[note.kind] +
        (host.preparedNoteIds.has(note.id) ? ' · Mit aktuellem Besuch verknüpft' : '');
      heading.append(title, kind);
      actions.className = 'toolbar';
      if (note.readAloud) {
        const publicText = host.document.createElement('pre'),
          use = host.document.createElement('button');
        publicText.textContent = note.readAloud;
        publicText.className = 'live-knowledge-public';
        use.type = 'button';
        use.textContent = 'Als Vorlesetext einsetzen';
        use.onclick = () => {
          if (current()) host.useKnowledgeReadAloud(note.readAloud, note.title);
        };
        card.append(heading, publicText);
        actions.append(use);
      } else card.append(heading);
      if (note.kind === 'npc') {
        const portrait = host.document.createElement('button');
        portrait.type = 'button';
        portrait.textContent = 'Porträt zeigen';
        portrait.onclick = () => {
          if (current()) void host.showLiveNpc(note.id, ownsContext);
        };
        actions.append(portrait);
      }
      if (note.kind === 'quest' || note.kind === 'rumor') {
        const status = host.document.createElement('p'),
          open = host.document.createElement('button'),
          view = narrativeCache.get(note.id),
          problem = narrativeProblems.get(note.id);
        status.className = 'caption';
        status.textContent = view
          ? narrativeFacts(view)
          : problem
            ? 'Status nicht verfügbar: ' + problem
            : 'Status wird geladen…';
        open.type = 'button';
        open.textContent = view?.award ? 'Abschluss ansehen' : 'Verwalten / abschließen';
        open.onclick = () => {
          if (current()) void host.openKnowledgeNote(note.id, ownsContext);
        };
        card.append(status);
        actions.append(open);
        if (!view && !problem) loadLiveNarrative(note.id);
      }
      if (note.gmNotes) {
        const details = host.document.createElement('details'),
          summary = host.document.createElement('summary'),
          gm = host.document.createElement('pre');
        summary.textContent = 'GM-Notizen';
        gm.textContent = note.gmNotes;
        details.append(summary, gm);
        card.append(details);
      }
      card.append(actions);
      root.append(card);
    }
    if (!rows.length) {
      const empty = host.document.createElement('p');
      empty.className = 'caption';
      empty.textContent = query
        ? 'Kein vorbereitetes Wissen gefunden.'
        : 'Noch keine NSCs, Fraktionen, Quests oder Gerüchte vorbereitet.';
      root.append(empty);
    }
  }

  function reset() {
    renderGeneration++;
    ownerGeneration++;
    narrativeGeneration++;
    narrativeCache.clear();
    narrativeProblems.clear();
    narrativeLoading.clear();
  }
  function init() {
    host.get('live-knowledge-search').oninput = renderLiveKnowledge;
  }

  return { init, reset, renderLiveKnowledge };
}
