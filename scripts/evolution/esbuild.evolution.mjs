// Ziel: Build-Script für Evolution-Scripts (ermöglicht Worker Threads)
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Kompiliert TypeScript zu JavaScript für parallele Worker-Ausführung.
// tsx kann Worker Threads nicht unterstützen, daher separater Build.

import esbuild from 'esbuild';
import { mkdirSync, existsSync, cpSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const outDir = path.join(projectRoot, 'dist/evolution');

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

// Copy dashboard public files
const dashboardPublicSrc = path.join(__dirname, 'dashboard/public');
const dashboardPublicDst = path.join(outDir, 'dashboard/public');
if (existsSync(dashboardPublicSrc)) {
  mkdirSync(path.join(outDir, 'dashboard'), { recursive: true });
  cpSync(dashboardPublicSrc, dashboardPublicDst, { recursive: true });
  console.log('Copied dashboard/public to dist/evolution/dashboard/public');
}

// Common build options
const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: ['obsidian'],
  // Path alias resolution
  alias: {
    '@': path.join(projectRoot, 'src'),
    '#entities': path.join(projectRoot, 'src/types/entities'),
    '#types': path.join(projectRoot, 'src/types'),
  },
};

console.log('Building evolution scripts...');
console.log('Output directory:', outDir);

try {
  // Main evolve.ts entry point
  await esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(__dirname, 'evolve.ts')],
    outfile: path.join(outDir, 'evolve.mjs'),
  });
  console.log('  - evolve.mjs');

  // Evaluate entry point
  await esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(__dirname, 'evaluate.ts')],
    outfile: path.join(outDir, 'evaluate.mjs'),
  });
  console.log('  - evaluate.mjs');

  // Worker entry point (separate bundle for Worker Threads)
  await esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(__dirname, 'workers/evaluationWorker.ts')],
    outfile: path.join(outDir, 'evaluationWorker.mjs'),
  });
  console.log('  - evaluationWorker.mjs');

  console.log('\nEvolution scripts compiled successfully!');
  console.log('\nUsage:');
  console.log('  node dist/evolution/evolve.mjs --population 150 --generations 500');
  console.log('  node dist/evolution/evaluate.mjs --genome champion.json --fights 20');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
