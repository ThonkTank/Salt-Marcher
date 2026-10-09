// Reuse the protocol only; Canvas of Kings identity is independently checked.
import fs from 'node:fs';
import path from 'node:path';
import { assertProcesses, sha256 } from './identity.mjs';
const i = process.argv.indexOf('--session');
if (i < 0 || !process.argv[i + 1]) throw new Error('Absolute --session required');
const file = process.argv[i + 1];
if (!path.isAbsolute(file)) throw new Error('Absolute --session required');
const session = JSON.parse(fs.readFileSync(file, 'utf8'));
if (path.resolve(file) !== path.join(session.run, 'session.json')) throw new Error('Session path does not match run');
assertProcesses(session);
for (const original of session.original.files) {
  if (await sha256(original.path) !== original.sha256) throw new Error('Original binary/library changed');
}
assertProcesses(session);
await import('../wonderdraft/rfb.mjs');
