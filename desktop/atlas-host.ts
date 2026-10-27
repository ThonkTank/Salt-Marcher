import { BrowserWindow, dialog, nativeImage } from 'electron';
import { stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { atlasGeometryTileBox } from '../src/app/atlas/atlas-geometry-tile';
import { atlasMaterialTileQuery } from '../src/app/atlas/atlas-material-tile';
import {
  validateAtlasReadRequest,
  type AtlasReadRequest,
} from '../src/app/atlas/atlas-read-request';
import { validateRegion } from '../src/app/atlas/atlas-region-contracts';
import { atlasTerrainTileQuery } from '../src/app/atlas/atlas-terrain-tile';
import { citySvg } from '../src/app/atlas/city-model';
import { dungeonSvg } from '../src/app/atlas/drawing-model';
import { validateTerrainColor } from '../src/app/atlas/terrain-color';
import { terrainSnapshotStillValid } from '../src/app/atlas/terrain-presentation';
import { validateTerrainProjection } from '../src/app/atlas/terrain-projection';
import { dungeonKeyDocument, dungeonKeyMarkdown } from '../src/app/campaign/key-document';
import type { Room } from '../src/app/shared/contracts';
import { AtlasRegionService } from './atlas-region';
import { AtlasWriteActivity } from './atlas-write-activity';
import type { HostIpc } from './host-ipc';
import { RoomDirectoryService } from './room-directory';
import { StoreClient } from './store-client';
import { closeSpatialRoutePreview, spatialRoutePreview } from './terrain-route-service';
export function registerAtlasHost(host: {
  ipc: HostIpc;
  store: StoreClient;
  win: BrowserWindow;
  dataDir: string;
  dungeonImport: (ticket: string) => { bytes: Buffer; name: string; rooms: Room[] } | undefined;
}) {
  const { store, win, dataDir } = host;
  const scope = host.ipc.scope(),
    handle = scope.handle;

  const atlasWriteActivity = new AtlasWriteActivity();
  const roomDirectory = new RoomDirectoryService(),
    atlasRoomDirectory = new RoomDirectoryService(),
    atlasRegions = new AtlasRegionService(
      undefined,
      16 * 1024 * 1024,
      path.join(dataDir, 'atlas-region-cache'),
    ),
    atlasExportRegions = new AtlasRegionService(
      undefined,
      16 * 1024 * 1024,
      path.join(dataDir, 'atlas-region-cache'),
    );
  let graphSourceReadBarrierDepth = 0;
  async function withGraphSourceReadBarrier<T>(operation: () => T | Promise<T>): Promise<T> {
    graphSourceReadBarrierDepth++;
    try {
      await Promise.all([
        roomDirectory.cancelAndWait(),
        atlasRoomDirectory.cancelAndWait(),
        atlasRegions.cancelAndWait(),
        atlasExportRegions.cancelAndWait(),
      ]);
      return await operation();
    } finally {
      graphSourceReadBarrierDepth--;
    }
  }
  handle(
    'campaign:room-directory-cancel',
    async (token: string, consumer: 'atlas' | 'directory' = 'directory') => {
      await store.roomReadSource(token);
      if (!['atlas', 'directory'].includes(consumer)) throw new Error('Raumsuche prüfen.');
      (consumer === 'atlas' ? atlasRoomDirectory : roomDirectory).cancel();
    },
  );
  handle(
    'campaign:room-directory',
    async (
      token: string,
      q: import('../src/app/shared/contracts').RoomDirectoryQuery,
      consumer: 'atlas' | 'directory' = 'directory',
    ) => {
      if (graphSourceReadBarrierDepth)
        throw new Error('Graphwechsel läuft. Raumsuche danach aktualisieren.');
      if (!['atlas', 'directory'].includes(consumer)) throw new Error('Raumsuche prüfen.');
      const source = await store.roomReadSource(token, q);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      const result = await (consumer === 'atlas' ? atlasRoomDirectory : roomDirectory).read(
        source,
        q,
      );
      if ((await store.roomReadSource(token)).fence !== source.fence)
        throw new Error('Raumsuche inzwischen geändert. Suche erneut beginnen.');
      return result;
    },
  );
  handle(
    'dungeon:command-state',
    async (command: import('../src/app/atlas/dungeon-contracts').DungeonCommand) =>
      await store.dungeonCommandState(command),
  );
  handle('dungeon:authoring', async (token: string) => await store.dungeonAuthoring(token));
  handle('dungeon:view', async (token: string) => await store.dungeon(token));
  handle(
    'dungeon:preview',
    async (token: string, r: import('../src/app/atlas/dungeon-contracts').DungeonRequest) =>
      await store.previewDungeon(token, r),
  );
  handle(
    'dungeon:execute',
    async (c: import('../src/app/atlas/dungeon-contracts').DungeonCommand) =>
      await store.executeDungeon(c),
  );
  handle('graph:view', async (token: string, scopeId: string) => await store.graph(token, scopeId));
  handle('graph:execute', async (c: import('../src/app/atlas/graph-contracts').GraphCommand) => {
    if (['restore', 'accept'].includes(c.action?.kind))
      return withGraphSourceReadBarrier(async () => await store.executeGraph(c));
    return await store.executeGraph(c);
  });
  handle(
    'drawing:path-preview',
    async (token: string, p: import('../src/app/atlas/path-contracts').DungeonPath) =>
      await store.previewPath(token, p),
  );
  handle(
    'drawing:map',
    async (token: string, roomId?: string, elementId?: string) =>
      await store.drawingMap(token, roomId, elementId),
  );
  handle(
    'drawing:element',
    async (token: string, id: string) => await store.drawingElement(token, id),
  );
  handle('drawing:view', async (token: string) => await store.drawing(token));
  handle(
    'drawing:execute',
    async (c: import('../src/app/atlas/drawing-contracts').DrawingCommand) =>
      await store.executeDrawing(c),
  );
  handle(
    'drawing:feature',
    async (
      token: string,
      id: string,
      sceneId: string,
      expected: number,
      action: 'activate' | 'reset' | 'correct',
      charges: number | null,
      commandId: string,
    ) => await store.activateFeature(token, id, sceneId, expected, action, charges, commandId),
  );
  handle(
    'drawing:export',
    async (
      token: string,
      scopeId: string,
      floorId: string,
      format: 'svg' | 'json' | 'keys' | 'document',
      publicOnly: boolean,
    ) => {
      if (!['svg', 'json', 'keys', 'document'].includes(format))
        throw new Error('Ausgabeformat unbekannt.');
      await store.drawing(token);
      const g = await store.dungeon(token),
        v = g.drawing,
        rooms = g.rooms.filter((r) => r.scopeId === scopeId && r.floorId === floorId),
        text =
          format === 'svg'
            ? dungeonSvg(
                rooms.filter(
                  (r) => !publicOnly || !v.keyContent?.some((c) => c.id === r.id && c.secret),
                ),
                v,
                scopeId,
                floorId,
                publicOnly,
              )
            : format === 'document'
              ? dungeonKeyDocument(g, scopeId, publicOnly)
              : format === 'keys'
                ? dungeonKeyMarkdown(g, scopeId, publicOnly, floorId)
                : publicOnly
                  ? JSON.stringify(
                      {
                        format: 'Kampagnenwerkstatt Dungeon public',
                        version: 1,
                        scopeId,
                        floorId,
                        svg: dungeonSvg(
                          rooms.filter(
                            (r) => !v.keyContent?.some((c) => c.id === r.id && c.secret),
                          ),
                          v,
                          scopeId,
                          floorId,
                          true,
                        ),
                        key: dungeonKeyMarkdown(g, scopeId, true, floorId),
                      },
                      null,
                      2,
                    )
                  : JSON.stringify(
                      {
                        format: 'Kampagnenwerkstatt Dungeon',
                        version: 1,
                        scopeId,
                        floorId,
                        rooms,
                        view: {
                          ...v,
                          keyContent: v.keyContent?.filter((k) => k.scopeId === scopeId),
                          paths: v.paths?.filter((p) => p.scopeId === scopeId),
                          passages: v.passages?.filter((p) => p.scopeId === scopeId),
                          volumes: v.volumes?.filter((p) => p.scopeId === scopeId),
                          elements: v.elements.filter((e) => e.scopeId === scopeId),
                          styles: v.styles.filter((e) => e.scopeId === scopeId),
                          hiddenRooms: v.hiddenRooms.filter((e) => e.scopeId === scopeId),
                          hiddenFloors: v.hiddenFloors.filter((e) => e.scopeId === scopeId),
                          features: [],
                        },
                      },
                      null,
                      2,
                    );
      const extension = format === 'keys' ? 'md' : format === 'document' ? 'html' : format,
        selection = await dialog.showSaveDialog(win, {
          defaultPath: 'Dungeon.' + extension,
          filters: [{ name: 'Dungeon', extensions: [extension] }],
        });
      if (selection.canceled || !selection.filePath) return { cancelled: true };
      await writeFile(selection.filePath, text);
      return { cancelled: false };
    },
  );
  handle(
    'city:activities',
    async (
      token: string,
      q: import('../src/app/atlas/city-activity-contracts').CityActivityQuery,
    ) => await store.cityActivities(token, q),
  );
  handle(
    'city:buildings',
    async (token: string, q: import('../src/app/atlas/city-contracts').CityBuildingQuery) =>
      await store.cityBuildings(token, q),
  );
  handle(
    'atlas:travel-preview',
    async (token: string, p: import('../src/app/shared/contracts').Point) =>
      await store.previewAtlasTravel(token, p),
  );
  handle(
    'atlas:travel-commit',
    async (c: import('../src/app/atlas/atlas-travel-contracts').AtlasTravelCommand) =>
      await store.executeAtlasTravelCommit(c),
  );
  handle(
    'atlas:travel',
    async (c: import('../src/app/atlas/atlas-travel-contracts').AtlasTravelCommand) =>
      await store.executeAtlasTravel(c),
  );
  handle(
    'atlas:find',
    async (token: string, text: string) => await store.landscapeFind(token, text),
  );
  const referencePreviewCache = new Map<string, string>();
  let referencePreviewBytes = 0;
  handle('atlas:reference-preview', async (token: string, id: string, size: number) => {
    if (typeof id !== 'string' || !id || ![256, 512, 1024, 2048].includes(size))
      throw new Error('Bildvorschau prüfen.');
    const before = await store.atlasRegionSource(token),
      key = JSON.stringify([before.campaignId, before.fence, id, size]),
      cached = referencePreviewCache.get(key);
    if (cached) {
      referencePreviewCache.delete(key);
      referencePreviewCache.set(key, cached);
      return cached;
    }
    const source = await store.referenceAssetSource(token, id),
      image = nativeImage.createFromBuffer(source.bytes),
      dimensions = image.getSize();
    if (image.isEmpty() || dimensions.width < 1 || dimensions.height < 1)
      throw new Error('Bildvorlage nicht lesbar. Original bleibt erhalten.');
    const byteLimit = (size <= 1024 ? 128 : 256) * 1024;
    let edge = Math.min(size, Math.max(dimensions.width, dimensions.height)),
      bytes: Buffer;
    do {
      const factor = Math.min(1, edge / Math.max(dimensions.width, dimensions.height));
      bytes = image
        .resize({
          width: Math.max(1, Math.round(dimensions.width * factor)),
          height: Math.max(1, Math.round(dimensions.height * factor)),
        })
        .toPNG();
      edge = Math.floor(edge / 2);
    } while (bytes.length > byteLimit && edge >= 32);
    if (bytes.length > byteLimit || (await store.atlasRegionSource(token)).fence !== before.fence)
      throw new Error('Bildvorschau inzwischen geändert oder zu groß. Erneut laden.');
    const data = 'data:image/png;base64,' + bytes.toString('base64');
    while (
      referencePreviewBytes + data.length * 2 > 8 * 1024 * 1024 &&
      referencePreviewCache.size
    ) {
      const [old, value] = referencePreviewCache.entries().next().value!;
      referencePreviewBytes -= value.length * 2;
      referencePreviewCache.delete(old);
    }
    referencePreviewCache.set(key, data);
    referencePreviewBytes += data.length * 2;
    return data;
  });
  handle('atlas:reference-import', async (token: string) => {
    await store.atlasIdentity(token);
    const pick = await dialog.showOpenDialog(win, {
      title: 'Nachzeichenvorlage wählen',
      properties: ['openFile'],
      filters: [{ name: 'Bild', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (pick.canceled || !pick.filePaths[0]) return null;
    const file = pick.filePaths[0];
    if ((await stat(file)).size > 32 * 1024 * 1024)
      throw new Error('Vorlage ist größer als 32 MiB.');
    const image = nativeImage.createFromPath(file),
      size = image.getSize();
    if (image.isEmpty() || size.width > 16384 || size.height > 16384)
      throw new Error('Bildmaße prüfen (bis 16384 Pixel).');
    const bytes = image.toPNG(),
      id = await store.registerReference(token, 'image/png', bytes);
    return { id, ...size };
  });
  handle(
    'atlas:export-png',
    async (
      token: string,
      bytes: Uint8Array,
      audience: 'gm' | 'public',
      format: 'png' | 'jpeg' = 'png',
      sourceFence?: string,
    ) => {
      const fence = (await store.atlasRegionSource(token)).fence;
      if (sourceFence !== undefined && sourceFence !== fence)
        throw new Error('Atlas wurde während der Ausgabe geändert. Erneut ausgeben.');
      if (
        !['gm', 'public'].includes(audience) ||
        !(bytes instanceof Uint8Array) ||
        bytes.length > 64 * 1024 * 1024 ||
        bytes.length < 8
      )
        throw new Error('Ungültige PNG-Ausgabe.');
      const buffer = Buffer.from(bytes);
      if (format !== 'png' && format !== 'jpeg') throw new Error('Bildformat prüfen.');
      if (
        format === 'png'
          ? buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
          : buffer.subarray(0, 2).toString('hex') !== 'ffd8'
      )
        throw new Error('Bildsignatur fehlt.');
      const selection = await dialog.showSaveDialog(win, {
        title: 'Atlas ausgeben',
        defaultPath:
          (audience === 'public' ? 'Atlas-Spieler.' : 'Atlas-GM.') +
          (format === 'jpeg' ? 'jpg' : 'png'),
        filters: [{ name: format.toUpperCase(), extensions: [format === 'jpeg' ? 'jpg' : 'png'] }],
      });
      if (selection.canceled || !selection.filePath) return { cancelled: true };
      if ((await store.atlasRegionSource(token)).fence !== fence)
        throw new Error('Atlas wurde während der Ausgabe geändert. Erneut ausgeben.');
      await writeFile(selection.filePath, buffer);
      return { cancelled: false };
    },
  );
  handle(
    'atlas:import',
    async (c: {
      commandId: string;
      token: string;
      campaignId: string;
      ticket: string;
      x: number;
      y: number;
    }) => {
      const pending = host.dungeonImport(c.ticket);
      if (!pending) throw new Error('Importvorschau abgelaufen. Datei erneut wählen.');
      const result = await store.executeAtlas({
        ...c,
        action: {
          kind: 'drawing-import',
          name: pending.name,
          rooms: pending.rooms,
          source: pending.bytes.toString('utf8'),
          x: c.x,
          y: c.y,
        },
      });
      return {
        atlas: result.atlas,
        roomId: (result.result as { roomId: string | null } | null)?.roomId ?? null,
      };
    },
  );
  handle(
    'atlas:territories',
    async (token: string, box?: import('../src/app/atlas/atlas-landscape').LandscapeBox) =>
      await store.atlasTerritories(token, box),
  );
  handle('atlas:overview', async (token: string) => await store.atlasOverview(token));
  handle(
    'atlas:objects',
    async (
      token: string,
      q: import('../src/app/atlas/campaign-atlas-contracts').AtlasObjectQuery,
    ) => await store.atlasObjects(token, q),
  );
  handle(
    'atlas:vegetation-scene',
    async (
      token: string,
      box: import('../src/app/atlas/atlas-landscape').LandscapeBox,
      mpp: number,
    ) => await store.atlasVegetationScene(token, box, mpp),
  );
  handle(
    'atlas:spatial-scene',
    async (
      token: string,
      box: import('../src/app/atlas/atlas-landscape').LandscapeBox,
      mpp: number,
      draft?: import('../src/app/atlas/spatial-terrain').SpatialTerrainDraft,
      fence?: string,
    ) =>
      draft
        ? spatialRoutePreview(store, token, box, mpp, draft, fence)
        : await store.atlasSpatialScene(token, box, mpp, draft, fence),
  );
  handle(
    'atlas:terrain-profile',
    async (token: string, points: import('../src/app/shared/contracts').Point[]) =>
      await store.atlasTerrainProfile(token, points),
  );
  handle(
    'atlas:height',
    async (token: string, point: import('../src/app/shared/contracts').Point) =>
      await store.atlasHeight(token, point),
  );
  handle(
    'atlas:terrain-frame',
    async (
      token: string,
      request: import('../src/app/atlas/terrain-presentation').TerrainFrameRequest,
    ) => {
      const q = request?.frame;
      if (request?.refinement !== undefined && typeof request.refinement !== 'boolean')
        throw Error('Geländeverfeinerung prüfen.');
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      if (q?.kind === 'top') validateRegion(q.query);
      else if (q?.kind === 'tilted') {
        validateTerrainProjection(q.query);
        if (q.query.color || q.query.heightStroke) throw Error('Nur gespeichertes Gelände.');
      } else throw Error('Geländeansicht prüfen.');
      const source = await store.atlasRegionSource(token, atlasRegions.cursor);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      if (request.source?.revision !== source.revision || request.source?.fence !== source.fence)
        throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
      const value = await atlasRegions.liveTerrain(source, q, request.base, request.refinement),
        current = await store.atlasRegionSource(token);
      // A completed, versioned snapshot remains useful during later Atlas writes.
      // Unversioned journal changes, workspace/preview changes and rollbacks fail closed.
      if (!terrainSnapshotStillValid(source, current))
        throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
      return value;
    },
  );
  handle(
    'atlas:terrain-color',
    async (token: string, q: import('../src/app/atlas/terrain-color').TerrainColorRequest) => {
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      validateTerrainColor(q);
      const source = await store.atlasRegionSource(token, atlasRegions.cursor);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      if (source.revision !== q.revision || (q.fence !== undefined && source.fence !== q.fence))
        throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
      const value = await atlasRegions.terrainColor(source, q);
      if ((await store.atlasRegionSource(token)).fence !== source.fence)
        throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
      return value;
    },
  );
  handle(
    'atlas:geometry-tile',
    async (
      token: string,
      q: import('../src/app/atlas/atlas-geometry-tile').AtlasGeometryTileRequest,
    ) => {
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      atlasGeometryTileBox(q);
      const source = await store.atlasRegionSource(token, atlasRegions.cursor);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      if (source.revision !== q.revision) throw Error('Geometriekachel inzwischen geändert.');
      const value = await atlasRegions.geometryTile(source, q);
      if ((await store.atlasRegionSource(token)).fence !== source.fence)
        throw Error('Geometriekachel inzwischen geändert.');
      return value;
    },
  );
  handle('atlas:cancel-read', async (token: string, control: AtlasReadRequest) => {
    await store.atlasRegionSource(token);
    if (!control) throw Error('Kartenleseauftrag fehlt.');
    validateAtlasReadRequest(control);
    atlasRegions.cancelRead(control, token);
    atlasExportRegions.cancelRead(control, token);
  });
  handle(
    'atlas:terrain-tile',
    async (
      token: string,
      q: import('../src/app/atlas/atlas-terrain-tile').AtlasTerrainTileRequest,
      control?: AtlasReadRequest,
    ) => {
      validateAtlasReadRequest(control);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      atlasTerrainTileQuery(q);
      const source = await store.atlasRegionSource(token, atlasExportRegions.cursor);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      if (source.revision !== q.revision) throw Error('Atlaskachel inzwischen geändert.');
      const value = await atlasExportRegions.terrainTile(source, q, control);
      if ((await store.atlasRegionSource(token)).fence !== source.fence)
        throw Error('Atlaskachel inzwischen geändert.');
      return value;
    },
  );
  handle(
    'atlas:material-tile',
    async (
      token: string,
      q: import('../src/app/atlas/atlas-material-tile').AtlasMaterialTileRequest,
      control?: AtlasReadRequest,
    ) => {
      validateAtlasReadRequest(control);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      atlasMaterialTileQuery(q);
      const source = await store.atlasRegionSource(token, atlasExportRegions.cursor);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      if (source.revision !== q.revision) throw Error('Materialkachel inzwischen geändert.');
      const value = await atlasExportRegions.materialTile(source, q, control);
      if ((await store.atlasRegionSource(token)).fence !== source.fence)
        throw Error('Materialkachel inzwischen geändert.');
      return value;
    },
  );
  handle('atlas:terrain-source', async (token: string) => {
    if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
    const source = await store.atlasRegionSource(token);
    if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
    return { revision: source.revision, fence: source.fence };
  });
  handle(
    'atlas:terrain-projection',
    async (
      token: string,
      q: import('../src/app/atlas/terrain-projection').TerrainProjectionRequest,
      consumer: 'view' | 'export' = 'view',
      control?: AtlasReadRequest,
    ) => {
      validateAtlasReadRequest(control);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      validateTerrainProjection(q);
      if (!['view', 'export'].includes(consumer)) throw Error('Kartenleser prüfen.');
      const reader = consumer === 'view' ? atlasRegions : atlasExportRegions,
        source = await store.atlasRegionSource(token, reader.cursor);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      if (source.revision !== q.revision || (q.fence !== undefined && source.fence !== q.fence))
        throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
      const value = await reader.terrain(source, q, control);
      if ((await store.atlasRegionSource(token)).fence !== source.fence)
        throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
      if (!value.draft && !value.heightOnly)
        await store.rememberTerrainGrid(token, source.fence, value.grid);
      return value;
    },
  );
  handle(
    'atlas:mask-region',
    async (token: string, box: import('../src/app/atlas/atlas-landscape').LandscapeBox) =>
      await store.atlasMaskRegion(token, box),
  );
  handle(
    'atlas:object',
    async (token: string, id: string) => await store.atlasLandscapeObject(token, id),
  );
  handle('atlas:room-commit', (edit: import('../src/app/shared/contracts').Edit) =>
    atlasWriteActivity.run(edit.commandId, async () => await store.atlasRoomCommit(edit)),
  );
  handle('atlas:room', async (token: string, id: string) => await store.atlasRoom(token, id));
  handle(
    'atlas:drawing-commit',
    (command: import('../src/app/atlas/drawing-contracts').DrawingCommand) =>
      atlasWriteActivity.run(
        command.commandId,
        async () => await store.atlasDrawingCommit(command),
      ),
  );
  handle(
    'atlas:reconcile-commit',
    async (c: import('../src/app/atlas/campaign-atlas-contracts').AtlasCommand) =>
      await store.reconcileAtlasCommit(c, atlasWriteActivity.has(c.commandId)),
  );
  handle('atlas:commit', (c: import('../src/app/atlas/campaign-atlas-contracts').AtlasCommand) =>
    atlasWriteActivity.run(c.commandId, async () => {
      if (c.action?.kind === 'graph-accept')
        return withGraphSourceReadBarrier(async () => await store.executeAtlasCommit(c));
      if (c.action?.kind === 'landscape-height-stroke') {
        const source = await store.terrainStrokeSource(c, atlasRegions.cursor);
        if (source) {
          const prepared = await atlasRegions.prepareTerrainStroke(source, c.action.stroke);
          return await store.executeAtlasCommit(c, prepared);
        }
      }
      return await store.executeAtlasCommit(c);
    }),
  );
  handle(
    'campaign:workspace-initial',
    async (token: string) => await store.workspaceInitial(token),
  );
  handle('atlas:region-cancel', async (token: string, consumer: 'view' | 'export' = 'view') => {
    await store.roomReadSource(token);
    if (!['view', 'export'].includes(consumer)) throw new Error('Kartenleser prüfen.');
    (consumer === 'view' ? atlasRegions : atlasExportRegions).cancel();
  });
  handle(
    'atlas:geometry-region',
    async (
      token: string,
      query: import('../src/app/atlas/atlas-region-contracts').AtlasRegionQuery,
      consumer: 'view' | 'export' = 'view',
    ) => {
      if (graphSourceReadBarrierDepth)
        throw new Error('Graphwechsel läuft. Ausschnitt danach aktualisieren.');
      validateRegion(query);
      if (!['view', 'export'].includes(consumer)) throw new Error('Kartenleser prüfen.');
      const reader = consumer === 'view' ? atlasRegions : atlasExportRegions;
      const source = await store.atlasRegionSource(token, reader.cursor);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      const region = await reader.read(source, query);
      return await store.atlasRegionView(
        token,
        region,
        query.perception === true,
        query.entranceId,
      );
    },
  );
  handle(
    'atlas:focus',
    async (token: string, kind: 'room' | 'city' | 'building' | 'element' | 'scope', id: string) => {
      if (
        graphSourceReadBarrierDepth ||
        !['room', 'city', 'building', 'element', 'scope'].includes(kind) ||
        typeof id !== 'string' ||
        !id
      )
        throw new Error('Kartenauswahl prüfen.');
      const source = await store.atlasRegionSource(token, atlasRegions.cursor);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      const value = await atlasRegions.focus(source, kind, id);
      if ((await store.atlasRegionSource(token)).fence !== source.fence)
        throw new Error('Atlas inzwischen geändert. Auswahl erneut öffnen.');
      return value;
    },
  );
  handle(
    'atlas:region-candidates',
    async (
      token: string,
      query: import('../src/app/atlas/atlas-region-contracts').AtlasRegionQuery,
      point: import('../src/app/shared/contracts').Point,
      fence: string,
      offset = 0,
      layer: 'geometry' | 'landscape' | 'all' = 'geometry',
      visualElementId?: string,
    ) => {
      if (
        visualElementId !== undefined &&
        (typeof visualElementId !== 'string' || !visualElementId)
      )
        throw new Error('Kartenauswahl prüfen.');
      if (
        graphSourceReadBarrierDepth ||
        !['geometry', 'landscape', 'all'].includes(layer) ||
        !Number.isSafeInteger(offset) ||
        offset < 0
      )
        throw new Error('Kartenauswahl prüfen.');
      validateRegion(query);
      const source = await store.atlasRegionSource(token, atlasRegions.cursor);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      if (source.fence !== fence)
        throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
      const value = await atlasRegions.candidates(
        source,
        query,
        point,
        offset,
        layer,
        visualElementId,
      );
      if ((await store.atlasRegionSource(token)).fence !== fence)
        throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
      return value;
    },
  );
  handle(
    'atlas:region-hit',
    async (
      token: string,
      query: import('../src/app/atlas/atlas-region-contracts').AtlasRegionQuery,
      point: import('../src/app/shared/contracts').Point,
      fence: string,
    ) => {
      if (graphSourceReadBarrierDepth) throw new Error('Graphwechsel läuft.');
      validateRegion(query);
      const source = await store.atlasRegionSource(token, atlasRegions.cursor);
      if (graphSourceReadBarrierDepth) throw Error('Graphwechsel läuft.');
      if (source.fence !== fence)
        throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
      const value = await atlasRegions.hit(source, query, point);
      if ((await store.atlasRegionSource(token)).fence !== source.fence)
        throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
      return value;
    },
  );
  handle(
    'atlas:city-site',
    async (token: string, cityId: string, id?: string) =>
      await store.atlasCitySite(token, cityId, id),
  );
  handle('atlas:render-view', async (token: string) => await store.atlasRenderView(token));
  handle('atlas:view', async (token: string) => await store.campaignAtlas(token));
  handle('atlas:execute', (c: import('../src/app/atlas/campaign-atlas-contracts').AtlasCommand) =>
    atlasWriteActivity.run(c.commandId, async () => {
      if (c.action?.kind === 'graph-accept')
        return withGraphSourceReadBarrier(async () => await store.executeAtlas(c));
      return await store.executeAtlas(c);
    }),
  );
  handle('city:list', async (token: string) => await store.cities(token));
  handle('city:view', async (token: string, id: string) => await store.city(token, id));
  handle('city:execute', (c: import('../src/app/atlas/city-contracts').CityCommand) =>
    atlasWriteActivity.run(c.commandId, () => store.executeCity(c)),
  );
  handle('city:export', async (token: string, id: string, format: 'svg' | 'json') => {
    if (!['svg', 'json'].includes(format)) throw new Error('Ausgabeformat unbekannt.');
    const city = await store.city(token, id),
      destination = await dialog.showSaveDialog(win, {
        defaultPath: city.header.name + '.' + format,
        filters: [{ name: 'Stadtplan', extensions: [format] }],
      });
    if (destination.canceled || !destination.filePath) return { cancelled: true };
    const text =
      format === 'svg'
        ? citySvg(city)
        : JSON.stringify({ format: 'Kampagnenwerkstatt City', version: 1, ...city }, null, 2);
    await writeFile(destination.filePath, text);
    return { cancelled: false };
  });
  return {
    cancelReads() {
      roomDirectory.cancel();
      atlasRoomDirectory.cancel();
      atlasRegions.cancel();
      atlasExportRegions.cancel();
    },
    cancelRegions: () =>
      Promise.all([atlasRegions.cancelAndWait(), atlasExportRegions.cancelAndWait()]),
    async close() {
      scope.dispose();
      await Promise.all([
        closeSpatialRoutePreview(),
        roomDirectory.close(),
        atlasRoomDirectory.close(),
        atlasRegions.close(),
        atlasExportRegions.close(),
      ]);
      referencePreviewCache.clear();
    },
  };
}
