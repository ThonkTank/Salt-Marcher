import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { assertNativeCompletion } from '../../../tools/native-session.mjs';
const base = path.resolve(process.argv[2]);
const report = JSON.parse(await readFile(path.join(base, 'report.json'), 'utf8'));
const rows = [];
for (const scenario of report.results.filter((r) => r.status === 'passed')) {
  const issues = [],
    evidence = [];
  for (const file of scenario.receipts) {
    const receipt = JSON.parse(await readFile(file, 'utf8'));
    if (!receipt.profile && !receipt.rendererErrors) continue; // aggregate only; underlying sessions are audited independently
    let errors = receipt.errors ?? receipt.rendererErrors;
    if (receipt.adapter?.startsWith('packaged-update')) {
      errors = [];
      for (const version of ['90.0.0', '90.0.1'])
        errors.push(
          ...JSON.parse(
            await readFile(
              path.join(path.dirname(receipt.root), 'renderer-' + version + '.json'),
              'utf8',
            ),
          ),
        );
    }
    try {
      assertNativeCompletion(receipt.launches, errors, {
        allowConfirmedCrash: scenario.name === 'e2e01',
      });
    } catch (e) {
      issues.push({ file, error: e.message });
    }
    for (const launch of receipt.launches) {
      if ((launch.zoom ?? launch.requestedZoom) !== 1)
        issues.push({ file, error: 'Non-100% native zoom' });
      if (launch.capture) {
        const bytes = await readFile(path.join(path.dirname(file), launch.capture));
        if (
          createHash('sha256').update(bytes).digest('hex') !== launch.captureSha256 ||
          !launch.capturedAt ||
          !(launch.captureSize?.width > 0 && launch.captureSize?.height > 0)
        )
          issues.push({ file, error: 'Development generation capture mismatch' });
      }
      for (const frame of launch.captures ?? []) {
        const png = await readFile(
          path.isAbsolute(frame.file) ? frame.file : path.join(path.dirname(file), frame.file),
        );
        const sha = createHash('sha256').update(png).digest('hex');
        if (
          sha !== frame.sha256 ||
          (!receipt.adapter && !frame.fresh) ||
          !(frame.width > 0 && frame.height > 0)
        )
          issues.push({ file, error: 'Capture freshness/hash mismatch' });
      }
    }
    if (receipt.cleanup?.some((e) => e.forced || e.pidAbsent !== true))
      issues.push({ file, error: 'Incomplete or forced cleanup' });
    if (receipt.artifacts)
      for (const [file, sha] of Object.entries(report.binding.artifacts))
        if (receipt.artifacts[file] !== sha)
          issues.push({ file, error: 'Runtime differs from bound baseline' });
    evidence.push({
      file,
      launches: receipt.launches.length,
      captures: receipt.launches.reduce((n, l) => n + (l.captures?.length ?? 0), 0),
      rendererErrors: errors?.length,
      cleanup: receipt.cleanup,
    });
  }
  if (!evidence.length) issues.push({ error: 'No complete session evidence found' });
  rows.push({ name: scenario.name, evidence, issues });
}
await writeFile(
  path.join(base, 'technical-audit.json'),
  JSON.stringify(
    {
      sourceDigest: report.binding.sourceDigest,
      auditorSha256: createHash('sha256')
        .update(await readFile(fileURLToPath(import.meta.url)))
        .digest('hex'),
      rows,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    audited: rows.length,
    issues: rows.filter((r) => r.issues.length).map((r) => ({ name: r.name, issues: r.issues })),
  }),
);

if (rows.some((row) => row.issues.length)) process.exitCode = 1;
