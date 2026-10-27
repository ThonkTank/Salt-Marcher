import { errorDiagnostic, errorText } from './error-diagnostics';
import { parentPort, workerData } from 'node:worker_threads';
import { dirname } from 'node:path';
import { CampaignStore } from '../src/app/storage/store';
import { AtlasCommitProjectionError } from '../src/app/storage/atlas-commit-projection';
import type { ChronicleReadSession } from '../src/app/storage/chronicle-pages';
import { BackupValidationService } from './backup-validation';
import { finishCampaignErasure } from './campaign-erasure';
import { acceptPreparedCampaign } from './campaign-accept';
import {
  fileDigest,
  exportCampaignArchive,
  extractCampaignArchive,
  type CampaignFileHooks,
} from './campaign-files';
import { exportSessionPacketFile } from './session-packet-export';
import {
  storeMethods,
  isStoreOperation,
  type StoreSpecialOperations,
  type FileAuthority,
} from './store-operations';
import { encodeStoreValue, decodeStoreValue, type StoreWire } from './store-transport';

const port = parentPort!;
function openStore() {
  try {
    return new CampaignStore(workerData.filename, workerData.applicationVersion);
  } catch (error) {
    port.postMessage({
      kind: 'fatal',
      error: errorText(error),
      diagnostic: errorDiagnostic(error, { phase: 'store-start' }),
    });
    throw error; // Let the worker report its native failure and exit; never start a dispatcher.
  }
}
const store = openStore();
const validation = new BackupValidationService(),
  snapshots = new Map<string, ChronicleReadSession>();
const active = new Set<Promise<void>>();
let closing = false,
  lastId = 0;
function hooks(authority: FileAuthority): CampaignFileHooks {
  const cancelled = new Int32Array(authority.cancel);
  return {
    cancelled: () => Atomics.load(cancelled, 0) !== 0,
    fence: () => {
      if (authority.fence) store.campaignFence(authority.fence.id, authority.fence.revision);
    },
    progress: (value) => port.postMessage({ kind: 'progress', value: encodeStoreValue(value) }),
  };
}
function snapshot(id: string) {
  const value = snapshots.get(id);
  if (!value) throw Error('Chronik-Lesestand nicht mehr verfügbar.');
  return value;
}
const special: StoreSpecialOperations = {
  executeCity: (c) => {
    store.executeAtlasCommit({
      commandId: c.commandId,
      token: c.token,
      campaignId: c.campaignId,
      action:
        c.action.kind === 'undo' || c.action.kind === 'redo'
          ? { kind: c.action.kind }
          : { kind: 'city', command: c },
    });
    return store.city(c.token, c.cityId);
  },
  finishCampaignErasureFiles: (id) => finishCampaignErasure(store, dirname(store.filename), id),
  backup: (filename) => store.backup(filename, (candidate) => validation.validate(candidate)),
  chronicleExportSnapshot: (token) => {
    const value = store.chronicleExportSnapshot(token);
    snapshots.set(value.id, value);
    return { id: value.id };
  },
  chronicleSnapshotRead: (id, ...args) => snapshot(id).read(...args),
  chronicleSnapshotClose: (id) => {
    snapshot(id).close();
    snapshots.delete(id);
  },
  campaignFileDigest: (filename, authority) => fileDigest(filename, hooks(authority)),
  exportCampaignFile: (destination, manifest, entries, authority) =>
    exportCampaignArchive(destination, manifest, entries, hooks(authority)),
  extractCampaignFile: (filename, base, authority) =>
    extractCampaignArchive(filename, base, hooks(authority)),
  acceptPreparedCampaignFile: (ticket, name, choices, authority) =>
    acceptPreparedCampaign(store, ticket, dirname(store.filename), name, choices, hooks(authority)),
  exportSessionPacketFile: (destination, packet, token, id, basis) =>
    exportSessionPacketFile(destination, packet, () => {
      if (store.sessionPacket(token, id).basis !== basis)
        throw Error('Mappenquellen geändert. Aktualisiere die Spielabendmappe.');
    }),
};
const operations: Record<string, (...args: any[]) => unknown> = Object.create(null);
for (const method of storeMethods)
  operations[method] = (...args: any[]) => (store[method] as Function).apply(store, args);
Object.assign(operations, special);
async function close() {
  if (closing) return;
  closing = true;
  // Cancellation waits for the independent validator's actual exit. Its caller
  // then discards its private candidate before this writer closes the database.
  try {
    await validation.close();
    await Promise.allSettled([...active]);
    for (const value of snapshots.values()) value.close();
    snapshots.clear();
    store.close();
    port.postMessage({ kind: 'closed' });
  } catch (error) {
    process.exitCode = 1;
    port.postMessage({
      kind: 'fatal',
      error: errorText(error, true),
      diagnostic: errorDiagnostic(error, { phase: 'store-close' }),
    });
  } finally {
    port.close();
  }
}
port.on('message', (message: { kind: string; id: number; method: string; value: StoreWire }) => {
  if (message.kind === 'close') {
    void close();
    return;
  }
  if (message.kind !== 'call' || closing) return;
  if (!Number.isSafeInteger(message.id) || message.id <= lastId) return; // transport duplicates never dispatch twice
  lastId = message.id;
  const task = Promise.resolve()
    .then(async () => {
      let value: unknown;
      try {
        if (!isStoreOperation(message.method)) throw Error('Store-Operation nicht freigegeben.');
        const args = decodeStoreValue(message.value);
        if (!Array.isArray(args)) throw Error('Ungültiger Store-Auftrag.');
        value = await operations[message.method]!(...args);
      } catch (error) {
        port.postMessage({
          kind: error instanceof AtlasCommitProjectionError ? 'unknown' : 'error',
          id: message.id,
          error: errorText(error),
          diagnostic: errorDiagnostic(error, {
            phase: 'store-operation',
            method: message.method,
            requestId: message.id,
          }),
        });
        return;
      }
      try {
        port.postMessage({ kind: 'result', id: message.id, value: encodeStoreValue(value) });
      } catch (error) {
        port.postMessage({
          kind: 'unknown',
          id: message.id,
          error: errorText(error, true),
          diagnostic: errorDiagnostic(error, {
            phase: 'store-result-encode',
            method: message.method,
            requestId: message.id,
          }),
        });
      }
    })
    .finally(() => active.delete(task));
  active.add(task);
});
port.postMessage({ kind: 'ready' });
