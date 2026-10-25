import { verify } from 'node:crypto';
export const updateProduct = 'saltmarcher-workbench';
export const updateRepository = 'ThonkTank/Salt-Marcher';
export const manifestName = 'saltmarcher-update.json';
export interface UpdateManifest {
  format: 1;
  product: typeof updateProduct;
  dataLine: 'CampaignWorkbench';
  version: string;
  commit: string;
  platform: 'linux-x64';
  archive: string;
  bytes: number;
  sha256: string;
  unpackedBytes: number;
  indexSha256: string;
  schema: { min: number; max: number; target: number };
}
export function versionParts(value: unknown): number[] {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value))
    throw new Error('Ungültige stabile Releaseversion.');
  const parts = value.split('.').map(Number);
  if (parts.some((n) => !Number.isSafeInteger(n))) throw new Error('Releaseversion zu groß.');
  return parts;
}
export function newerVersion(next: string, current: string) {
  const a = versionParts(next),
    b = versionParts(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i]! > b[i]!;
  }
  return false;
}
export function checkedManifest(value: unknown): UpdateManifest {
  const m = value as UpdateManifest;
  if (
    !m ||
    m.format !== 1 ||
    m.product !== updateProduct ||
    m.dataLine !== 'CampaignWorkbench' ||
    m.platform !== 'linux-x64'
  )
    throw new Error('Dieses Update gehört nicht zu dieser Anwendung und Plattform.');
  versionParts(m.version);
  if (
    !/^[a-f0-9]{40}$/.test(m.commit) ||
    m.archive !== `SaltMarcher-${m.version}-linux-x64.zip` ||
    !Number.isSafeInteger(m.bytes) ||
    m.bytes <= 0 ||
    m.bytes > 4 * 1024 ** 3 ||
    !Number.isSafeInteger(m.unpackedBytes) ||
    m.unpackedBytes <= 0 ||
    m.unpackedBytes > 8 * 1024 ** 3 ||
    !/^[a-f0-9]{64}$/.test(m.sha256)
  )
    throw new Error('Updatepaket ist ungültig beschrieben.');
  if (!/^[a-f0-9]{64}$/.test(m.indexSha256)) throw new Error('Paketindex-Prüfsumme fehlt.');
  if (
    !m.schema ||
    [m.schema.min, m.schema.max, m.schema.target].some((n) => !Number.isSafeInteger(n) || n < 0) ||
    m.schema.min > m.schema.max ||
    m.schema.target < m.schema.max
  )
    throw new Error('Datenformatangaben fehlen oder widersprechen sich.');
  return m;
}
export function verifyManifest(bytes: Buffer, signature: Buffer, publicKey: string) {
  if (
    bytes.length > 64 * 1024 ||
    signature.length !== 64 ||
    !verify(null, bytes, publicKey, signature)
  )
    throw new Error('Updatesignatur ist ungültig.');
  return checkedManifest(JSON.parse(bytes.toString('utf8')));
}
export function releaseAssetURL(version: string, name: string) {
  versionParts(version);
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error('Ungültiger Assetname.');
  return `https://github.com/${updateRepository}/releases/download/v${version}/${name}`;
}
export interface ReleaseCandidate {
  version: string;
  notes: string;
}
export function releaseCandidates(input: unknown, current: string): ReleaseCandidate[] {
  if (!Array.isArray(input)) throw new Error('GitHub hat keine gültige Releaseliste geliefert.');
  const result: ReleaseCandidate[] = [];
  for (const r of input) {
    if (
      !r ||
      r.draft !== false ||
      r.prerelease !== false ||
      typeof r.tag_name !== 'string' ||
      !r.tag_name.startsWith('v') ||
      !Array.isArray(r.assets)
    )
      continue;
    const version = r.tag_name.slice(1);
    try {
      if (!newerVersion(version, current)) continue;
    } catch {
      continue;
    }
    const names = new Set(r.assets.map((a: { name?: string }) => a.name));
    if (
      !names.has(manifestName) ||
      !names.has(manifestName + '.sig') ||
      !names.has(`SaltMarcher-${version}-linux-x64.zip`)
    )
      continue;
    result.push({ version, notes: typeof r.body === 'string' ? r.body.slice(0, 32000) : '' });
  }
  return result.sort((a, b) =>
    newerVersion(a.version, b.version) ? -1 : newerVersion(b.version, a.version) ? 1 : 0,
  );
}
