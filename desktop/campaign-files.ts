import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import type { CampaignTransferProgress } from '../src/app/campaign-contracts';
import { readArchive, writeArchive, type ArchiveFile } from './zip-files';

export interface CampaignManifest {
  format: 'Kampagnenwerkstatt Campaign';
  version: 1;
  campaignId: string;
  name: string;
  applicationVersion: string;
  schema: number;
  createdAt: string;
  files: ArchiveFile[];
}
export interface CampaignFileHooks {
  cancelled: () => boolean;
  progress: (p: CampaignTransferProgress) => void;
  fence: () => void;
}
export function campaignMediaPath(dataDir: string, name: string) {
  return path.join(
    dataDir,
    name.startsWith('images/') ? 'player-images' : 'audio',
    path.basename(name),
  );
}
function check(h: CampaignFileHooks) {
  if (h.cancelled()) throw new Error('Kampagnenübertragung abgebrochen.');
  h.fence();
}
const allowedName = (name: string) =>
  /^(?:campaign\.sqlite|(?:audio|images)\/[a-f0-9]{64}\.[a-z0-9]{1,8}|catalog\/[a-z0-9._-]+)$/.test(
    name,
  );
function checkedManifest(value: unknown): CampaignManifest {
  const m = value as CampaignManifest;
  if (
    !m ||
    m.format !== 'Kampagnenwerkstatt Campaign' ||
    m.version !== 1 ||
    typeof m.campaignId !== 'string' ||
    !m.campaignId ||
    typeof m.name !== 'string' ||
    !m.name.trim() ||
    typeof m.applicationVersion !== 'string' ||
    !m.applicationVersion.trim() ||
    !Number.isSafeInteger(m.schema) ||
    m.schema < 1 ||
    typeof m.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(m.createdAt)) ||
    !Array.isArray(m.files)
  )
    throw new Error('Unbekanntes Kampagnenformat oder ungültiges Manifest.');
  const names = new Set<string>();
  for (const f of m.files) {
    if (
      !f ||
      typeof f.name !== 'string' ||
      !allowedName(f.name) ||
      names.has(f.name) ||
      typeof f.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(f.sha256) ||
      !Number.isSafeInteger(f.bytes) ||
      f.bytes < 0
    )
      throw new Error('Manifest enthält ungültige oder doppelte Dateieinträge.');
    names.add(f.name);
  }
  if (!names.has('campaign.sqlite'))
    throw new Error('Kampagnenmanifest benötigt eine Datenbank campaign.sqlite.');
  return m;
}
/** Bind the package directory to the validated database, including shared/trash media. */
export function checkCampaignContents(
  manifest: CampaignManifest,
  database: {
    id: string;
    name: string;
    schema: number;
    media: { name: string; sha256: string; bytes: number }[];
  },
) {
  const m = checkedManifest(manifest);
  if (database.id !== m.campaignId || database.name !== m.name || database.schema !== m.schema)
    throw new Error('Kampagnenmanifest und Datenbank widersprechen sich.');
  const media = new Map(
    m.files
      .filter((f) => f.name.startsWith('audio/') || f.name.startsWith('images/'))
      .map((f) => [f.name, f]),
  );
  if (media.size !== database.media.length)
    throw new Error('Manifest und referenzierte Kampagnenmedien widersprechen sich.');
  for (const expected of database.media) {
    const file = media.get(expected.name);
    if (!file || file.sha256 !== expected.sha256 || file.bytes !== expected.bytes)
      throw new Error('Medienbindung im Kampagnenmanifest widersprüchlich: ' + expected.name);
  }
}
export async function fileDigest(filename: string, h?: CampaignFileHooks) {
  const hash = createHash('sha256');
  let bytes = 0;
  if (h) check(h);
  for await (const chunk of createReadStream(filename)) {
    if (h) check(h);
    hash.update(chunk);
    bytes += chunk.length;
    if (h) h.progress({ phase: 'Paketdatei prüfen', bytes, records: 0, busy: true });
  }
  if (h) check(h);
  return hash.digest('hex');
}
export async function exportCampaignArchive(
  destination: string,
  manifest: CampaignManifest,
  entries: { name: string; filename: string }[],
  h: CampaignFileHooks,
) {
  const m = checkedManifest(manifest),
    files = new Map(m.files.map((f) => [f.name, f]));
  if (
    entries.length !== files.size ||
    new Set(entries.map((e) => e.name)).size !== files.size ||
    entries.some((e) => !files.has(e.name))
  )
    throw new Error('Manifest und Export-Dateiverzeichnis widersprechen sich.');
  await writeArchive(
    destination,
    m,
    entries.map((e) => ({ ...files.get(e.name)!, filename: e.filename })),
    {
      check: () => check(h),
      progress: (bytes, records) =>
        h.progress({ phase: 'Kampagne exportieren', bytes, records, busy: true }),
    },
  );
}
export async function extractCampaignArchive(filename: string, base: string, h: CampaignFileHooks) {
  const extracted = await readArchive(
    filename,
    base,
    allowedName,
    (value) => {
      const manifest = checkedManifest(value);
      return new Map(manifest.files.map((file) => [file.name, file]));
    },
    {
      check: () => check(h),
      progress: (bytes, records) =>
        h.progress({ phase: 'Kampagnenpaket vorbereiten', bytes, records, busy: true }),
    },
  );
  return { dir: extracted.dir, manifest: extracted.manifest as CampaignManifest };
}
