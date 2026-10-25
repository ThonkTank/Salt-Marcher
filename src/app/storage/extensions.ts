import { createHash, randomUUID } from 'node:crypto';
import { canonicalJson } from '../campaign/generation/canonical-json';
import {
  checkedExtensionCommand,
  extensionRights,
  type ExtensionManifest,
  type ExtensionPackage,
  type ExtensionInfo,
  type ExtensionPreview,
  type ExtensionCommand,
  type ExtensionPage,
  type ExtensionRight,
} from '../workspace/extension-contracts';
export const extensionPackageLimit = 1048576;
const prefix = 'extension:installed:',
  receiptPrefix = 'extension:receipt:',
  hash = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const object = (v: any, keys: string[]) =>
  v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
function rights(v: unknown): asserts v is ExtensionRight[] {
  if (
    !Array.isArray(v) ||
    v.length > extensionRights.length ||
    new Set(v).size !== v.length ||
    v.some((x) => !extensionRights.includes(x))
  )
    throw new Error('Nicht unterstützte oder doppelte Packagerechte.');
}
function manifest(v: any): asserts v is ExtensionManifest {
  if (
    !object(v, ['id', 'name', 'version', 'hostApi', 'unitCodec', 'rights']) ||
    typeof v.id !== 'string' ||
    !/^[a-z][a-z0-9.-]{0,99}$/.test(v.id) ||
    typeof v.name !== 'string' ||
    !v.name.trim() ||
    v.name.length > 1000 ||
    typeof v.version !== 'string' ||
    v.version.length > 128 ||
    !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(v.version) ||
    v.hostApi !== 1 ||
    v.unitCodec !== 'way-note:1'
  )
    throw new Error('Paketmanifest oder Host-/Codecversion nicht unterstützt.');
  rights(v.rights);
}
export function readExtensionPackage(bytes: Buffer): ExtensionPackage {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > extensionPackageLimit)
    throw new Error('Paket benötigt höchstens 1 MiB.');
  let p: any;
  try {
    const text = bytes.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error();
    p = JSON.parse(text);
  } catch {
    throw new Error('Paket ist kein lesbares UTF-8-JSON.');
  }
  if (
    !object(p, ['format', 'version', 'manifest', 'renderer']) ||
    p.format !== 'Kampagnenwerkstatt Extension' ||
    p.version !== 1 ||
    !object(p.renderer, ['html', 'script', 'styles']) ||
    Object.values(p.renderer).some((v) => typeof v !== 'string')
  )
    throw new Error('Paketformat nicht unterstützt.');
  manifest(p.manifest);
  return p;
}
type Record = ExtensionInfo & { packageBytes: string | null; checksum: string };
function checksum(r: Omit<Record, 'checksum'> | Record) {
  const copy = { ...r } as Partial<Record>;
  delete copy.checksum;
  return hash(canonicalJson(copy));
}
function checked(r: any, id: string): Record {
  if (
    !object(r, [
      'id',
      'revision',
      'generation',
      'manifest',
      'hash',
      'state',
      'grants',
      'packageBytes',
      'checksum',
    ]) ||
    r.id !== id ||
    !Number.isSafeInteger(r.revision) ||
    r.revision < 1 ||
    typeof r.generation !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(r.generation) ||
    typeof r.hash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(r.hash) ||
    !['installed', 'removed'].includes(r.state) ||
    checksum(r) !== r.checksum
  )
    throw new Error('Installation ist beschädigt. Originaldaten bleiben erhalten.');
  manifest(r.manifest);
  rights(r.grants);
  if (
    r.manifest.id !== id ||
    r.grants.some((right: ExtensionRight) => !r.manifest.rights.includes(right))
  )
    throw new Error('Installationsrechte widersprüchlich.');
  if (r.state === 'removed') {
    if (r.packageBytes !== null || r.grants.length)
      throw new Error('Entferntes Paket enthält noch Code oder Rechte.');
  } else {
    if (
      typeof r.packageBytes !== 'string' ||
      r.packageBytes.length > Math.ceil(extensionPackageLimit / 3) * 4
    )
      throw new Error('Gespeicherte Paketbytes ungültig.');
    const bytes = Buffer.from(r.packageBytes, 'base64'),
      p = readExtensionPackage(bytes);
    if (
      bytes.toString('base64') !== r.packageBytes ||
      hash(bytes) !== r.hash ||
      canonicalJson(p.manifest) !== canonicalJson(r.manifest)
    )
      throw new Error('Gespeicherter Pakethash oder Manifest widersprüchlich.');
  }
  return r;
}
const info = (r: Record): ExtensionInfo => ({
  id: r.id,
  revision: r.revision,
  generation: r.generation,
  manifest: structuredClone(r.manifest),
  hash: r.hash,
  state: r.state,
  grants: [...r.grants],
});
function checkedReceipt(value: any, fp?: string): ExtensionInfo {
  if (
    !object(value, ['fingerprint', 'result', 'checksum']) ||
    typeof value.fingerprint !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.fingerprint) ||
    hash(canonicalJson({ fingerprint: value.fingerprint, result: value.result })) !==
      value.checksum ||
    (fp !== undefined && fp !== value.fingerprint)
  )
    throw new Error('Installationskennung anders verwendet oder beschädigt.');
  const r = value.result;
  if (
    !object(r, ['id', 'revision', 'generation', 'manifest', 'hash', 'state', 'grants']) ||
    !Number.isSafeInteger(r.revision) ||
    r.revision < 1 ||
    typeof r.generation !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(r.generation) ||
    typeof r.hash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(r.hash) ||
    !['installed', 'removed'].includes(r.state)
  )
    throw new Error('Installationsbestätigung beschädigt.');
  manifest(r.manifest);
  rights(r.grants);
  if (
    r.id !== r.manifest.id ||
    r.grants.some((x: ExtensionRight) => !r.manifest.rights.includes(x)) ||
    (r.state === 'removed' && r.grants.length)
  )
    throw new Error('Bestätigte Packagerechte widersprüchlich.');
  return r;
}
export function validateExtensionSettings(db: any) {
  for (const row of db
    .prepare('SELECT key,value FROM settings WHERE key LIKE ?')
    .iterate(prefix + '%'))
    checked(JSON.parse(row.value), row.key.slice(prefix.length));
  for (const row of db
    .prepare('SELECT value FROM settings WHERE key LIKE ?')
    .iterate(receiptPrefix + '%'))
    checkedReceipt(JSON.parse(row.value));
}
export class ExtensionRegistry {
  private previews = new Map<
    string,
    { bytes: Buffer; preview: ExtensionPreview; expires: number }
  >();
  constructor(private db: any) {}
  dispose() {
    this.previews.clear();
  }
  outcome(command: ExtensionCommand): ExtensionInfo | null {
    command = checkedExtensionCommand(command);
    const row = this.db
      .prepare('SELECT value FROM settings WHERE key=?')
      .get(receiptPrefix + command.commandId);
    return row ? checkedReceipt(JSON.parse(row.value), hash(canonicalJson(command.action))) : null;
  }
  private read(id: string) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get(prefix + id);
    return row ? checked(JSON.parse(row.value), id) : null;
  }
  preview(bytes: Buffer): ExtensionPreview {
    this.previews.clear();
    const pkg = readExtensionPackage(bytes),
      old = this.read(pkg.manifest.id),
      preview = {
        ticket: randomUUID(),
        hash: hash(bytes),
        bytes: bytes.length,
        manifest: structuredClone(pkg.manifest),
        expectedRevision: old?.revision ?? null,
      };
    this.previews.set(preview.ticket, {
      bytes: Buffer.from(bytes),
      preview,
      expires: Date.now() + 600000,
    });
    return structuredClone(preview);
  }
  list(after: string | null): ExtensionPage {
    if (
      after !== null &&
      (typeof after !== 'string' || !/^extension:installed:[a-z][a-z0-9.-]{0,99}$/.test(after))
    )
      throw new Error('Installationsseite ungültig.');
    const rows = this.db
        .prepare(
          'SELECT key,value FROM settings WHERE key LIKE ? AND (? IS NULL OR key>?) ORDER BY key LIMIT 21',
        )
        .all(prefix + '%', after, after),
      items: ExtensionInfo[] = [],
      problems: ExtensionPage['problems'] = [];
    for (const row of rows.slice(0, 20)) {
      const id = row.key.slice(prefix.length);
      try {
        items.push(info(checked(JSON.parse(row.value), id)));
      } catch (error) {
        problems.push({ id, message: (error as Error).message });
      }
    }
    return { items, problems, next: rows.length > 20 ? rows[19].key : null };
  }
  execute(command: ExtensionCommand): ExtensionInfo {
    command = checkedExtensionCommand(command);
    const fp = hash(canonicalJson(command.action));
    const result = this.db
      .transaction(() => {
        const prior = this.db
          .prepare('SELECT value FROM settings WHERE key=?')
          .get(receiptPrefix + command.commandId);
        if (prior) {
          return checkedReceipt(JSON.parse(prior.value), fp);
        }
        const a = command.action;
        let next: Record;
        if (a.kind === 'install') {
          const ticket = this.previews.get(a.ticket);
          if (
            !ticket ||
            ticket.expires < Date.now() ||
            a.hash !== ticket.preview.hash ||
            a.expectedRevision !== ticket.preview.expectedRevision
          )
            throw new Error('Paketvorschau fehlt oder wurde geändert. Erneut wählen.');
          rights(a.rights);
          if (
            canonicalJson([...a.rights].sort()) !==
            canonicalJson([...ticket.preview.manifest.rights].sort())
          )
            throw new Error('Genau die angezeigten Rechte müssen ausdrücklich bestätigt werden.');
          const old = this.read(ticket.preview.manifest.id);
          if ((old?.revision ?? null) !== a.expectedRevision)
            throw new Error('Installation inzwischen geändert. Erneut prüfen.');
          next = {
            id: ticket.preview.manifest.id,
            revision: (old?.revision ?? 0) + 1,
            generation: randomUUID(),
            manifest: structuredClone(ticket.preview.manifest),
            hash: ticket.preview.hash,
            state: 'installed',
            grants: [...a.rights],
            packageBytes: ticket.bytes.toString('base64'),
            checksum: '',
          };
        } else if (a.kind === 'remove' || a.kind === 'revoke') {
          const old = this.read(a.id);
          if (!old || old.revision !== a.expectedRevision)
            throw new Error('Installation inzwischen geändert.');
          next = {
            ...old,
            revision: old.revision + 1,
            generation: randomUUID(),
            grants: [],
            ...(a.kind === 'remove' ? { state: 'removed' as const, packageBytes: null } : {}),
          };
        } else throw new Error('Installationsaktion unbekannt.');
        next.checksum = checksum(next);
        checked(next, next.id);
        this.db
          .prepare(
            'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
          )
          .run(prefix + next.id, JSON.stringify(next));
        const result = info(next),
          receipt = { fingerprint: fp, result };
        this.db
          .prepare('INSERT INTO settings VALUES(?,?)')
          .run(
            receiptPrefix + command.commandId,
            JSON.stringify({ ...receipt, checksum: hash(canonicalJson(receipt)) }),
          );
        return result;
      })
      .immediate();
    if (command.action.kind === 'install') this.previews.delete(command.action.ticket);
    return result;
  }
}
