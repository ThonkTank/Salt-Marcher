import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const workHeading = '## Aktueller Arbeitsstand';
export const bodyHash = body => createHash('sha256').update(body).digest('hex');
export const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 4 * 1024 * 1024 });

// Ignore headings inside code fences; preserve all bytes outside the selected section.
export function workSection(body) {
  let fence, offset = 0;
  const headings = [];
  for (const line of body.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
    } else if (!fence) {
      const heading = line.match(/^(#{1,3}) (.+?)\s*$/);
      if (heading) headings.push({ offset, line: line.trimEnd(), level: heading[1].length, title: heading[2] });
    }
    offset += line.length;
  }
  const matches = headings.filter(h => h.level >= 2 && h.title === 'Aktueller Arbeitsstand');
  if (matches.length > 1) throw new Error('Duplicate current-work sections; resolve explicitly before updating.');
  if (!matches.length) return null;
  const start = matches[0].offset;
  const end = headings.find(h => h.offset > start && h.level <= matches[0].level)?.offset ?? body.length;
  return { start, end, heading: matches[0].line, text: body.slice(start, end) };
}

export function replaceWork(body, content) {
  if (typeof content !== 'string' || !content.trim() || content.length > 16000
    || /^ {0,3}#{1,3}(?:\s|$)/m.test(content) || /^ {0,3}(?:`{3,}|~{3,})/m.test(content) || content.includes('\0'))
    throw new Error('Provide a nonempty current-work paragraph, without level-1/2/3 headings or code fences (max 16000 characters).');
  const section = workSection(body);
  const replacement = `${section?.heading ?? workHeading}\n\n${content.trim()}\n\n`;
  return section ? body.slice(0, section.start) + replacement + body.slice(section.end)
    : body + (body.endsWith('\n\n') ? '' : body.endsWith('\n') ? '\n' : '\n\n') + replacement;
}

export function issueSnapshot(call, repository, number) {
  const issue = JSON.parse(call(['api', `repos/${repository}/issues/${number}`]));
  if (issue.pull_request) throw new Error('Expected a task issue, not a PR.');
  return { number: issue.number, title: issue.title, url: issue.html_url,
    body: issue.body ?? '', state: issue.state.toLowerCase(), labels: issue.labels,
    updatedAt: issue.updated_at, bodySha256: bodyHash(issue.body ?? '') };
}

export function assertTask(issue) {
  if (issue.state !== 'open' || !issue.labels.some(l => (typeof l === 'string' ? l : l.name) === 'kind:task'))
    throw new Error('Selected task is closed or is not a work package.');
}

export function liveFacts(call, repository, body) {
  const section = workSection(body);
  const facts = [], warnings = [];
  // Explicit current links only; historical prose and arbitrary PR mentions are not candidates.
  for (const line of section?.text.split('\n') ?? []) {
    const match = line.match(/^(Kandidat|Eingang):\s+https:\/\/github\.com\/([^/]+\/[^/]+)\/(pull|issues)\/([1-9]\d*)\s*$/);
    if (!match) continue;
    const [, kind, repo, type, number] = match;
    if (repo !== repository || (kind === 'Kandidat' && type !== 'pull') || (kind === 'Eingang' && type !== 'issues')) {
      warnings.push(`Unsupported current link: ${line}`); continue;
    }
    try {
      const data = type === 'pull' ? JSON.parse(call(['pr', 'view', number, '--repo', repository,
        '--json', 'number,url,state,isDraft,headRefOid,reviewDecision,statusCheckRollup']))
        : JSON.parse(call(['api', `repos/${repository}/issues/${number}`]));
      facts.push({ kind, number: Number(number), url: data.html_url ?? data.url,
        state: data.state, ...(type === 'pull' ? { head: data.headRefOid, draft: data.isDraft,
          reviewDecision: data.reviewDecision, checks: (data.statusCheckRollup ?? []).map(c => ({
            name: c.name ?? c.context, state: c.conclusion || c.status || c.state })) } : {}) });
      if (type === 'pull' && data.state === 'MERGED' && /wart\w*[^\n]*(?:review|integration)/i.test(section.text))
        warnings.push(`Check remaining instruction against merged candidate PR${number}; merge is not package/product acceptance.`);
    } catch (error) { warnings.push(`Live ${kind} #${number} unavailable: ${error.message.split('\n')[0]}`); }
  }
  if (!section) warnings.push('No current-work section yet; legacy text below is not a live technical status.');
  return { facts, warnings };
}

export function recentComments(call, repository, number, source = 'issue') {
  const [owner, name] = repository.split('/');
  const result = JSON.parse(call(['api', 'graphql', '-f', `query=query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){${source}(number:$number){comments(last:3){nodes{url body}}}}}`,
    '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${number}`]));
  return result.data.repository[source].comments.nodes;
}
