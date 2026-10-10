import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const workHeading = '## Aktueller Arbeitsstand';
export const bodyHash = body => createHash('sha256').update(body).digest('hex');
export const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 4 * 1024 * 1024 });

// ATX/setext headings outside fenced or indented code. Unclosed fences fail closed.
export function markdownSection(body, title) {
  let fence, offset = 0, previous;
  const headings = [];
  for (const line of body.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const value = line.replace(/\r?\n$/, '');
    const marker = value.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      previous = undefined;
    } else if (marker) {
      fence = marker[1]; previous = undefined;
    } else {
      const atx = value.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/);
      const setext = value.match(/^ {0,3}(=+|-+)[ \t]*$/);
      if (atx) headings.push({ offset, line: value, level: atx[1].length,
        title: (atx[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '').trim() });
      else if (setext && previous) headings.push({ offset: previous.offset, line: previous.value + '\n' + value,
        level: setext[1][0] === '=' ? 1 : 2, title: previous.value.trim() });
      previous = !atx && !setext && value.trim() && !/^(?: {4}|\t)/.test(value) ? { offset, value } : undefined;
    }
    offset += line.length;
  }
  if (fence) throw new Error('Unclosed code fence; section boundaries are ambiguous.');
  const matches = headings.filter(h => h.title === title);
  if (matches.length > 1) throw new Error('Duplicate sections; resolve explicitly before reading/updating.');
  if (!matches.length) return null;
  const selected = matches[0], start = selected.offset;
  const end = headings.find(h => h.offset > start && h.level <= selected.level)?.offset ?? body.length;
  return { start, end, heading: selected.line, text: body.slice(start, end) };
}

export const workSection = body => markdownSection(body, 'Aktueller Arbeitsstand');

export function replaceWork(body, content) {
  if (typeof content !== 'string' || !content.trim() || content.length > 16000
    || /^ {0,3}#{1,6}(?:\s|$)/m.test(content) || /^ {0,3}(?:=+|-+)[ \t]*$/m.test(content) || /^ {0,3}(?:`{3,}|~{3,})/m.test(content) || content.includes('\0'))
    throw new Error('Provide a nonempty current-work paragraph, without headings or code fences (max 16000 characters).');
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

// Explicit same-repository default-branch Markdown source, pinned before loading.
// No body mutation and no fallback to historical prose when a declared source fails.
export function taskContext(call, repository, number, body) {
  const links = body.split('\n').filter(line => /^Arbeitsstand:/.test(line));
  if (!links.length) return { source: null, ...liveFacts(call, repository, body) };
  try {
    if (links.length !== 1) throw new Error('Expected exactly one Arbeitsstand link.');
    const url = links[0].slice('Arbeitsstand:'.length).trim();
    const metadata = JSON.parse(call(['api', `repos/${repository}`]));
    const prefix = `https://github.com/${repository}/blob/${metadata.default_branch}/`;
    if (!url.startsWith(prefix)) throw new Error('Arbeitsstand must refer to this repository default branch.');
    const suffix = url.slice(prefix.length), fragment = `#arbeitsstand-${number}`;
    if (!suffix.endsWith(fragment)) throw new Error('Arbeitsstand anchor must match the task number.');
    const path = suffix.slice(0, -fragment.length);
    if (!/^[A-Za-z0-9_./-]+\.md$/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..'))
      throw new Error('Expected an existing Markdown file path.');
    const commit = JSON.parse(call(['api', `repos/${repository}/commits/${encodeURIComponent(metadata.default_branch)}`]));
    if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('Missing source revision.');
    const file = JSON.parse(call(['api', `repos/${repository}/contents/${path}?ref=${commit.sha}`]));
    if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string')
      throw new Error('Source is not an available regular Markdown file.');
    const text = Buffer.from(file.content, 'base64').toString('utf8');
    const section = markdownSection(text, `Arbeitsstand #${number}`);
    if (!section) throw new Error('Declared current-work section is missing.');
    if (section.text.length > 6000) throw new Error('Current-work section exceeds 6000 characters; compact it at its existing source.');
    if (workSection(body)) throw new Error('Both issue and versioned current-work sections exist; remove the duplicate.');
    const current = '## Aktueller Arbeitsstand\n' + section.text.slice(section.heading.length);
    return { source: { url, path, revision: commit.sha, text: section.text }, ...liveFacts(call, repository, current) };
  } catch (error) {
    return { source: null, facts: [], warnings: [`Versioned work context unavailable: ${error.message.split('\n')[0]}. No historical fallback.`] };
  }
}
