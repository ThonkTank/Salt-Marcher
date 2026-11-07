import { openPromise } from 'yauzl';
import { createHash } from 'node:crypto';
import { chmod, readFile, lstat, readdir, mkdir, mkdtemp, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { writeArchive, type ArchiveFile } from './zip-files';
import { sha256 } from './update-files';
import { updateProduct, type UpdateManifest } from './update-manifest';
interface PackageFile extends ArchiveFile {
  mode: 420 | 493;
}
interface PackageIndex {
  product: typeof updateProduct;
  version: string;
  commit: string;
  files: PackageFile[];
}
export function safePackageName(name: string) {
  return (
    typeof name === 'string' &&
    name.length < 512 &&
    !name.includes('\\') &&
    !name.includes('\0') &&
    !path.posix.isAbsolute(name) &&
    name.split('/').every((p) => !!p && p !== '.' && p !== '..') &&
    name !== 'manifest.json'
  );
}
export async function packUpdate(
  directory: string,
  destination: string,
  version: string,
  commit: string,
) {
  const entries: (PackageFile & { filename: string })[] = [];
  async function walk(dir: string) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const filename = path.join(dir, e.name);
      if (e.isDirectory()) await walk(filename);
      else if (e.isFile()) {
        const s = await lstat(filename),
          name = path.relative(directory, filename).split(path.sep).join('/');
        if (!safePackageName(name)) throw new Error('Ungültiger Paketpfad.');
        entries.push({
          name,
          filename,
          bytes: s.size,
          sha256: await sha256(filename),
          mode: s.mode & 0o111 ? 493 : 420,
        });
      } else throw new Error('Releasepakete dürfen keine Links enthalten: ' + filename);
    }
  }
  await walk(directory);
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const index: PackageIndex = {
    product: updateProduct,
    version,
    commit,
    files: entries.map(({ filename: _, ...e }) => e),
  };
  await writeArchive(destination, index, entries, { check: () => {}, progress: () => {} });
  return {
    indexSha256: createHash('sha256').update(JSON.stringify(index)).digest('hex'),
    bytes: (await lstat(destination)).size,
    sha256: await sha256(destination),
    unpackedBytes: entries.reduce((sum, e) => sum + e.bytes, 0),
  };
}
export async function unpackUpdate(
  archive: string,
  base: string,
  manifest: UpdateManifest,
  check = () => {},
) {
  if ((await lstat(archive)).size !== manifest.bytes || (await sha256(archive)) !== manifest.sha256)
    throw new Error('Updatepaket hat eine falsche Prüfsumme oder Größe.');
  await mkdir(base, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(base, 'import-'));
  const zip = await openPromise(archive, {
    lazyEntries: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });
  let success = false;
  try {
    let index: PackageIndex | null = null;
    const expected = new Map<string, PackageFile>(),
      seen = new Set<string>();
    for await (const entry of zip.eachEntry()) {
      check();
      const name = entry.fileName,
        type = (entry.externalFileAttributes >>> 16) & 0o170000;
      if (
        (type !== 0 && type !== 0o100000) ||
        seen.has(name) ||
        entry.isEncrypted() ||
        (name !== 'manifest.json' && !safePackageName(name))
      )
        throw new Error('Ungültiger Archiveintrag oder Link.');
      if (!index && name !== 'manifest.json') throw new Error('Paketindex muss zuerst stehen.');
      seen.add(name);
      const stream = await zip.openReadStreamPromise(entry);
      if (name === 'manifest.json') {
        if (entry.uncompressedSize > 16 * 1024 ** 2) throw new Error('Paketindex zu groß.');
        const chunks: Buffer[] = [];
        let count = 0;
        for await (const chunk of stream) {
          check();
          count += chunk.length;
          if (count > 16 * 1024 ** 2) throw new Error('Paketindex zu groß.');
          chunks.push(chunk);
        }
        const bytes = Buffer.concat(chunks);
        if (createHash('sha256').update(bytes).digest('hex') !== manifest.indexSha256)
          throw new Error('Paketindex widerspricht der Signatur.');
        const m = JSON.parse(bytes.toString()) as PackageIndex;
        if (
          m.product !== updateProduct ||
          m.version !== manifest.version ||
          m.commit !== manifest.commit ||
          !Array.isArray(m.files) ||
          m.files.length > 50000
        )
          throw new Error('Paketinhalt gehört nicht zum signierten Release.');
        let total = 0;
        for (const f of m.files) {
          if (
            !f ||
            !safePackageName(f.name) ||
            expected.has(f.name) ||
            ![420, 493].includes(f.mode) ||
            !Number.isSafeInteger(f.bytes) ||
            f.bytes < 0 ||
            !/^[a-f0-9]{64}$/.test(f.sha256)
          )
            throw new Error('Ungültiger Paketdateieintrag.');
          expected.set(f.name, f);
          total += f.bytes;
        }
        if (total !== manifest.unpackedBytes)
          throw new Error('Entpackte Paketgröße widerspricht dem Manifest.');
        for (const required of [
          'electron',
          'Starten.sh',
          'resources/app/main.cjs',
          'resources/app/update-helper.cjs',
          'resources/app/update-probe.cjs',
          'resources/app/build-info.json',
        ])
          if (!expected.has(required)) throw new Error('Unvollständiges Anwendungspaket.');
        index = m;
        const h = await open(path.join(directory, name), 'wx', 0o600);
        try {
          await h.writeFile(bytes);
          await h.sync();
        } finally {
          await h.close();
        }
      } else {
        const file = expected.get(name);
        if (!file || entry.uncompressedSize !== file.bytes)
          throw new Error('Nicht deklarierte Paketdatei oder Größe.');
        const target = path.join(directory, name);
        await mkdir(path.dirname(target), { recursive: true });
        const h = await open(target, 'wx', file.mode),
          hash = createHash('sha256');
        let count = 0;
        try {
          for await (const chunk of stream) {
            check();
            count += chunk.length;
            if (count > file.bytes) throw new Error('Datei überschreitet die deklarierte Größe.');
            hash.update(chunk);
            await h.writeFile(chunk);
          }
          if (count !== file.bytes || hash.digest('hex') !== file.sha256)
            throw new Error('Paketdatei hat eine falsche Prüfsumme.');
          await h.sync();
        } finally {
          await h.close();
        }
        await chmod(target, file.mode);
      }
    }
    if (!index || seen.size !== expected.size + 1) throw new Error('Paket ist unvollständig.');
    const info = JSON.parse(
      await readFile(path.join(directory, 'resources/app/build-info.json'), 'utf8'),
    );
    if (
      info.applicationVersion !== manifest.version ||
      info.commit !== manifest.commit ||
      info.product !== updateProduct
    )
      throw new Error('Buildidentität widerspricht dem Release.');
    success = true;
    return directory;
  } finally {
    zip.close();
    if (!success) await rm(directory, { recursive: true, force: true });
  }
}
