import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd(),
  require = createRequire(path.join(root, 'package.json')),
  { buildSync } = require('esbuild');
mkdirSync(path.join(root, '.build'), { recursive: true });
const helperRoot = mkdtempSync(path.join(root, '.build', 'atlas-projection-probe-'));
let AtlasTileCache, fileKey, fileSource;
try {
  const outfile = path.join(helperRoot, 'cache.cjs');
  buildSync({
    stdin: {
      contents:
        "export * from './src/app/storage/atlas-tile-cache';export {PROJECTION_CACHE_KEY,PROJECTION_CACHE_SOURCE} from './src/app/storage/atlas-projection-index';",
      resolveDir: root,
    },
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const api = createRequire(outfile)(outfile);
  AtlasTileCache = api.AtlasTileCache;
  fileKey = api.PROJECTION_CACHE_KEY;
  fileSource = api.PROJECTION_CACHE_SOURCE;
} finally {
  rmSync(helperRoot, { recursive: true, force: true });
}
const Database = require('better-sqlite3');

function snapshotFor(directory, namespace) {
  const scratch = mkdtempSync(path.join(tmpdir(), 'atlas-projection-probe-')),
    filename = path.join(scratch, 'snapshot.sqlite'),
    cache = AtlasTileCache.open(directory, namespace);
  try {
    if (!cache.getFile(fileKey, fileSource, filename)) return undefined;
    const bytes = readFileSync(filename),
      digest = createHash('sha256').update(bytes).digest('hex'),
      index = new Database(filename, { readonly: true });
    try {
      const sources = Object.fromEntries(
        index
          .prepare('SELECT part,source FROM projection_meta ORDER BY part')
          .all()
          .map((row) => [row.part, row.source]),
      );
      if (!sources.geometry || !sources.landscape) return undefined;
      return { namespace, digest, bytes: bytes.length, sources };
    } finally {
      index.close();
    }
  } catch {
    return undefined;
  } finally {
    cache.close();
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Wait until a complete projection file is published in the shared tile cache. */
export async function waitForAtlasProjection(directory) {
  const deadline = Date.now() + 10000,
    cacheFile = path.join(directory, 'tiles-v2', 'atlas-tiles.sqlite');
  while (Date.now() < deadline) {
    let db;
    try {
      db = new Database(cacheFile, { readonly: true });
      const namespaces = db
        .prepare(
          "SELECT namespace FROM atlas_tile_cache WHERE key=? AND source=? AND kind='file' ORDER BY namespace",
        )
        .all(fileKey, fileSource)
        .map((row) => row.namespace);
      db.close();
      db = undefined;
      for (const namespace of namespaces) {
        const snapshot = snapshotFor(directory, namespace);
        if (snapshot) return snapshot;
      }
    } catch {
      /* Cache creation or publication may still be in progress. */
    } finally {
      db?.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail('Both index sections must be published in the shared cache before the reopen check');
}
