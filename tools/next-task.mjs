import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { issueSnapshot, taskContext, markdownSection, recentComments } from './task-state.mjs';

const labels = issue => issue.labels.map(label => typeof label === 'string' ? label : label.name);
const priority = issue => labels(issue).includes('priority:now') ? 0 : labels(issue).includes('priority:next') ? 1 : 2;
const preparation = issue => labels(issue).includes('documentation') ? 1 : 0;
const workOrder = (a, b) => priority(a) - priority(b) || preparation(a) - preparation(b) || a.number - b.number;
export function readyTasks(issues) {
  return issues.filter(issue => {
    const tags = labels(issue);
    return issue.state === 'open' && tags.includes('kind:task') && tags.includes('status:ready')
      && !tags.includes('status:active') && !tags.includes('status:blocked');
  }).sort(workOrder);
}

export function criticalTasks(issues) {
  return issues.filter(issue => {
    const tags = labels(issue);
    return issue.state === 'open' && tags.includes('kind:task') && tags.includes('priority:now');
  }).sort((a, b) => a.number - b.number);
}

// Support is an invitation to the described boundary, never ownership of the
// parent implementation. Blocked parents can still have executable support.
export function supportTasks(issues) {
  return issues.filter(issue => issue.state === 'open' && labels(issue).includes('kind:task')
    && labels(issue).includes('help wanted') && !readyTasks([issue]).length)
    .sort(workOrder);
}

export function taskCandidate(issues, prs) {
  // Preserve explicit bottleneck priority. At equal priority, offer a free
  // product package before support so available workers can implement in parallel.
  const free = readyTasks(issues);
  const freeNumbers = new Set(free.map(issue => issue.number));
  const invitation = issue => issue.source === 'pr' || !freeNumbers.has(issue.number) ? 1 : 0;
  return [...free, ...supportTasks(issues),
    ...prs.filter(pr => pr.state === 'open' && labels(pr).includes('help wanted'))
      .map(pr => ({ ...pr, source: 'pr' }))].sort((a, b) => priority(a) - priority(b)
        || preparation(a) - preparation(b) || invitation(a) - invitation(b) || a.number - b.number)[0];
}

export function tasksForArea(issues, area) {
  if (!area) return issues;
  const areas = { atlas: 'atlas-city', city: 'atlas-city', dungeon: 'dungeon', gm: 'dungeon',
    catalog: 'catalog', campaign: 'campaign', runtime: 'runtime', platform: 'platform', repository: 'repository' };
  if (!Object.hasOwn(areas, area)) throw new Error(`Unknown area: ${area}`);
  return issues.filter(issue => labels(issue).includes(`area:${areas[area]}`));
}

function showPackage(call, repository, chosen, requested = false, fullComments = false, json = false) {
  const source = chosen.source || 'issue';
  const current = source === 'issue' ? issueSnapshot(call, repository, chosen.number)
    : JSON.parse(call(['pr', 'view', String(chosen.number), '--repo', repository,
      '--json', 'number,title,body,state,labels,url,headRefOid,reviewDecision,isDraft,statusCheckRollup']));
  const fresh = { ...current, state: current.state.toLowerCase() };
  if (fresh.state !== 'open' || source === 'issue' && !labels(fresh).includes('kind:task'))
    throw new Error('Selected task is closed or is not a work package.');
  if (source === 'pr' && !labels(fresh).includes('help wanted')
    || source === 'issue' && !requested && !readyTasks([fresh]).length && !supportTasks([fresh]).length)
    throw new Error('Task changed while reading. Rerun npm run next.');
  const live = source === 'issue' ? taskContext(call, repository, chosen.number, current.body) : { facts: [{
    kind: 'Kandidat', number: current.number, state: current.state, head: current.headRefOid,
    reviewDecision: current.reviewDecision, checks: current.statusCheckRollup }], warnings: [] };
  if (json) { console.log(JSON.stringify({ ...current, live }, null, 2)); return; }
  console.log(`\n${requested ? 'Requested package' : readyTasks([fresh]).length ? 'Free candidate' : 'Support invitation'} ${source === 'pr' ? 'PR ' : ''}#${chosen.number}: ${current.title}\n${current.url}`);
  if (live.source) {
    const entry = ['Nutzerergebnis', 'Übernommene Implementierung', 'Arbeitsort, Scope und Voraussetzungen']
      .map(title => markdownSection(current.body, title)?.text).filter(Boolean).join('\n');
    console.log(entry.slice(0, 4000));
    if (entry.length > 4000) console.log('Entry shortened; full fixed scope/claims at the issue link.');
    console.log(`\nVersioned work context @ ${live.source.revision}\n${live.source.url}\n${live.source.text}`);
  } else {
    console.log(current.body.slice(0, 6000));
    if (current.body.length > 6000) console.log('Issue text shortened; full text at the issue link.');
  }

  for (const fact of live.facts) console.log(`\nLive ${fact.kind}: ${JSON.stringify(fact)}`);
  for (const warning of live.warnings) console.log(`\nContext warning: ${warning}`);
  console.log('\nLive PR/CI/review metadata is not domain, GUI or product acceptance.');
  if (fullComments) {
    try {
      for (const comment of recentComments(call, repository, chosen.number, source))
        console.log(`\nRecent comment ${comment.url}:\n${comment.body}`);
    } catch (error) { console.log(`\nComments unavailable: ${error.message.split('\n')[0]}`); }
  }
  console.log('\nComments are targeted evidence, not a second current-work description. --comments reads the latest three; older claims/decisions must be checked explicitly when needed.');
  console.log('\nResume only your own scope. Before a new claim, check unresolved claims and linked PRs, including older comments. After posting, reread claims: the first unreturned claim owns that scope. Only a free whole package changes ready to active; support never takes over its parent. See docs/REPOSITORY.md.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2);
    let list = false, fullComments = false, json = false, area, task;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--list') list = true;
      else if (args[i] === '--comments') fullComments = true;
      else if (args[i] === '--json') json = true;
      else if (args[i] === '--area' && args[i + 1]) area = args[++i];
      else if (args[i] === '--task' && /^[1-9]\d*$/.test(args[i + 1] || '')) task = Number(args[++i]);
      else throw new Error('Usage: npm run next -- [--list] [--area <area>] [--task <issue>] [--comments] [--json]');
    }
    if (json && (!task || list || fullComments)) throw new Error('--json requires --task, without --list/--comments.');
    const { repository } = JSON.parse(fs.readFileSync('docs/repository-policy.json', 'utf8'));
    const call = params => execFileSync('gh', params, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    // Resume the known package even when an unrelated queue/PR query fails.
    // --list explicitly requests the overview as well as the named package.
    if (task && !list) {
      if (area) tasksForArea([], area);
      showPackage(call, repository, { number: task }, true, fullComments, json);
    } else {
      const issues = JSON.parse(call(['issue', 'list', '--repo', repository, '--state', 'open', '--label', 'kind:task',
        '--limit', '1000', '--json', 'number,title,url,state,labels'])).map(issue => ({ ...issue, state: issue.state.toLowerCase() }));
      const available = tasksForArea(issues, area);
      const queue = readyTasks(available);
      const support = supportTasks(available);
      // Read the live PR connection, then filter locally: label search indexing
      // can lag behind a newly published support invitation.
      const prs = JSON.parse(call(['pr', 'list', '--repo', repository, '--state', 'open',
        '--limit', '1000', '--json', 'number,title,url,state,labels']))
        .map(pr => ({ ...pr, state: pr.state.toLowerCase() }));
      const supportPRs = tasksForArea(prs.filter(pr => labels(pr).includes('help wanted')), area);
      console.log('Live task queue; no automatic claim. Priority first; then product before documentation, free package before support, then issue number.');
      console.log('\nCurrent product bottlenecks: check existing owners and requested support before opening more work.');
      const bottlenecks = criticalTasks(issues);
      for (const issue of bottlenecks) console.log(`#${issue.number} ${issue.title} [${issue.labels.map(l => l.name).filter(l => l.startsWith('status:')).join(', ') || 'ownership to check'}]\n${issue.url}`);
      if (!bottlenecks.length) console.log('No task is marked priority:now; check the current delivery decision in #12.');
      if (list) {
        console.log('\nFree executable tasks:');
        if (!queue.length) console.log('No free implementation package is labelled ready. Continue owned work, then check the support invitations below and confirmed unowned needs; an empty ready list alone is not a blocker.');
        for (const issue of queue) console.log(`#${issue.number} ${issue.title}\n${issue.url}`);
        console.log('\nOwned packages: continue your role with --task <number>; these are not free work.');
        for (const issue of available.filter(issue => labels(issue).includes('status:active')))
          console.log(`#${issue.number} ${issue.title} [${labels(issue).filter(tag => tag.startsWith('status:')).join(', ')}]\n${issue.url}`);
        console.log('\nSupport invitations: read the offered scope and prerequisites; parent ownership and blockers remain.');
        for (const issue of support) console.log(`#${issue.number} ${issue.title}\n${issue.url}`);
        for (const pr of supportPRs) console.log(`PR #${pr.number} ${pr.title}\n${pr.url}`);
        if (!support.length && !supportPRs.length) console.log('No explicit support invitation in this selection. Check #12 and the relevant area for a confirmed unmet input; do not manufacture work.');
      } else {
        console.log(`\nSelection: ${queue.length} free packages, ${support.length + supportPRs.length} support invitations. --list shows the full queue; --task <number> resumes owned work.`);
        if (!queue.length && !support.length && !supportPRs.length)
          console.log('No invitation in this selection. Check confirmed unmet inputs at the relevant area; an empty list alone is not a blocker.');
      }
      if (!list || task) {
        const chosen = task ? { number: task } : taskCandidate(available, supportPRs);
        if (chosen) showPackage(call, repository, chosen, Boolean(task), fullComments);
      }
      if (issues.length === 1000 || prs.length === 1000) console.log('Query reached 1000 items; use GitHub search for the complete inventory.');
    }
  } catch (error) { console.error(`Task lookup failed: ${error.message}`); process.exitCode = 1; }
}
