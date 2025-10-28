// Migration: migrate-factions-v1
// Normalises faction documents to schema version 1 (array tags, members structure, version field).

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = path.resolve(__dirname, '../..', '..');
const VAULT_ROOT = path.resolve(PLUGIN_ROOT, 'SaltMarcher');

const TARGETS = [
  { label: 'Samples', dir: path.join(PLUGIN_ROOT, 'samples', 'fraktionen'), optional: false },
  { label: 'Vault', dir: path.join(VAULT_ROOT, 'Fraktionen'), optional: true }
];

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export default async function migrate(flags = {}) {
  const stats = { processed: 0, updated: 0, skipped: 0 };
  let success = true;
  const problems = [];

  for (const target of TARGETS) {
    const exists = await pathExists(target.dir);
    if (!exists) {
      if (!target.optional) {
        console.log(`⚠ ${target.label}: Pfad nicht gefunden (${target.dir})`);
      }
      continue;
    }

    const files = await collectMarkdownFiles(target.dir);
    for (const file of files) {
      stats.processed += 1;
      try {
        const original = await fs.readFile(file, 'utf8');
        const match = original.match(FRONTMATTER_REGEX);
        if (!match) {
          problems.push(`${relative(file)}: Kein Frontmatter block`);
          stats.skipped += 1;
          continue;
        }

        const [, frontmatterRaw, body = ''] = match;
        const data = yaml.load(frontmatterRaw) ?? {};
        const updated = transformFaction(data);

        if (!updated.changed) {
          stats.skipped += 1;
          continue;
        }

        stats.updated += 1;
        if (!flags.dryRun) {
          const newFrontmatter = yaml.dump(updated.data, { lineWidth: -1, noRefs: true });
          const next = `---\n${newFrontmatter}---\n${body}`;
          await fs.writeFile(file, next, 'utf8');
        }
      } catch (err) {
        problems.push(`${relative(file)}: ${err.message}`);
        success = false;
      }
    }
  }

  if (problems.length) {
    console.log('Probleme:');
    problems.forEach((line) => console.log(`  - ${line}`));
  }

  return { success, stats };
}

function transformFaction(data) {
  const next = { ...data };
  let changed = false;

  if (!Array.isArray(next.tags)) {
    if (typeof next.tags === 'string' && next.tags.trim()) {
      next.tags = [next.tags.trim()];
      changed = true;
    } else if (next.tags == null) {
      // leave undefined (schema allows optional), no change
    } else {
      next.tags = [];
      changed = true;
    }
  }

  if (Array.isArray(next.members)) {
    const normalised = next.members.map((entry) => {
      if (entry && typeof entry === 'object') {
        let dirty = false;
        const copy = { ...entry };
        if (copy.count != null) {
          const parsed = Number(copy.count);
          if (!Number.isFinite(parsed) || parsed < 0) {
            copy.count = 0;
            dirty = true;
          } else if (typeof copy.count !== 'number') {
            copy.count = parsed;
            dirty = true;
          }
        }
        if (dirty) {
          changed = true;
          return copy;
        }
        return entry;
      }
      changed = true;
      return { id: 'unknown', name: String(entry ?? 'Unknown'), count: 0 };
    });
    if (normalised.some((entry, idx) => entry !== next.members[idx])) {
      next.members = normalised;
      changed = true;
    }
  }

  if (next.version == null) {
    next.version = 1;
    changed = true;
  }

  return { data: next, changed };
}

async function collectMarkdownFiles(root) {
  const dirents = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of dirents) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function relative(file) {
  return path.relative(PLUGIN_ROOT, file);
}
