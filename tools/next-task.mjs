import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function readyTasks(issues) {
  const labels = issue => issue.labels.map(label => typeof label === 'string' ? label : label.name);
  const priority = issue => labels(issue).includes('priority:now') ? 0 : labels(issue).includes('priority:next') ? 1 : 2;
  return issues.filter(issue => {
    const tags = labels(issue);
    return issue.state === 'open' && tags.includes('kind:task') && tags.includes('status:ready')
      && !tags.includes('status:active') && !tags.includes('status:blocked');
  }).sort((a, b) => priority(a) - priority(b) || a.number - b.number);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.length && args[0] !== '--list') throw new Error('Usage: npm run next -- [--list]');
    const { repository } = JSON.parse(fs.readFileSync('docs/repository-policy.json', 'utf8'));
    const call = params => execFileSync('gh', params, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const issues = JSON.parse(call(['issue', 'list', '--repo', repository, '--state', 'open', '--label', 'status:ready',
      '--limit', '100', '--json', 'number,title,url,state,labels']));
    const queue = readyTasks(issues.map(issue => ({ ...issue, state: issue.state.toLowerCase() })));
    console.log('Live task queue; no automatic claim. Priority first, then issue number.');
    if (!queue.length) console.log('No free executable task is labelled ready. Check #12 for the current handoff; do not start owned or blocked work.');
    else {
      for (const issue of queue) console.log(`#${issue.number} ${issue.title}\n${issue.url}`);
      if (!args.includes('--list')) {
        const chosen = queue[0];
        const current = JSON.parse(call(['issue', 'view', String(chosen.number), '--repo', repository,
          '--json', 'body,comments,state,labels', '--jq', '{body,comments:.comments[-3:],state,labels}']));
        if (!readyTasks([{ ...chosen, ...current, state: current.state.toLowerCase() }]).length)
          throw new Error('Task changed while reading. Rerun npm run next.');
        console.log(`\nFirst candidate #${chosen.number}:\n${current.body}`);
        for (const comment of current.comments) console.log(`\nRecent comment ${comment.url}:\n${comment.body}`);
        console.log('\nBefore starting, check these comments and existing PRs for a claim; claim this exact scope in the task issue and replace ready with active.');
      }
    }
    if (issues.length === 100) console.log('Query limited to 100 ready issues; use GitHub search for the complete queue.');
  } catch (error) { console.error(`Task lookup failed: ${error.message}`); process.exitCode = 1; }
}
