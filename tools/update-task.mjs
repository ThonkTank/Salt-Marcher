import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gh, issueSnapshot, assertTask, workSection, replaceWork } from './task-state.mjs';

export function updateTask(call, repository, number, request, apply = false) {
  if (!request || Object.keys(request).some(k => !['expectedBodySha256', 'expectedUpdatedAt', 'content'].includes(k))
    || !/^[a-f0-9]{64}$/.test(request.expectedBodySha256 ?? '') || typeof request.expectedUpdatedAt !== 'string')
    throw new Error('Input requires expectedBodySha256, expectedUpdatedAt and content; no ownership/labels/state operations.');
  const before = issueSnapshot(call, repository, number); assertTask(before);
  if (before.bodySha256 !== request.expectedBodySha256 || before.updatedAt !== request.expectedUpdatedAt)
    throw new Error('Incoming task change; reread and reconcile before publishing.');
  const body = replaceWork(before.body, request.content);
  const preview = { issue: before.url, apply, changed: body !== before.body,
    before: workSection(before.body)?.text ?? '(no current-work section)', after: workSection(body).text };
  if (!apply || !preview.changed) return preview;
  const fresh = issueSnapshot(call, repository, number); assertTask(fresh);
  if (fresh.bodySha256 !== before.bodySha256 || fresh.updatedAt !== before.updatedAt)
    throw new Error('Incoming task change before publication; no write performed.');
  // GitHub has no cross-resource transaction/CAS guarantee. Never retry a mutation blindly.
  try { call(['api', `repos/${repository}/issues/${number}`, '--method', 'PATCH', '--input', '-'], JSON.stringify({ body })); }
  catch (error) { throw new Error(`Publication outcome unknown. Reread task before retrying; no automatic rollback/retry. ${error.message}`); }
  let after;
  try { after = issueSnapshot(call, repository, number); }
  catch (error) { throw new Error(`Publication sent, confirmation unavailable. Reread task; no retry/rollback performed. ${error.message}`); }
  if (after.body !== body) throw new Error('Published body not confirmed (possible concurrent edit). Inspect task; no rollback performed.');
  return { ...preview, verified: true, atomicity: 'Optimistic recheck only; a final read/write race remains. No labels, claims, comments or acceptance changed.' };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2); let number, file, apply = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--task' && /^[1-9]\d*$/.test(args[i + 1] ?? '')) number = Number(args[++i]);
      else if (args[i] === '--file' && args[i + 1]) file = args[++i];
      else if (args[i] === '--apply') apply = true;
      else throw new Error('Usage: npm run update-task -- --task N --file INPUT.json [--apply]');
    }
    if (!number || !file) throw new Error('Supply --task and --file (use - for stdin). Default is read-only preview.');
    const { repository } = JSON.parse(fs.readFileSync('docs/repository-policy.json', 'utf8'));
    const request = JSON.parse(fs.readFileSync(file === '-' ? 0 : file, 'utf8'));
    console.log(JSON.stringify(updateTask(gh, repository, number, request, apply), null, 2));
  } catch (error) { console.error(`Task update failed: ${error.message}`); process.exitCode = 1; }
}
