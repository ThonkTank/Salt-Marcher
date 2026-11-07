import { reportError } from './error-diagnostics';
import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { clearProjectionWork } from '../src/app/storage/atlas-projection-index';
import { clearCorruptAtlasTileCaches } from '../src/app/storage/atlas-tile-cache';
import { registerAtlasHost } from './atlas-host';
import { clearCampaignStaging } from './campaign-erasure';
import { registerCampaignHost } from './campaign-host';
import { registerCatalogHost } from './catalog-host';
import { connectDevelopment } from './development';
import { HostIpc } from './host-ipc';
import { registerMediaHost } from './media-host';
import { registerPlayerHost } from './player-host';
import { registerPreparationHost } from './preparation-host';
import { registerRuntimeHost } from './runtime-host';
import { StoreClient } from './store-client';
import { openUpdateRuntime } from './update-runtime';
import { UpdateService } from './update-service';
import { registerUpdatesHost } from './updates-host';
import { registerWorkspaceHost } from './workspace-host';
declare const __APP_VERSION__: string;
declare const __SALT_DEV__: boolean;
app.setName('SaltMarcher');
const dataFlag = process.argv.indexOf('--data-dir');
const dataDir =
  dataFlag >= 0
    ? path.resolve(process.argv[dataFlag + 1]!)
    : path.join(app.getPath('appData'), 'CampaignWorkbench');
mkdirSync(dataDir, { recursive: true });
app.setPath('userData', dataDir);
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'campaign',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let development: ReturnType<typeof connectDevelopment> = null;
  let win: BrowserWindow;
  let store: StoreClient;
  let closeAllowed = false;
  let stopping = false,
    storeClosed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let backupTask: Promise<void> | null = null;
  let updateRuntime: Awaited<ReturnType<typeof openUpdateRuntime>> | null = null;
  let backupRunning = false;
  let backupError: string | null = null;
  const finishPendingCampaignErasure = (id: string) => store.finishCampaignErasureFiles(id);
  const root = path.join(__dirname, 'ui');
  const origin = 'campaign://app/index.html';
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      updateRuntime = await openUpdateRuntime(process.execPath, dataDir);
      const updatesService = new UpdateService({
        version: __APP_VERSION__,
        root: updateRuntime.root,
        settings: path.join(dataDir, 'update-settings.json'),
        publicKey: updateRuntime.root ? await updateRuntime.publicKey() : '',
        emit: (status) => {
          if (win && !win.isDestroyed()) win.webContents.send('update:status', status);
        },
      });
      await updatesService.init();
      store = new StoreClient(path.join(dataDir, 'workbench.sqlite'), __APP_VERSION__);
      store.on('failure', (error) => reportError(error, { phase: 'store-lifecycle' }));
      await store.ready;
      await clearProjectionWork(path.join(dataDir, 'atlas-region-cache'));
      await clearCorruptAtlasTileCaches(path.join(dataDir, 'atlas-region-cache'));
      clearCampaignStaging(dataDir);
      for (const id of await store.pendingCampaignErasures())
        await finishPendingCampaignErasure(id);
      win = new BrowserWindow({
        show: !updateRuntime.transaction,
        width: 1280,
        height: 880,
        minWidth: 640,
        minHeight: 480,
        title: 'SaltMarcher',
        backgroundColor: '#edf1f6',
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', (event) => event.preventDefault());
      win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      win.webContents.session.webRequest.onBeforeRequest((details, callback) =>
        callback({
          cancel:
            !details.url.startsWith('campaign://app/') &&
            !details.url.startsWith('campaign://player/') &&
            !details.url.startsWith(pathToFileURL(root + path.sep).href) &&
            !details.url.startsWith(pathToFileURL(path.join(dataDir, 'audio') + path.sep).href) &&
            !details.url.startsWith(
              pathToFileURL(path.join(dataDir, 'player-images') + path.sep).href,
            ),
        }),
      );
      const ipc = new HostIpc(ipcMain, {
        contents: () => win.webContents,
        origin,
        stopping: () => stopping,
        erasing: () => campaign.erasing,
        syncPlayer: () => player.sync(),
      });
      const base = { ipc, store, win, dataDir };
      const player = registerPlayerHost({
        ...base,
        root,
        stopping: () => stopping || closeAllowed,
      });
      const atlas = registerAtlasHost({
        ...base,
        dungeonImport: (ticket) => campaign.dungeonImport(ticket),
      });
      const media = registerMediaHost({ ...base, root, campaignBusy: () => campaign.busy });
      const campaign = registerCampaignHost({
        ...base,
        version: __APP_VERSION__,
        audioBusy: () => media.busy,
        backup: () => backupTask,
        cancelReads: () => atlas.cancelReads(),
        cancelRegions: () => atlas.cancelRegions(),
      });
      const preparation = registerPreparationHost(base),
        catalog = registerCatalogHost(base),
        runtime = registerRuntimeHost(base),
        workspace = registerWorkspaceHost({ ...base, backupError: () => backupError });
      const updates = registerUpdatesHost({
        ipc,
        win,
        service: updatesService,
        runtime: updateRuntime,
        stopping: () => stopping,
        storeClosed: () => storeClosed,
        resume: () => {
          stopping = false;
        },
        allowClose: () => {
          closeAllowed = true;
        },
        finishClose,
      });
      async function finishClose(updateRequest?: string) {
        if (stopping) return;
        stopping = true;
        clearInterval(timer);
        await ipc.drain();
        const shutdown = store.close();
        await backupTask;
        await atlas.close();
        await campaign.close();
        media.close();
        preparation.close();
        catalog.close();
        runtime.close();
        workspace.close();
        updates.close();
        player.close();
        const ended = await shutdown;
        storeClosed = true;
        if (!ended.databaseClosed)
          dialog.showErrorBox(
            'Speicherprozess unerwartet beendet',
            'Speicherbestätigungen bleiben ungeklärt. Nach Neustart die Buchungsbelege prüfen.',
          );
        if (updateRequest) await updateRuntime!.handoff(updateRequest);
        await updateRuntime!.close();
        closeAllowed = true;
        ipcMain.removeListener('campaign:close-ready', closeReady);
        development?.closed(ended.databaseClosed);
        app.quit();
      }
      function closeReady(event: Electron.IpcMainEvent) {
        if (ipc.trusted(event))
          void finishClose().catch((error) => {
            reportError(error, { phase: 'host-close' });
            dialog.showErrorBox('Schließen fehlgeschlagen', String(error));
          });
      }
      ipcMain.on('campaign:close-ready', closeReady);
      win.on('close', (event) => {
        if (!closeAllowed) {
          event.preventDefault();
          if (!stopping) win.webContents.send('campaign:close');
        }
      });
      timer = setInterval(async () => {
        if (campaign.erasing || backupRunning || stopping) return;
        backupRunning = true;
        backupTask = store
          .backup(path.join(dataDir, 'recovery.sqlite'))
          .then(
            () => {
              backupError = null;
            },
            (error) => {
              reportError(error, { phase: 'background-backup' });
              backupError =
                'Wiederherstellungskopie fehlgeschlagen. Die gespeicherten Änderungen liegen im Arbeitsstore.';
            },
          )
          .finally(() => {
            backupRunning = false;
          });
      }, 30000);
      win.on('closed', () => {
        clearInterval(timer);
        player.close();
      });
      await win.loadURL(origin);
      if (typeof __SALT_DEV__ !== 'undefined' && __SALT_DEV__)
        development = connectDevelopment(win, root);
      app.on('before-quit', (event) => {
        if (!closeAllowed && win && !win.isDestroyed()) {
          event.preventDefault();
          win.close();
        }
      });
    })
    .catch((error) => {
      reportError(error, { phase: 'host-start' });
      dialog.showErrorBox('SaltMarcher kann nicht starten', String(error));
      app.exit(1);
    });
  app.on('window-all-closed', () => app.quit());
  // finishClose awaits the writer's closed acknowledgement and actual exit before app.quit.
}
