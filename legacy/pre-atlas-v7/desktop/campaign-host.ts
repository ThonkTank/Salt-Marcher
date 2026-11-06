import { BrowserWindow, dialog } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { inspectDungeon } from '../src/app/atlas/import-dungeon';
import type { ChronicleCategory } from '../src/app/runtime/chronicle-contracts';
import type { CampaignRename, DungeonImportPreview, Room } from '../src/app/shared/contracts';
import { cancelCampaignTicket, discardCampaignTickets } from './campaign-erasure';
import { campaignMediaPath, checkCampaignContents, type CampaignManifest } from './campaign-files';
import { exportChronicleFile } from './chronicle-export';
import type { HostIpc } from './host-ipc';
import { StoreClient } from './store-client';
export function registerCampaignHost(host: {
  ipc: HostIpc;
  store: StoreClient;
  win: BrowserWindow;
  dataDir: string;
  version: string;
  audioBusy: () => boolean;
  backup: () => Promise<void> | null;
  cancelReads: () => void;
  cancelRegions: () => Promise<unknown>;
}) {
  const { store, win, dataDir } = host;
  const scope = host.ipc.scope(),
    handle = scope.handle;
  const __APP_VERSION__ = host.version;
  let campaignErasing = false;
  const dungeonImportPreviews = new Map<string, { bytes: Buffer; name: string; rooms: Room[] }>();
  async function catalogOperation(
    c: import('../src/app/campaign/campaign-contracts').CampaignCatalogCommand,
    outcome = false,
  ) {
    const erasing = c.kind === 'erase';
    // Native file operations may await dialogs or streams. Do not delete their bytes mid-flight.
    if (erasing && (host.ipc.activeCount > 1 || campaignBusy || host.audioBusy()))
      throw Error(
        'Laufende Vorgänge zuerst abschließen. Kampagnenlöschung danach erneut versuchen.',
      );
    if (erasing) campaignErasing = true;
    try {
      const result = outcome
        ? await store.campaignCatalogOutcome(c)
        : await store.campaignCatalog(c);
      if (!outcome && (c.kind === 'open' || c.kind === 'create')) dungeonImportPreviews.clear();
      if (
        !outcome &&
        (c.kind === 'trash' || c.kind === 'erase') &&
        currentCampaignSource === c.id
      ) {
        campaignCancelled = true;
        Atomics.store(new Int32Array(campaignCancel), 0, 1);
      }
      if (erasing && result) {
        await host.backup();
        await host.cancelRegions();
        discardCampaignTickets(campaignTickets, c.id);
        await store.finishCampaignErasureFiles(c.id);
      }
      return result;
    } finally {
      if (erasing) campaignErasing = false;
    }
  }
  handle(
    'campaign:catalog',
    (c: import('../src/app/campaign/campaign-contracts').CampaignCatalogCommand) =>
      catalogOperation(c),
  );
  handle(
    'campaign:catalog-outcome',
    (c: import('../src/app/campaign/campaign-contracts').CampaignCatalogCommand) =>
      catalogOperation(c, true),
  );
  handle('campaign:catalog-shell', async (id: string) => {
    host.cancelReads();
    return await store.campaignCatalogWorkspace(id, true);
  });
  handle('campaign:activate-shell', async (id: string) => {
    host.cancelReads();
    dungeonImportPreviews.clear();
    return await store.activateShell(id);
  });
  handle(
    'campaign:catalog-workspace',
    async (id: string) => await store.campaignCatalogWorkspace(id),
  );
  handle('campaign:list', async () => await store.list());
  handle('campaign:create', async (name: string) => await store.create(name));
  handle('campaign:rename', async (command: CampaignRename) => await store.renameCampaign(command));
  handle('campaign:activate', async (id: string) => {
    dungeonImportPreviews.clear();
    return await store.activate(id);
  });
  handle('campaign:session-packet-export', async (token: string, id: string, basis: string) => {
    const packet = await store.sessionPacket(token, id);
    if (packet.basis !== basis)
      throw new Error('Mappenquellen geändert. Aktualisiere die Spielabendmappe.');
    const safe = (packet.planName || 'Spielabend').replace(/[\\/:*?"<>|]+/g, '-'),
      pick = await dialog.showSaveDialog(win, {
        title: 'GM-Spielabendmappe speichern',
        defaultPath: safe + ' – GM-Mappe.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
    if (pick.canceled || !pick.filePath) return { cancelled: true };
    await store.exportSessionPacketFile(pick.filePath, packet, token, id, basis);
    return { cancelled: false };
  });
  const campaignJobsRoot = path.join(dataDir, 'campaign-jobs');
  mkdirSync(campaignJobsRoot, { recursive: true });
  type CampaignTicket = {
    dir: string;
    manifest: CampaignManifest;
    copy: boolean;
    fence: { id: string; revision: number } | null;
    basis?: string;
    problems?: string[];
  };
  const campaignTickets = new Map<string, CampaignTicket>();
  let campaignBusy = false,
    campaignCancelled = false,
    currentCampaignSource: string | null = null,
    acceptingTicket: string | null = null;
  let acceptanceFinished: Promise<void> | null = null;
  const campaignProgress = (
    p: import('../src/app/campaign/campaign-contracts').CampaignTransferProgress,
  ) => {
    if (!win.isDestroyed()) win.webContents.send('campaign:transfer-progress', p);
  };
  async function campaignJob<T>(fn: () => Promise<T>) {
    if (campaignBusy || host.audioBusy())
      throw new Error('Eine Kampagnen- oder Medienübertragung läuft bereits.');
    campaignBusy = true;
    campaignCancelled = false;
    Atomics.store(new Int32Array(campaignCancel), 0, 0);
    try {
      campaignProgress({
        phase: 'Kampagnenübertragung vorbereiten',
        records: 0,
        bytes: 0,
        busy: true,
      });
      return await fn();
    } finally {
      campaignBusy = false;
      currentCampaignSource = null;
      campaignProgress({
        phase: campaignCancelled ? 'Abgebrochen' : 'Fertig',
        records: 0,
        bytes: 0,
        busy: false,
      });
    }
  }
  const campaignCancel = new SharedArrayBuffer(4);
  function campaignAuthority(fence: CampaignTicket['fence']) {
    return { fence, cancel: campaignCancel };
  }
  store.on('progress', campaignProgress);
  async function captureCampaign(token: string) {
    const dir = await mkdtemp(path.join(campaignJobsRoot, 'snapshot-')),
      dbFile = path.join(dir, 'campaign.sqlite');
    try {
      const snapshot = await store.campaignSnapshot(token, dbFile);
      currentCampaignSource = snapshot.id;
      const fence = { id: snapshot.id, revision: snapshot.fence },
        authority = campaignAuthority(fence),
        media = new Map(snapshot.media.map((f) => [f.name, f]));
      const files = [
        { name: 'campaign.sqlite', filename: dbFile },
        ...snapshot.media.map((f) => ({
          name: f.name,
          filename: campaignMediaPath(dataDir, f.name),
        })),
        {
          name: 'catalog/srd-5.1.generated.json',
          filename: path.join(__dirname, 'catalog', 'srd-5.1.generated.json'),
        },
        {
          name: 'catalog/srd-5.1-attribution.md',
          filename: path.join(__dirname, 'catalog', 'SRD-5.1-ATTRIBUTION.md'),
        },
      ];
      const manifest: CampaignManifest = {
        format: 'Kampagnenwerkstatt Campaign',
        version: 1,
        campaignId: snapshot.id,
        name: snapshot.name,
        applicationVersion: __APP_VERSION__,
        schema: snapshot.schema,
        createdAt: new Date().toISOString(),
        files: [],
      };
      for (const file of files) {
        const actual = {
            name: file.name,
            sha256: await store.campaignFileDigest(file.filename, authority),
            bytes: (await stat(file.filename)).size,
          },
          expected = media.get(file.name);
        if (expected && (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes))
          throw new Error('Kampagnenmedien fehlen oder sind verändert: ' + file.name);
        manifest.files.push(actual);
      }
      checkCampaignContents(manifest, snapshot);
      if (campaignCancelled) throw new Error('Kampagnenübertragung abgebrochen.');
      await store.campaignFence(fence.id, fence.revision);
      return { dir, manifest, files, fence };
    } catch (e) {
      await rm(dir, { recursive: true, force: true });
      throw e;
    }
  }
  async function campaignPreview(ticket: CampaignTicket) {
    try {
      const preview = await store.campaignPreview(path.join(ticket.dir, 'campaign.sqlite'));
      checkCampaignContents(ticket.manifest, preview);
      const catalog = ticket.manifest.files.find(
          (f) => f.name === 'catalog/srd-5.1.generated.json',
        ),
        problems: string[] = [];
      if (
        !catalog ||
        catalog.sha256 !==
          (await store.campaignFileDigest(
            path.join(__dirname, 'catalog', 'srd-5.1.generated.json'),
            campaignAuthority(ticket.fence),
          ))
      )
        problems.push('Der Kreaturkatalog des Pakets passt nicht zu dieser Produktversion.');
      const key = randomUUID();
      ticket.basis = JSON.stringify(preview.conflicts);
      ticket.problems = problems;
      campaignTickets.set(key, ticket);
      return {
        ticket: key,
        name: preview.name,
        campaignId: preview.id,
        applicationVersion: ticket.manifest.applicationVersion,
        schema: preview.schema,
        counts: preview.counts,
        audioFiles: ticket.manifest.files.filter((f) => f.name.startsWith('audio/')).length,
        bytes: ticket.manifest.files.reduce((n, f) => n + f.bytes, 0),
        conflicts: preview.conflicts,
        problems,
        copy: ticket.copy,
      };
    } catch (error) {
      await rm(ticket.dir, { recursive: true, force: true });
      throw error;
    }
  }
  handle('campaign:overview', async () => await store.campaignOverview());
  handle('campaign:export', (token: string) =>
    campaignJob(async () => {
      const campaign = await store.campaignIdentity(token);
      const selection = await dialog.showSaveDialog(win, {
        title: 'Kampagne vollständig exportieren',
        defaultPath: campaign.name + '.kwcampaign',
        filters: [{ name: 'SaltMarcher Kampagne', extensions: ['kwcampaign'] }],
      });
      if (selection.canceled || !selection.filePath || campaignCancelled)
        return { cancelled: true };
      const capture = await captureCampaign(token);
      try {
        await store.exportCampaignFile(
          selection.filePath,
          capture.manifest,
          capture.files,
          campaignAuthority(capture.fence),
        );
        return { cancelled: false };
      } finally {
        await rm(capture.dir, { recursive: true, force: true });
      }
    }),
  );
  handle('campaign:copy-preview', (token: string) =>
    campaignJob(async () => {
      const capture = await captureCampaign(token);
      return campaignPreview({
        dir: capture.dir,
        manifest: capture.manifest,
        copy: true,
        fence: capture.fence,
      });
    }),
  );
  handle('campaign:import-preview', () =>
    campaignJob(async () => {
      const selection = await dialog.showOpenDialog(win, {
        title: 'Kampagnenpaket auswählen',
        properties: ['openFile'],
        filters: [{ name: 'SaltMarcher Kampagne', extensions: ['kwcampaign'] }],
      });
      if (selection.canceled) return null;
      const extracted = await store.extractCampaignFile(
        selection.filePaths[0]!,
        campaignJobsRoot,
        campaignAuthority(null),
      );
      return campaignPreview({ ...extracted, copy: false, fence: null });
    }),
  );
  handle('campaign:transfer-status', async (ticketId: string) => {
    const pending = acceptingTicket === ticketId;
    const campaign = await store.campaignTransferOutcome(ticketId);
    return campaign
      ? { state: 'applied' as const, campaign }
      : {
          state:
            pending || acceptingTicket === ticketId
              ? ('pending' as const)
              : ('not-applied' as const),
        };
  });
  handle(
    'campaign:transfer-accept',
    (
      ticketId: string,
      name: string,
      choices: Record<string, import('../src/app/campaign/campaign-contracts').ConflictChoice>,
    ) =>
      campaignJob(async () => {
        acceptingTicket = ticketId;
        let finishAcceptance!: () => void;
        acceptanceFinished = new Promise<void>((resolve) => {
          finishAcceptance = resolve;
        });
        try {
          const confirmed = await store.campaignTransferOutcome(ticketId, { name, choices });
          if (confirmed) return confirmed;
          const ticket = campaignTickets.get(ticketId);
          if (!ticket) throw new Error('Importvorschau nicht mehr verfügbar.');
          const campaign = await store.acceptPreparedCampaignFile(
            { ...ticket, acceptanceId: ticketId },
            name,
            choices,
            campaignAuthority(ticket.fence),
          );
          campaignTickets.delete(ticketId);
          try {
            await rm(ticket.dir, { recursive: true, force: true });
          } catch (e) {
            console.error(
              'Kampagne übernommen; temporäre Paketbereinigung steht aus.',
              e instanceof Error ? e.message : e,
            );
          }
          return campaign;
        } finally {
          acceptingTicket = null;
          acceptanceFinished = null;
          finishAcceptance();
        }
      }),
  );
  handle('campaign:transfer-cancel', async (ticketId?: string) => {
    campaignCancelled = true;
    Atomics.store(new Int32Array(campaignCancel), 0, 1);
    if (ticketId)
      await cancelCampaignTicket(
        campaignTickets,
        ticketId,
        acceptingTicket === ticketId ? acceptanceFinished : null,
      );
  });
  let chronicleExport: { id: string; cancelled: boolean } | null = null;
  handle('campaign:chronicle-export-cancel', (id: string) => {
    if (chronicleExport?.id === id) chronicleExport.cancelled = true;
  });
  handle(
    'campaign:chronicle-export',
    async (
      token: string,
      category: ChronicleCategory | 'all',
      search: string,
      requestId = randomUUID(),
    ) => {
      if (chronicleExport) throw new Error('Eine Chronik-Ausgabe läuft bereits.');
      if (typeof requestId !== 'string' || !requestId || requestId.length > 100)
        throw new Error('Chronik-Ausgabeauftrag ungültig.');
      const state = { id: requestId, cancelled: false };
      chronicleExport = state;
      let written = 0,
        snapshot: { id: string } | undefined;
      const progress = (busy: boolean) => {
          if (!win.isDestroyed())
            win.webContents.send('campaign:chronicle-export-progress', {
              requestId,
              written,
              busy,
            });
        },
        check = () => {
          if (state.cancelled || win.isDestroyed()) throw new Error('Chronik-Ausgabe abgebrochen.');
        };
      try {
        snapshot = await store.chronicleExportSnapshot(token);
        const snapshotId = snapshot.id;
        const initial = await store.chronicleSnapshotRead(snapshotId, category, search, null, 1),
          safe = initial.campaignName.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Kampagne';
        progress(true);
        const destination = await dialog.showSaveDialog(win, {
          defaultPath: safe + ' – Chronik.md',
          filters: [{ name: 'Markdown', extensions: ['md'] }],
        });
        if (destination.canceled || !destination.filePath || state.cancelled)
          return { cancelled: true };
        written = await exportChronicleFile(
          { read: (...args) => store.chronicleSnapshotRead(snapshotId, ...args) },
          category,
          search,
          destination.filePath,
          {
            check,
            progress: (n) => {
              written = n;
              progress(true);
            },
          },
        );
        return { cancelled: false, written };
      } catch (e) {
        if (state.cancelled) return { cancelled: true };
        throw e;
      } finally {
        try {
          if (snapshot) await store.chronicleSnapshotClose(snapshot.id);
        } finally {
          if (chronicleExport === state) chronicleExport = null;
          progress(false);
        }
      }
    },
  );
  handle('campaign:preview-import', async (): Promise<DungeonImportPreview | null> => {
    const chosen = await dialog.showOpenDialog(win, {
      title: 'Dungeon in die Kampagnenwelt einfügen',
      filters: [{ name: 'Dungeon', extensions: ['dungeon'] }],
      properties: ['openFile'],
    });
    if (chosen.canceled || !chosen.filePaths[0]) return null;
    const bytes = readFileSync(chosen.filePaths[0]);
    if (bytes.length > 64 * 1024 * 1024)
      throw new Error('Dieser erste Import kann Dateien bis 64 MiB prüfen.');
    const inspected = inspectDungeon(bytes.toString('utf8')),
      ticket = randomUUID();
    dungeonImportPreviews.clear();
    dungeonImportPreviews.set(ticket, { bytes, name: inspected.name, rooms: inspected.rooms });
    return {
      ticket,
      name: inspected.name,
      roomCount: inspected.rooms.length,
      sourceHash: createHash('sha256').update(bytes).digest('hex'),
      warnings: inspected.warnings,
    };
  });
  handle('campaign:import', async (ticket: string) => {
    const pending = dungeonImportPreviews.get(ticket);
    if (!pending) throw new Error('Importvorschau abgelaufen. Bitte Datei erneut auswählen.');
    const result = await store.create(pending.name, pending.rooms, pending.bytes);
    dungeonImportPreviews.delete(ticket);
    return result;
  });
  return {
    get busy() {
      return campaignBusy;
    },
    get erasing() {
      return campaignErasing;
    },
    dungeonImport: (ticket: string) => dungeonImportPreviews.get(ticket),
    async close() {
      scope.dispose();
      store.off('progress', campaignProgress);
      await Promise.all(
        [...campaignTickets.keys()].map((id) =>
          cancelCampaignTicket(campaignTickets, id, acceptanceFinished),
        ),
      );
      dungeonImportPreviews.clear();
    },
  };
}
