import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { assertRun, originalIdentity, startTicks, sha256, assertHeldLock } from './identity.mjs';
const { values } = parseArgs({ options: Object.fromEntries(['run', 'app', 'steam-manifest', 'xvnc', 'wm'].map(k => [k, { type: 'string' }])) });
const required = name => {
  if (!values[name] || !path.isAbsolute(values[name])) throw new Error(`Absolute --${name} required`);
  return values[name];
};
const run = required('run'), app = required('app'), xvnc = required('xvnc'), wm = required('wm');
required('steam-manifest'); assertRun(run);
const runtime = process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid()}`;
const lock = path.join(runtime, 'dungeon-editor-test.lock');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
if (process.env.COK_QA_LOCKED !== '1') {
  // --no-fork makes signal forwarding reach the actual locked Node owner.
  const child = spawn('flock', ['-n', '-E', '75', '--no-fork', lock, process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, COK_QA_LOCKED: '1' },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} else await main();
async function main() {
  const owner = { pid: process.pid, startTicks: startTicks(process.pid), executable: process.execPath };
  assertHeldLock(lock, owner);
  const original = await originalIdentity(app, values['steam-manifest']);
  for (const file of [xvnc, wm]) fs.accessSync(file, fs.constants.X_OK);
  for (const id of fs.readdirSync('/proc').filter(id => /^\d+$/.test(id))) {
    let args; try { args = fs.readFileSync(`/proc/${id}/cmdline`, 'utf8').split('\0'); } catch { continue; }
    if (/(?:CanvasOfKingsDemo|Wonderdraft|Dungeondraft)\.x86_64$/.test(args[0]) || path.basename(args[0]) === 'Xvnc' ||
        (/obsidian/i.test(args[0]) && args.some(a => a.includes('dungeon-native-qa'))))
      throw new Error(`Another original/graphical QA is running: ${id}`);
  }
  const display = Array.from({ length: 18 }, (_, i) => i + 12).find(n => !fs.existsSync(`/tmp/.X11-unix/X${n}`) && !fs.existsSync(`/tmp/.X${n}-lock`));
  if (!display) throw new Error('No unused test display');
  fs.mkdirSync(run, { recursive: true });
  for (const d of ['home', 'config', 'data', 'cache', 'runtime', 'maps', 'screens']) fs.mkdirSync(path.join(run, d), { mode: 0o700 });
  const busDir = fs.mkdtempSync(path.join(runtime, 'cok-qa-bus-'));
  const session = { id: randomUUID(), role: 'actual_original_runtime', product: 'Canvas of Kings Demo', run,
    startedAt: new Date().toISOString(), executable: app, executableSha256: original.files[0].sha256, original,
    inputKind: 'synthetic_local_rfb', physicalInput: false, display: `:${display}`, port: 5900 + display, width: 1280, height: 960,
    lock, owner, profile: Object.fromEntries(['home', 'config', 'data', 'cache', 'runtime'].map(k => [k, path.join(run, k)])),
    displayIsolation: { sessionBus: path.join(busDir, 'bus'), busServiceActivation: false, waylandDisplay: '', rfbHost: '127.0.0.1' },
    rendering: 'original_default_no_software_override', processes: [], state: 'starting',
    emergencyGuard: 'MemAvailable < 256 MiB or full PSI > 50% over two seconds',
    tools: await Promise.all([xvnc, wm].map(async file => ({ path: file, sha256: await sha256(file) }))),
  };
  const save = () => fs.writeFileSync(path.join(run, 'session.json'), JSON.stringify(session, null, 2) + '\n');
  const env = { ...process.env, HOME: session.profile.home, XDG_CONFIG_HOME: session.profile.config,
    XDG_DATA_HOME: session.profile.data, XDG_CACHE_HOME: session.profile.cache, XDG_RUNTIME_DIR: session.profile.runtime,
    DISPLAY: session.display, WAYLAND_DISPLAY: '', GDK_BACKEND: 'x11', QT_QPA_PLATFORM: 'xcb', GTK_USE_PORTAL: '0',
    DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + session.displayIsolation.sessionBus, SteamAppId: '3122210', SteamGameId: '3122210',
    LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' };
  const children = []; let stopping = false;
  const alive = child => child.exitCode === null && child.signalCode === null;
  async function start(executable, args, name, overrides = {}) {
    const log = fs.openSync(path.join(run, name + '.log'), 'a');
    const child = spawn(executable, args, { cwd: run, env: { ...env, ...overrides }, stdio: ['ignore', log, log] });
    fs.closeSync(log); children.push(child);
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    session.processes.push({ name, pid: child.pid, startTicks: startTicks(child.pid), executable: fs.realpathSync(executable) });
    save(); return child;
  }
  async function cleanup() {
    if (stopping) return; stopping = true;
    for (const child of [...children].reverse()) {
      if (alive(child)) child.kill('SIGTERM');
      for (let i = 0; i < 30 && alive(child); i++) await pause(100);
      if (alive(child)) { child.kill('SIGKILL'); session.forcedStop = true; }
    }
    fs.rmSync(busDir, { recursive: true, force: true });
    session.state = session.failure ? 'failed' : 'stopped'; session.endedAt = new Date().toISOString(); save();
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void cleanup(); });
  try {
    const server = await start(xvnc, [session.display, '-geometry', '1280x960', '-depth', '24', '-SecurityTypes', 'None', '-localhost', 'yes', '-rfbport', String(session.port), '-ac'], 'xvnc');
    let ready = false;
    for (let i = 0; i < 50 && alive(server); i++) {
      ready = await new Promise(resolve => { const s = createConnection({ host: '127.0.0.1', port: session.port }); s.once('connect', () => { s.destroy(); resolve(true); }); s.once('error', () => resolve(false)); });
      if (ready) break; await pause(100);
    }
    if (!ready) throw new Error('Private display failed to start');
    const busConfig = path.join(run, 'session-bus.xml');
    const bus = session.displayIsolation.sessionBus.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
    fs.writeFileSync(busConfig, `<busconfig><type>session</type><listen>unix:path=${bus}</listen><policy context="default"><allow own="*"/><allow send_destination="*"/><allow receive_sender="*"/></policy></busconfig>`);
    const daemon = await start('/usr/bin/dbus-daemon', ['--nofork', '--config-file=' + busConfig], 'session-bus');
    for (let i = 0; i < 50 && alive(daemon) && !fs.existsSync(session.displayIsolation.sessionBus); i++) await pause(100);
    if (!alive(daemon) || !fs.existsSync(session.displayIsolation.sessionBus)) throw new Error('Private D-Bus failed');
    const wmRoot = path.resolve(path.dirname(wm), '../..'), wmConfig = path.join(run, 'config', 'openbox.xml');
    fs.writeFileSync(wmConfig, '<openbox_config xmlns="http://openbox.org/3.4/rc"><applications><application class="*"><decor>no</decor><position force="yes"><x>0</x><y>0</y></position></application></applications></openbox_config>');
    const manager = await start(wm, ['--config-file', wmConfig], 'window-manager', { XDG_DATA_DIRS: wmRoot + '/usr/share:/usr/local/share:/usr/share', LD_LIBRARY_PATH: wmRoot + '/usr/lib64' });
    await pause(500); if (!alive(manager)) throw new Error('Private window manager failed');
    const program = await start(app, ['--position', '0,0', '--resolution', '1280x960'], 'canvas-of-kings', { LD_LIBRARY_PATH: path.dirname(app) });
    session.state = 'running'; save(); console.log(path.join(run, 'session.json'));
    const memory = () => ({ time: Date.now(), available: Number(fs.readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+)/m)[1]) * 1024,
      full: Number(fs.readFileSync('/proc/pressure/memory', 'utf8').match(/^full .*total=(\d+)/m)[1]) });
    let baseline = memory();
    while (!stopping && !fs.existsSync(path.join(run, 'stop')) && children.every(alive)) {
      const row = memory(), elapsed = row.time - baseline.time;
      fs.appendFileSync(path.join(run, 'memory.jsonl'), JSON.stringify(row) + '\n');
      if (row.available < 256 * 1048576 || (elapsed >= 2000 && row.full - baseline.full > elapsed * 1000 * .5)) throw new Error('Acute system-wide memory shortage');
      if (elapsed >= 2000) baseline = row; await pause(500);
    }
    if (!stopping && !fs.existsSync(path.join(run, 'stop'))) {
      if (program.exitCode === 0 && children.filter(c => c !== program).every(alive)) session.originalExit = { kind: 'normal_process_exit', code: 0, observedAt: new Date().toISOString() };
      else throw new Error('Original/display exited before explicit stop');
    }
  } catch (error) { session.failure = error.message; process.exitCode = 1; console.error(error.message); }
  finally { await cleanup(); }
}
