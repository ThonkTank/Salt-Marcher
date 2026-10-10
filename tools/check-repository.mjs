import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const states = ['draft', 'active', 'complete', 'superseded'];
const workLabels = ['status:ready', 'status:active', 'status:blocked'];
const isMarkdown = file => /\.(md|markdown)$/i.test(file);

// Validate Markdown links, not text examples inside fenced code or HTML comments.
export function markdownLinks(text) {
  let fence = null;
  const visible = text.replace(/<!--[\s\S]*?-->/g, '').split('\n').map(line => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker && !fence) { fence = marker[1]; return ''; }
    if (fence && marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) {
      fence = null; return '';
    }
    return fence ? '' : line.replace(/(`+)[\s\S]*?\1/g, '');
  }).join('\n');
  const inline = [...visible.matchAll(/!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+[^)\n]*)?\)/g)].map(m => m[1]);
  const references = [...visible.matchAll(/^\s{0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/gm)].map(m => m[1]);
  return [...inline, ...references].map(s => s.replace(/^<|>$/g, ''));
}

function anchors(text) {
  const counts = new Map(), result = new Set();
  let fence = null;
  for (const line of text.split('\n')) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker && !fence) { fence = marker[1]; continue; }
    if (fence && marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) { fence = null; continue; }
    if (fence) continue;
    const heading = line.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const slug = heading[1].replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
      const n = counts.get(slug) ?? 0; counts.set(slug, n + 1);
      result.add(n ? `${slug}-${n}` : slug);
    }
  }
  for (const m of text.matchAll(/<a\s+(?:id|name)=["']([^"']+)["']/g)) result.add(m[1]);
  return result;
}

export function validateIssueStates(issues) {
  return issues.flatMap(issue => {
    const labels = issue.labels.map(l => typeof l === 'string' ? l : l.name);
    const errors = [];
    if (labels.includes('status:ready') && labels.some(l => ['status:active', 'status:blocked'].includes(l)))
      errors.push(`#${issue.number}: status:ready conflicts with active/blocked work`);
    if (issue.state === 'closed' && labels.some(l => workLabels.includes(l)))
      errors.push(`#${issue.number}: closed issue retains an open work-status label`);
    return errors;
  });
}

export function checkRepository(root, suppliedFiles) {
  const errors = [];
  const files = new Set(suppliedFiles ?? execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean));
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const exists = file => typeof file === 'string' && (files.has(file) || [...files].some(f => f.startsWith(`${file.replace(/\/$/, '')}/`))) && fs.existsSync(path.join(root, file));
  function json(file) {
    try { if (!exists(file)) throw new Error('missing file'); return JSON.parse(read(file)); }
    catch (e) { errors.push(`${file}: ${e.message}`); return null; }
  }
  const policy = json('docs/repository-policy.json');
  const checkpoint = json('checkpoint.json');
  json('acceptance.json');
  const scope = json('docs/scope-sources.json');
  if (!policy || !checkpoint || !scope) return errors;
  if (policy.schemaVersion !== 1 || !Array.isArray(policy.coreRootDocs) || !Array.isArray(policy.legacyRootDocs) || !Array.isArray(policy.inFlightRootDocs))
    return [...errors, 'docs/repository-policy.json: invalid compatibility inventory'];
  const allowed = new Set([...policy.coreRootDocs, ...policy.legacyRootDocs, ...policy.inFlightRootDocs.map(p => p.path)]);
  for (const file of files) {
    if (!file.includes('/') && isMarkdown(file) && !allowed.has(file))
      errors.push(`${file}: new root document; use docs/plans/<area>/ or docs/ and link it in docs/INDEX.md`);
  }
  for (const entry of policy.inFlightRootDocs) {
    if (!entry.reason || !new RegExp(`/blob/[a-f0-9]{40}/${entry.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`).test(entry.source))
      errors.push(`${entry.path}: in-flight compatibility entry needs reason and pinned source`);
  }
  const managed = [...files].filter(f => f.startsWith('docs/') && isMarkdown(f) || ['README.md', 'AGENTS.md', 'CONTRIBUTING.md'].includes(f));
  const graph = new Map();
  for (const file of managed) {
    if (!exists(file)) { errors.push(`${file}: missing documentation file`); continue; }
    const linked = new Set();
    for (const link of markdownLinks(read(file))) {
      if (/^[a-z][a-z\d+.-]*:/i.test(link) || link.startsWith('//')) continue;
      let decoded;
      try { decoded = decodeURIComponent(link); } catch { errors.push(`${file}: malformed link ${link}`); continue; }
      const [name, anchor] = decoded.split('#');
      const target = name ? path.posix.normalize(path.posix.join(path.posix.dirname(file), name)) : file;
      if (!exists(target)) { errors.push(`${file}: missing local link target ${link}`); continue; }
      linked.add(target);
      if (fs.statSync(path.join(root, target)).isDirectory()) {
        const readme = path.posix.join(target, 'README.md');
        if (exists(readme)) linked.add(readme);
      }
      if (anchor && isMarkdown(target) && !anchors(read(target)).has(anchor))
        errors.push(`${file}: missing Markdown anchor ${link}`);
    }
    graph.set(file, linked);
  }
  const reachable = new Set(), pending = ['docs/INDEX.md'];
  while (pending.length) {
    const file = pending.pop(); if (reachable.has(file)) continue;
    reachable.add(file); pending.push(...(graph.get(file) ?? []));
  }
  for (const file of managed.filter(f => f.startsWith('docs/')))
    if (!reachable.has(file)) errors.push(`${file}: not reachable from docs/INDEX.md`);
  const reachableSources = new Set([...reachable].filter(f => graph.has(f)).flatMap(f => markdownLinks(read(f))));
  for (const file of files) {
    if (file.includes('/') || !isMarkdown(file) || policy.coreRootDocs.includes(file)) continue;
    const flight = policy.inFlightRootDocs.find(p => p.path === file);
    if (!reachable.has(file) && !(flight && reachableSources.has(flight.source)))
      errors.push(`${file}: root Fachplan missing from docs/INDEX.md navigation`);
  }
  for (const file of managed.filter(f => f.startsWith('docs/plans/'))) {
    if (!/^docs\/plans\/[^/]+\/[^/]+\.md$/.test(file)) errors.push(`${file}: use docs/plans/<area>/<package>.md`);
    const header = read(file).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!header) { errors.push(`${file}: missing package-plan metadata`); continue; }
    const fields = Object.fromEntries(header[1].split(/\r?\n/).map(line => line.match(/^([a-z_]+):\s*(.*?)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]));
    for (const key of ['area', 'owner', 'issue', 'status', 'checkpoint']) if (!fields[key]) errors.push(`${file}: missing ${key}`);
    if (fields.area !== file.split('/')[2]) errors.push(`${file}: area differs from plan directory`);
    if (!/^[1-9]\d*$/.test(fields.issue ?? '')) errors.push(`${file}: issue must be a concrete issue number`);
    if (!states.includes(fields.status)) errors.push(`${file}: invalid document status`);
    if (!Object.hasOwn(checkpoint, fields.checkpoint ?? '')) errors.push(`${file}: unknown checkpoint owner root`);
    if (fields.status === 'superseded' && (!exists(fields.superseded_by) || !isMarkdown(fields.superseded_by) || fields.superseded_by === file))
      errors.push(`${file}: superseded plan needs an existing successor`);
  }
  // The register is a pinned audit, so historic hashes must not be compared to today's product bytes.
  if (scope.schema_version !== 1 || !/^[a-f0-9]{40}$/.test(scope.source_revision)) errors.push('docs/scope-sources.json: invalid pinned source revision/schema');
  let invalidCollections = false;
  for (const key of ['source_requirements', 'additional_primary_sources', 'local_reference_files', 'technical_needs', 'capability_subsections', 'capability_acceptance_references', 'target_smr_phases', 'target_smr_acceptance_cases']) {
    const rows = scope[key];
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) { errors.push(`docs/scope-sources.json: invalid collection ${key}`); invalidCollections = true; continue; }
    const ids = rows.map(r => r.id ?? r.path);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) errors.push(`docs/scope-sources.json: missing/duplicate identity in ${key}`);
  }
  if (invalidCollections) return errors;
  for (const row of [...(scope.source_requirements ?? []), ...(scope.additional_primary_sources ?? []), ...(scope.local_reference_files ?? [])])
    if (!/^[a-f0-9]{64}$/.test(row.sha256 ?? '')) errors.push(`docs/scope-sources.json: invalid SHA-256 for ${row.path}`);
  for (const row of scope.local_reference_files ?? []) if (!exists(row.path)) errors.push(`docs/scope-sources.json: missing local reference ${row.path}`);
  const needs = new Set((scope.technical_needs ?? []).map(r => r.id));
  const sources = new Set((scope.capability_subsections ?? []).map(r => r.id));
  const phases = new Set((scope.target_smr_phases ?? []).map(r => r.id));
  for (const row of [...(scope.capability_subsections ?? []), ...(scope.capability_acceptance_references ?? [])])
    for (const id of row.technical_needs ?? []) if (!needs.has(id)) errors.push(`docs/scope-sources.json: ${row.id} references unknown need ${id}`);
  for (const row of scope.technical_needs ?? [])
    for (const id of row.source_ids ?? []) if (!sources.has(id) && !['EXT-DND2014', 'EXT-NNG', 'EXT-WCAG'].includes(id)) errors.push(`docs/scope-sources.json: ${row.id} references unknown source ${id}`);
  for (const row of scope.source_requirements ?? []) {
    if (!row.url?.includes(`/blob/${scope.source_revision}/${row.path}`)) errors.push(`docs/scope-sources.json: unpinned requirement ${row.path}`);
    for (const id of row.target_phases ?? []) if (!phases.has(id)) errors.push(`docs/scope-sources.json: unknown target phase ${id}`);
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2);
    if (args.some(a => a !== '--github')) throw new Error('Usage: node tools/check-repository.mjs [--github]');
    const errors = checkRepository(process.cwd());
    if (args.includes('--github')) {
      const policy = JSON.parse(fs.readFileSync('docs/repository-policy.json', 'utf8'));
      const output = execFileSync('gh', ['api', '--paginate', `repos/${policy.repository}/issues?state=all&per_page=100`, '--jq', '.[] | select(.pull_request == null) | {number,state,labels:[.labels[].name]}'], { encoding: 'utf8' });
      errors.push(...validateIssueStates(output.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))));
    }
    for (const error of errors) console.error(error);
    if (errors.length) { console.error(`Repository check FAILED: ${errors.length} problem(s)`); process.exitCode = 1; }
    else console.log(`Repository check PASS${args.includes('--github') ? ' (including read-only GitHub label audit)' : ' (offline structure and references)'}`);
  } catch (error) { console.error(`Repository check FAILED: ${error.message}`); process.exitCode = 1; }
}
