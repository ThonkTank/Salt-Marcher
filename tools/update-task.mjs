import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gh, issueSnapshot, assertTask, workSection, replaceWork } from './task-state.mjs';

export function updateTask(call, repository, number, request, apply = false) {
  if (apply) throw new Error('Issue publication disabled: preview only. Maintain versioned work context in the existing plan via normal Git publication.');
  if (!request || Object.keys(request).some(k => !['expectedBodySha256', 'expectedUpdatedAt', 'content'].includes(k))
    || !/^[a-f0-9]{64}$/.test(request.expectedBodySha256 ?? '') || typeof request.expectedUpdatedAt !== 'string')
    throw new Error('Input requires expectedBodySha256, expectedUpdatedAt and content; no ownership/labels/state operations.');
  const before = issueSnapshot(call, repository, number); assertTask(before);
  if (before.bodySha256 !== request.expectedBodySha256 || before.updatedAt !== request.expectedUpdatedAt)
    throw new Error('Incoming task change; reread and reconcile before publishing.');
  if (/^Arbeitsstand:/m.test(before.body)) throw new Error('Task already uses versioned work context; edit the linked plan, not an issue copy.');
  const body = replaceWork(before.body, request.content);
  return { issue: before.url, mode: 'preview-only', changed: body !== before.body,
    before: workSection(before.body)?.text ?? '(no current-work section)', after: workSection(body).text };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2); let number, file;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--task' && /^[1-9]\d*$/.test(args[i + 1] ?? '')) number = Number(args[++i]);
      else if (args[i] === '--file' && args[i + 1]) file = args[++i];
      else if (args[i] === '--apply') throw new Error('Issue publication disabled: --apply is no longer supported.');
      else throw new Error('Usage: npm run update-task -- --task N --file INPUT.json (preview only)');
    }
    if (!number || !file) throw new Error('Supply --task and --file (use - for stdin). Read-only preview; never publishes.');
    const { repository } = JSON.parse(fs.readFileSync('docs/repository-policy.json', 'utf8'));
    const request = JSON.parse(fs.readFileSync(file === '-' ? 0 : file, 'utf8'));
    console.log(JSON.stringify(updateTask(gh, repository, number, request), null, 2));
  } catch (error) { console.error(`Task update failed: ${error.message}`); process.exitCode = 1; }
}
