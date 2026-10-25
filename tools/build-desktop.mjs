import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { mkdir, copyFile, rm, readFile, writeFile } from 'node:fs/promises';
import { copyAtlasRuntimeLicenses } from './atlas-runtime-licenses.mjs';
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const { schema } = JSON.parse(await readFile('src/app/data-format.json', 'utf8'));
if (!Number.isSafeInteger(schema) || schema < 1) throw new Error('Ungültiges Datenformat.');
const applicationVersion = JSON.parse(await readFile('package.json', 'utf8')).version;
if (typeof applicationVersion !== 'string' || !applicationVersion.trim())
  throw new Error('Releaseversion fehlt.');
await rm('.build/desktop', { recursive: true, force: true });
await mkdir('.build/desktop/ui', { recursive: true });
await mkdir('.build/desktop/catalog', { recursive: true });
await mkdir('.build/desktop/licenses', { recursive: true });
await copyFile('node_modules/three/LICENSE', '.build/desktop/licenses/three-LICENSE.txt');
await copyAtlasRuntimeLicenses('.build/desktop/licenses/atlas');
await copyFile(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/desktop/catalog/srd-5.1.generated.json',
);
await copyFile(
  'src/features/catalog/SRD-5.1-ATTRIBUTION.md',
  '.build/desktop/catalog/SRD-5.1-ATTRIBUTION.md',
);
await copyFile(
  'src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md',
  '.build/desktop/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md',
);
await copyFile('resources/update-public-key.pem', '.build/desktop/update-public-key.pem');
for (const name of ['update-helper', 'update-probe'])
  await build({
    entryPoints: ['desktop/' + name + '.ts'],
    outfile: '.build/desktop/' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron', 'better-sqlite3'],
  });
await build({
  entryPoints: ['desktop/terrain-route-worker.ts'],
  outfile: '.build/desktop/terrain-route-worker.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
await build({
  entryPoints: ['desktop/atlas-region-worker.ts'],
  outfile: '.build/desktop/atlas-region-worker.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
await build({
  entryPoints: ['desktop/room-directory-worker.ts'],
  outfile: '.build/desktop/room-directory-worker.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
await build({
  entryPoints: ['desktop/store-worker.ts'],
  outfile: '.build/desktop/store-worker.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
await build({
  entryPoints: ['desktop/backup-validation-worker.ts'],
  outfile: '.build/desktop/backup-validation-worker.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
await build({
  entryPoints: ['desktop/main.ts'],
  outfile: '.build/desktop/main.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron', 'better-sqlite3'],
  define: { __APP_VERSION__: JSON.stringify(applicationVersion) },
});
await build({
  entryPoints: ['desktop/player-preload.ts'],
  outfile: '.build/desktop/player-preload.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});
await build({
  entryPoints: ['src/app/player-display.ts'],
  outfile: '.build/desktop/ui/player-display.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  plugins: [
    {
      name: 'player-atlas-runtime',
      setup(build) {
        build.onResolve({ filter: /^\.\/atlas-deck-runtime$/ }, () => ({
          path: './atlas-deck-runtime.js',
          external: true,
        }));
      },
    },
  ],
});
await build({
  entryPoints: ['desktop/preload.ts'],
  outfile: '.build/desktop/preload.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});
await build({
  entryPoints: ['src/app/atlas-brush-worker.ts'],
  outfile: '.build/desktop/ui/atlas-brush-worker.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
});
// The replacement Atlas remains a local lazy module until full tool handover.
await build({
  entryPoints: ['src/app/atlas-deck-runtime.ts'],
  outfile: '.build/desktop/ui/atlas-deck-runtime.js',
  bundle: true,
  platform: 'browser',
  format: 'esm',
});
await mkdir('.build/desktop/ui/atlas-fonts', { recursive: true });
for (const name of ['NotoSans-VF.ttf', 'NotoSansSymbols-VF.ttf'])
  await copyFile(`resources/atlas-fonts/${name}`, `.build/desktop/ui/atlas-fonts/${name}`);
for (const name of ['OFL-1.1.txt', 'PROVENANCE.md'])
  await copyFile(`resources/atlas-fonts/${name}`, `.build/desktop/licenses/atlas/fonts-${name}`);
await build({
  entryPoints: ['src/app/renderer.ts'],
  outfile: '.build/desktop/ui/renderer.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  plugins: [
    {
      name: 'lazy-generator-settings',
      setup(build) {
        build.onResolve({ filter: /^\.\/preset-settings-ui$/ }, () => ({
          path: './preset-settings.js',
          external: true,
        }));
        build.onResolve({ filter: /^\.\/atlas-deck-runtime$/ }, () => ({
          path: './atlas-deck-runtime.js',
          external: true,
        }));
      },
    },
  ],
});
await build({
  entryPoints: ['src/app/preset-settings-ui.ts'],
  outfile: '.build/desktop/ui/preset-settings.js',
  bundle: true,
  platform: 'browser',
  format: 'esm',
});
await copyFile('src/app/preset-settings.css', '.build/desktop/ui/preset-settings.css');
for (const file of ['index.html', 'app.css', 'player-display.html', 'player.css'])
  await copyFile(`src/app/${file}`, `.build/desktop/ui/${file}`);
await writeFile(
  '.build/desktop/ui/app.css',
  (await readFile('src/app/app.css', 'utf8')) +
    '\n' +
    (await readFile('src/app/key-notes.css', 'utf8')) +
    '\n' +
    (await readFile('src/app/markdown-view.css', 'utf8')) +
    '\n' +
    (await readFile('src/app/atlas-workspace.css', 'utf8')),
);
await writeFile(
  '.build/desktop/build-info.json',
  JSON.stringify({
    applicationVersion,
    commit,
    product: 'saltmarcher-workbench',
    dataLine: 'CampaignWorkbench',
    schema: { min: schema, max: schema, target: schema },
  }) + '\n',
);
console.log('Desktop build ready: .build/desktop/main.cjs');
