import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const qaRoot = '/home/aaron/.cache/dungeon-native-qa';
export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export function startTicks(pid) {
  return fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[19];
}
export function assertRun(run, existing = false) {
  if (!path.isAbsolute(run) || path.resolve(run) === qaRoot || !path.resolve(run).startsWith(qaRoot + '/'))
    throw new Error('Run must be below the external QA root');
  let ancestor = run;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (!(fs.realpathSync(ancestor) === qaRoot || fs.realpathSync(ancestor).startsWith(qaRoot + '/')))
    throw new Error('QA path escapes through a symlink');
  if (!existing && fs.existsSync(run)) throw new Error('Use a new run; never overwrite an existing session');
  if (existing && fs.realpathSync(run) !== path.resolve(run)) throw new Error('Session run must be canonical');
}
export async function originalIdentity(app, steamManifest) {
  const text = fs.readFileSync(steamManifest, 'utf8');
  const value = key => text.match(new RegExp('"' + key + '"\\s+"([^"\\n]+)"'))?.[1];
  if (value('appid') !== '3122210' || value('name') !== 'Canvas of Kings Demo' || value('StateFlags') !== '4')
    throw new Error('Expected installed Canvas of Kings Demo Steam manifest');
  const expected = path.join(path.dirname(steamManifest), 'common', value('installdir'), 'CanvasOfKingsDemo.x86_64');
  if (fs.realpathSync(app) !== fs.realpathSync(expected)) throw new Error('Executable differs from Steam installation');
  fs.accessSync(app, fs.constants.X_OK);
  const files = [app, ...['libgodotsteam.x86_64.so', 'libsteam_api.so'].map(n => path.join(path.dirname(app), n))];
  return { steamAppId: '3122210', steamBuildId: value('buildid'), semanticVersion: null,
    manifest: { path: steamManifest, sha256: await sha256(steamManifest) },
    files: await Promise.all(files.map(async file => ({ path: fs.realpathSync(file), sha256: await sha256(file) }))) };
}
export function assertProcesses(session) {
  if (session.state !== 'running' || session.role !== 'actual_original_runtime' || session.product !== 'Canvas of Kings Demo')
    throw new Error('Not a live Canvas of Kings original session');
  assertRun(session.run, true);
  if (!session.processes?.some(p => p.name === 'canvas-of-kings')) throw new Error('Original process missing');
  for (const p of session.processes) {
    if (startTicks(p.pid) !== p.startTicks || fs.realpathSync(`/proc/${p.pid}/exe`) !== fs.realpathSync(p.executable))
      throw new Error('Owned original process identity changed');
  }
}
