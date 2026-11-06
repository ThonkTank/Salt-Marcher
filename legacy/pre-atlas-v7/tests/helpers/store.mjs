import { constants, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after } from 'node:test';

const seeds = new Map();
after(() => {
  for (const source of seeds.values())
    rmSync(path.dirname(source), { recursive: true, force: true });
});

// UI fixtures need an initialized empty database, not a repeat of every schema
// migration. Keep real SQLite files and production durability settings. Store
// initialization/migration tests continue to construct their own fresh files.
export function fixtureStore(Store, filename) {
  if (!seeds.has(Store)) {
    const root = mkdtempSync(path.join(tmpdir(), 'salt-test-schema-'));
    const source = path.join(root, 'empty.sqlite');
    try {
      const store = new Store(source);
      store.close(); // checkpoint/close before copying; never copy a live WAL
      seeds.set(Store, source);
    } catch (error) {
      rmSync(root, { recursive: true, force: true });
      throw error;
    }
  }
  // COPYFILE_EXCL protects an existing database, including a test's reopen.
  copyFileSync(seeds.get(Store), filename, constants.COPYFILE_EXCL);
  return new Store(filename);
}
