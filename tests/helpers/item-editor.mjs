import { buildSync } from './build.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const output = `.build/item-commit-host-${process.pid}.cjs`;
buildSync({
  entryPoints: ['src/app/shared/commit-confirmation.ts'],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
export function itemCommitHost(context, status) {
  delete require.cache[require.resolve('../../' + output)];
  const commits = require('../../' + output);
  commits.initCommitControls(context, status);
  return { commits, refreshProgress: async () => {} };
}
