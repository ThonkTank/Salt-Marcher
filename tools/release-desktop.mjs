import { build } from 'esbuild';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The canonical data-format declaration is shared with the desktop build. */
export function assertPackageSource(info, version, head, schema) {
  if (
    info.applicationVersion !== version ||
    info.commit !== head ||
    info.product !== 'saltmarcher-workbench'
  )
    throw new Error('Paket und Releasequellstand stimmen nicht überein.');
  if (
    !Number.isSafeInteger(schema) ||
    schema < 1 ||
    info.schema?.target !== schema ||
    info.schema?.max !== schema
  )
    throw new Error('Build-Datenformatgrenze stimmt nicht mit der Formatdeklaration überein.');
}

async function main() {
  const [directory, output] = process.argv.slice(2);
  if (!directory || !output)
    throw new Error('Aufruf: node tools/release-desktop.mjs PAKETORDNER AUSGABEORDNER');
  await mkdir(output, { recursive: true });
  const info = JSON.parse(
    await readFile(path.join(directory, 'resources/app/build-info.json'), 'utf8'),
  );
  const pkg = JSON.parse(await readFile('package.json', 'utf8')),
    head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const { schema } = JSON.parse(await readFile('src/app/data-format.json', 'utf8'));
  assertPackageSource(info, pkg.version, head, schema);
  const key = createPrivateKey(process.env.SALTMARCHER_UPDATE_PRIVATE_KEY ?? '');
  const expected = await readFile('resources/update-public-key.pem', 'utf8');
  if (createPublicKey(key).export({ type: 'spki', format: 'pem' }) !== expected)
    throw new Error('Signierschlüssel passt nicht zur Anwendung.');
  await build({
    entryPoints: ['desktop/update-package.ts'],
    outfile: '.build/update-package.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });
  const { packUpdate } = createRequire(import.meta.url)(path.resolve('.build/update-package.cjs'));
  const archive = `SaltMarcher-${info.applicationVersion}-linux-x64.zip`,
    filename = path.join(output, archive);
  if (
    await stat(filename).then(
      () => true,
      () => false,
    )
  )
    throw new Error('Releasepaket existiert bereits; nicht überschreiben.');
  const hashes = await packUpdate(directory, filename, info.applicationVersion, info.commit);
  const manifest = {
    format: 1,
    product: info.product,
    dataLine: info.dataLine,
    version: info.applicationVersion,
    commit: info.commit,
    platform: 'linux-x64',
    archive,
    ...hashes,
    schema: info.schema,
  };
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(output, 'saltmarcher-update.json'), bytes, { flag: 'wx' });
  await writeFile(path.join(output, 'saltmarcher-update.json.sig'), sign(null, bytes, key), {
    flag: 'wx',
  });
  console.log(`Signed Linux release ${info.applicationVersion} (${info.commit})`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();
