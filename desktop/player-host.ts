import { BrowserWindow, dialog, ipcMain, nativeImage, net, screen, session } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { HostIpc } from './host-ipc';
import { installPlayerResources } from './player-resources';
import { PlayerDisplay } from './player-window';
import { StoreClient } from './store-client';
export function registerPlayerHost(host: {
  ipc: HostIpc;
  store: StoreClient;
  win: BrowserWindow;
  dataDir: string;
  root: string;
  stopping: () => boolean;
}) {
  const { store, win, dataDir } = host;
  const scope = host.ipc.scope(),
    handle = scope.handle;
  const { root } = host;
  const playerOrigin = 'campaign://player/player-display.html';
  const playerSession = session.fromPartition('player-display');
  const releaseResources = installPlayerResources(playerSession, {
    windowId: () => playerDisplay.window?.webContents.id ?? null,
    current: async () => {
      const window = playerDisplay.window;
      if (!window) return null;
      const frame = (await playerDisplay.frame()).frame;
      return {
        windowId: window.webContents.id,
        imageId: frame.mode === 'image' ? (frame.imageId ?? null) : null,
      };
    },
    uiFile: (name) => path.join(root, name),
    imageFile: async (id) => await store.playerImageFile(id),
    fetchFile: (filename) => net.fetch(pathToFileURL(filename).href),
  });
  const playerDisplay = new PlayerDisplay({
    current: async () => await store.currentPlayerDisplay(),
    origin: playerOrigin,
    stopping: host.stopping,
    create: () => {
      const window = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 400,
        minHeight: 300,
        title: 'Spieleranzeige',
        backgroundColor: '#000000',
        show: false,
        webPreferences: {
          session: playerSession,
          preload: path.join(__dirname, 'player-preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        },
      });
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      window.webContents.on('will-navigate', (event) => event.preventDefault());
      return window;
    },
    layout: (settings) => {
      const displays = screen.getAllDisplays(),
        display =
          displays.find((d) => d.id === settings.displayId) ??
          displays.find((d) => d.id !== screen.getPrimaryDisplay().id) ??
          screen.getPrimaryDisplay();
      return { bounds: display.workArea, fullscreen: settings.fullscreen };
    },
    closed: async (token) => await store.closePlayerWindow(token),
    error: (error) =>
      console.error(
        'Spieleranzeige konnte nicht aktualisiert werden.',
        error instanceof Error ? error.message : error,
      ),
  });
  ipcMain.handle('player:frame', async (event) => {
    const window = playerDisplay.window;
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== playerOrigin
    )
      return { ok: false, error: 'Zugriff verweigert.' };
    return { ok: true, value: await playerDisplay.frame() };
  });
  handle(
    'player:view',
    async (token: string, query?: import('../src/app/runtime/player-contracts').PlayerMapQuery) =>
      await store.playerView(token, query),
  );
  handle(
    'player:execute',
    async (command: import('../src/app/runtime/player-contracts').PlayerCommand) =>
      await store.executePlayer(command),
  );
  handle('player:screens', () =>
    screen.getAllDisplays().map((d) => ({
      id: d.id,
      name: d.label || 'Bildschirm ' + d.id + ' · ' + d.size.width + ' × ' + d.size.height,
    })),
  );
  handle('player:window', async (token: string, open: boolean) => {
    if (typeof open !== 'boolean') throw new Error('Fensteraktion prüfen.');
    await store.playerWindowOpen(token, open);
  });
  handle(
    'player:art',
    async (
      token: string,
      kind: import('../src/app/runtime/player-contracts').PlayerAsset['kind'],
      subjectId: string | null,
      title: string,
    ) => {
      await store.playerView(token);
      const pick = await dialog.showOpenDialog(win, {
        title: 'Bild für Spieleranzeige hinterlegen',
        properties: ['openFile'],
        filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });
      if (pick.canceled || !pick.filePaths[0]) return null;
      const filename = pick.filePaths[0];
      if ((await stat(filename)).size > 32 * 1024 * 1024)
        throw new Error('Bild ist größer als 32 MiB.');
      const image = nativeImage.createFromPath(filename),
        size = image.getSize();
      if (image.isEmpty() || size.width > 8192 || size.height > 8192)
        throw new Error('Bildformat oder Bildmaße prüfen (maximal 8192 × 8192).');
      const bytes = image
          .resize({
            width: Math.min(size.width, 2400),
            height: Math.round(size.height * Math.min(1, 2400 / size.width)),
          })
          .toPNG(),
        sha256 = createHash('sha256').update(bytes).digest('hex'),
        dir = path.join(dataDir, 'player-images');
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, sha256 + '.png'), bytes);
      return await store.registerPlayerAsset(token, {
        id: randomUUID(),
        kind,
        subjectId,
        title,
        sha256,
        extension: '.png',
        bytes: bytes.length,
      });
    },
  );
  let closed = false;
  return {
    sync: () => playerDisplay.sync(),
    close() {
      if (closed) return;
      closed = true;
      scope.dispose();
      ipcMain.removeHandler('player:frame');
      playerDisplay.shutdown();
      releaseResources();
    },
  };
}
