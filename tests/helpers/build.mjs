import { buildSync as compile } from 'esbuild';
import { existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
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
  const source = path.resolve('.build/test-shared/store.cjs');
  if (!existsSync(source)) throw new Error('Prepare test assets first: node build.mjs --test');
  const destination = path.resolve(options.outfile);
  mkdirSync(path.dirname(destination), { recursive: true });
  const relative =
    './' + path.relative(path.dirname(destination), source).split(path.sep).join('/');
  const temporary = `${destination}.${process.pid}.tmp`;
  writeFileSync(temporary, `module.exports = require(${JSON.stringify(relative)});\n`);
  renameSync(temporary, destination);
  return { errors: [], warnings: [] };
}
