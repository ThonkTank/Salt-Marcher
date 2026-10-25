import { bindAnchoredPopup } from './anchored-popup';
import { validateCampaignCatalogCommand } from './campaign-catalog-command';
import type {
  CampaignCatalogCommand,
  CampaignCatalogReceipt,
  CampaignOverview,
} from './campaign-contracts';
import type { Result } from './contracts';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const unwrap = <T>(r: Result<T>) => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
let applicationPopup: ReturnType<typeof bindAnchoredPopup> | null = null;
const closeApplicationMenu = () => {
  if (el('application-trigger').getAttribute('aria-expanded') === 'true') applicationPopup?.close();
};
const pendingKey = 'campaign-catalog-pending';
let storageNotice = '';
let unreadable: { raw: string | null; backupKey?: string } | null = null;
const blocked = () => busy || !!pending || !!unreadable;
let before: () => Promise<boolean>,
  enter: (receipt: CampaignCatalogReceipt) => Promise<boolean>,
  changed: () => Promise<void>;
let campaigns: CampaignOverview[] = [],
  activeId: string | null = null,
  busy = false,
  pending: CampaignCatalogCommand | null = null,
  editing: CampaignOverview | null = null,
  erasing: CampaignOverview | null = null,
  entry: CampaignCatalogReceipt | null = null,
  request = 0,
  loading = false,
  catalogReady = false;
const dialog = (id: string) => el<HTMLDialogElement>(id);
function message(text: string) {
  if (storageNotice) text += ' ' + storageNotice;
  el('campaign-screen-status').textContent = text;
  el('campaign-identity-status').textContent = text;
  el('campaign-trash-status').textContent = text;
  el('campaign-delete-status').textContent = text;
}
const readyMessage = () =>
  message(
    unreadable
      ? 'Neue Kampagnenaufträge bleiben bis zur Wiederaufnahme gesperrt.'
      : pending
        ? 'Ein Kampagnenauftrag wartet auf Statusprüfung.'
        : 'Kampagne wählen, um den Spieltisch zu öffnen.',
  );
function lock() {
  for (const root of [
    'campaign-screen',
    'campaign-identity-dialog',
    'campaign-trash-dialog',
    'campaign-delete-dialog',
  ])
    for (const b of el(root).querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input'))
      b.disabled = blocked();
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-catalog-check]')) {
    b.hidden = !pending && !unreadable;
    b.disabled = busy;
    b.textContent = unreadable ? 'Auftragsvermerk erneut lesen' : 'Buchungsstatus prüfen';
  }
  el<HTMLButtonElement>('campaign-load-retry').hidden = !entry;
  el<HTMLButtonElement>('campaign-load-retry').disabled = blocked();
  el('campaign-pending-recovery').hidden = !unreadable;
  el<HTMLTextAreaElement>('campaign-pending-raw').value = unreadable?.raw ?? '';
  el('campaign-pending-raw').hidden = unreadable?.raw === null;
  el<HTMLButtonElement>('campaign-pending-preserve').disabled =
    busy || !unreadable || unreadable.raw === null;
}
const button = (text: string, run: () => void) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.onclick = run;
  return b;
};
const date = (s: string | null) =>
  s
    ? new Date(s).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
    : 'nicht bekannt';
async function refresh() {
  loading = true;
  catalogReady = false;
  const n = ++request,
    lists = ['campaign-screen-list', 'campaign-trash-list'];
  // A previous catalog may belong to a different active identity. Do not leave
  // its opening, editing or deletion actions available during a new read.
  for (const id of lists) {
    el(id).replaceChildren();
    el(id).textContent = 'Kampagnen werden geladen…';
    el(id).setAttribute('aria-busy', 'true');
  }
  el('campaign-trash-open').textContent = 'Papierkorb (…)';
  el('campaign-screen-count').textContent = '';
  el('campaign-trash-count').textContent = '';
  try {
    const [rows, list] = await Promise.all([
      window.campaign.campaignOverview(),
      window.campaign.list(),
    ]);
    if (n !== request) return false;
    campaigns = unwrap(rows);
    activeId = unwrap(list).activeId;
    catalogReady = true;
    draw();
    return true;
  } catch (error) {
    if (n !== request) return false;
    for (const id of lists)
      el(id).textContent = 'Liste konnte nicht geladen werden. Bitte aktualisieren.';
    throw error;
  } finally {
    if (n === request) {
      loading = false;
      for (const id of lists) el(id).setAttribute('aria-busy', 'false');
    }
  }
}
const duplicate = (c: CampaignOverview) =>
  campaigns.some((other) => other.id !== c.id && searchable(other.name) === searchable(c.name));
const searchable = (text: string) =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('de');
function deleteLabel(c: CampaignOverview) {
  el('campaign-delete-label').textContent = c.name;
  el('campaign-delete-context').hidden = !duplicate(c);
  el('campaign-delete-context').textContent = 'Kennung: ' + c.id;
}
function draw() {
  const root = el('campaign-screen-list'),
    trash = el('campaign-trash-list');
  root.replaceChildren();
  trash.replaceChildren();
  const queries = {
    available: searchable(el<HTMLInputElement>('campaign-screen-search').value)
      .trim()
      .split(/\s+/)
      .filter(Boolean),
    trash: searchable(el<HTMLInputElement>('campaign-trash-search').value)
      .trim()
      .split(/\s+/)
      .filter(Boolean),
  };
  const totals = { available: 0, trash: 0 },
    shown = { available: 0, trash: 0 };
  for (const c of campaigns) {
    const list = c.trashed ? 'trash' : 'available';
    totals[list]++;
    if (!queries[list].every((term) => searchable(c.name + ' ' + c.id).includes(term))) continue;
    shown[list]++;
    const card = document.createElement('article'),
      h = document.createElement('h3'),
      facts = document.createElement('p'),
      time = document.createElement('p'),
      actions = document.createElement('div');
    card.className = 'campaign-card';
    card.dataset.campaignId = c.id;
    h.textContent = c.name + (c.id === activeId ? ' · aktiv' : '');
    facts.textContent =
      c.rooms +
      (c.rooms === 1 ? ' Raum' : ' Räume') +
      ' · ' +
      c.locations +
      (c.locations === 1 ? ' Ort' : ' Orte') +
      ' · ' +
      c.characters +
      (c.characters === 1 ? ' Charakter' : ' Charaktere');
    if (c.notes) {
      facts.append(' · ' + c.notes + (c.notes === 1 ? ' Wissenseintrag' : ' Wissenseinträge'));
      facts.title =
        'Wissenseinträge umfassen NSCs, Fraktionen, Quests und weitere Notizen einschließlich Papierkorbeinträgen.';
    }
    if (c.maps) facts.append(' · ' + c.maps + (c.maps === 1 ? ' Karte' : ' Karten'));
    time.className = 'caption';
    time.textContent =
      'Zuletzt geöffnet: ' + date(c.lastOpenedAt) + ' · Angelegt: ' + date(c.createdAt);
    actions.className = 'toolbar';
    if (c.trashed)
      actions.append(
        button(
          'Wiederherstellen',
          () =>
            void execute({
              commandId: crypto.randomUUID(),
              kind: 'trash',
              id: c.id,
              expectedRevision: c.trashRevision,
              trashed: false,
            }),
        ),
        button('Dauerhaft löschen…', () => {
          if (blocked()) return;
          erasing = c;
          deleteLabel(c);
          el<HTMLInputElement>('campaign-delete-name').value = '';
          dialog('campaign-delete-dialog').showModal();
          el('campaign-delete-name').focus();
        }),
      );
    else
      actions.append(
        button(
          c.id === activeId ? 'Fortsetzen' : 'Öffnen',
          () => void execute({ commandId: crypto.randomUUID(), kind: 'open', id: c.id }),
        ),
        button('Bearbeiten…', () => edit(c)),
      );
    card.append(h, facts, time);
    if (duplicate(c)) {
      const identity = document.createElement('p');
      identity.className = 'caption';
      identity.textContent = 'Kennung: ' + c.id;
      card.append(identity);
    }
    card.append(actions);
    (c.trashed ? trash : root).append(card);
  }
  if (!root.children.length)
    root.textContent = totals.available
      ? 'Keine Kampagne passt zur Suche. Ändere oder lösche den Suchtext.'
      : 'Noch keine verfügbare Kampagne. Lege eine neue an oder importiere ein Paket.';
  if (!trash.children.length)
    trash.textContent = totals.trash
      ? 'Keine Kampagne passt zur Suche. Ändere oder lösche den Suchtext.'
      : 'Der Papierkorb ist leer.';
  el('campaign-screen-count').textContent =
    shown.available + ' von ' + totals.available + ' Kampagnen';
  el('campaign-trash-count').textContent =
    shown.trash + ' von ' + totals.trash + ' Kampagnen im Papierkorb';
  el('campaign-trash-open').textContent =
    'Papierkorb (' + campaigns.filter((c) => c.trashed).length + ')';
  lock();
}
function edit(c: CampaignOverview | null) {
  if (blocked()) return;
  editing = c;
  el('campaign-identity-context').hidden = !c || !duplicate(c);
  el('campaign-identity-context').textContent = c ? 'Kennung: ' + c.id : '';
  el('campaign-identity-heading').textContent = c ? 'Kampagne bearbeiten' : 'Neue Kampagne';
  el<HTMLInputElement>('campaign-identity-name').value = c?.name ?? '';
  el('campaign-identity-trash').hidden = !c;
  el('campaign-identity-status').textContent = '';
  dialog('campaign-identity-dialog').showModal();
  el('campaign-identity-name').focus();
}
function closeIdentity() {
  dialog('campaign-identity-dialog').close();
  el<HTMLInputElement>('campaign-identity-name').value = '';
  editing = null;
}
function clearPending() {
  pending = null;
  try {
    window.localStorage.removeItem(pendingKey);
    storageNotice = '';
  } catch {
    storageNotice =
      'Der geklärte Auftragsvermerk konnte lokal nicht entfernt werden. Sein Buchungsstatus bleibt erneut prüfbar.';
  }
}
async function apply(receipt: CampaignCatalogReceipt) {
  closeIdentity();
  if (receipt.kind === 'create' || receipt.kind === 'open') {
    entry = receipt;
    message('Öffnung bestätigt. Arbeitsfläche wird geladen…');
    await changed();
    await load();
  } else {
    dialog('campaign-delete-dialog').close();
    erasing = null;
    await changed();
    await refresh();
    message(
      receipt.kind === 'rename'
        ? 'Name gespeichert.'
        : receipt.kind === 'erase'
          ? 'Kampagne dauerhaft gelöscht.'
          : 'Kampagnenstatus gespeichert. Wiederherstellen aktiviert keine Kampagne.',
    );
  }
}
async function load() {
  if (!entry) return;
  const accepted = entry;
  try {
    if (await enter(accepted)) {
      entry = null;
      hideCampaignScreen();
    } else
      message(
        'Öffnung bestätigt. Arbeitsfläche konnte nicht vollständig geladen werden. Erneut laden versucht nur die Arbeitsfläche.',
      );
  } catch (e) {
    message((e as Error).message + ' · Öffnung ist bereits bestätigt.');
  }
}
async function execute(c: CampaignCatalogCommand) {
  if (blocked()) return;
  // Persist the intent before dispatch; a failed local write must not lock the UI.
  try {
    window.localStorage.setItem(pendingKey, JSON.stringify(c));
    storageNotice = '';
  } catch (error) {
    const reason =
      (error as Error).name === 'QuotaExceededError'
        ? 'Lokaler Speicher für die Wiederaufnahme ist voll.'
        : 'Lokaler Speicher für die Wiederaufnahme ist nicht verfügbar.';
    message('Auftrag nicht gestartet: ' + reason + ' Eingaben bleiben erhalten. Erneut versuchen.');
    return;
  }
  busy = true;
  pending = c;
  lock();
  let accepted: CampaignCatalogReceipt | null = null;
  try {
    try {
      accepted = unwrap(await window.campaign.campaignCatalog(c));
    } catch (error) {
      try {
        accepted = unwrap(await window.campaign.campaignCatalogOutcome(c));
      } catch {
        message('Ergebnis noch offen. Buchungsstatus prüfen, bevor du fortfährst.');
        return;
      }
      if (!accepted) {
        clearPending();
        throw error;
      }
    }
    clearPending();
    await apply(accepted!);
  } catch (error) {
    message((error as Error).message);
  } finally {
    busy = false;
    lock();
  }
}
function resumeUncommitted(command: CampaignCatalogCommand) {
  const row = command.kind === 'create' ? null : campaigns.find((c) => c.id === command.id);
  if (command.kind === 'create') {
    edit(null);
    el<HTMLInputElement>('campaign-identity-name').value = command.name;
  } else if (!row) {
    message(
      'Keine Änderung gebucht. Die Zielkampagne ist nicht mehr verfügbar.' +
        (command.kind === 'rename'
          ? ' Nicht gebuchter Namensentwurf: ' + command.name
          : command.kind === 'erase'
            ? ' Nicht verwendete Löschbestätigung: ' + command.confirmName
            : ''),
    );
    return;
  } else if (command.kind === 'open') {
    message('Keine Öffnung gebucht. Kampagne erneut auswählen, um sie ausdrücklich zu öffnen.');
    return;
  } else if (command.kind === 'rename') {
    if (row.trashed) {
      if (!dialog('campaign-trash-dialog').open) dialog('campaign-trash-dialog').showModal();
      message(
        'Keine Namensänderung gebucht. Ziel zuerst wiederherstellen. Nicht gebuchter Namensentwurf: ' +
          command.name,
      );
      return;
    }
    edit(row);
    el<HTMLInputElement>('campaign-identity-name').value = command.name;
  } else if (command.kind === 'trash' && command.trashed && !row.trashed) edit(row);
  else if (row.trashed) {
    if (!dialog('campaign-trash-dialog').open) dialog('campaign-trash-dialog').showModal();
    if (command.kind === 'erase') {
      erasing = row;
      deleteLabel(row);
      el<HTMLInputElement>('campaign-delete-name').value = command.confirmName;
      dialog('campaign-delete-dialog').showModal();
      el('campaign-delete-name').focus();
    }
  } else {
    message(
      'Keine Änderung gebucht. Kampagnenstatus inzwischen geändert. Aktuellen Eintrag erneut wählen.',
    );
    return;
  }
  message(
    'Keine Änderung gebucht. Eingaben wiederhergestellt; aktuellen Kampagnenstand prüfen und erneut ausdrücklich bestätigen.',
  );
  lock();
}
async function check() {
  if (busy) return;
  if (unreadable) {
    if (!readPending()) {
      readyMessage();
      lock();
      return;
    }
    lock();
    if (!pending) {
      await openCampaignScreen(true);
      return;
    }
  }
  if (!pending) return;
  const command = pending;
  let uncommitted = false;
  busy = true;
  lock();
  try {
    const r = unwrap(await window.campaign.campaignCatalogOutcome(command));
    if (r) {
      clearPending();
      await apply(r);
    } else {
      if (!(await refresh())) return;
      clearPending();
      uncommitted = true;
    }
  } catch (e) {
    message((e as Error).message);
  } finally {
    busy = false;
    lock();
  }
  if (uncommitted) resumeUncommitted(command);
}

function readPending() {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(pendingKey);
    const value: unknown = JSON.parse(raw ?? 'null');
    if (value !== null) validateCampaignCatalogCommand(value);
    pending = value;
    unreadable = null;
    storageNotice = '';
    return true;
  } catch {
    pending = null;
    unreadable = { raw };
    storageNotice =
      'Auftragsvermerk nicht lesbar. Das Original bleibt erhalten; eine frühere Buchung kann bereits erfolgt sein.';
    return false;
  }
}
function preserveUnreadable() {
  const raw = unreadable?.raw;
  if (busy || raw === null || raw === undefined) return;
  try {
    if (window.localStorage.getItem(pendingKey) !== raw) {
      readPending();
      message('Auftragsvermerk inzwischen geändert. Aktuellen Status erneut prüfen.');
      lock();
      return;
    }
    let key = unreadable!.backupKey;
    if (!key || window.localStorage.getItem(key) !== raw) {
      key = pendingKey + '-unreadable:' + crypto.randomUUID();
      window.localStorage.setItem(key, raw);
      if (window.localStorage.getItem(key) !== raw) throw new Error('Sicherung nicht bestätigt.');
      unreadable!.backupKey = key;
    }
    if (window.localStorage.getItem(pendingKey) !== raw) {
      readPending();
      message('Auftragsvermerk inzwischen geändert. Aktuellen Status erneut prüfen.');
      lock();
      return;
    }
    window.localStorage.removeItem(pendingKey);
    pending = null;
    unreadable = null;
    storageNotice =
      'Beschädigtes Original auf diesem Gerät getrennt gesichert. Kein Auftrag wiederholt. Vor neuen Änderungen den aktuellen Kampagnenstand prüfen.';
    readyMessage();
    lock();
  } catch {
    message(
      'Auftragsvermerk konnte nicht sicher freigegeben werden. Original und Sperre bleiben erhalten.',
    );
    lock();
  }
}

export function hideCampaignScreen() {
  document.body.classList.remove('campaign-screen-open');
  el('campaign-screen').hidden = true;
}
export async function openCampaignScreen(initial = false) {
  if (busy) return false;
  if (!initial && !(await before())) return false;
  if (busy) return false;
  el<HTMLInputElement>('campaign-screen-search').value = '';
  el<HTMLInputElement>('campaign-trash-search').value = '';
  document.body.classList.add('campaign-screen-open');
  el('campaign-screen').hidden = false;
  closeApplicationMenu();
  message('Kampagnen werden geladen…');
  try {
    const ready = await refresh();
    if (ready) readyMessage();
    return ready;
  } catch (e) {
    message((e as Error).message);
    return false;
  }
}
export function initCampaignScreen(options: {
  before: typeof before;
  enter: typeof enter;
  changed: typeof changed;
  currentCampaign?: () => string | null;
}) {
  applicationPopup = bindAnchoredPopup(
    el<HTMLButtonElement>('application-trigger'),
    el('application-popup'),
    176,
  );
  el('application-trigger').onclick = () => applicationPopup!.toggle();
  document.addEventListener('keydown', (event) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      !(event.ctrlKey || event.metaKey) ||
      event.key.toLowerCase() !== 'f' ||
      el('campaign-screen').hidden ||
      blocked()
    )
      return;
    const modals = [...document.querySelectorAll<HTMLDialogElement>('dialog')].filter(
      (d) => d.open,
    );
    if (modals.some((d) => d.id !== 'campaign-trash-dialog')) return;
    event.preventDefault();
    const search = el<HTMLInputElement>(
      modals.length ? 'campaign-trash-search' : 'campaign-screen-search',
    );
    search.focus();
    search.select();
  });
  for (const id of ['campaign-screen-search', 'campaign-trash-search'])
    el(id).oninput = () => {
      if (catalogReady && !loading && !blocked()) draw();
    };
  before = options.before;
  enter = options.enter;
  changed = options.changed;
  readPending();
  el('campaign-screen-open').onclick = () => void openCampaignScreen();
  el('campaign-header-name').onclick = () => void openCampaignScreen();
  el('campaign-screen-create').onclick = () => edit(null);
  el('campaign-screen-refresh').onclick = () => {
    message('Kampagnen werden geladen…');
    void refresh()
      .then((ok) => {
        if (ok) readyMessage();
      })
      .catch((e) => message(e.message));
  };
  el('campaign-trash-open').onclick = () => dialog('campaign-trash-dialog').showModal();
  el('campaign-trash-close').onclick = () => {
    if (!blocked()) dialog('campaign-trash-dialog').close();
  };
  el('campaign-identity-close').onclick = () => {
    if (!blocked()) closeIdentity();
  };
  el('campaign-delete-close').onclick = () => {
    if (!blocked()) {
      erasing = null;
      dialog('campaign-delete-dialog').close();
    }
  };
  for (const id of ['campaign-identity-dialog', 'campaign-trash-dialog', 'campaign-delete-dialog'])
    dialog(id).oncancel = (e) => {
      e.preventDefault();
      if (!blocked()) {
        if (id === 'campaign-identity-dialog') closeIdentity();
        else dialog(id).close();
      }
    };
  el('campaign-identity-form').onsubmit = (e) => {
    e.preventDefault();
    const name = el<HTMLInputElement>('campaign-identity-name').value.trim();
    void execute(
      editing
        ? {
            commandId: crypto.randomUUID(),
            kind: 'rename',
            id: editing.id,
            expectedRevision: editing.revision,
            name,
          }
        : { commandId: crypto.randomUUID(), kind: 'create', name },
    );
  };
  el('campaign-identity-trash').onclick = () => {
    if (editing)
      void execute({
        commandId: crypto.randomUUID(),
        kind: 'trash',
        id: editing.id,
        expectedRevision: editing.trashRevision,
        trashed: true,
      });
  };
  el('campaign-delete-form').onsubmit = (e) => {
    e.preventDefault();
    if (erasing)
      void execute({
        commandId: crypto.randomUUID(),
        kind: 'erase',
        id: erasing.id,
        expectedRevision: erasing.trashRevision,
        confirmName: el<HTMLInputElement>('campaign-delete-name').value,
      });
  };
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-catalog-check]'))
    b.onclick = () => void check();
  el('campaign-pending-preserve').onclick = preserveUnreadable;
  el('campaign-load-retry').onclick = () => {
    if (blocked()) return;
    busy = true;
    lock();
    void load().finally(() => {
      busy = false;
      lock();
    });
  };
  el('campaign-screen-packages').onclick = () => el('campaign-manager').click();
  el('application-settings').onclick = () => {
    closeApplicationMenu();
    void import('./preset-settings-ui')
      .then((ui) => ui.openPresetSettings(options.currentCampaign?.() ?? null))
      .catch((e) => message(e.message));
  };
  el('new-campaign').onclick = () =>
    void openCampaignScreen().then((ok) => {
      if (ok) edit(null);
    });
  el('rename-campaign').onclick = () =>
    void openCampaignScreen().then((ok) => {
      if (ok) edit(campaigns.find((c) => c.id === activeId) ?? null);
    });
  lock();
}
