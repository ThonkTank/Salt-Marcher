import { Worker } from 'node:worker_threads';
import path from 'node:path';
import type { StoreClient } from './store-client';
import type { LandscapeBox } from '../src/app/atlas-landscape';
import type { SpatialTerrainDraft } from '../src/app/spatial-terrain';
import type { VegetationScene } from '../src/app/vegetation';

let active: Worker | undefined,
  generation = 0,
  closed = false;
export async function closeSpatialRoutePreview() {
  closed = true;
  generation++;
  const worker = active;
  if (worker) await worker.terminate();
}
/** One bounded proposal per desktop host; replacing a proposal cancels its worker. */
export async function spatialRoutePreview(
  store: Pick<StoreClient, 'atlasRegionSource' | 'atlasIdentity'>,
  token: string,
  box: LandscapeBox,
  mpp: number,
  draft: SpatialTerrainDraft,
  fence?: string,
): Promise<VegetationScene> {
  if (closed) throw Error('Planung beendet.');
  const request = ++generation;
  const source = await store.atlasRegionSource(token),
    revision = (await store.atlasIdentity(token)).revision;
  if (closed || request !== generation) throw Error('Planung abgebrochen.');
  if (fence !== undefined && fence !== source.fence)
    throw Error('Gelände inzwischen geändert. Vorschau erneut öffnen.');
  if (active) await active.terminate();
  if (closed || request !== generation) throw Error('Planung abgebrochen.');
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'terrain-route-worker.cjs'), {
      workerData: { source, revision, box, mpp, draft },
    });
    active = worker;
    let settled = false;
    const finish = async (error?: Error, value?: VegetationScene) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (active === worker) active = undefined;
      await worker.terminate();
      if (error) reject(error);
      else {
        try {
          const current = await store.atlasRegionSource(token);
          if (closed || request !== generation) throw Error('Planung abgebrochen.');
          if (current.fence !== source.fence)
            throw Error('Gelände inzwischen geändert. Vorschau erneut berechnen.');
          resolve(value!);
        } catch (e) {
          reject(e);
        }
      }
    };
    const timer = setTimeout(
      () => finish(Error('Planung dauert zu lange. Kürzeren Abschnitt wählen.')),
      15000,
    );
    worker.once('message', (r) => finish(r.error ? Error(r.error) : undefined, r.value));
    worker.once('error', (e) => finish(e));
    worker.once('exit', () => finish(Error('Planung abgebrochen.')));
  });
}
