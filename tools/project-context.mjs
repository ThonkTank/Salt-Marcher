import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Navigation only. Do not put live task state or readiness in this map.
export const areas = {
  atlas: { issue: 7, checkpoint: ['hexAtlasExecution'], acceptance: ['hexAtlas', 'wonderdraftParity'], plan: 'ROADMAP-HEX-ATLAS.md' },
  city: { issue: 7, checkpoint: ['cityExecution'], acceptance: ['cityPlans'], plan: 'ROADMAP-CITIES-IMPLEMENTATION-PLAN.md' },
  dungeon: { issue: 8, checkpoint: ['parityRoadmap'], acceptance: ['strictParity', 'requirements'], plan: 'ROADMAP-PARITY-TOOLS.md' },
  gm: { issue: 8, checkpoint: ['gmProductTesting'], acceptance: ['gmProductFollowups'], plan: 'ROADMAP-GM-PRODUCT-TESTING-PLAN.md' },
  catalog: { issue: 9, checkpoint: ['saltMarcherCatalogEncounter'], acceptance: ['saltMarcherCatalogEncounter'], plan: 'ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md' },
  campaign: { issue: 10, checkpoint: [], acceptance: ['saltMarcherReplacement'], plan: 'ROADMAP-SALTMARCHER-REPLACEMENT.md' },
  runtime: { issue: 6, checkpoint: [], acceptance: ['saltMarcherReplacement'], plan: 'ROADMAP-SALTMARCHER-REPLACEMENT.md' },
  platform: { issue: 11, checkpoint: ['saltMarcherReplacement'], acceptance: ['saltMarcherReplacement'], plan: 'ROADMAP-SALTMARCHER-PLATFORM-ADR.md' },
  repository: { issue: 1, checkpoint: ['repositoryOrientation'], acceptance: [], plan: 'docs/REPOSITORY.md' },
};

export function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--full') { result.full = true; continue; }
    if (!['--area', '--case', '--checkpoint'].includes(flag) || !args[i + 1] || args[i + 1].startsWith('--'))
      throw new Error('Usage: npm run context -- [--area NAME | --case EXACT_ID | --checkpoint ROOT] [--full]');
    const key = flag.slice(2);
    if (result[key]) throw new Error(`Repeated selector ${flag}`);
    result[key] = args[++i];
  }
  if (['area', 'case', 'checkpoint'].filter(k => result[k]).length > 1 || result.full && !result.area && !result.case && !result.checkpoint)
    throw new Error('Choose exactly one selector; --full requires a selector.');
  return result;
}

// Explicit omissions keep bounded output from looking like a complete entry.
export function summarize(value, depth = 0) {
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}… [truncated; --full]` : value;
  if (!value || typeof value !== 'object') return value;
  if (depth >= 2) return { _summary: Array.isArray(value) ? `${value.length} entries` : `${Object.keys(value).length} fields`, _detail: '--full' };
  if (Array.isArray(value)) return { entries: value.slice(0, 3).map(v => summarize(v, depth + 1)), omittedEntries: Math.max(0, value.length - 3) };
  const priority = ['id', 'state', 'status', 'date', 'updated', 'updatedAt', 'plan', 'roadmap', 'currentRun', 'nextRun', 'next', 'open'];
  const entries = Object.entries(value).sort(([a], [b]) => {
    const order = key => priority.includes(key) ? priority.indexOf(key) : priority.length;
    return order(a) - order(b);
  });
  return { ...Object.fromEntries(entries.slice(0, 12).map(([k, v]) => [k, summarize(v, depth + 1)])),
    ...(entries.length > 12 ? { _omittedKeys: entries.slice(12, 42).map(([k]) => k), _omittedKeyCount: entries.length - 12 } : {}) };
}

export function findCases(value, id, pointer = '', found = new Map()) {
  if (!value || typeof value !== 'object') return [...found.values()];
  if (!Array.isArray(value) && value.id === id) found.set(pointer, { pointer, entry: value });
  for (const [key, child] of Object.entries(value)) {
    const next = `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    if (!Array.isArray(value) && key === id) found.set(next, { pointer: next, entry: child });
    findCases(child, id, next, found);
  }
  return [...found.values()];
}

function areaSummary(entry, execution) {
  if (Array.isArray(entry)) return { _summary: `${entry.length} entries`, _detail: '--case EXACT_ID' };
  if (!entry || typeof entry !== 'object') return summarize(entry);
  const keys = execution ? ['state', 'status', 'date', 'updated', 'updatedAt', 'plan', 'roadmap', 'currentRun', 'nextRun', 'next']
    : ['state', 'status', 'updated', 'plan'];
  const fields = Object.fromEntries(keys.filter(k => Object.hasOwn(entry, k)).map(k => [k, entry[k]]));
  return { ...summarize(fields), _omittedFieldCount: Object.keys(entry).length - Object.keys(fields).length,
    _detail: execution ? '--checkpoint ROOT [--full]' : '--case EXACT_ID, or --area NAME --full' };
}

export function buildContext(root, args) {
  const select = parseArgs(args);
  const git = (...params) => {
    try { return execFileSync('git', params, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { return 'unavailable'; }
  };
  const base = {
    source: { branch: git('branch', '--show-current') || 'detached', commit: git('rev-parse', 'HEAD'),
      workingTreeModified: (() => { const status = git('status', '--porcelain'); return status === 'unavailable' ? 'unknown' : !!status; })() },
    scope: 'Offline checkout snapshot. Not live task status, candidate state or product approval.',
    currentDecisions: 'https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12',
  };
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const view = entry => select.full ? entry : summarize(entry);
  if (select.case) {
    const found = findCases(read('acceptance.json'), select.case);
    if (!found.length) throw new Error(`No exact acceptance identity: ${select.case}`);
    return { ...base, file: 'acceptance.json', matchCount: found.length, matches: found.map(({ pointer, entry }) => ({ pointer, entry: view(entry) })) };
  }
  if (select.checkpoint) {
    const data = read('checkpoint.json');
    if (!Object.hasOwn(data, select.checkpoint)) throw new Error(`Unknown checkpoint root: ${select.checkpoint}`);
    return { ...base, file: 'checkpoint.json', root: select.checkpoint, entry: view(data[select.checkpoint]) };
  }
  if (!select.area) return { ...base, areas, usage: 'npm run context -- --area atlas | --case HEX01-001 | --checkpoint ROOT; add --full for the selected entry only' };
  const route = areas[select.area];
  if (!route) throw new Error(`Unknown area: ${select.area}; choose ${Object.keys(areas).join(', ')}`);
  const checkpoint = read('checkpoint.json'), acceptance = read('acceptance.json');
  const selectRoots = (data, roots, execution) => Object.fromEntries(roots.map(key => {
    if (!Object.hasOwn(data, key)) throw new Error(`Mapped root missing: ${key}; update the navigation map`);
    return [key, select.full ? data[key] : areaSummary(data[key], execution)];
  }));
  return { ...base, area: select.area, plan: route.plan,
    coordination: `https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/${route.issue}`,
    checkpoint: selectRoots(checkpoint, route.checkpoint, true), acceptance: selectRoots(acceptance, route.acceptance, false),
    ...(!route.checkpoint.length ? { note: 'No dedicated execution root mapped on this checkout. Read the current owner issue/PR; acceptance below is the overall portfolio contract.' } : {}),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { console.log(JSON.stringify(buildContext(process.cwd(), process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
