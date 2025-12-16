import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const prod = process.argv.includes('production');
const outDir = '/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher';

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  format: 'cjs',
  target: 'es2022',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: join(outDir, 'main.js'),
});

if (prod) {
  await context.rebuild();
  copyFileSync('manifest.json', join(outDir, 'manifest.json'));
  console.log('Build complete:', outDir);
  process.exit(0);
} else {
  await context.watch();
  copyFileSync('manifest.json', join(outDir, 'manifest.json'));
  console.log('Watching for changes...');
}
