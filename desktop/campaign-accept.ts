import { mkdir, mkdtemp, link } from 'node:fs/promises';
import { createReadStream, createWriteStream, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import type { CampaignStore } from '../src/app/storage/store';
import type { ConflictChoice } from '../src/app/campaign/campaign-contracts';
import {
  checkCampaignContents,
  campaignMediaPath,
  type CampaignManifest,
  type CampaignFileHooks,
} from './campaign-files';
import type { ArchiveFile } from './zip-files';

export interface PreparedCampaign {
  dir: string;
  manifest: CampaignManifest;
  copy: boolean;
  basis?: string;
  problems?: string[];
  acceptanceId?: string;
}
type Store = Pick<
  CampaignStore,
  'campaignPreview' | 'acceptCampaignSnapshot' | 'campaignMediaReferenced'
>;

function check(h: CampaignFileHooks) {
  if (h.cancelled()) throw new Error('Import abgebrochen.');
  h.fence();
}
function currentBasis(store: Store, filename: string, ticket: PreparedCampaign) {
  const current = store.campaignPreview(filename);
  checkCampaignContents(ticket.manifest, current);
  if (JSON.stringify(current.conflicts) !== ticket.basis)
    throw new Error('Definitionsstände geändert. Erstelle eine neue Vorschau.');
}
function checkedBytes(file: ArchiveFile, bytes: number, hash: string) {
  if (bytes !== file.bytes || hash !== file.sha256)
    throw new Error('Medienbytes fehlen oder sind verändert: ' + file.name);
}
async function verifyMedia(filename: string, file: ArchiveFile, h: CampaignFileHooks) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(filename)) {
    check(h);
    bytes += chunk.length;
    hash.update(chunk);
    h.progress({ phase: 'Vorhandene Kampagnenmedien prüfen', bytes, records: 0, busy: true });
  }
  checkedBytes(file, bytes, hash.digest('hex'));
}
async function stageMedia(source: string, target: string, file: ArchiveFile, h: CampaignFileHooks) {
  const hash = createHash('sha256');
  let bytes = 0;
  const checked = new Transform({
    transform(chunk, _encoding, done) {
      try {
        check(h);
        bytes += chunk.length;
        hash.update(chunk);
        h.progress({ phase: 'Kampagnenmedien vorbereiten', bytes, records: 0, busy: true });
        done(null, chunk);
      } catch (e) {
        done(e instanceof Error ? e : new Error('Medienvorbereitung fehlgeschlagen.'));
      }
    },
  });
  await pipeline(createReadStream(source), checked, createWriteStream(target, { flags: 'wx' }));
  check(h);
  checkedBytes(file, bytes, hash.digest('hex'));
}

/** The desktop's prepared-file acceptance path, independent of Electron's dialog plumbing. */
export async function acceptPreparedCampaign(
  store: Store,
  ticket: PreparedCampaign,
  dataDir: string,
  name: string,
  choices: Record<string, ConflictChoice>,
  h: CampaignFileHooks,
) {
  if (!ticket.problems || ticket.problems.length)
    throw new Error(ticket.problems?.join('\n') || 'Importvorschau nicht vollständig geprüft.');
  check(h);
  const filename = path.join(ticket.dir, 'campaign.sqlite');
  currentBasis(store, filename, ticket);
  const staging = new Map<string, string>();
  let committed = false;
  const introduced: {
    name: string;
    filename: string;
    dev: number;
    ino: number;
  }[] = [];
  try {
    const media = ticket.manifest.files.filter(
      (f) => f.name.startsWith('audio/') || f.name.startsWith('images/'),
    );
    for (const file of media) {
      check(h);
      const name = path.basename(file.name),
        destination = campaignMediaPath(dataDir, file.name),
        root = path.dirname(destination);
      if (ticket.copy) {
        await verifyMedia(destination, file, h);
        continue;
      }
      if (!staging.has(root)) {
        await mkdir(root, { recursive: true });
        staging.set(root, await mkdtemp(path.join(root, '.campaign-')));
      }
      const candidate = path.join(staging.get(root)!, name);
      await stageMedia(path.join(ticket.dir, file.name), candidate, file, h);
      check(h);
      try {
        await link(candidate, destination);
        const s = statSync(destination);
        introduced.push({ name: file.name, filename: destination, dev: s.dev, ino: s.ino });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        await verifyMedia(destination, file, h);
      }
      rmSync(candidate); // Keep at most one temporary media copy, including when reusing existing files.
    }
    // No await may separate the final authority/basis checks from the synchronous commit.
    check(h);
    currentBasis(store, filename, ticket);
    const campaign = store.acceptCampaignSnapshot(
      filename,
      name,
      choices,
      ticket.acceptanceId,
      ticket.manifest.files.find((f) => f.name === 'campaign.sqlite')!.sha256,
    );
    committed = true;
    return campaign;
  } finally {
    try {
      if (!committed)
        for (const file of introduced) {
          // Preserve shared or independently replaced bytes; only remove this job's unused file.
          if (store.campaignMediaReferenced(file.name)) continue;
          const s = statSync(file.filename, { throwIfNoEntry: false });
          if (s && s.dev === file.dev && s.ino === file.ino) rmSync(file.filename);
        }
    } finally {
      let cleanupError;
      for (const dir of staging.values())
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch (e) {
          if (!committed) cleanupError ??= e;
          else
            console.error(
              'Kampagne übernommen; temporäre Medienbereinigung steht aus.',
              e instanceof Error ? e.message : e,
            );
        }
      if (cleanupError) throw cleanupError;
    }
  }
}
