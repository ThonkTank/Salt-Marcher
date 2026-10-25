import type { WorkspaceGeometry, Result } from './contracts';
import type { CampaignTransferPreview, ConflictChoice } from './campaign-contracts';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
let context: () => WorkspaceGeometry | null,
  before: () => Promise<boolean>,
  changed: (id?: string) => Promise<void>,
  tell: (text: string, error?: boolean) => void;
let preview: CampaignTransferPreview | null = null,
  busy = false,
  accepting = false,
  generation = 0,
  transferRequest = 0;
const pendingKey = 'campaign-pending-transfer';
let pendingTicket: string | null = null;
const labels: Record<string, string> = {
  drawing_element: 'Dungeonobjekte und Features',
  drawing_profile: 'Raumdarstellung und Deckenhöhen',
  player_asset: 'Freigegebene Spielerbilder',
  city_document: 'Stadtpläne',
  city_unit: 'Stadtelemente',
  room: 'Räume',
  scope: 'Dungeonzeichnungen',
  world_note: 'Welttexte',
  location: 'Orte',
  plan: 'Spielabendpläne',
  planned_visit: 'Vorbereitete Besuche',
  roster_member: 'Charaktere',
  live_scene: 'Gruppen / Szenen',
  combat: 'Kämpfe',
  treasure: 'Schätze',
  character_ledger: 'Persönliche Beute',
  world_journey: 'Reisen',
  travel_checkpoint: 'Rücknehmbare Reiseschritte',
  world_record: 'Karten, Kalender und Wetter',
  audio_asset: 'Audiodateibeschreibungen',
  item_definition: 'Gegenstandsdefinitionen',
  generator_preset: 'Generatorregeln',
  campaign_capability: 'Erhaltene Zusatzinhalte',
};
function run(fn: () => Promise<unknown> | void) {
  const gen = generation,
    token = context()?.token;
  void Promise.resolve()
    .then(() => {
      if (gen !== generation || token !== context()?.token) return;
      return fn();
    })
    .catch((error) => {
      if (gen === generation && token === context()?.token) tell(error.message, true);
    });
}
function displayPreview(p: CampaignTransferPreview) {
  preview = p;
  el<HTMLInputElement>('campaign-transfer-name').value =
    p.name + (p.copy ? ' – Kopie' : ' – Import');
  el('campaign-transfer-heading').textContent = p.copy
    ? 'Kampagnenkopie erstellen'
    : 'Kampagnenpaket importieren';
  el('campaign-transfer-origin').textContent = 'Quelle: ' + p.name;
  el('campaign-transfer-accept').textContent = p.copy
    ? 'Kopie erstellen und öffnen'
    : 'Importieren und öffnen';
  const units: Record<string, [string, string]> = {
    scope: ['Dungeonzeichnung', 'Dungeonzeichnungen'],
    room: ['Raum', 'Räume'],
    city_document: ['Stadtplan', 'Stadtpläne'],
    location: ['Ort', 'Orte'],
    world_note: ['Wissenseintrag', 'Wissenseinträge'],
    roster_member: ['Charakter', 'Charaktere'],
  };
  const contentsSummary = p.counts
    .filter((c) => units[c.table] && c.records > 0)
    .map((c) => c.records + ' ' + units[c.table]![c.records === 1 ? 0 : 1]);
  contentsSummary.push(p.audioFiles + ' ' + (p.audioFiles === 1 ? 'Mediendatei' : 'Mediendateien'));
  el('campaign-transfer-summary').textContent = contentsSummary.join(' · ');
  el('campaign-transfer-metadata').textContent =
    (p.bytes / 1048576).toFixed(1) + ' MB · Produktstand ' + p.applicationVersion;
  const contents = el('campaign-transfer-contents');
  contents.replaceChildren();
  for (const c of p.counts) {
    if (!labels[c.table]) continue;
    const row = document.createElement('p');
    row.textContent = labels[c.table] + ': ' + c.records;
    contents.append(row);
  }
  const issues = el('campaign-transfer-problems');
  issues.textContent = p.problems.join('\n');
  const conflicts = el('campaign-transfer-conflicts');
  conflicts.replaceChildren();
  for (const c of p.conflicts) {
    const card = document.createElement('article'),
      title = document.createElement('h3'),
      text = document.createElement('p'),
      select = document.createElement('select');
    card.className = 'campaign-card';
    title.textContent =
      c.name +
      ' · ' +
      {
        item: 'Gegenstand',
        audio: 'Audio',
        preset: 'Generatorregel',
        table: 'Encounter-Tabelle',
        mood: 'Stimmungsachse',
      }[c.kind];
    text.textContent =
      'Die Paketvariante unterscheidet sich vom vorhandenen Stand. Das Ersetzen des aktuellen gemeinsamen Stands kann ' +
      c.affectedCampaigns +
      ' vorhandene Kampagnen betreffen.';
    select.dataset.conflict = c.key;
    for (const [id, label] of [
      ['', 'Entscheidung wählen'],
      ['keep-both', 'Beide Varianten mit getrennten Kennungen behalten'],
      ['keep-current', 'Vorhandenen aktuellen Stand verwenden'],
      ['keep-imported', 'Paketvariante als aktuellen Stand übernehmen'],
    ]) {
      const o = document.createElement('option');
      o.value = id!;
      o.textContent = label!;
      select.append(o);
    }
    select.onchange = lock;
    const details = document.createElement('details'),
      summary = document.createElement('summary');
    summary.textContent = 'Beide Definitionen vergleichen';
    details.append(summary);
    for (const [label, data] of [
      ['Vorhanden', c.existing],
      ['Im Paket', c.incoming],
    ]) {
      const heading = document.createElement('h4'),
        pre = document.createElement('pre');
      heading.textContent = label!;
      pre.textContent = JSON.stringify(JSON.parse(data!), null, 2);
      details.append(heading, pre);
    }
    if (c.kind === 'item') {
      const note = document.createElement('p');
      note.className = 'caption';
      note.textContent =
        'Aufgezeichnete Vergabewerte bleiben erhalten. Abweichende historische Definitionen werden separat bewahrt.';
      card.append(note);
    }
    card.append(title, text, details, select);
    conflicts.append(card);
  }
  lock();
  el<HTMLDialogElement>('campaign-transfer-dialog').showModal();
}
function canAccept() {
  if (!preview || preview.problems.length) return false;
  const decisions = new Map(
    [...el('campaign-transfer-conflicts').querySelectorAll<HTMLSelectElement>('select')].map(
      (s) => [s.dataset.conflict, s.value],
    ),
  );
  return preview.conflicts.every((c) =>
    ['keep-current', 'keep-imported', 'keep-both'].includes(decisions.get(c.key) ?? ''),
  );
}
function lock() {
  el<HTMLButtonElement>('campaign-transfer-accept').disabled =
    busy || accepting || !!pendingTicket || !canAccept();
  for (const id of ['campaign-export', 'campaign-copy'])
    el<HTMLButtonElement>(id).disabled = busy || accepting || !!pendingTicket || !context();
  el<HTMLButtonElement>('campaign-import-package').disabled = busy || accepting || !!pendingTicket;
  el<HTMLInputElement>('campaign-transfer-name').disabled = accepting || !!pendingTicket;
  for (const select of el('campaign-transfer-conflicts').querySelectorAll<HTMLSelectElement>(
    'select',
  ))
    select.disabled = accepting || !!pendingTicket;
  for (const id of ['campaign-transfer-check', 'campaign-transfer-check-preview']) {
    const b = el<HTMLButtonElement>(id);
    b.hidden = !pendingTicket;
    b.disabled = accepting;
  }
  el('campaign-transfer-cancel-job').hidden = !busy;
}
async function cancelPreview() {
  const p = preview,
    request = ++transferRequest;
  preview = null;
  el<HTMLDialogElement>('campaign-transfer-dialog').close();
  lock();
  if (p) {
    const result = await window.campaign.cancelCampaignTransfer(p.ticket);
    if (request === transferRequest) unwrap(result);
  }
}
async function closeManager() {
  generation++;
  el<HTMLDialogElement>('campaign-manager-dialog').close();
  await cancelPreview();
}
async function preparePreview(copy: boolean) {
  if (busy || accepting || pendingTicket) return;
  const owner = context(),
    gen = generation,
    request = ++transferRequest,
    old = preview;
  const owns = () =>
    gen === generation && request === transferRequest && owner?.token === context()?.token;
  preview = null;
  el<HTMLDialogElement>('campaign-transfer-dialog').close();
  lock();
  if (old) await window.campaign.cancelCampaignTransfer(old.ticket);
  if (!(await before()) || !owns()) return;
  if (copy && !owner) throw new Error('Öffne zuerst eine Kampagne.');
  const response = copy
    ? await window.campaign.prepareCampaignCopy(owner!.token)
    : await window.campaign.prepareCampaignImport();
  if (!owns()) {
    if (response.ok && response.value)
      await window.campaign.cancelCampaignTransfer(response.value.ticket);
    return;
  }
  const p = unwrap(response);
  if (p) displayPreview(p);
}
async function acceptPreview() {
  if (busy || accepting || pendingTicket || !canAccept() || !preview) return;
  const p = preview,
    request = transferRequest,
    gen = generation,
    token = context()?.token,
    name = el<HTMLInputElement>('campaign-transfer-name').value;
  const choices = Object.fromEntries(
    [...el('campaign-transfer-conflicts').querySelectorAll<HTMLSelectElement>('select')].map(
      (s) => [s.dataset.conflict!, s.value as ConflictChoice],
    ),
  );
  accepting = true;
  lock();
  try {
    if (
      !(await before()) ||
      preview !== p ||
      request !== transferRequest ||
      token !== context()?.token
    )
      return;
    // Retain only the opaque ticket before sending. Recovery never repeats the write.
    window.localStorage.setItem(pendingKey, p.ticket);
    pendingTicket = p.ticket;
    let result;
    try {
      result = unwrap(await window.campaign.acceptCampaignTransfer(p.ticket, name, choices));
    } catch (error) {
      const state = await reconcileAcceptance();
      if (state === 'not-applied') throw error;
      return;
    }
    const cleanup = clearPending();
    const owns =
      preview === p &&
      request === transferRequest &&
      gen === generation &&
      token === context()?.token;
    if (preview === p) {
      preview = null;
      transferRequest++;
      el<HTMLDialogElement>('campaign-transfer-dialog').close();
    }
    if (owns) el<HTMLDialogElement>('campaign-manager-dialog').close();
    await changed(owns ? result.id : undefined);
    if (owns) transferOutcome('Unabhängige Kampagne übernommen: ' + result.name + '.', cleanup);
  } finally {
    accepting = false;
    lock();
  }
}

function clearPending() {
  // A confirmed Store outcome must remain usable even if local journal cleanup fails.
  try {
    window.localStorage.removeItem(pendingKey);
    pendingTicket = null;
    return '';
  } catch {
    return 'Der geklärte Auftragsvermerk konnte lokal nicht entfernt werden. Das bestätigte Ergebnis bleibt gültig. Öffne Pakete und Kopien und prüfe die Übernahme erneut, bevor du eine weitere startest.';
  }
}
function transferOutcome(text: string, cleanup: string) {
  const message = text + (cleanup ? ' ' + cleanup : '');
  el('campaign-transfer-progress').textContent = message;
  tell(message, !!cleanup);
}
async function reconcileAcceptance() {
  const ticket = pendingTicket;
  if (!ticket) return;
  const status = unwrap(await window.campaign.campaignTransferStatus(ticket));
  if (ticket !== pendingTicket) return;
  if (status.state === 'pending') {
    tell('Die Übernahme läuft noch. Status erneut prüfen.');
    return status.state;
  }
  const cleanup = clearPending();
  if (status.state === 'applied') {
    if (preview?.ticket === ticket) {
      preview = null;
      transferRequest++;
      el<HTMLDialogElement>('campaign-transfer-dialog').close();
    }
    // Recovered outcomes update the list without selecting an old campaign context.
    await changed();
    transferOutcome('Übernahme bestätigt: ' + status.campaign.name, cleanup);
  } else
    transferOutcome(
      cleanup
        ? 'Keine übernommene Kampagne vorhanden.'
        : 'Keine übernommene Kampagne vorhanden. Du kannst die Übernahme erneut starten.',
      cleanup,
    );
  return status.state;
}
async function checkAcceptance() {
  if (accepting || !pendingTicket) return;
  accepting = true;
  lock();
  try {
    await reconcileAcceptance();
  } finally {
    accepting = false;
    lock();
  }
}

function readPending() {
  pendingTicket = window.localStorage.getItem(pendingKey);
  if (pendingTicket)
    el('campaign-transfer-progress').textContent =
      'Ein früherer Auftragsvermerk ist erhalten. Übernahme prüfen liest ausschließlich den gespeicherten Buchungsstatus.';
  lock();
}

function showManager() {
  el('campaign-transfer-source').textContent = context()
    ? 'Geöffnete Kampagne: ' + context()!.campaign.name
    : 'Öffne eine Kampagne zum Exportieren oder Kopieren. Ein Paket kannst du auch ohne geöffnete Kampagne importieren.';
  el<HTMLDialogElement>('campaign-manager-dialog').showModal();
}

export function initCampaignManager(
  status: typeof tell,
  getContext: typeof context,
  flush: typeof before,
  onChanged: typeof changed,
) {
  tell = status;
  context = getContext;
  before = flush;
  changed = onChanged;
  el('campaign-manager').onclick = () => {
    generation++;
    run(() => {
      readPending();
      showManager();
    });
  };
  el('campaign-screen-import').onclick = () => {
    generation++;
    run(async () => {
      readPending();
      if (pendingTicket) {
        showManager();
        return;
      }
      await preparePreview(false);
    });
  };
  lock();
  for (const id of ['campaign-transfer-check', 'campaign-transfer-check-preview'])
    el(id).onclick = () => run(checkAcceptance);
  el('campaign-manager-close').onclick = () => run(closeManager);
  el<HTMLDialogElement>('campaign-manager-dialog').oncancel = (e) => {
    e.preventDefault();
    run(closeManager);
  };
  el('campaign-export').onclick = () =>
    run(async () => {
      if (busy || accepting || pendingTicket) return;
      const w = context(),
        gen = generation;
      if (!(await before()) || gen !== generation || w?.token !== context()?.token) return;
      if (!w) throw new Error('Öffne zuerst eine Kampagne.');
      const response = await window.campaign.exportCampaign(w.token);
      if (gen !== generation || w.token !== context()?.token) return;
      if (!unwrap(response).cancelled) tell('Kampagnenpaket mit Daten und Medien exportiert.');
    });
  el('campaign-copy').onclick = () => run(() => preparePreview(true));
  el('campaign-import-package').onclick = () => run(() => preparePreview(false));
  el('campaign-transfer-cancel').onclick = () => run(cancelPreview);
  el<HTMLDialogElement>('campaign-transfer-dialog').oncancel = (e) => {
    e.preventDefault();
    run(cancelPreview);
  };
  el('campaign-transfer-cancel-job').onclick = () =>
    run(async () => {
      unwrap(await window.campaign.cancelCampaignTransfer());
    });
  el('campaign-transfer-form').onsubmit = (e) => {
    e.preventDefault();
    run(acceptPreview);
  };
  window.campaign.onCampaignTransfer((p) => {
    busy = p.busy;
    el('campaign-transfer-progress').textContent =
      p.phase + (p.busy ? ' · ' + (p.bytes / 1048576).toFixed(1) + ' MB' : '');
    lock();
  });
}
