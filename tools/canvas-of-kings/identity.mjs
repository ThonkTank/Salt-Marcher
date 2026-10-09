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
export function assertHeldLock(lock, owner) {
  if (!owner || startTicks(owner.pid) !== owner.startTicks || fs.realpathSync(`/proc/${owner.pid}/exe`) !== fs.realpathSync(owner.executable))
    throw new Error('Lock owner identity changed');
  const stat = fs.statSync(lock, { bigint: true });
  // Btrfs subvolumes can expose a different st_dev than the lock superblock.
  // Bind the actual owned open descriptor to the file, then read its lock entry.
  const held = fs.readdirSync(`/proc/${owner.pid}/fd`).some(fd => {
    try {
      const opened = fs.statSync(`/proc/${owner.pid}/fd/${fd}`, { bigint: true });
      if (opened.dev !== stat.dev || opened.ino !== stat.ino) return false;
      return fs.readFileSync(`/proc/${owner.pid}/fdinfo/${fd}`, 'utf8').split('\n').some(line => {
        if (!line.startsWith('lock:')) return false;
        const p = line.slice(5).trim().split(/\s+/);
        return p[1] === 'FLOCK' && p[3] === 'WRITE' && Number(p[4]) === owner.pid;
      });
    } catch { return false; }
  });
  if (!held) throw new Error('Actual exclusive QA lock not held by owner');
}
export function assertTarget(session) {
  const display = session.display?.match(/^:(1[2-9]|2[0-9])$/);
  if (!display || session.port !== 5900 + Number(display[1]) || session.width !== 1280 || session.height !== 960)
    throw new Error('Private display/port/frame contract changed');
  const names = session.processes.map(p => p.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(['canvas-of-kings', 'session-bus', 'window-manager', 'xvnc']))
    throw new Error('Owned process roles incomplete');
  if (fs.realpathSync(session.processes.find(p => p.name === 'canvas-of-kings').executable) !== fs.realpathSync(session.executable))
    throw new Error('Original executable role differs');
}
