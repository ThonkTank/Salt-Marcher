import path from 'node:path';
import { desktopEntryEnvironments } from './desktop-entry-environments.mjs';
import { desktopStyleOptions } from './desktop-styles.mjs';

/** One bundle inventory for release builds and incremental development. */
export function desktopBuildPlan({ outdir = '.build/desktop', version, development = false } = {}) {
  const bundles = [];
  function add(entry, output, extra = {}) {
    const environment = desktopEntryEnvironments[entry];
    if (!environment) throw Error('Unqualified desktop entry: ' + entry);
    const platform = ['renderer', 'browser-worker'].includes(environment) ? 'browser' : 'node';
    bundles.push({
      entryPoints: [entry],
      outfile: path.join(outdir, output),
      bundle: true,
      platform,
      format: platform === 'node' ? 'cjs' : 'iife',
      ...(platform === 'node'
        ? {
            external:
              environment === 'worker'
                ? ['better-sqlite3']
                : entry.endsWith('preload.ts')
                  ? ['electron']
                  : ['electron', 'better-sqlite3'],
          }
        : {}),
      define: { __APP_VERSION__: JSON.stringify(version), __SALT_DEV__: String(development) },
      ...(development
        ? {
            sourcemap: 'inline',
            sourcesContent: true,
            ...(platform === 'node'
              ? { banner: { js: 'process.setSourceMapsEnabled?.(true);' } }
              : {}),
          }
        : {}),
      ...extra,
    });
  }
  for (const name of [
    'update-helper',
    'update-probe',
    'terrain-route-worker',
    'atlas-region-worker',
    'room-directory-worker',
    'store-worker',
    'backup-validation-worker',
    'main',
    'player-preload',
    'preload',
  ])
    add('desktop/' + name + '.ts', name + '.cjs');
  const lazy = (settings) => ({
    name: 'local-lazy-modules',
    setup(build) {
      build.onResolve({ filter: /(?:^|\/)atlas-deck-runtime$/ }, () => ({
        path: './atlas-deck-runtime.js',
        external: true,
      }));
      if (settings)
        build.onResolve({ filter: /(?:^|\/)preset-settings-ui$/ }, () => ({
          path: './preset-settings.js',
          external: true,
        }));
    },
  });
  add('src/app/runtime/player-display.ts', 'ui/player-display.js', { plugins: [lazy(false)] });
  add('src/app/atlas/atlas-brush-worker.ts', 'ui/atlas-brush-worker.js');
  add('src/app/atlas/atlas-deck-runtime.ts', 'ui/atlas-deck-runtime.js', { format: 'esm' });
  add('src/app/workspace/renderer.ts', 'ui/renderer.js', { plugins: [lazy(true)] });
  add('src/app/campaign/preset-settings-ui.ts', 'ui/preset-settings.js', { format: 'esm' });
  const entries = new Set(bundles.flatMap((options) => options.entryPoints));
  for (const entry of Object.keys(desktopEntryEnvironments))
    if (!entries.has(entry)) throw Error('Declared desktop entry was not built: ' + entry);
  bundles.push({
    ...desktopStyleOptions({ outfile: path.join(outdir, 'ui/app.css') }),
    ...(development ? { sourcemap: 'inline', sourcesContent: true } : {}),
  });
  return bundles;
}

export const desktopAssets = [
  ['node_modules/three/LICENSE', 'licenses/three-LICENSE.txt'],
  ['src/features/catalog/data/srd-5.1.generated.json', 'catalog/srd-5.1.generated.json'],
  ['src/features/catalog/SRD-5.1-ATTRIBUTION.md', 'catalog/SRD-5.1-ATTRIBUTION.md'],
  ['src/features/catalog/SRD-5.1-ITEMS-ATTRIBUTION.md', 'catalog/SRD-5.1-ITEMS-ATTRIBUTION.md'],
  ['resources/update-public-key.pem', 'update-public-key.pem'],
  ...['NotoSans-VF.ttf', 'NotoSansSymbols-VF.ttf'].map((name) => [
    'resources/atlas-fonts/' + name,
    'ui/atlas-fonts/' + name,
  ]),
  ...['OFL-1.1.txt', 'PROVENANCE.md'].map((name) => [
    'resources/atlas-fonts/' + name,
    'licenses/atlas/fonts-' + name,
  ]),
  ['src/app/campaign/preset-settings.css', 'ui/preset-settings.css'],
  ['src/app/runtime/player-display.html', 'ui/player-display.html'],
  ['src/app/runtime/player.css', 'ui/player.css'],
];
