import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { buildSync } from '../tests/helpers/build.mjs';
import { createNativeSession } from './native-session.mjs';
const root = process.cwd(),
  output = process.env.QA_EVIDENCE_DIR || path.join(root, '.build/error-diagnostics-evidence');
const native = await createNativeSession({ root, output, name: 'error-diagnostics' });
const require = createRequire(import.meta.url),
  records = [];
try {
  buildSync({
    entryPoints: ['src/app/storage/store.ts'],
    outfile: '.build/error-diagnostic-store.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore } = require(path.join(root, '.build/error-diagnostic-store.cjs'));
  const store = new CampaignStore(path.join(native.profile, 'workbench.sqlite'));
  const campaign = store.create('Diagnosekampagne');
  store.tutorial('skipped');
  store.close();
  const page = await native.launch();
  let buffer = '';
  native.app.process().stderr.on('data', (chunk) => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      try {
        const record = JSON.parse(line);
        if (record.event === 'desktop-error') records.push(record);
      } catch {}
    }
  });
  await page
    .locator(`.campaign-card[data-campaign-id="${campaign.id}"]`)
    .getByRole('button', { name: 'Bearbeiten…', exact: true })
    .click();
  await page.locator('#campaign-identity-name').fill('Nicht versehentlich übernehmen');
  const changed = await page.evaluate((command) => window.campaign.campaignCatalog(command), {
    commandId: randomUUID(),
    kind: 'rename',
    id: campaign.id,
    expectedRevision: campaign.revision,
    name: 'Parallel bestätigter Name',
  });
  assert.equal(changed.ok, true);
  await page
    .locator('#campaign-identity-form')
    .getByRole('button', { name: 'Speichern', exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('#campaign-identity-status').textContent ===
      'Kampagnenname inzwischen geändert.',
  );
  const deadline = Date.now() + 5000;
  while (!records.length && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
  const record = records.find((record) => record.context.channel === 'campaign:catalog');
  assert(record);
  assert.equal(record.error.message, 'Kampagnenname inzwischen geändert.');
  assert.equal(record.error.context.method, 'campaignCatalog');
  assert.equal(record.error.context.phase, 'store-operation');
  assert(Number.isSafeInteger(record.error.context.requestId));
  assert.match(record.error.stack, /store-worker.cjs/);
  assert(!JSON.stringify(record).includes('Nicht versehentlich übernehmen'));
  assert(!JSON.stringify(record).includes('Parallel bestätigter Name'));
  await native.capture(page, 'rename-conflict');
  await page.locator('#campaign-identity-name').press('Escape');
  await native.close();
  await native.finish({
    checks: [
      'Original visible conflict message',
      'Worker source stack and request context in host stderr',
      'No command payload in diagnostic',
      'Normal close',
    ],
    diagnostics: records,
  });
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
