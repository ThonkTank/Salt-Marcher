import { execFileSync } from 'node:child_process';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { desktopAssets } from './desktop-build-plan.mjs';
import { copyAtlasRuntimeLicenses } from './atlas-runtime-licenses.mjs';

export async function desktopBuildMetadata(root = process.cwd()) {
  const { schema } = JSON.parse(
    await readFile(path.join(root, 'src/app/data-format.json'), 'utf8'),
  );
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (!Number.isSafeInteger(schema) || schema < 1) throw Error('Ungültiges Datenformat.');
  if (typeof version !== 'string' || !version.trim()) throw Error('Releaseversion fehlt.');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return {
    applicationVersion: version,
    commit,
    product: 'saltmarcher-workbench',
    dataLine: 'CampaignWorkbench',
    schema: { min: schema, max: schema, target: schema },
  };
}
export async function copyDesktopAssets(outdir, { root = process.cwd(), changes = null } = {}) {
  for (const [source, destination] of desktopAssets) {
    if (changes && !changes.has(source)) continue;
    const target = path.join(outdir, destination);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, source), target);
  }
  if (!changes) await copyAtlasRuntimeLicenses(path.join(outdir, 'licenses/atlas'));
}
export async function writeDesktopDocuments(outdir, metadata, root = process.cwd()) {
  await mkdir(path.join(outdir, 'ui'), { recursive: true });
  await writeFile(
    path.join(outdir, 'ui/index.html'),
    await readFile(path.join(root, 'src/app/workspace/index.html'), 'utf8'),
  );
  await writeFile(path.join(outdir, 'build-info.json'), JSON.stringify(metadata) + '\n');
}
