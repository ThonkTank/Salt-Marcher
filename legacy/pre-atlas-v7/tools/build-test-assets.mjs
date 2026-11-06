import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const [kind, directory] = process.argv.slice(2);
const entries = {
  store: 'src/app/storage/store.ts',
  'atlas-region-worker': 'desktop/atlas-region-worker.ts',
};
if (!entries[kind] || !directory) throw Error('Expected known test artifact and output directory.');
await mkdir(path.join(directory, 'catalog'), { recursive: true });
await copyFile(
  'src/features/catalog/data/srd-5.1.generated.json',
  path.join(directory, 'catalog/srd-5.1.generated.json'),
);
await build({
  entryPoints: [entries[kind]],
  outfile: path.join(directory, 'bundle.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
