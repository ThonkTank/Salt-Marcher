import path from 'node:path';
import { lstat, readFile } from 'node:fs/promises';
import { CampaignStore } from '../src/app/storage/store';
async function main() {
  const profile = process.argv[2];
  if (!profile || !path.isAbsolute(profile)) throw new Error('Prüfprofil fehlt.');
  const file = path.join(profile, 'workbench.sqlite');
  await lstat(file);
  const info = JSON.parse(await readFile(path.join(__dirname, 'build-info.json'), 'utf8'));
  // CampaignStore runs the real migrations. backup validates the complete resulting DB.
  const store = new CampaignStore(file, info.applicationVersion);
  try {
    await store.backup(path.join(profile, 'update-validated.sqlite'));
  } finally {
    store.close();
  }
}
void main().catch((e) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
