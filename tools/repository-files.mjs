import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Existing tracked and non-ignored untracked files, as used by check:repo. */
export function repositoryFiles(root) {
  return [
    ...new Set(
      execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
      })
        .split('\0')
        .filter((file) => file && fs.existsSync(path.join(root, file))),
    ),
  ].sort();
}
