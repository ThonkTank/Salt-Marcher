import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const [kind, directory] = process.argv.slice(2);
if (kind !== 'store' || !directory) throw Error('Expected store artifact and output directory.');
await mkdir(path.join(directory, 'catalog'), { recursive: true });
await copyFile(
  'src/features/catalog/data/srd-5.1.generated.json',
  path.join(directory, 'catalog/srd-5.1.generated.json'),
);
await build({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: path.join(directory, 'bundle.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
