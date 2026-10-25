import { BrowserWindow, dialog, net, protocol } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { copyAudio, exportAudioBundle, importAudioBundle, type TransferHooks } from './audio-files';
import { audioResponse } from './audio-response';
import type { HostIpc } from './host-ipc';
import { StoreClient } from './store-client';
export function registerMediaHost(host: {
  ipc: HostIpc;
  store: StoreClient;
  win: BrowserWindow;
  dataDir: string;
  root: string;
  campaignBusy: () => boolean;
}) {
  const { store, win, dataDir } = host;
  const scope = host.ipc.scope(),
    handle = scope.handle;
  const { root } = host;
  let audioBusy = false,
    audioCancelled = false;
  protocol.handle('campaign', async (request) => {
    const url = new URL(request.url);
    if (url.host === 'app' && url.pathname.startsWith('/audio/')) {
      try {
        const id = decodeURIComponent(url.pathname.slice(7)),
          filename = await store.audioFile(id);
        return audioResponse(filename, request, (url, options) => net.fetch(url, options)).catch(
          () => new Response('Audio unavailable', { status: 404 }),
        );
      } catch {
        return new Response('Audio unavailable', { status: 404 });
      }
    }
    if (url.pathname.startsWith('/player/art/') && url.host === 'app') {
      try {
        const id = decodeURIComponent(url.pathname.split('/').at(-1)!),
          frame = await store.currentPlayerFrame();
        if (frame.mode !== 'image' || frame.imageId !== id)
          return new Response('Image unavailable', { status: 404 });
        return net.fetch(pathToFileURL(await store.playerImageFile(id)).href);
      } catch {
        return new Response('Image unavailable', { status: 404 });
      }
    }
    const name = url.pathname.slice(1);

    if (
      url.host !== 'app' ||
      ![
        'index.html',
        'renderer.js',
        'atlas-brush-worker.js',
        'preset-settings.js',
        'preset-settings.css',
        'app.css',
        'player.css',
        'atlas-deck-runtime.js',
        'atlas-fonts/NotoSans-VF.ttf',
        'atlas-fonts/NotoSansSymbols-VF.ttf',
      ].includes(name)
    )
      return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(path.join(root, name)).href);
  });
  const hooks: TransferHooks = {
    cancelled: () => audioCancelled,
    progress: (p) => {
      if (!win.isDestroyed()) win.webContents.send('music:progress', p);
    },
  };
  async function transfer<T>(task: () => Promise<T>) {
    if (audioBusy || host.campaignBusy())
      throw new Error('Eine Kampagnen- oder Medienübertragung läuft bereits.');
    audioBusy = true;
    audioCancelled = false;
    try {
      return await task();
    } finally {
      audioBusy = false;
      hooks.progress({
        phase: audioCancelled ? 'Abgebrochen' : 'Fertig',
        bytes: 0,
        files: 0,
        busy: false,
      });
    }
  }
  handle(
    'campaign:music-favorites',
    async (token: string, after: string | null) => await store.musicFavorites(token, after),
  );
  handle(
    'music:assets',
    async (query: import('../src/app/runtime/music-contracts').AudioQuery) =>
      await store.audioAssets(query),
  );
  handle('music:asset', async (id: string) => await store.audioAsset(id));
  handle('music:view', async (token: string) => await store.music(token));
  handle(
    'music:subject',
    async (
      token: string,
      kind: import('../src/app/runtime/music-contracts').MusicSubject['kind'],
      id: string,
    ) => await store.musicSubject(token, kind, id),
  );
  handle(
    'music:execute',
    async (command: import('../src/app/runtime/music-contracts').MusicCommand) =>
      await store.executeMusic(command),
  );
  handle(
    'music:position',
    async (token: string, id: string, seconds: number) =>
      await store.musicPosition(token, id, seconds),
  );
  handle('music:cancel', () => {
    audioCancelled = true;
  });
  handle('music:pick', (token: string) =>
    transfer(async () => {
      await store.music(token);
      const selection = await dialog.showOpenDialog(win, {
        title: 'Lokale Audiodateien hinzufügen',
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Audio',
            extensions: ['mp3', 'ogg', 'oga', 'opus', 'wav', 'flac', 'm4a', 'aac'],
          },
        ],
      });
      if (selection.canceled) return { cancelled: true, ids: [] };
      const medias: import('../src/app/runtime/music-contracts').AudioAsset['media'][] = [];
      for (const filename of selection.filePaths)
        medias.push(await copyAudio(filename, path.join(dataDir, 'audio'), hooks));
      if (audioCancelled) throw new Error('Audioimport abgebrochen.');
      return {
        cancelled: false,
        ids: (await store.ingestAudios(token, medias)).map((a) => a.id),
      };
    }),
  );
  handle('music:export', (token: string) =>
    transfer(async () => {
      const library = await store.audioLibrary(token),
        selection = await dialog.showSaveDialog(win, {
          title: 'Musikbibliothek mit Medien exportieren',
          defaultPath: 'Musikbibliothek.kwmusic',
          filters: [{ name: 'SaltMarcher Musikbibliothek', extensions: ['kwmusic'] }],
        });
      if (selection.canceled || !selection.filePath) return { cancelled: true };
      await exportAudioBundle(selection.filePath, path.join(dataDir, 'audio'), library, hooks);
      return { cancelled: false };
    }),
  );
  handle('music:import', (token: string) =>
    transfer(async () => {
      await store.music(token);
      const selection = await dialog.showOpenDialog(win, {
        title: 'Musikbibliothek importieren',
        properties: ['openFile'],
        filters: [{ name: 'SaltMarcher Musikbibliothek', extensions: ['kwmusic'] }],
      });
      if (selection.canceled) return { cancelled: true, ids: [] };
      const library = await importAudioBundle(
        selection.filePaths[0]!,
        path.join(dataDir, 'audio'),
        hooks,
      );
      if (audioCancelled) throw new Error('Bibliotheksimport abgebrochen.');
      return { cancelled: false, ids: await store.mergeAudioLibrary(token, library) };
    }),
  );
  return {
    get busy() {
      return audioBusy;
    },
    close() {
      scope.dispose();
      protocol.unhandle('campaign');
    },
  };
}
