import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const domains = ['workspace', 'atlas', 'campaign', 'runtime', 'catalog', 'shared'];
const adrTests = [
  'p02-contract',
  'p02-concurrency',
  'p02-process',
  'p03-contract',
  'p03-channel',
  'p03-renderer',
  'p03-pixel-oracle',
  'p03-evidence',
];

// Only active test directories are discovered. Native reference tests are opt-in.
export function activeTests(root = process.cwd()) {
  const walk = (directory) =>
    readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(`${directory}/${entry.name}`)
        : entry.name.endsWith('.test.mjs')
          ? [`${directory}/${entry.name}`]
          : [],
    );
  const entries = readdirSync(path.join(root, 'tests'), { withFileTypes: true });
  return [
    '.build/tests.cjs',
    ...entries
      .flatMap((entry) =>
        entry.isFile() && entry.name.endsWith('.test.mjs')
          ? [`tests/${entry.name}`]
          : entry.isDirectory() && domains.includes(entry.name)
            ? walk(`tests/${entry.name}`)
            : [],
      )
      .sort(),
    ...adrTests.map((name) => `tests/adr-prototypes/${name}.test.mjs`),
  ];
}

export function selectTests(args, root = process.cwd()) {
  let serial = false,
    list = false,
    concurrency;
  const selected = [];
  for (const arg of args) {
    if (arg.startsWith('--concurrency=')) {
      const value = arg.slice('--concurrency='.length);
      if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value)))
        throw Error('Invalid concurrency: ' + value);
      concurrency = Number(value);
      continue;
    }
    if (arg === '--serial') {
      serial = true;
      continue;
    }
    if (arg === '--list') {
      list = true;
      continue;
    }
    if (!arg || arg.startsWith('-'))
      throw new Error(
        `Invalid test argument: ${JSON.stringify(arg)}. Use --serial, --concurrency=N, --list or explicit test file paths.`,
      );
    const relative = path.relative(root, path.resolve(root, arg)).split(path.sep).join('/');
    if (relative === '.build/tests.cjs' || relative === 'tests/shared/core.test.ts') {
      selected.push('.build/tests.cjs');
      continue;
    }
    if (!relative.startsWith('tests/') || !relative.endsWith('.test.mjs'))
      throw new Error(`Expected a tests/*.test.mjs file: ${arg}`);
    let isFile = false;
    try {
      isFile = statSync(path.join(root, relative)).isFile();
    } catch {}
    if (!isFile) throw new Error(`Test file does not exist: ${arg}`);
    selected.push(relative);
  }
  const files = [...new Set(selected.length ? selected : activeTests(root))];
  if (!files.length) throw new Error('No tests selected.');
  if (serial && concurrency !== undefined && concurrency !== 1)
    throw Error('--serial conflicts with --concurrency.');
  return { serial, list, files, ...(concurrency === undefined ? {} : { concurrency }) };
}
