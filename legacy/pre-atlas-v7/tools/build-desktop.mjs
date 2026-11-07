import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { desktopBuildPlan } from './desktop-build-plan.mjs';
import {
  desktopBuildMetadata,
  copyDesktopAssets,
  writeDesktopDocuments,
} from './desktop-build-output.mjs';

const outdir = '.build/desktop';
const metadata = await desktopBuildMetadata();
await rm(outdir, { recursive: true, force: true });
await copyDesktopAssets(outdir);
for (const options of desktopBuildPlan({ outdir, version: metadata.applicationVersion }))
  await build(options);
await writeDesktopDocuments(outdir, metadata);
console.log('Desktop build ready: .build/desktop/main.cjs');
