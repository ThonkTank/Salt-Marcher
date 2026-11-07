import type { WorkspaceGeometry, Result } from './contracts';
import {
  checkedCommitReference,
  commitFingerprintInput,
  type CommitFamily,
  type CommitCommand,
  type CommitReference,
} from './commit-receipt';

export interface CommitResolution {
  ref: CommitReference;
  value: unknown;
  meta: unknown;
}
const entries = new Map<string, { ref: CommitReference; meta: unknown }>(),
  preparing = new Set<string>();
const stateListeners = new Set<() => void>(),
  resolutionListeners = new Set<(event: CommitResolution) => void | Promise<void>>();
let context: () => WorkspaceGeometry | null = () => null,
  tell: (message: string, error?: boolean) => void = () => {},
  checking = false;
const key = (campaignId: string) => 'pending-booking:' + campaignId;
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

function reference(campaignId: string): CommitReference | null {
  const saved = window.localStorage.getItem(key(campaignId));
  if (!saved) return null;
  const ref = JSON.parse(saved) as CommitReference;
  checkedCommitReference(ref);
  if (ref.campaignId !== campaignId)
    throw new Error('Buchungsreferenz gehört zu einer anderen Kampagne.');
  return ref;
}
export function hasPendingCommit(campaignId: string): boolean {
  if (preparing.has(campaignId)) return true;
  try {
    return reference(campaignId) !== null;
  } catch {
    return true;
  }
}
function clear(ref: CommitReference) {
  const current = reference(ref.campaignId);
  if (current?.commandId !== ref.commandId || current.fingerprint !== ref.fingerprint) return;
  window.localStorage.removeItem(key(ref.campaignId));
  entries.delete(ref.campaignId);
  updateCommitControls();
}
export function updateCommitControls() {
  const root = document.getElementById('commit-pending'),
    button = document.getElementById('commit-check') as HTMLButtonElement | null,
    message = document.getElementById('commit-message');
  const w = context();
  for (const [id, entry] of entries) {
    const meta = entry.meta as { token?: string } | undefined;
    if (id !== w?.campaign.id || (meta?.token && meta.token !== w?.token)) entries.delete(id);
  }
  if (root && button && message) {
    try {
      const ref = w ? reference(w.campaign.id) : null;
      root.hidden = !ref;
      message.textContent =
        'Buchung noch nicht bestätigt. Vor weiteren Buchungen den Status prüfen.';
      button.disabled = checking || (!!w && preparing.has(w.campaign.id));
    } catch (error) {
      root.hidden = false;
      message.textContent = (error as Error).message;
      button.disabled = checking;
    }
  }
  for (const listener of stateListeners) listener();
}
export function onCommitState(listener: () => void) {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}
export function onCommitResolved(listener: (event: CommitResolution) => void | Promise<void>) {
  resolutionListeners.add(listener);
  return () => {
    resolutionListeners.delete(listener);
  };
}
export function initCommitControls(getContext: typeof context, status: typeof tell) {
  context = getContext;
  tell = status;
  const button = document.getElementById('commit-check');
  if (button)
    button.onclick = () => {
      void checkPendingCommit().catch((error) => tell(error.message, true));
    };
  updateCommitControls();
}

export async function writeConfirmed<T>(
  family: CommitFamily,
  command: CommitCommand,
  send: () => Promise<Result<T>>,
  isCurrent: () => boolean,
  meta: unknown,
): Promise<T> {
  if (hasPendingCommit(command.campaignId))
    throw new Error('Eine Buchung ist noch ungeklärt. Zuerst ihren Status prüfen.');
  preparing.add(command.campaignId);
  updateCommitControls();
  let ref: CommitReference | undefined;
  try {
    const bytes = new TextEncoder().encode(commitFingerprintInput(family, command));
    const hash = await crypto.subtle.digest('SHA-256', bytes),
      fingerprint = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (!isCurrent()) throw new Error('Buchungskontext gewechselt.');
    if (reference(command.campaignId)) throw new Error('Eine frühere Buchung ist noch ungeklärt.');
    ref = { family, commandId: command.commandId, campaignId: command.campaignId, fingerprint };
    window.localStorage.setItem(key(command.campaignId), JSON.stringify(ref));
    entries.set(command.campaignId, { ref, meta });
    updateCommitControls();
    let error: unknown;
    try {
      const response = await send();
      if (response.ok) {
        clear(ref);
        return response.value;
      }
      error = new Error(response.error);
    } catch (failure) {
      error = failure;
    }
    try {
      const result = unwrap(await window.campaign.commitStatus(ref, command.token));
      if (result.outcome === 'applied') {
        clear(ref);
        return result.value as T;
      }
      if (result.outcome === 'not-applied') {
        clear(ref);
        throw error;
      }
    } catch (failure) {
      if (!reference(command.campaignId)) throw failure;
    }
    throw new Error('Buchungsantwort fehlt. Status prüfen; keinen neuen Schreibversuch starten.');
  } finally {
    preparing.delete(command.campaignId);
    updateCommitControls();
  }
}

export async function checkPendingCommit(): Promise<void> {
  if (checking) return;
  const w = context();
  if (!w) return;
  const ref = reference(w.campaign.id);
  if (!ref) return;
  checking = true;
  updateCommitControls();
  try {
    const result = unwrap(await window.campaign.commitStatus(ref, w.token));
    const current = reference(ref.campaignId);
    if (current?.commandId !== ref.commandId || current.fingerprint !== ref.fingerprint) return;
    if (result.outcome === 'pending') {
      tell('Die Buchung läuft noch. Status später erneut prüfen.');
      return;
    }
    const meta = entries.get(ref.campaignId)?.meta;
    clear(ref);
    if (context()?.token !== w.token) return;
    if (result.outcome === 'not-applied') {
      tell(
        'Buchung nicht durchgeführt. Eingaben bleiben offen; erneut buchen ist eine neue ausdrückliche Aktion.',
      );
      return;
    }
    if (result.outcome === 'applied')
      for (const listener of resolutionListeners)
        await listener({ ref, value: result.value, meta });
    if (context()?.token === w.token) tell('Buchung anhand ihres Belegs bestätigt.');
  } finally {
    checking = false;
    updateCommitControls();
  }
}
