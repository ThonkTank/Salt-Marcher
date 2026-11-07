import { readdirSync, rmSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { CampaignStore } from '../src/app/storage/store';
import { campaignMediaPath } from './campaign-files';
import { eraseAtlasProjection } from '../src/app/storage/atlas-projection-index';

function entries(root: string) {
  try {
    return readdirSync(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Tickets only exist in one main-process session. Old managed staging cannot be resumed. */
export function clearCampaignStaging(dataDir: string) {
  for (const [directory, prefix] of [
    ['campaign-jobs', /^(snapshot-|import-)/],
    ['player-images', /^\.campaign-/],
    ['audio', /^\.campaign-/],
  ] as const) {
    const root = path.join(dataDir, directory);
    for (const entry of entries(root))
      if (entry.isDirectory() && prefix.test(entry.name))
        rmSync(path.join(root, entry.name), { recursive: true, force: true });
  }
}

export function discardCampaignTickets(
  tickets: Map<
    string,
    { dir: string; manifest: { campaignId: string }; fence?: { id: string } | null }
  >,
  id: string,
) {
  for (const [key, ticket] of tickets)
    if (ticket.fence?.id === id || ticket.manifest.campaignId === id) {
      rmSync(ticket.dir, { recursive: true, force: true });
      tickets.delete(key);
    }
}

type Store = Pick<
  CampaignStore,
  | 'filename'
  | 'pendingCampaignErasures'
  | 'campaignErasureFiles'
  | 'campaignMediaReferenced'
  | 'finishCampaignErasure'
>;
/** Main excludes concurrent writers and live transfer tickets before entering this cleanup. */
export async function finishCampaignErasure(store: Store, dataDir: string, id: string) {
  if (!store.pendingCampaignErasures().includes(id)) return;
  for (const entry of entries(dataDir))
    if (entry.name === 'recovery.sqlite' || entry.name.startsWith('recovery.sqlite.candidate-'))
      rmSync(path.join(dataDir, entry.name), { force: true });
  await eraseAtlasProjection(path.join(dataDir, 'atlas-region-cache'), store.filename, id);
  for (const name of store.campaignErasureFiles(id)) {
    // Keep reference-check and unlink synchronous: a newly committed shared owner must not race them.
    if (!store.campaignMediaReferenced(name))
      rmSync(campaignMediaPath(dataDir, name), { force: true });
  }
  store.finishCampaignErasure(id);
}

/** Retire authority immediately, but keep files until their admitted acceptance ends. */
export async function cancelCampaignTicket(
  tickets: Map<string, { dir: string }>,
  id: string,
  acceptance: Promise<void> | null,
) {
  const ticket = tickets.get(id);
  if (!ticket) return;
  tickets.delete(id);
  if (acceptance) await acceptance;
  await rm(ticket.dir, { recursive: true, force: true });
}
