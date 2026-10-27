import type { LiveMomentCategory } from '../runtime/live-moment-drafts';
import type { DeskRef } from '../shared/desk-reference';
import { markdownView } from '../shared/markdown-view';
import { PacketNoteEditor, type PreparationPacketEditor } from './packet-note-editor';
import { packetReadingBlocks } from './packet-reading-blocks';
import type { SessionPacket } from './session-packet-contracts';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
export interface LivePacketSource {
  sceneId: string;
  token: string;
  planId: string;
  visitId: string | null;
  key: string;
  current: () => boolean;
  flush: () => Promise<boolean>;
  openVisit: (id: string) => Promise<void>;
  readAloud: (text: string, title: string, current?: () => boolean) => Promise<void>;
  openReference?: (ref: DeskRef, current?: () => boolean) => Promise<void>;
  prepareEncounter?: (
    groupId: string,
    visitId: string,
    groupRevision: number,
    current?: () => boolean,
  ) => Promise<void>;
  openReward?: (visitId: string, current?: () => boolean) => Promise<void>;
  captureMoment?: (
    category: LiveMomentCategory,
    title: string,
    summary: string,
    current?: () => boolean,
  ) => Promise<void>;
}
type PacketSource = {
  noteEditor?: PreparationPacketEditor;
  sceneId?: string;
  token: string;
  planId: string;
  key: string;
  current: () => boolean;
  flush: () => Promise<boolean>;
  visitId?: string | null;
  openVisit?: (id: string) => Promise<void>;
  readAloud?: (text: string, title: string, current?: () => boolean) => Promise<void>;
  openReference?: (ref: DeskRef, current?: () => boolean) => Promise<void>;
  prepareEncounter?: (
    groupId: string,
    visitId: string,
    groupRevision: number,
    current?: () => boolean,
  ) => Promise<void>;
  openReward?: (visitId: string, current?: () => boolean) => Promise<void>;
  captureMoment?: (
    category: LiveMomentCategory,
    title: string,
    summary: string,
    current?: () => boolean,
  ) => Promise<void>;
};
let preparationEditor: (() => PreparationPacketEditor) | null = null,
  packetEditor: PacketNoteEditor | null = null;
export function registerPreparationPacketEditor(editor: () => PreparationPacketEditor) {
  preparationEditor = editor;
}
export function packetNoteFeedback(text: string, error = false) {
  packetEditor?.feedback(text, error);
}
let packet: SessionPacket | null = null,
  source: PacketSource | null = null,
  liveSource: LivePacketSource | null = null,
  request = 0,
  selected: string | null = null,
  docked = false,
  surface = 'atlas',
  partyWasHidden = false;
let openPreparationPacket: (visitId?: string) => Promise<boolean> = async () => false;

let loadPacket: (next?: PacketSource) => Promise<boolean>;
export function closeSessionPacket() {
  request++;
  packetEditor?.reset();
  packet = null;
  source = null;
  const d = document.getElementById('session-packet-dialog') as HTMLDialogElement | null;
  if (d?.open) d.close();
  if (docked) {
    docked = false;
    const host = el('live-packet-host');
    host.hidden = true;
    el('live-workspace').classList.remove('packet-at-desk');
    el('live').classList.remove('packet-at-desk');
    el('live-party-panel').hidden = partyWasHidden;
    if (d) {
      document.body.append(d);
      d.classList.remove('packet-docked');
      d.removeAttribute('role');
    }
    el('session-packet-party-toggle').hidden = true;
  }
}
export function closePreparationPacket() {
  if (!docked) closeSessionPacket();
}
export function setSessionPacketSurface(tab: string) {
  surface = tab;
  if (docked && tab === 'live' && liveSource) void loadPacket(liveSource);
}
export function syncLiveSessionPacket(next: LivePacketSource | null) {
  const changed = next?.key !== liveSource?.key;
  liveSource = next;
  if (!docked) return;
  if (!next) {
    closeSessionPacket();
    return;
  }
  if (changed) {
    if (
      source?.sceneId !== next.sceneId ||
      source?.planId !== next.planId ||
      source?.token !== next.token ||
      source?.visitId !== next.visitId
    ) {
      selected = next.visitId;
      packet = null;
      el('session-packet-content').replaceChildren();
      el('session-packet-visits').replaceChildren();
      el<HTMLInputElement>('session-packet-search').value = '';
    }
    if (surface === 'live') void loadPacket(next);
    else {
      request++;
      source = next;
    }
  }
}
export async function openLiveSessionPacket(next: LivePacketSource) {
  liveSource = next;
  const dialog = el<HTMLDialogElement>('session-packet-dialog');
  if (dialog.open) dialog.close();
  if (!docked) {
    partyWasHidden = el('live-party-panel').hidden;
    el('live-party-panel').hidden = true;
  }
  docked = true;
  source = next;
  selected = next.visitId;
  el<HTMLInputElement>('session-packet-search').value = '';
  el<HTMLDetailsElement>('session-packet-index').open = window.innerWidth > 750;
  el('live-packet-host').hidden = false;
  el('live-packet-host').append(dialog);
  el('live-workspace').classList.add('packet-at-desk');
  el('live').classList.add('packet-at-desk');
  dialog.classList.add('packet-docked');
  dialog.setAttribute('role', 'region');
  dialog.open = true;
  el('session-packet-party-toggle').hidden = false;
  el('session-packet-party-toggle').setAttribute('aria-pressed', 'false');
  await loadPacket(next);
}
export async function openPreparationSessionPacket(visitId?: string) {
  return openPreparationPacket(visitId);
}
export function initSessionPacket(
  tell: (s: string, e?: boolean) => void,
  owner: () => { token: string; planId: string; visitId?: string | null } | null,
  flush: () => Promise<boolean>,
  offerVisit?: (planId: string, visitId: string, current: () => boolean) => Promise<void>,
) {
  const bar = document.createElement('div');
  bar.className = 'toolbar';
  bar.innerHTML = '<button id="session-packet-open" type="button">Spielabendmappe öffnen…</button>';
  el('plan-name').after(bar);
  const workspace = el('live-workspace');
  const host = document.createElement('section');
  host.id = 'live-packet-host';
  host.hidden = true;
  workspace.append(host);
  const dialog = document.createElement('dialog');
  dialog.id = 'session-packet-dialog';
  dialog.innerHTML =
    '<div class="toolbar packet-heading"><h2>GM-Spielabendmappe</h2><button id="session-packet-party-toggle" type="button" hidden aria-pressed="false">Party-Bearbeitung anzeigen</button><button id="session-packet-refresh" type="button">Aktualisieren</button><button id="session-packet-export" type="button" disabled>Als Markdown speichern…</button><button id="session-packet-close" type="button">Schließen</button></div><p id="session-packet-summary"></p><div id="session-packet-warnings"></div><div class="session-packet-columns"><details id="session-packet-index" class="packet-index" open><summary>Besuche und Suche</summary><label for="session-packet-search">In der Mappe suchen</label><input id="session-packet-search" type="search" placeholder="Ort, Figur, Aktion oder Notiz"><div class="toolbar"><button id="session-packet-prev" type="button">Voriger Besuch</button><button id="session-packet-next" type="button">Nächster Besuch</button><span id="session-packet-count"></span></div><p id="session-packet-filter-current" role="status" hidden></p><div id="session-packet-visits"></div></details><article id="session-packet-content"></article></div>';
  document.body.append(dialog);
  const updateEditorControls = () => {
    const active = !!packetEditor?.active,
      busy = !!packetEditor?.busy;
    el<HTMLButtonElement>('session-packet-refresh').disabled = active;
    el<HTMLButtonElement>('session-packet-export').disabled = active || !packet;
    el<HTMLButtonElement>('session-packet-close').disabled = busy;
  };
  packetEditor = new PacketNoteEditor(
    dialog.querySelector<HTMLElement>('.session-packet-columns')!,
    el('session-packet-content'),
    updateEditorControls,
  );
  dialog.append(packetEditor.host);
  const same = (o: PacketSource) => source === o && o.current();
  const preparationSource = (): PacketSource | null => {
    const o = owner();
    if (!o) return null;
    const current = () => {
      const n = owner();
      return n?.token === o.token && n.planId === o.planId && n.visitId === o.visitId;
    };
    return {
      ...o,
      ...(preparationEditor ? { noteEditor: preparationEditor() } : {}),
      key: o.token + ':' + o.planId,
      current,
      flush,
      ...(offerVisit ? { openVisit: (id: string) => offerVisit(o.planId, id, current) } : {}),
    };
  };
  const act = (fn: () => Promise<void>) => void fn().catch((e) => tell(e.message, true));
  const matches = () => {
    const term = el<HTMLInputElement>('session-packet-search').value.toLocaleLowerCase();
    return (
      packet?.visits.filter((v) =>
        [v.title, v.location ?? '', ...v.blocks.flatMap((b) => [b.heading, b.text])].some((t) =>
          t.toLocaleLowerCase().includes(term),
        ),
      ) ?? []
    );
  };
  function visit(id: string) {
    selected = id;
    const v = packet?.visits.find((v) => v.id === id),
      root = el('session-packet-content'),
      notice = el('session-packet-filter-current');
    root.replaceChildren();
    notice.hidden = !v || matches().some((row) => row.id === id);
    notice.textContent = notice.hidden
      ? ''
      : 'Der angezeigte Besuch passt nach der Aktualisierung nicht mehr zur Suche.';
    if (!v) return;
    for (const b of el('session-packet-visits').querySelectorAll('button'))
      b.setAttribute('aria-pressed', String(b.dataset.visitId === id));
    const header = document.createElement('div');
    header.className = 'toolbar';
    const h = document.createElement('h3');
    h.textContent = v.title;
    header.append(h);
    const captured = source,
      viewed = packet,
      version = request;
    const current = () =>
      header.isConnected &&
      selected === id &&
      !!captured &&
      same(captured) &&
      packet === viewed &&
      request === version;
    const invoke = (button: HTMLButtonElement, fn: () => Promise<void>) => {
      if (!button.isConnected || button.disabled || !current() || (docked && surface !== 'live'))
        return;
      void fn().catch((e) => {
        if (current()) tell(e.message, true);
      });
    };
    if (captured?.openVisit) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = captured.sceneId
        ? captured.visitId === id
          ? 'Besuch erneut übernehmen…'
          : 'Besuch übernehmen…'
        : 'Am Spieltisch prüfen…';
      b.onclick = () =>
        invoke(b, async () => {
          if (current()) await captured!.openVisit!(id);
        });
      header.append(b);
    }
    root.append(header);
    const location = document.createElement('p');
    location.className = 'caption';
    location.textContent = v.location ?? 'Ohne Ortsbindung';
    root.append(location);
    const blocks = packetReadingBlocks(v.blocks);
    if (v.locationId && captured?.openReference) {
      const ref = { kind: 'location' as const, id: v.locationId },
        b = document.createElement('button');
      b.type = 'button';
      b.className = 'packet-location-action';
      b.textContent = 'Ort in der Ortsmappe öffnen…';
      b.onclick = () =>
        invoke(b, async () => {
          if (current()) await captured!.openReference!(ref, current);
        });
      location.append(' ', b);
    }
    if (!blocks.length) {
      const p = document.createElement('p');
      p.textContent =
        'Dieser Besuch hat noch keine vorbereiteten Texte, Begegnungen oder Belohnungen.';
      root.append(p);
    } else {
      const runway = document.createElement('details'),
        runwaySummary = document.createElement('summary'),
        steps = document.createElement('div');
      runway.className = 'packet-runway';
      runway.open = true;
      runwaySummary.textContent =
        'Ablauf dieses Besuchs · ' +
        blocks.length +
        (blocks.length === 1 ? ' Abschnitt' : ' Abschnitte');
      steps.className = 'packet-runway-steps';
      for (const [blockIndex, block] of blocks.entries()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = blockIndex + 1 + '. ' + block.heading;
        button.onclick = () =>
          invoke(button, async () => {
            const target = root.querySelector<HTMLElement>(
              '[data-packet-block-index="' + blockIndex + '"]',
            );
            target?.scrollIntoView({ block: 'start' });
            target?.focus({ preventScroll: true });
          });
        steps.append(button);
      }
      runway.append(runwaySummary, steps);
      root.append(runway);
    }
    for (const [blockIndex, block] of blocks.entries()) {
      const section = document.createElement('section');
      section.className = 'packet-block packet-' + (block.parts ? 'note' : block.kind);
      section.dataset.packetBlockIndex = String(blockIndex);
      section.tabIndex = -1;
      const h = document.createElement('h4');
      h.textContent = block.heading;
      section.append(h);
      for (const part of block.parts ?? [block]) {
        const body = block.parts ? document.createElement('div') : section;
        if (block.parts) {
          body.className = 'packet-part packet-' + part.kind;
          const label = document.createElement('h5'),
            at = part.heading.lastIndexOf(' · ');
          label.textContent =
            part.kind === 'read-aloud'
              ? 'Zum Vorlesen'
              : 'GM · ' + (at < 0 ? part.heading : part.heading.slice(at + 3));
          body.append(label);
        }
        const p = document.createElement('div');
        p.className = 'packet-text';
        p.append(markdownView(part.text || 'Keine Notizen.', 4));
        body.append(p);
        if (part.kind === 'read-aloud' && captured?.readAloud) {
          const text = part.text,
            heading = part.heading,
            b = document.createElement('button');
          b.type = 'button';
          b.className = 'packet-use-read-aloud';
          b.textContent = 'Vorlesetext in Szene übernehmen';
          b.onclick = () =>
            invoke(b, async () => {
              if (current()) await captured!.readAloud!(text, heading, current);
            });
          body.append(b);
        }
        if (captured?.captureMoment) {
          const heading = part.heading,
            text = part.text,
            b = document.createElement('button'),
            category: LiveMomentCategory =
              part.kind === 'encounter'
                ? 'combat'
                : part.kind === 'reward'
                  ? 'reward'
                  : part.kind === 'reference'
                    ? 'narrative'
                    : 'world';
          b.type = 'button';
          b.className = 'packet-block-action';
          b.textContent = 'Als Chronikmoment vormerken';
          b.onclick = () =>
            invoke(b, async () => {
              if (current()) await captured!.captureMoment!(category, heading, text, current);
            });
          body.append(b);
        }
        if (block.parts) section.append(body);
      }
      const action = structuredClone(block.action);
      if (
        action &&
        captured &&
        !(
          action.kind === 'reference' &&
          action.ref.kind === 'location' &&
          action.ref.id === v.locationId &&
          captured.openReference
        )
      ) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'packet-block-action';
        if (action.kind === 'reference' && captured.openReference) {
          b.textContent =
            action.ref.kind === 'location' ? 'Ort in der Ortsmappe öffnen…' : 'Quelle öffnen…';
          b.onclick = () =>
            invoke(b, async () => {
              if (current()) await captured!.openReference!(action.ref, current);
            });
          section.append(b);
        } else if (
          action.kind === 'reference' &&
          action.ref.kind === 'note' &&
          captured.noteEditor
        ) {
          b.textContent = 'Original bearbeiten…';
          b.onclick = () =>
            invoke(b, async () => {
              if (current() && !packetEditor?.active)
                await packetEditor!.open(action.ref.id, {
                  current,
                  ownerCurrent: () => same(captured),
                  editor: captured.noteEditor!,
                  hint: el<HTMLInputElement>('session-packet-search').value,
                  refresh: () => (same(captured) ? loadPacket() : Promise.resolve(false)),
                });
            });
          const tools = document.createElement('div');
          tools.className = 'packet-source-actions';
          tools.append(b);
          section.append(tools);
        } else if (action.kind === 'encounter' && captured.prepareEncounter) {
          b.disabled = !Number.isSafeInteger(action.groupRevision) || action.groupRevision! < 1;
          b.textContent = b.disabled
            ? 'Begegnungsquelle aktualisieren…'
            : 'Begegnung mit dieser Gruppe vorbereiten';
          b.onclick = () =>
            invoke(b, async () => {
              if (
                current() &&
                Number.isSafeInteger(action.groupRevision) &&
                action.groupRevision! > 0
              )
                await captured!.prepareEncounter!(
                  action.groupId,
                  v.id,
                  action.groupRevision!,
                  current,
                );
            });
          section.append(b);
        } else if (action.kind === 'reward' && captured.openReward) {
          b.textContent = 'Belohnung dieses Besuchs verwalten…';
          b.onclick = () =>
            invoke(b, async () => {
              if (current()) await captured!.openReward!(v.id, current);
            });
          section.append(b);
        }
      }

      root.append(section);
    }
    const rows = matches(),
      index = rows.findIndex((v) => v.id === id);
    el<HTMLButtonElement>('session-packet-prev').disabled = index <= 0;
    el<HTMLButtonElement>('session-packet-next').disabled = index < 0 || index >= rows.length - 1;
    root.scrollTop = 0;
  }
  function draw(keepSelection = false) {
    const root = el('session-packet-visits');
    root.replaceChildren();
    if (!packet) return;
    const rows = matches();
    el('session-packet-count').textContent =
      rows.length + ' von ' + packet.visits.length + ' Besuchen';
    for (const v of rows) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.visitId = v.id;
      b.textContent =
        packet.visits.indexOf(v) +
        1 +
        '. ' +
        v.title +
        (source?.sceneId && source.visitId === v.id ? ' · aktuelle Übernahme' : '');
      b.onclick = () => {
        if (b.isConnected && !packetEditor?.active && source?.current()) visit(v.id);
      };
      root.append(b);
    }
    visit(
      rows.some((v) => v.id === selected) ||
        (keepSelection && packet.visits.some((v) => v.id === selected))
        ? selected!
        : (rows[0]?.id ?? ''),
    );
  }
  loadPacket = async (next?: PacketSource) => {
    if (next) source = next;
    const o = source,
      n = ++request;
    if (!o) return false;
    const oldSelected = selected,
      oldScroll = el('session-packet-content').scrollTop;
    packet = null;
    for (const id of ['content', 'visits', 'warnings', 'count'])
      el('session-packet-' + id).replaceChildren();
    el<HTMLButtonElement>('session-packet-export').disabled = true;
    dialog.setAttribute('aria-busy', 'true');
    el('session-packet-summary').textContent = 'Spielabendmappe wird zusammengestellt…';
    try {
      if (!(await o.flush())) {
        if (n === request && same(o))
          el('session-packet-summary').textContent =
            'Eingaben zuerst speichern; danach die Mappe erneut öffnen oder aktualisieren.';
        return false;
      }
      if (n !== request || !same(o)) return false;
      if (!docked && !dialog.open) dialog.showModal();
      el('session-packet-summary').textContent = 'Spielabendmappe wird zusammengestellt…';
      const r = await window.campaign.sessionPacket(o.token, o.planId);
      if (n !== request || !same(o)) return false;
      if (!r.ok) throw new Error(r.error);
      if (r.value.planId !== o.planId)
        throw new Error('Spielabendmappe gehört zu einem anderen Plan.');
      packet = r.value;
      el('session-packet-summary').textContent =
        (packet.planName || 'Unbenannter Spielabend') +
        ' · ' +
        packet.campaignName +
        ' · ' +
        packet.visits.length +
        ' Besuche · Planungsparty: ' +
        (packet.party.join(' · ') || 'keine Vorgabe');
      const warnings = el('session-packet-warnings');
      warnings.replaceChildren();
      for (const text of packet.warnings) {
        const p = document.createElement('p');
        p.textContent = text;
        warnings.append(p);
      }
      draw(true);
      if (selected === oldSelected) el('session-packet-content').scrollTop = oldScroll;
      el<HTMLButtonElement>('session-packet-export').disabled = false;
      return true;
    } catch (error) {
      if (n === request && same(o)) {
        packet = null;
        el('session-packet-content').replaceChildren();
        el('session-packet-visits').replaceChildren();
        el('session-packet-summary').textContent = (error as Error).message;
        tell((error as Error).message, true);
      }
      return false;
    } finally {
      if (n === request) dialog.setAttribute('aria-busy', 'false');
    }
  };
  openPreparationPacket = async (visitId) => {
    closeSessionPacket();
    el<HTMLDetailsElement>('session-packet-index').open = window.innerWidth > 750;
    el<HTMLInputElement>('session-packet-search').value = '';
    const o = preparationSource();
    if (!o) return false;
    selected = visitId ?? o.visitId ?? null;
    const loaded = await loadPacket(o);
    return loaded && (!visitId || !!packet?.visits.some((visit) => visit.id === visitId));
  };
  el('session-packet-open').onclick = () =>
    act(async () => {
      await openPreparationPacket();
    });
  el('session-packet-refresh').onclick = () => {
    if (!packetEditor?.active)
      act(async () => {
        await loadPacket();
      });
  };
  const close = () =>
    act(async () => {
      if (!packetEditor?.active || (await packetEditor.leave(false))) closeSessionPacket();
    });
  el('session-packet-close').onclick = close;
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  el('session-packet-search').oninput = () => {
    if (!packetEditor?.active) draw();
  };
  for (const [id, delta] of [
    ['session-packet-prev', -1],
    ['session-packet-next', 1],
  ] as const)
    el(id).onclick = () => {
      if (packetEditor?.active) return;
      const rows = matches(),
        index = rows.findIndex((v) => v.id === selected),
        next = rows[index + delta];
      if (next) visit(next.id);
    };
  el('session-packet-party-toggle').onclick = () => {
    const panel = el('live-party-panel');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) el<HTMLDetailsElement>('live-party-details').open = true;
    el('session-packet-party-toggle').setAttribute('aria-pressed', String(!panel.hidden));
  };
  el('session-packet-export').onclick = () => {
    const o = source,
      p = packet,
      n = request;
    if (!o || !p || p.planId !== o.planId || !same(o)) return;
    const b = el<HTMLButtonElement>('session-packet-export');
    if (b.disabled) return;
    const current = () => n === request && same(o) && packet === p;
    b.disabled = true;
    void window.campaign
      .exportSessionPacket(o.token, o.planId, p.basis)
      .then((r) => {
        if (!current()) return;
        if (!r.ok) throw new Error(r.error);
        tell(
          r.value.cancelled
            ? 'Mappenausgabe abgebrochen.'
            : 'GM-Spielabendmappe als Markdown gespeichert.',
        );
      })
      .catch((e) => {
        if (current()) tell(e.message, true);
      })
      .finally(() => {
        if (current()) b.disabled = false;
      });
  };
}

/** Named Live handoffs keep packet controls with their existing owner. */
export function selectLivePacketVisit(visitId: string) {
  [...el('session-packet-visits').querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.dataset.visitId === visitId)
    ?.click();
}
export function showLivePacketParty() {
  el('live-party-panel').hidden = false;
  el('session-packet-party-toggle').setAttribute('aria-pressed', 'true');
}
