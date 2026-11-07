import { checkNativeProbes } from './native-probes.mjs';
import { checkSourceModuleBoundaries } from './check-module-boundaries.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryFiles } from './repository-files.mjs';

const isMarkdown = (file) => /\.(md|markdown)$/i.test(file);

// Validate Markdown links, not text examples inside fenced code or HTML comments.
export function markdownLinks(text) {
  let fence = null;
  const visible = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((line) => {
      const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (marker && !fence) {
        fence = marker[1];
        return '';
      }
      if (fence && marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) {
        fence = null;
        return '';
      }
      return fence ? '' : line.replace(/(`+)[\s\S]*?\1/g, '');
    })
    .join('\n');
  const inline = [
    ...visible.matchAll(/!?\[[^\]]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+[^)\n]*)?\)/g),
  ].map((m) => m[1]);
  const references = [...visible.matchAll(/^\s{0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/gm)].map(
    (m) => m[1],
  );
  return [...inline, ...references].map((s) => s.replace(/^<|>$/g, ''));
}

function anchors(text) {
  const counts = new Map(),
    result = new Set();
  let fence = null;
  for (const line of text.split('\n')) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker && !fence) {
      fence = marker[1];
      continue;
    }
    if (fence && marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) {
      fence = null;
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const slug = heading[1]
        .replace(/<[^>]*>/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '')
        .replace(/\s/g, '-');
      const n = counts.get(slug) ?? 0;
      counts.set(slug, n + 1);
      result.add(n ? `${slug}-${n}` : slug);
    }
  }
  for (const m of text.matchAll(/<a\s+(?:id|name)=["']([^"']+)["']/g)) result.add(m[1]);
  return result;
}

export function checkRepository(root, suppliedFiles) {
  const errors = [];
  const files = new Set(suppliedFiles ?? repositoryFiles(root));
  errors.push(...checkSourceModuleBoundaries(root, [...files]));
  errors.push(...checkNativeProbes(root, [...files]));
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const exists = (file) =>
    typeof file === 'string' &&
    (files.has(file) || [...files].some((f) => f.startsWith(`${file.replace(/\/$/, '')}/`))) &&
    fs.existsSync(path.join(root, file));
  function json(file) {
    try {
      if (!exists(file)) throw new Error('missing file');
      return JSON.parse(read(file));
    } catch (e) {
      errors.push(`${file}: ${e.message}`);
      return null;
    }
  }
  json('acceptance.json');
  // ADR matrices may refer to a live local plan or an immutable historical plan.
  for (const file of files) {
    if (!/^ROADMAP-.*-MATRIX\.json$/.test(file)) continue;
    const matrix = json(file);
    if (!matrix) continue;
    const target = matrix.normativeFor;
    if (typeof target !== 'string' || !target) {
      errors.push(`${file}: missing normativeFor reference`);
    } else if (
      /^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[a-f0-9]{40}\/[^?#]+\.md(?:#[^\s]+)?$/.test(
        target,
      )
    ) {
      // Offline validation checks the immutable binding, not remote availability.
    } else if (
      /^[a-z][a-z\d+.-]*:/i.test(target) ||
      path.posix.isAbsolute(target) ||
      !isMarkdown(target) ||
      !files.has(target) ||
      !exists(target)
    ) {
      errors.push(`${file}: invalid or missing normativeFor target ${target}`);
    }
  }
  const scope = json('docs/project/requirements/sources.json');
  if (!scope) return errors;
  const managed = [...files].filter(isMarkdown);
  for (const file of managed) {
    if (!exists(file)) {
      errors.push(`${file}: missing documentation file`);
      continue;
    }
    for (const link of markdownLinks(read(file))) {
      if (/^[a-z][a-z\d+.-]*:/i.test(link) || link.startsWith('/')) continue;
      let decoded;
      try {
        decoded = decodeURIComponent(link);
      } catch {
        errors.push(`${file}: malformed link ${link}`);
        continue;
      }
      const [name, anchor] = decoded.split('#');
      const target = name
        ? path.posix.normalize(path.posix.join(path.posix.dirname(file), name))
        : file;
      if (!exists(target)) {
        errors.push(`${file}: missing local link target ${link}`);
        continue;
      }
      if (anchor && isMarkdown(target) && !anchors(read(target)).has(anchor))
        errors.push(`${file}: missing Markdown anchor ${link}`);
    }
  }
  // The register is a pinned audit, so historic hashes must not be compared to today's product bytes.
  if (scope.schema_version !== 1 || !/^[a-f0-9]{40}$/.test(scope.source_revision))
    errors.push('docs/project/requirements/sources.json: invalid pinned source revision/schema');
  let invalidCollections = false;
  for (const key of [
    'source_requirements',
    'additional_primary_sources',
    'local_reference_files',
    'technical_needs',
    'capability_subsections',
    'capability_acceptance_references',
    'target_smr_phases',
    'target_smr_acceptance_cases',
  ]) {
    const rows = scope[key];
    if (
      !Array.isArray(rows) ||
      rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
    ) {
      errors.push(`docs/project/requirements/sources.json: invalid collection ${key}`);
      invalidCollections = true;
      continue;
    }
    const ids = rows.map((r) => r.id ?? r.path);
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
      errors.push(`docs/project/requirements/sources.json: missing/duplicate identity in ${key}`);
  }
  if (invalidCollections) return errors;
  for (const row of [
    ...(scope.source_requirements ?? []),
    ...(scope.additional_primary_sources ?? []),
    ...(scope.local_reference_files ?? []),
  ])
    if (!/^[a-f0-9]{64}$/.test(row.sha256 ?? ''))
      errors.push(`docs/project/requirements/sources.json: invalid SHA-256 for ${row.path}`);
  for (const row of scope.local_reference_files ?? [])
    if (!exists(row.currentPath ?? row.path))
      errors.push(`docs/project/requirements/sources.json: missing local reference ${row.path}`);
  const needs = new Set((scope.technical_needs ?? []).map((r) => r.id));
  const sources = new Set((scope.capability_subsections ?? []).map((r) => r.id));
  const phases = new Set((scope.target_smr_phases ?? []).map((r) => r.id));
  for (const row of [
    ...(scope.capability_subsections ?? []),
    ...(scope.capability_acceptance_references ?? []),
  ])
    for (const id of row.technical_needs ?? [])
      if (!needs.has(id))
        errors.push(
          `docs/project/requirements/sources.json: ${row.id} references unknown need ${id}`,
        );
  for (const row of scope.technical_needs ?? [])
    for (const id of row.source_ids ?? [])
      if (!sources.has(id) && !['EXT-DND2014', 'EXT-NNG', 'EXT-WCAG'].includes(id))
        errors.push(
          `docs/project/requirements/sources.json: ${row.id} references unknown source ${id}`,
        );
  for (const row of scope.source_requirements ?? []) {
    if (!row.url?.includes(`/blob/${scope.source_revision}/${row.path}`))
      errors.push(`docs/project/requirements/sources.json: unpinned requirement ${row.path}`);
    for (const id of row.target_phases ?? [])
      if (!phases.has(id))
        errors.push(`docs/project/requirements/sources.json: unknown target phase ${id}`);
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2);
    if (args.length) throw new Error('Usage: node tools/check-repository.mjs');
    const errors = checkRepository(process.cwd());
    for (const error of errors) console.error(error);
    if (errors.length) {
      console.error(`Repository check FAILED: ${errors.length} problem(s)`);
      process.exitCode = 1;
    } else console.log('Repository check PASS (offline links, JSON, source references)');
  } catch (error) {
    console.error(`Repository check FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
