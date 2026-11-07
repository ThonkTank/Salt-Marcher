import { campaignLocalId } from '../../features/campaign/campaign-contracts';
import { rawTextOffset } from '../shared/raw-text-offset';
import type { EditorSession } from '../shared/editor-session';
import { normalizedNoteTitle, type KeyNoteChoices } from './key-note-capture-contracts';
import { appendNoteExcerpt } from './note-excerpt';
import type { Note } from './note-data';
import type { Result } from '../shared/contracts';
import type { PreparationChange } from './preparation-contracts';
interface Host {
  document: Document;
  get: <T extends HTMLElement>(id: string) => T;
  session: EditorSession;
  api: Pick<Window['campaign'], 'keyNoteChoices' | 'deskContent' | 'preparationDraft'>;
  token: () => string | undefined;
  selectedNote: () => string | null;
  selectionGeneration: () => number;
  noteDraft: () => Note | null;
  originalNote: () => Note | undefined;
  hasDraft: (id: string) => boolean;
  blocked: () => boolean;
  flush: () => Promise<boolean>;
  change: (change: PreparationChange, redraw: boolean, current: () => boolean) => Promise<boolean>;
  confirmed: () => void;
  openNote: (id: string) => Promise<unknown>;
}
/** Owns the complete excerpt interaction: raw source selection, search generation,
 * destination choice and modal confirmation. Persistence stays in the shared writer. */
export function createPreparationExcerptEditor(host: Host) {
  const { document, get, session: editorSession } = host;
  const value = (id: string) => get<HTMLInputElement>(id).value;
  const unwrap = <T>(result: Result<T>): T => {
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
  let excerptField: 'readAloud' | 'gmNotes' | null = null;
  let excerpt: {
    source: import('./preparation-contracts').NoteExcerptSource;
    original: Note;
    text: string;
    token: string;
    load: number;
    selection: number;
  } | null = null;
  let excerptBusy = false,
    excerptComposing = false;
  let excerptChosen: Note | null = null,
    excerptExplicitNew = false,
    excerptLookup = 0,
    excerptReading = false;
  let excerptChoices: KeyNoteChoices = { entries: [], more: false };
  function excerptCurrent(input: NonNullable<typeof excerpt>) {
    return (
      excerpt === input &&
      host.selectionGeneration() === input.selection &&
      editorSession.status.attached &&
      host.token() === input.token &&
      editorSession.generation === input.load &&
      host.selectedNote() === input.source.id
    );
  }
  function excerptControls() {
    const chosen = excerptChosen;
    get<HTMLInputElement>('note-excerpt-title').readOnly = !!chosen;
    get<HTMLSelectElement>('note-excerpt-kind').disabled = !!chosen;
    get('note-excerpt-new-kind').hidden = !!chosen;
    get<HTMLButtonElement>('note-excerpt-new').hidden = !chosen && !excerptChoices.entries.length;
    get<HTMLButtonElement>('note-excerpt-save').disabled = excerptReading;
    for (const button of get('note-excerpt-choices').querySelectorAll('button'))
      button.disabled = excerptReading;
    get('note-excerpt-save').textContent = chosen
      ? 'An vorhandene Notiz anhängen'
      : 'Notiz mit Herkunft anlegen';
    get('note-excerpt-text-label').textContent = chosen
      ? 'Wird am bisherigen Text angehängt'
      : 'Markierter Originaltext';
    get('note-excerpt-existing').hidden = !chosen;
    get('note-excerpt-existing-text').textContent = chosen
      ? chosen[excerpt!.source.field] || 'Noch kein Text in diesem Feld.'
      : '';
    if (excerpt)
      get<HTMLTextAreaElement>('note-excerpt-text').value = chosen
        ? appendNoteExcerpt(
            { ...chosen, readAloud: '', gmNotes: '' },
            excerpt.original,
            excerpt.source.field,
            excerpt.text,
          )[excerpt.source.field]
        : excerpt.text;
  }
  async function lookupExcerpt() {
    const input = excerpt,
      query = value('note-excerpt-title'),
      seq = ++excerptLookup;
    excerptChosen = null;
    excerptExplicitNew = false;
    excerptReading = false;
    excerptChoices = { entries: [], more: false };
    get('note-excerpt-choices').replaceChildren();
    excerptControls();
    if (!input || !query.trim()) {
      get('note-excerpt-choices-status').textContent =
        'Name eingeben, um vorhandene Originalnotizen zu finden.';
      return true;
    }
    get('note-excerpt-choices-status').textContent = 'Vorhandene Originalnotizen werden gesucht…';
    const current = () =>
      excerptCurrent(input) && seq === excerptLookup && query === value('note-excerpt-title');
    try {
      const choices = unwrap(await host.api.keyNoteChoices(input.token, query));
      if (!current()) return false;
      excerptChoices = choices;
      get('note-excerpt-choices-status').textContent =
        choices.notice ??
        (excerptChoices.entries.length
          ? 'Vorhandenes Original wählen oder ausdrücklich eine eigenständige neue Notiz anlegen.'
          : 'Keine passende vorhandene Notiz.');
      if (choices.more)
        get('note-excerpt-choices-status').append(' Weitere Treffer: Namen genauer eingeben.');
      for (const candidate of excerptChoices.entries) {
        if (candidate.id === input.source.id) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.noteId = candidate.id;
        button.textContent =
          candidate.title +
          ' · ' +
          {
            note: 'Notiz',
            npc: 'NSC',
            faction: 'Fraktion',
            quest: 'Quest',
            rumor: 'Gerücht',
            rule: 'Regelreferenz',
          }[candidate.kind] +
          (candidate.preview ? ' · ' + candidate.preview : '');
        button.onclick = () => {
          void (async () => {
            if (excerptBusy || excerptReading || !current()) return;
            excerptReading = true;
            excerptControls();
            try {
              const [content, pendingDraft] = await Promise.all([
                host.api.deskContent(input.token, { kind: 'note', id: candidate.id }),
                host.api.preparationDraft(input.token, 'note', candidate.id),
              ]);
              const original = unwrap(content),
                note = original.note,
                draft = unwrap(pendingDraft);
              if (!current()) return;
              if (
                original.unavailable ||
                original.ref.kind !== 'note' ||
                original.ref.id !== candidate.id ||
                !note ||
                note.id !== candidate.id ||
                original.revision !== candidate.revision ||
                note.revision !== candidate.revision
              )
                throw Error('Original wurde geändert. Namen erneut eingeben und Auswahl prüfen.');
              if (draft || host.hasDraft(candidate.id))
                throw Error(
                  'Dieses Original hat einen offenen Arbeitsentwurf. Erst im Originaleditor aufklären.',
                );
              excerptChosen = structuredClone(note);
              get<HTMLInputElement>('note-excerpt-title').value = note.title;
              get<HTMLSelectElement>('note-excerpt-kind').value = note.kind;
              get('note-excerpt-choices').replaceChildren();
              get('note-excerpt-choices-status').textContent =
                'Vorhandenes Original: ' +
                note.title +
                ' · frühere Texte und Verwendungen bleiben erhalten.';
            } catch (error) {
              if (current())
                get('note-excerpt-choices-status').textContent = (error as Error).message;
            } finally {
              if (excerptCurrent(input) && seq === excerptLookup) {
                excerptReading = false;
                excerptControls();
              }
            }
          })();
        };
        get('note-excerpt-choices').append(button);
      }
      excerptControls();
      return true;
    } catch (error) {
      if (current())
        get('note-excerpt-choices-status').textContent =
          'Suche fehlgeschlagen: ' + (error as Error).message;
      return false;
    }
  }
  function init() {
    for (const [id, field] of [
      ['note-read-aloud', 'readAloud'],
      ['note-gm', 'gmNotes'],
    ] as const) {
      const area = get<HTMLTextAreaElement>(id);
      const selectionChanged = () => {
        excerptField = field;
        // Keep the action next to the selected field, including inside read-aloud.
        area.after(get('note-selection-actions'));
        get('note-excerpt').hidden = !area.value
          .slice(area.selectionStart, area.selectionEnd)
          .trim();
      };
      for (const event of ['focus', 'select', 'keyup', 'mouseup', 'input'])
        area.addEventListener(event, selectionChanged);
    }
    get('note-excerpt').onclick = () => {
      void (async () => {
        const field = excerptField ?? 'gmNotes',
          area = get<HTMLTextAreaElement>(field === 'gmNotes' ? 'note-gm' : 'note-read-aloud'),
          before = host.noteDraft();
        if (!before || host.blocked() || excerptBusy) return;
        const start = rawTextOffset(before[field], area.selectionStart),
          end = rawTextOffset(before[field], area.selectionEnd),
          text = before[field].slice(start, end);
        if (!text.trim()) {
          get('note-excerpt-status').textContent =
            'Markiere zuerst den gewünschten Text unter „Zum Vorlesen“ oder „Notizen für die Spielleitung“.';
          area.focus();
          return;
        }
        const token = host.token(),
          load = editorSession.generation,
          edit = editorSession.input.version,
          selection = host.selectionGeneration();
        if (
          !(await host.flush()) ||
          host.token() !== token ||
          editorSession.generation !== load ||
          host.selectionGeneration() !== selection ||
          host.selectedNote() !== before.id ||
          editorSession.input.version !== edit
        )
          return;
        const source = host.originalNote();
        if (!source || source[field].slice(start, end) !== text) return;
        excerpt = {
          source: { id: source.id, revision: source.revision, field, start, end },
          original: source,
          text,
          token: token!,
          load,
          selection,
        };
        get('note-excerpt-origin').textContent =
          'Quelle: ' +
          source.title +
          ' · ' +
          (field === 'gmNotes' ? 'privater GM-Text' : 'Text zum Vorlesen');
        get<HTMLInputElement>('note-excerpt-title').value = '';
        get<HTMLSelectElement>('note-excerpt-kind').value = 'note';
        get<HTMLTextAreaElement>('note-excerpt-text').value = text;
        excerptComposing = false;
        get<HTMLDetailsElement>('note-excerpt-existing').open = false;
        void lookupExcerpt();
        get<HTMLDialogElement>('note-excerpt-dialog').showModal();
        get('note-excerpt-title').focus();
      })();
    };
    get('note-excerpt-cancel').onclick = () => {
      if (!excerptBusy) {
        get<HTMLDialogElement>('note-excerpt-dialog').close();
        excerpt = null;
      }
    };
    get('note-excerpt-dialog').addEventListener('cancel', (event) => {
      if (excerptBusy) event.preventDefault();
      else excerpt = null;
    });
    get('note-excerpt-title').oninput = () => {
      if (!excerptBusy) void lookupExcerpt();
    };
    get('note-excerpt-form').addEventListener('compositionstart', () => {
      excerptComposing = true;
    });
    get('note-excerpt-form').addEventListener('compositionend', () => {
      excerptComposing = false;
    });
    get('note-excerpt-new').onclick = () => {
      if (excerptBusy || excerptReading) return;
      excerptChosen = null;
      excerptExplicitNew = true;
      get('note-excerpt-choices-status').textContent =
        'Eigenständige neue Notiz gewählt. Vorhandene Originale bleiben getrennt.';
      excerptControls();
    };
    get('note-excerpt-form').onsubmit = (event) => {
      event.preventDefault();
      void (async () => {
        const input = excerpt;
        if (
          !input ||
          excerptBusy ||
          excerptReading ||
          excerptComposing ||
          host.blocked() ||
          !value('note-excerpt-title').trim()
        )
          return;
        const current = () => excerptCurrent(input);
        if (!current()) return;
        excerptBusy = true;
        get('note-excerpt-form').inert = true;
        try {
          if (!excerptChosen) {
            const title = value('note-excerpt-title'),
              explicit = excerptExplicitNew;
            if (!(await lookupExcerpt()) || !current() || title !== value('note-excerpt-title'))
              return;
            excerptExplicitNew = explicit;
            if (
              !explicit &&
              excerptChoices.entries.some(
                (n) => normalizedNoteTitle(n.title) === normalizedNoteTitle(title),
              )
            ) {
              get('note-excerpt-choices-status').textContent =
                'Diesen Namen gibt es bereits. Original wählen oder ausdrücklich eigenständig neu anlegen.';
              return;
            }
          }
          const chosen = excerptChosen;
          const note: Note = chosen
            ? appendNoteExcerpt(chosen, input.original, input.source.field, input.text)
            : {
                version: 1,
                id: campaignLocalId(crypto.randomUUID()),
                revision: 1,
                kind: value('note-excerpt-kind') as Note['kind'],
                title: value('note-excerpt-title'),
                readAloud: input.source.field === 'readAloud' ? input.text : '',
                gmNotes: input.source.field === 'gmNotes' ? input.text : '',
                relations: [{ targetId: campaignLocalId(input.source.id), label: 'Quelle' }],
                creatureId: null,
                deleted: false,
              };
          const saved = await host.change(
            {
              kind: 'note',
              expectedRevision: chosen?.revision ?? null,
              note,
              excerpt: { ...input.source, ...(excerptExplicitNew ? { allowSameTitle: true } : {}) },
            },
            false,
            current,
          );
          if (!current()) return;
          // An unconfirmed request is resolved through the existing preparation
          // controls, outside the modal. Never resend it automatically.
          get<HTMLDialogElement>('note-excerpt-dialog').close();
          excerpt = null;
          if (!saved) return;
          host.confirmed();
          const status = get('note-excerpt-status');
          status.replaceChildren(
            document.createTextNode(
              '„' +
                note.title +
                '“ ' +
                (chosen ? 'ergänzt' : 'angelegt') +
                ' · Herkunft und Auszug verknüpft. ',
            ),
          );
          const open = document.createElement('button');
          open.type = 'button';
          open.textContent = chosen ? 'Originalnotiz öffnen' : 'Neue Notiz öffnen';
          open.onclick = () => {
            if (host.token() === input.token) void host.openNote(note.id);
          };
          status.append(open);
          const area = get<HTMLTextAreaElement>(
            input.source.field === 'gmNotes' ? 'note-gm' : 'note-read-aloud',
          );
          area.focus();
          const end = host
            .noteDraft()!
            [input.source.field].slice(0, input.source.end)
            .replace(/\r\n?/g, '\n').length;
          area.setSelectionRange(end, end);
        } finally {
          excerptBusy = false;
          get('note-excerpt-form').inert = false;
        }
      })();
    };
  }

  function reset() {
    excerpt = null;
    excerptField = null;
    excerptLookup++;
    get<HTMLDialogElement>('note-excerpt-dialog').close();
  }
  function selectionChanged(disabled: boolean) {
    get<HTMLButtonElement>('note-excerpt').disabled = disabled;
    excerptField = null;
    get('note-excerpt-status').replaceChildren();
    get('note-excerpt').hidden = true;
    get('note-gm').after(get('note-selection-actions'));
  }
  editorSession.onDeactivate(reset);
  return { init, reset, selectionChanged };
}
