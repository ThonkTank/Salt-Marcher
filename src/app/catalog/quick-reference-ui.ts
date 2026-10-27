import { textReferences } from '../campaign/text-references';
import type { DeskContent, DeskEntry } from '../runtime/scene-desk-contracts';
import { refreshSceneDeskPins } from '../runtime/scene-desk-ui';
import type { Result, WorkspaceGeometry } from '../shared/contracts';
import type { DeskRef } from '../shared/desk-reference';
import { renderCreatureDetail } from './creature-detail-ui';
import { encounterEntryLabel } from './encounter-contracts';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const unwrap = <T>(r: Result<T>) => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
type Kind = 'world' | 'creature' | 'item' | 'encounter' | 'reference';
const kinds: Kind[] = ['world', 'creature', 'item', 'encounter', 'reference'],
  labels: Record<Kind, string> = {
    world: 'Welt und Regeln',
    creature: 'Kreaturen',
    item: 'Gegenstände',
    encounter: 'Begegnungen',
    reference: 'Verknüpfte Begriffe',
  };
export interface QuickReferenceAction {
  kind: 'edit' | 'read-aloud' | 'creature' | 'encounter' | 'source' | 'connections';
  content: DeskContent;
  sceneId: string | null;
  count?: number;
  grouped?: boolean;
}
let searching = false;
let enterIntent: { token: string; search: number; content: number } | null = null;
let workspace: WorkspaceGeometry | null = null,
  searchRequest = 0,
  contentRequest = 0,
  timer: ReturnType<typeof setTimeout> | null = null,
  history: DeskRef[] = [],
  position = -1;
let tell: (s: string, error?: boolean) => void,
  drain: () => Promise<boolean>,
  handoff: (action: QuickReferenceAction) => Promise<void>;
let inspection: { current: () => boolean } | null = null,
  releaseInspection: (() => void) | null = null;
function inspectionCurrent() {
  if (!inspection || inspection.current()) return true;
  close();
  return false;
}
const owned = (token: string, n: number) =>
  workspace?.token === token &&
  contentRequest === n &&
  el<HTMLDialogElement>('quick-reference').open &&
  inspectionCurrent();
function button(
  text: string,
  action: () => Promise<unknown>,
  scope: 'content' | 'search' = 'content',
) {
  const b = node('button', text),
    owner = workspace,
    token = owner?.token,
    campaignId = owner?.campaign.id,
    generation = scope === 'content' ? contentRequest : searchRequest;
  const current = () =>
    workspace === owner &&
    workspace?.token === token &&
    workspace?.campaign.id === campaignId &&
    el<HTMLDialogElement>('quick-reference').open &&
    (scope === 'content' ? contentRequest : searchRequest) === generation &&
    inspectionCurrent();
  b.type = 'button';
  b.onclick = () => {
    if (!b.isConnected || b.disabled || !current()) return;
    b.disabled = true;
    void action()
      .catch((e) => {
        if (current()) tell(e.message, true);
      })
      .finally(() => {
        if (b.isConnected && current()) b.disabled = false;
      });
  };
  return b;
}
function sourceNotice(section: HTMLElement, notice: string | undefined) {
  if (!notice) return;
  let p = section.querySelector<HTMLElement>('.quick-source-notice');
  if (!p) {
    p = node('p');
    p.className = 'quick-source-notice';
    section.append(p);
  }
  p.textContent = notice;
}

function selectedKinds(): Kind[] {
  const k = el<HTMLSelectElement>('quick-kind').value;
  return k === 'all' ? kinds : [k as Kind];
}
function firstResult() {
  return document.querySelector<HTMLButtonElement>('#quick-results button:not(.quick-more)');
}
function fulfillEnter() {
  const intent = enterIntent;
  if (!intent) return;
  if (
    workspace?.token !== intent.token ||
    searchRequest !== intent.search ||
    contentRequest !== intent.content ||
    !el<HTMLDialogElement>('quick-reference').open
  ) {
    enterIntent = null;
    return;
  }
  const first = firstResult();
  if (first) {
    enterIntent = null;
    first.click();
  }
}
function invalidate() {
  enterIntent = null;
  searchRequest++;
  if (timer) clearTimeout(timer);
  el('quick-results').replaceChildren(node('p', 'Suche…'));
  timer = setTimeout(() => {
    timer = null;
    void search();
  }, 180);
}
async function search() {
  const w = workspace;
  if (!w) return;
  const n = ++searchRequest,
    query = el<HTMLInputElement>('quick-search').value,
    selected = selectedKinds(),
    root = el('quick-results');
  root.replaceChildren();
  searching = true;
  el('quick-search-status').textContent = 'Quellen werden gelesen…';
  const current = () =>
    workspace?.token === w.token &&
    n === searchRequest &&
    el<HTMLDialogElement>('quick-reference').open &&
    inspectionCurrent();
  let total = 0,
    incomplete = false;
  const sections = new Map<Kind, HTMLElement>();
  for (const kind of selected) {
    const section = node('section');
    section.append(node('h3', labels[kind]));
    sections.set(kind, section);
    root.append(section);
  }
  await Promise.all(
    selected.map(async (kind) => {
      const section = sections.get(kind)!;
      try {
        const r = unwrap(await window.campaign.searchDesk(w.token, kind, query, 0));
        if (!current()) return;
        total += r.entries.length;
        appendResults(section, r.entries);
        if (!r.entries.length)
          section.append(
            node(
              'p',
              r.notice ? 'Keine verfügbaren Treffer in den lesbaren Quellen.' : 'Keine Treffer.',
            ),
          );
        if (r.notice) {
          incomplete = true;
          sourceNotice(section, r.notice);
        }
        if (r.next !== null) more(section, kind, query, r.next, w.token, n);
        fulfillEnter();
      } catch (e) {
        if (current()) {
          incomplete = true;
          section.append(node('p', (e as Error).message));
        }
      }
    }),
  );
  if (current()) {
    searching = false;
    fulfillEnter();
    if (enterIntent?.search === n) enterIntent = null;
    el('quick-search-status').textContent =
      total +
      ' Treffer geladen' +
      (incomplete ? ' · Quellen unvollständig' : ' · weitere je Quelle nachladen');
  }
}
function appendResults(section: HTMLElement, entries: DeskEntry[]) {
  for (const entry of entries) {
    const b = button(entry.title, () => openContent(entry.ref), 'search');
    b.dataset.refKind = entry.ref.kind;
    b.dataset.refId = entry.ref.id;
    b.append(node('span', entry.label));
    if (entry.preview && 'label' in entry.preview) {
      const p = node('span', entry.preview.label + ' · ' + entry.preview.text);
      p.className = 'desk-search-preview';
      b.append(p);
    }
    section.append(b);
  }
}
function more(
  section: HTMLElement,
  kind: Kind,
  query: string,
  offset: number,
  token: string,
  n: number,
) {
  const b = button(
    'Weitere ' + labels[kind],
    async () => {
      const r = unwrap(await window.campaign.searchDesk(token, kind, query, offset));
      if (
        workspace?.token !== token ||
        searchRequest !== n ||
        !el<HTMLDialogElement>('quick-reference').open ||
        !inspectionCurrent()
      )
        return;
      b.remove();
      appendResults(section, r.entries);
      if (r.notice) {
        sourceNotice(section, r.notice);
        if (!el('quick-search-status').textContent?.includes('unvollständig'))
          el('quick-search-status').textContent += ' · Quellen unvollständig';
      }
      if (r.next !== null) more(section, kind, query, r.next, token, n);
    },
    'search',
  );
  b.className = 'quick-more';
  section.append(b);
}
function historyButtons() {
  el<HTMLButtonElement>('quick-back').disabled = position <= 0;
  el<HTMLButtonElement>('quick-forward').disabled = position < 0 || position >= history.length - 1;
}
async function openContent(ref: DeskRef, remember = true) {
  if (ref.kind === 'location' && ref.sectionId && !inspection) {
    el<HTMLDialogElement>('quick-reference').close();
    document.dispatchEvent(new CustomEvent('atlas-location-request', { detail: ref }));
    return;
  }
  const w = workspace;
  if (!w) return;
  enterIntent = null;
  const n = ++contentRequest,
    root = el('quick-document'),
    loading = node('p', 'Inhalt wird gelesen…');
  root.replaceChildren(loading);
  // Keep the selected target retryable even when its read fails.
  if (remember) {
    history = history.slice(0, position + 1);
    if (history.at(-1)?.kind !== ref.kind || history.at(-1)?.id !== ref.id) history.push(ref);
    position = history.length - 1;
  }
  historyButtons();
  try {
    const c = unwrap(await window.campaign.deskContent(w.token, ref));
    if (!owned(w.token, n)) return;
    root.replaceChildren(
      node('h2', c.title),
      node(
        'p',
        c.label + ' · Revision ' + c.revision + (c.unavailable ? ' · Nicht verfügbar' : ''),
      ),
    );
    const actions = node('div');
    actions.className = 'toolbar';
    if (c.referenceNotice) root.append(node('p', c.referenceNotice));
    let displayedReferences = 0;
    const text = (title: string, value: string, publicText = false) => {
      if (!value) return;
      const section = node('section');
      section.append(node('h3', title));
      const p = node('p');
      let at = 0;
      for (const link of textReferences(value, Math.max(0, 200 - displayedReferences))) {
        displayedReferences++;
        p.append(document.createTextNode(value.slice(at, link.start)));
        const b = button(link.label, () => openContent(link.ref));
        b.className = 'text-reference-inline';
        b.disabled = !!c.links?.find(
          (l) => l.entry.ref.kind === link.ref.kind && l.entry.ref.id === link.ref.id,
        )?.entry.unavailable;
        p.append(b);
        at = link.end;
      }
      p.append(document.createTextNode(value.slice(at)));
      p.className = publicText ? 'quick-read-aloud' : 'quick-text';
      section.append(p);
      root.append(section);
    };
    if (c.note) {
      text('Zum Vorlesen', c.note.readAloud, true);
      text('Notizen für die Spielleitung', c.note.gmNotes);
      if (c.links?.length) {
        const links = node('section');
        links.append(node('h3', 'Verknüpfte Weltinhalte'));
        for (const link of c.links) {
          const b = button(link.label + ' → ' + link.entry.title, () =>
            openContent(link.entry.ref),
          );
          b.disabled = !!link.entry.unavailable;
          links.append(b);
        }
        root.append(links);
      }
    }
    if (c.location) for (const s of c.location.sections) text(s.title, s.markdown);
    if (c.creature) {
      const detail = node('section');
      root.append(detail);
      renderCreatureDetail(detail, c.creature);
    }
    if (c.item) {
      const i = c.item;
      const value =
        i.unitCopper === null
          ? 'Wert offen'
          : BigInt(i.unitCopper) / 100n +
            ',' +
            (BigInt(i.unitCopper) % 100n).toString().padStart(2, '0') +
            ' GM';
      text(
        'Gegenstand',
        i.category +
          ' · ' +
          value +
          (i.weightText ? ' · ' + i.weightText : '') +
          (i.magic ? ' · magisch · ' + i.rarity + ' · Einstimmung ' + i.attunement : ''),
      );
      text('Eigenschaften', i.properties.join(', '));
      text('Beschreibung', i.description);
      text('Quelle', i.source.label + (i.source.license ? '\n' + i.source.license : ''));
    }
    if (c.encounter) {
      text('Begegnung', c.encounter.notes);
      text(
        'Teilnehmer',
        c.encounter.entries.map((e) => encounterEntryLabel(e, c.encounter!.sources)).join('\n'),
      );
    }
    // Contextual inspection remains in its owning editor. Following references,
    // history and search are reads; editing or game handoffs use the normal desk.
    if (inspection) return;
    root.append(actions);
    const fresh = async () => {
      if (!owned(w.token, n)) throw new Error('Lesekontext geändert.');
      const now = unwrap(await window.campaign.deskContent(w.token, ref));
      if (
        !owned(w.token, n) ||
        now.ref.kind !== ref.kind ||
        now.ref.id !== ref.id ||
        now.revision !== c.revision ||
        now.unavailable
      )
        throw new Error('Inhalt geändert oder nicht verfügbar. Erneut ansehen.');
      return now;
    };
    const use = async (
      kind: QuickReferenceAction['kind'],
      sceneId: string | null,
      count?: number,
      grouped?: boolean,
    ) => {
      await fresh();
      if (!(await drain()) || !owned(w.token, n)) return;
      const current = await fresh();
      el<HTMLDialogElement>('quick-reference').close();
      contentRequest++;
      searchRequest++;
      const closedContent = contentRequest,
        closedSearch = searchRequest,
        token = w.token,
        campaignId = w.campaign.id;
      try {
        await handoff({ kind, content: current, sceneId, count, grouped });
      } catch (error) {
        if (
          workspace === w &&
          workspace?.token === token &&
          workspace?.campaign.id === campaignId &&
          contentRequest === closedContent &&
          searchRequest === closedSearch
        )
          tell((error as Error).message, true);
      }
    };
    if (!c.unavailable) {
      actions.append(button('Zusammenhänge dieser Quelle…', () => use('connections', null)));
      if (c.creature || c.item || c.encounter)
        actions.append(
          button(
            c.item
              ? 'Gegenstand im Katalog öffnen…'
              : c.encounter
                ? 'Begegnungsvorlage bearbeiten…'
                : 'Kreatur im Katalog öffnen…',
            () => use('source', null),
          ),
        );
    }
    if (!c.unavailable && (c.note || c.location))
      actions.append(button('Texte und Verweise bearbeiten…', () => use('edit', null)));
    const live = unwrap(await window.campaign.live(w.token));
    if (!owned(w.token, n)) return;
    const scene = live.scene;
    if (!scene || c.unavailable) return;
    const desk = unwrap(await window.campaign.sceneDesk(w.token, scene.id));
    if (!owned(w.token, n)) return;
    let pinned = desk.pins.some((p) => p.ref.kind === ref.kind && p.ref.id === ref.id),
      deskRevision = desk.revision;
    const pin = button('', async () => {
      await fresh();
      const current = unwrap(await window.campaign.live(w.token));
      if (
        !owned(w.token, n) ||
        current.focusId !== scene.id ||
        current.focusRevision !== live.focusRevision
      )
        throw new Error('Fokusgruppe geändert. Inhalt erneut ansehen.');
      const result = unwrap(
        await window.campaign.pinSceneDesk(w.token, scene.id, deskRevision, ref, !pinned),
      );
      if (!owned(w.token, n)) return;
      pinned = result.pins.some((p) => p.ref.kind === ref.kind && p.ref.id === ref.id);
      deskRevision = result.revision;
      pin.textContent = pinLabel();
      await refreshSceneDeskPins(scene.id);
      tell(pinned ? 'Inhalt am Szenentisch angeheftet.' : 'Inhalt vom Szenentisch gelöst.');
    });
    const pinLabel = () =>
      (pinned ? 'Vom Szenentisch lösen: ' : 'Am Szenentisch anheften: ') +
      (scene.title || 'Gruppe');
    pin.textContent = pinLabel();
    pin.id = 'quick-pin';
    actions.append(pin);
    if (c.note?.readAloud.trim()) {
      const b = button('Vorlesetext in „' + (scene.title || 'Gruppe') + '“ übernehmen', () =>
        use('read-aloud', scene.id),
      );
      b.id = 'quick-use-read-aloud';
      actions.append(b);
    }
    if (c.encounter)
      actions.append(
        button('Begegnung am Spieltisch vorbereiten…', () => use('encounter', scene.id)),
      );
    if (c.creature) {
      const count = node('input');
      count.type = 'number';
      count.required = true;
      count.min = '1';
      count.step = '1';
      count.value = '1';
      count.setAttribute('aria-label', 'Anzahl Kreaturen');
      const label = node('label', 'Anzahl ');
      label.append(count);
      const group = node('input');
      group.type = 'checkbox';
      const groupLabel = node('label', ' Gemeinsame Initiative');
      groupLabel.prepend(group);
      groupLabel.className = 'check-label';
      const b = button('Kreaturen am Spieltisch vorbereiten…', async () => {
        if (!count.reportValidity() || !Number.isSafeInteger(Number(count.value))) return;
        await use('creature', scene.id, Number(count.value), group.checked);
      });
      actions.append(label, groupLabel, b);
    }
  } catch (e) {
    if (owned(w.token, n)) {
      loading.remove();
      root.append(node('p', (e as Error).message));
      tell((e as Error).message, true);
    }
  }
}
function reading(value: boolean) {
  el('quick-reference').classList.toggle('quick-reading', value);
  el('quick-show-search').hidden = !value;
}
function close() {
  enterIntent = null;
  searching = false;
  searchRequest++;
  contentRequest++;
  if (timer) clearTimeout(timer);
  timer = null;
  releaseInspection?.();
  releaseInspection = null;
  inspection = null;
  el<HTMLDialogElement>('quick-reference').close();
}
export async function openQuickReference(ref?: DeskRef, stillCurrent = () => true) {
  await openReference(ref, stillCurrent);
}
/** An explicit read from an editor may stack over that editor's own dialog. */
export async function inspectQuickReference(
  ref: DeskRef,
  stillCurrent: () => boolean,
  parent: HTMLDialogElement | null = null,
) {
  await openReference(ref, stillCurrent, { parent });
}
async function openReference(
  ref: DeskRef | undefined,
  stillCurrent: () => boolean,
  scope?: { parent: HTMLDialogElement | null },
) {
  if (!workspace || !stillCurrent()) return;
  const dialog = el<HTMLDialogElement>('quick-reference'),
    token = workspace.token;
  const allowed = () =>
    ![...document.querySelectorAll('dialog')].some(
      (d) => d.open && d !== dialog && d !== scope?.parent,
    );
  const current = () =>
    stillCurrent() &&
    allowed() &&
    (!scope?.parent || (scope.parent.open && scope.parent.isConnected));
  if (!current()) return;
  if (!dialog.open) {
    if (!(await drain()) || workspace?.token !== token || !current()) return;
    dialog.showModal();
  }
  releaseInspection?.();
  releaseInspection = null;
  inspection = scope ? { current } : null;
  if (scope?.parent) {
    const parent = scope.parent;
    parent.addEventListener('close', close);
    releaseInspection = () => parent.removeEventListener('close', close);
  }
  dialog.querySelector('h2')!.textContent = scope ? 'Quelle nachschlagen' : 'GM-Schnellsuche';
  el('quick-close').textContent = scope?.parent ? 'Zurück zur Notiz' : 'Schließen';
  el('quick-hint').textContent = scope
    ? 'Quelle lesen; beim Schließen bleibt die ursprüngliche Notiz geöffnet.'
    : 'Private GM-Referenz. Lesen und Anheften verändern keine Zeit oder Belohnungen. Übergaben an den Spieltisch bestätigst du ausdrücklich.';
  reading(!!ref);
  if (ref) {
    await openContent(ref);
    if (dialog.open && workspace?.token === token && current()) {
      el('quick-document').focus({ preventScroll: true });
      dialog.scrollTop = 0;
      el('quick-document').scrollTop = 0;
    }
  } else {
    el<HTMLInputElement>('quick-search').focus();
    el<HTMLInputElement>('quick-search').select();
    void search();
    if (position >= 0) await openContent(history[position]!, false);
  }
}
export function activateQuickReference(w: WorkspaceGeometry) {
  close();
  reading(false);
  workspace = w;
  history = [];
  position = -1;
  el('quick-document').replaceChildren(node('p', 'Wähle einen Treffer.'));
  el('quick-results').replaceChildren();
  el<HTMLInputElement>('quick-search').value = '';
  el<HTMLSelectElement>('quick-kind').value = 'all';
  el<HTMLButtonElement>('quick-reference-open').disabled = false;
  historyButtons();
}
export function initQuickReference(status: typeof tell, flush: typeof drain, use: typeof handoff) {
  tell = status;
  drain = flush;
  handoff = use;
  const shortcut = node('button', 'Schnellsuche');
  shortcut.id = 'quick-reference-open';
  shortcut.type = 'button';
  shortcut.disabled = true;
  shortcut.title = 'Schnellsuche · Strg+K';
  el('narrative-journal-open').after(shortcut);
  const dialog = node('dialog');
  dialog.id = 'quick-reference';
  dialog.innerHTML =
    '<div class="toolbar"><h2>GM-Schnellsuche</h2><button id="quick-back" type="button" disabled>Zurück</button><button id="quick-forward" type="button" disabled>Vorwärts</button><button id="quick-refresh" type="button">Inhalt aktualisieren</button><button id="quick-show-search" type="button" hidden>Andere Quelle suchen…</button><button id="quick-close" type="button">Schließen</button></div><p id="quick-hint">Private GM-Referenz. Lesen und Anheften verändern keine Zeit oder Belohnungen. Übergaben an den Spieltisch bestätigst du ausdrücklich.</p><div class="quick-columns"><section class="quick-index"><form id="quick-search-form"><label for="quick-search">Inhalte suchen</label><input id="quick-search" type="search" maxlength="1000" placeholder="Name, Ort, Regel oder Beschreibung"><label for="quick-kind">Quellen</label><select id="quick-kind"><option value="all">Alle Quellen</option><option value="world">Welt und Regeln</option><option value="creature">Kreaturen</option><option value="item">Gegenstände</option><option value="encounter">Begegnungen</option><option value="reference">Verknüpfte Begriffe</option></select></form><p id="quick-search-status" role="status"></p><div id="quick-results"></div></section><article id="quick-document" tabindex="-1"><p>Wähle einen Treffer.</p></article></div>';
  document.body.append(dialog);
  const open = () => openQuickReference();
  shortcut.onclick = () => void open().catch((e) => tell(e.message, true));
  el('quick-close').onclick = close;
  el('quick-show-search').onclick = () => {
    reading(false);
    el<HTMLInputElement>('quick-search').focus();
    void search();
  };
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  el('quick-search').oninput = invalidate;
  el('quick-kind').onchange = invalidate;
  el<HTMLFormElement>('quick-search-form').onsubmit = (e) => {
    e.preventDefault();
    if (!workspace || !dialog.open) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
      void search();
    }
    if (searching) {
      enterIntent = { token: workspace.token, search: searchRequest, content: contentRequest };
      fulfillEnter();
    } else firstResult()?.click();
  };
  el('quick-back').onclick = () => {
    if (position > 0) void openContent(history[--position]!, false);
  };
  el('quick-forward').onclick = () => {
    if (position < history.length - 1) void openContent(history[++position]!, false);
  };
  el('quick-refresh').onclick = () => {
    if (position >= 0) void openContent(history[position]!, false);
  };
  document.addEventListener('keydown', (e) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      !e.altKey &&
      e.key.toLowerCase() === 'k' &&
      !e.isComposing &&
      workspace
    ) {
      e.preventDefault();
      void open().catch((error) => tell(error.message, true));
    }
  });
}
