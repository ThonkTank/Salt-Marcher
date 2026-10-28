import { BrowserWindow, dialog, shell } from 'electron';
import { open } from 'node:fs/promises';
import type { EncounterPlanCommand } from '../src/app/catalog/encounter-contracts';
import { creatureInfo, readCreature, searchCreatures } from '../src/app/storage/encounters';
import { extensionPackageLimit } from '../src/app/storage/extensions';
import { readItemReferenceCatalog } from '../src/app/storage/item-reference';
import type { CreatureCatalogQuery } from '../src/features/catalog/creature-catalog';
import type { HostIpc } from './host-ipc';
import { StoreClient } from './store-client';
export function registerCatalogHost(host: {
  ipc: HostIpc;
  store: StoreClient;
  win: BrowserWindow;
}) {
  const { store, win } = host;
  const scope = host.ipc.scope(),
    handle = scope.handle;

  handle('extensions:preview', async () => {
    const selected = await dialog.showOpenDialog(win, {
      title: 'Extensionpaket prüfen',
      properties: ['openFile'],
      filters: [{ name: 'Extensionpaket (JSON)', extensions: ['json'] }],
    });
    if (selected.canceled || !selected.filePaths[0]) return null;
    const file = await open(selected.filePaths[0], 'r');
    try {
      if (!(await file.stat()).isFile()) throw new Error('Eine Paketdatei wählen.');
      const bytes = Buffer.alloc(extensionPackageLimit + 1);
      let length = 0;
      while (length < bytes.length) {
        const r = await file.read(bytes, length, bytes.length - length, length);
        if (!r.bytesRead) break;
        length += r.bytesRead;
      }
      return await store.extensionPreview(bytes.subarray(0, length));
    } finally {
      await file.close();
    }
  });
  handle('extensions:list', async (after: string | null) => await store.extensions(after));
  handle(
    'extensions:execute',
    async (command: import('../src/app/workspace/extension-contracts').ExtensionCommand) =>
      await store.executeExtension(command),
  );
  handle(
    'extensions:outcome',
    async (command: import('../src/app/workspace/extension-contracts').ExtensionCommand) =>
      await store.extensionOutcome(command),
  );
  handle(
    'catalog:items',
    (query: import('../src/app/catalog/item-reference-contracts').ItemReferenceQuery) =>
      readItemReferenceCatalog(query),
  );
  handle(
    'catalog:reference',
    async (entryType: 'creature' | 'item', id: string) =>
      await store.catalogReference(entryType, id),
  );
  handle(
    'catalog:resolve-reference',
    async (reference: import('../src/app/catalog/catalog-reference-contracts').CatalogReference) =>
      await store.resolveCatalogReference(reference),
  );
  handle('catalog:info', () => creatureInfo());
  handle('catalog:search', (query: CreatureCatalogQuery) => searchCreatures(query));
  handle('catalog:creature', (id: string) => readCreature(id));
  handle(
    'campaign:encounter-plans',
    async (token: string, search: string, limit?: number) =>
      await store.encounterPlans(token, search, limit),
  );
  handle(
    'campaign:encounter-plan',
    async (token: string, id: string) => await store.encounterPlan(token, id),
  );
  handle(
    'campaign:save-encounter-plan',
    async (command: EncounterPlanCommand) => await store.saveEncounterPlan(command),
  );
  handle('campaign:open-item-source', async (token: string, id: string) => {
    await store.live(token);
    const d = await store.itemDefinition(id),
      url = d.source.url;
    if (
      !url ||
      !/^https:\/\/media\.wizards\.com\/2023\/downloads\/dnd\/SRD_CC_v5\.1\.pdf#page=[1-9][0-9]{0,2}$/.test(
        url,
      )
    )
      throw new Error('Keine verfügbare SRD-Quellenseite.');
    await shell.openExternal(url);
  });
  handle(
    'items:definitions',
    async (query: import('../src/app/catalog/items-contracts').ItemQuery) =>
      await store.itemDefinitions(query),
  );
  handle(
    'items:definition',
    async (id: string, revision?: number) => await store.itemDefinition(id, revision),
  );
  handle(
    'items:shops',
    async (token: string, trashed: boolean) => await store.shops(token, trashed),
  );
  handle('items:shop', async (token: string, id: string) => await store.shop(token, id));
  handle(
    'items:shop-history',
    async (token: string, id: string, after: string | null) =>
      await store.shopHistory(token, id, after),
  );
  handle(
    'items:scene-shops',
    async (token: string, id: string) => await store.sceneShops(token, id),
  );
  return { close: scope.dispose };
}
