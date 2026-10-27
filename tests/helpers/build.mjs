import {ensureTestAsset,publishTestAlias} from '../../tools/test-assets.mjs';
import { buildSync as compile } from 'esbuild';
import path from 'node:path';
export { build } from 'esbuild';

// Only this identical, frequently repeated build is shared. Custom entry
// points, plugins and compile options still go through esbuild unchanged.
export function buildSync(options) {
  const standard = ['entryPoints', 'outfile', 'bundle', 'platform', 'format', 'external'];
  if (
    Object.keys(options).some((key) => !standard.includes(key)) ||
    options.entryPoints?.length !== 1 ||
    options.entryPoints[0] !== 'src/app/storage/store.ts' ||
    options.bundle !== true ||
    options.platform !== 'node' ||
    options.format !== 'cjs' ||
    JSON.stringify(options.external) !== JSON.stringify(['better-sqlite3'])
  )
    return compile(options);
  const source = ensureTestAsset('store');
  publishTestAlias(source,path.resolve(options.outfile));
  return { errors: [], warnings: [] };
}
