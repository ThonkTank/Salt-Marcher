import type { Result } from './contracts';
import {
  checkedExtensionCommand,
  type ExtensionPreview,
  type ExtensionCommand,
  type ExtensionRight,
} from './extension-contracts';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T,
  unwrap = <T>(r: Result<T>): T => {
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
const labels: Record<ExtensionRight, string> = {
  'ownedUnits.read': 'Eigene Zusatzdaten lesen',
  'ownedUnits.write': 'Eigene Zusatzdaten schreiben',
};
export function initExtensions(status: (text: string, error?: boolean) => void) {
  const dialog = get<HTMLDialogElement>('extensions-dialog');
  let generation = 0,
    request = 0,
    preview: ExtensionPreview | null = null,
    pending: ExtensionCommand | null = null,
    busy = false,
    cursor: string | null = null,
    opener: HTMLElement | null = null,
    recoveryError = false,
    recoveryRaw: string | null = null,
    listReady = false;
  const pendingKey = 'extension-pending-write';
  function readRecovery() {
    pending = null;
    recoveryError = false;
    recoveryRaw = null;
    try {
      const saved = window.localStorage.getItem(pendingKey);
      if (saved !== null) {
        recoveryRaw = saved;
        pending = checkedExtensionCommand(JSON.parse(saved));
        recoveryRaw = null;
      }
    } catch {
      recoveryError = true;
      status(
        'Gespeicherter Installationsauftrag ist nicht sicher lesbar. Neue Änderungen bleiben gesperrt.',
        true,
      );
    }
  }
  function lock() {
    const blocked = busy || !!pending || recoveryError;
    for (const input of get('extension-rights').querySelectorAll<HTMLInputElement>('input'))
      input.disabled = blocked;
    get<HTMLButtonElement>('extension-install').disabled =
      blocked ||
      !preview ||
      [...get('extension-rights').querySelectorAll<HTMLInputElement>('input')].some(
        (c) => !c.checked,
      );
    get<HTMLButtonElement>('extension-pick').disabled = blocked;
    get<HTMLButtonElement>('extension-outcome').hidden = !pending;
    get<HTMLButtonElement>('extension-more').disabled = busy || !!pending;
    for (const b of get('extension-list').querySelectorAll<HTMLButtonElement>('button'))
      b.disabled = blocked;
    const recovery = get('extension-recovery');
    recovery.hidden = !recoveryError;
    get<HTMLButtonElement>('extension-reset-recovery').disabled =
      busy || !listReady || recoveryRaw === null;
  }
  function showPreview() {
    get('extension-preview').hidden = !preview;
    get('extension-rights').replaceChildren();
    if (preview) {
      get('extension-description').textContent =
        preview.manifest.name +
        ' · ' +
        preview.manifest.id +
        ' · ' +
        preview.manifest.version +
        ' · ' +
        preview.bytes +
        ' Bytes';
      get('extension-hash').textContent = preview.hash;
      for (const right of preview.manifest.rights) {
        const label = document.createElement('label'),
          input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.right = right;
        label.className = 'check-label';
        label.append(input, document.createTextNode(labels[right]));
        input.onchange = lock;
        get('extension-rights').append(label);
      }
    }
    lock();
  }
  async function list(more = false) {
    const owner = generation,
      id = ++request,
      response = await window.campaign.extensions(more ? cursor : null);
    if (owner !== generation || id !== request || !dialog.open) return;
    const page = unwrap(response);
    if (!more) {
      get('extension-list').replaceChildren();
      listReady = false;
    }
    cursor = page.next;
    if (!cursor) listReady = true;
    get<HTMLButtonElement>('extension-more').hidden = !cursor;
    for (const item of page.items) {
      const row = document.createElement('article'),
        title = document.createElement('p');
      title.textContent =
        item.manifest.name +
        ' · ' +
        item.manifest.version +
        ' · ' +
        (item.state === 'removed'
          ? 'Entfernt'
          : !item.manifest.rights.length
            ? 'Installiert · keine Rechte angefordert'
            : item.grants.length
              ? 'Installiert · Rechte bestätigt'
              : 'Installiert · Rechte widerrufen');
      row.append(title);
      if (item.state === 'installed')
        for (const [kind, label] of [
          ['revoke', 'Rechte widerrufen'],
          ['remove', 'Paket entfernen'],
        ] as const) {
          if (kind === 'revoke' && !item.grants.length) continue;
          const b = document.createElement('button');
          b.textContent = label;
          b.onclick = () => {
            void execute({
              commandId: crypto.randomUUID(),
              action: { kind, id: item.id, expectedRevision: item.revision },
            });
          };
          row.append(b);
        }
      get('extension-list').append(row);
    }
    for (const p of page.problems) {
      const text = document.createElement('p');
      text.setAttribute('role', 'status');
      text.textContent = p.id + ': ' + p.message;
      get('extension-list').append(text);
    }
    lock();
  }
  function keep(command: ExtensionCommand | null) {
    if (command) window.localStorage.setItem(pendingKey, JSON.stringify(command));
    else window.localStorage.removeItem(pendingKey);
    pending = command;
    lock();
  }
  async function confirmed() {
    keep(null);
    preview = null;
    showPreview();
    await list();
    status('Installationsstand bestätigt.');
  }
  async function execute(command: ExtensionCommand) {
    if (busy || pending || recoveryError) return;
    busy = true;
    lock();
    try {
      keep(command);
      const response = await window.campaign.executeExtension(command);
      if (!response.ok) {
        keep(null);
        throw new Error(response.error);
      }
      await confirmed();
    } catch (error) {
      status((error as Error).message + (pending ? ' Antwort fehlt. Ergebnis prüfen.' : ''), true);
    } finally {
      busy = false;
      lock();
    }
  }
  get('extensions-open').onclick = () => {
    opener = document.activeElement as HTMLElement | null;
    generation++;
    listReady = false;
    cursor = null;
    if (!busy) readRecovery();
    dialog.showModal();
    get('extensions-heading').focus({ preventScroll: true });
    showPreview();
    void list().catch((e) => status(e.message, true));
  };
  function close() {
    generation++;
    request++;
    dialog.close();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  get('extensions-close').onclick = close;
  dialog.addEventListener('cancel', () => {
    generation++;
    request++;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  get('extension-pick').onclick = () => {
    if (busy || pending || recoveryError) return;
    const owner = generation,
      id = ++request;
    preview = null;
    showPreview();
    busy = true;
    lock();
    void window.campaign
      .extensionPreview()
      .then((response) => {
        if (owner !== generation || id !== request || !dialog.open) return;
        const value = unwrap(response);
        if (value) {
          preview = value;
          showPreview();
        }
      })
      .catch((e) => {
        if (owner === generation) status(e.message, true);
      })
      .finally(() => {
        busy = false;
        lock();
      });
  };
  get('extension-install').onclick = () => {
    if (!preview || busy || pending || recoveryError) return;
    const rights = [...get('extension-rights').querySelectorAll<HTMLInputElement>('input')]
      .filter((c) => c.checked)
      .map((c) => c.dataset.right as ExtensionRight);
    if (rights.length !== preview.manifest.rights.length) return;
    void execute({
      commandId: crypto.randomUUID(),
      action: {
        kind: 'install',
        ticket: preview.ticket,
        hash: preview.hash,
        expectedRevision: preview.expectedRevision,
        rights,
      },
    });
  };
  get('extension-outcome').onclick = () => {
    const command = pending;
    if (!command || busy) return;
    busy = true;
    lock();
    void window.campaign
      .extensionOutcome(command)
      .then(async (response) => {
        const result = unwrap(response);
        if (result) await confirmed();
        else {
          keep(null);
          preview = null;
          showPreview();
          status('Installation nicht bestätigt. Paket bei Bedarf erneut wählen.');
        }
      })
      .catch((e) => status(e.message, true))
      .finally(() => {
        busy = false;
        lock();
      });
  };
  get('extension-reset-recovery').onclick = () => {
    const damaged = recoveryRaw;
    if (busy || !recoveryError || !listReady || damaged === null) return;
    busy = true;
    lock();
    try {
      if (window.localStorage.getItem(pendingKey) !== damaged)
        throw new Error(
          'Der gespeicherte Installationsauftrag hat sich geändert. Dialog schließen und erneut öffnen.',
        );
      window.localStorage.setItem('extension-damaged-write:' + crypto.randomUUID(), damaged);
      window.localStorage.removeItem(pendingKey);
      if (window.localStorage.getItem(pendingKey) !== null)
        throw new Error('Der beschädigte Installationsauftrag konnte nicht entfernt werden.');
      recoveryError = false;
      recoveryRaw = null;
      pending = null;
      preview = null;
      showPreview();
      status('Beschädigten Installationsauftrag gesichert und zurückgesetzt.');
    } catch (error) {
      status((error as Error).message, true);
    } finally {
      busy = false;
      lock();
    }
  };
  get('extension-more').onclick = () => {
    void list(true).catch((e) => status(e.message, true));
  };
  lock();
}
