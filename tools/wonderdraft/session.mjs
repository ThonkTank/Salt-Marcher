// One actual Wonderdraft process, isolated profile, localhost-only framebuffer.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const { values } = parseArgs({ options: {
  run: { type: 'string' }, app: { type: 'string' }, xvnc: { type: 'string' }, wm: { type: 'string' },
  locked: { type: 'boolean', default: false },
} });
const required = name => {
  if (!values[name] || !path.isAbsolute(values[name])) throw new Error(`Absolute --${name} required`);
  return values[name];
};
const run = required('run'), app = required('app'), xvnc = required('xvnc');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const startTicks = pid => fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[19];
const memory = () => ({ time: Date.now(),
  available: Number(fs.readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+)/m)[1]) * 1024,
  total: Number(fs.readFileSync('/proc/pressure/memory', 'utf8').match(/^full .*total=(\d+)/m)[1]),
});
const lock = path.join(process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid()}`, 'dungeon-editor-test.lock');

if (!values.locked) {
  const child = spawn('flock', ['-n', '-E', '75', lock, process.execPath, fileURLToPath(import.meta.url),
    '--locked', '--run', run, '--app', app, '--xvnc', xvnc,
    ...(values.wm ? ['--wm', required('wm')] : [])], { stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', code => { process.exitCode = code ?? 1; });
} else {
  await main();
}

async function main() {
  fs.accessSync(app, fs.constants.X_OK); fs.accessSync(xvnc, fs.constants.X_OK);
  if (fs.existsSync(run)) throw new Error('Use a new session directory; existing session not overwritten');
  fs.mkdirSync(run, { recursive: true });
  const foreign = fs.readdirSync('/proc').filter(id => /^\d+$/.test(id)).flatMap(id => {
    try {
      const args = fs.readFileSync(`/proc/${id}/cmdline`, 'utf8').split('\0');
      return /(?:Wonderdraft|Dungeondraft)\.x86_64$/.test(args[0]) ||
        (/obsidian/i.test(args[0]) && args.some(a => a.includes('dungeon-native-qa'))) ||
        path.basename(args[0]) === 'Xvnc' ? [{ pid: Number(id), executable: args[0] }] : [];
    } catch { return []; }
  });
  if (foreign.length) throw new Error(`Another graphical test/original is running: ${JSON.stringify(foreign)}`);
  let displayNumber;
  for (let n = 12; n < 30; n++) {
    if (!fs.existsSync(`/tmp/.X11-unix/X${n}`)) { displayNumber = n; break; }
  }
  if (!displayNumber) throw new Error('No unused test display');
  for (const dir of ['config', 'data', 'cache', 'maps', 'screens']) fs.mkdirSync(path.join(run, dir));
  fs.mkdirSync(path.join(run, 'data', 'Wonderdraft'));
  fs.writeFileSync(path.join(run, 'data', 'Wonderdraft', 'config.ini'),
    '[Display]\nfullscreen=false\nwindow_width=1280\nwindow_height=960\nwindow_maximized=false\nwindow_position_x=0\nwindow_position_y=0\n');
  // Unix socket paths are limited; QA evidence directories can be much longer.
  const busDirectory = fs.mkdtempSync(path.join(path.dirname(lock), 'wonderdraft-qa-bus-'));
  const manifest = {
    id: randomUUID(), role: 'actual_original_runtime', product: 'Wonderdraft',
    startedAt: new Date().toISOString(), inputKind: 'synthetic_local_rfb', physicalInput: false,
    emergencyGuard: 'MemAvailable < 256 MiB or full PSI > 50% for a two-second window',
    run, executable: app, executableSha256: hash(app),
    packageSha256: hash(path.join(path.dirname(app), 'Wonderdraft.pck')),
    display: `:${displayNumber}`, port: 5900 + displayNumber, width: 1280, height: 960,
    displayIsolation: { waylandDisplay: '', gdkBackend: 'x11', qtPlatform: 'xcb', gtkUsePortal: '0',
      sessionBus: path.join(busDirectory, 'bus'), busServiceActivation: false },
    profile: { config: path.join(run, 'config'), data: path.join(run, 'data'), cache: path.join(run, 'cache') },
    lock, processes: [], state: 'starting',
  };
  const save = () => fs.writeFileSync(path.join(run, 'session.json'), JSON.stringify(manifest, null, 2) + '\n');
  const children = [];
  function start(executable, args, name, env = process.env) {
    const log = fs.openSync(path.join(run, name + '.log'), 'a');
    const child = spawn(executable, args, { cwd: path.dirname(app), env, stdio: ['ignore', log, log] });
    fs.closeSync(log);
    children.push(child);
    child.on('error', error => { manifest.failure = error.message; });
    manifest.processes.push({ name, pid: child.pid, startTicks: startTicks(child.pid), executable });
    save(); return child;
  }
  const alive = child => child.exitCode === null && child.signalCode === null;
  let stopping = false;
  async function cleanup() {
    if (stopping) return; stopping = true;
    for (const child of children.toReversed()) {
      if (alive(child)) child.kill('SIGTERM');
      for (let i = 0; i < 30 && alive(child); i++) await pause(100);
      if (alive(child)) { child.kill('SIGKILL'); manifest.forcedStop = true; }
    }
    fs.rmSync(busDirectory, { recursive: true, force: true });
    manifest.state = manifest.failure ? 'failed' : 'stopped';
    manifest.endedAt = new Date().toISOString(); save();
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void cleanup(); });
  try {
    const server = start(xvnc, [manifest.display, '-geometry', '1280x960', '-depth', '24',
      '-SecurityTypes', 'None', '-localhost', 'yes', '-rfbport', String(manifest.port), '-ac'], 'xvnc');
    let ready = false;
    for (let i = 0; i < 50 && alive(server); i++) {
      ready = await new Promise(resolve => {
        const socket = createConnection({ host: '127.0.0.1', port: manifest.port });
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('error', () => resolve(false));
      });
      if (ready) break; await pause(100);
    }
    if (!ready) throw new Error('Original display failed to start');
    // No inherited desktop portal or service activation in the original test.
    const busConfig = path.join(run, 'session-bus.xml');
    const busPathXml = manifest.displayIsolation.sessionBus.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    fs.writeFileSync(busConfig, `<busconfig><type>session</type><listen>unix:path=${busPathXml}</listen><policy context="default"><allow own="*"/><allow send_destination="*"/><allow receive_sender="*"/></policy></busconfig>`);
    const bus = start('/usr/bin/dbus-daemon', ['--nofork', '--config-file=' + busConfig], 'session-bus');
    for (let i = 0; i < 50 && alive(bus) && !fs.existsSync(manifest.displayIsolation.sessionBus); i++) await pause(100);
    if (!alive(bus) || !fs.existsSync(manifest.displayIsolation.sessionBus)) throw new Error('Private original session bus failed');
    if (values.wm) {
      fs.accessSync(required('wm'), fs.constants.X_OK);
      const wmRoot = path.resolve(path.dirname(values.wm), '../..');
      const config = path.join(run, 'config', 'openbox.xml');
      fs.writeFileSync(config, '<openbox_config xmlns="http://openbox.org/3.4/rc"><applications><application class="*"><decor>no</decor><position force="yes"><x>0</x><y>0</y></position></application></applications></openbox_config>');
      const manager = start(values.wm, ['--config-file', config], 'window-manager', {
        ...process.env, DISPLAY: manifest.display, XDG_CONFIG_HOME: manifest.profile.config,
        XDG_DATA_DIRS: wmRoot + '/usr/share:/usr/local/share:/usr/share',
        LD_LIBRARY_PATH: wmRoot + '/usr/lib64',
      });
      await pause(500);
      if (!alive(manager)) throw new Error('Isolated window manager failed');
    }
    const original = start(app, ['--position', '0,0', '--resolution', '1280x960'], 'wonderdraft', {
      ...process.env, DISPLAY: manifest.display, XDG_CONFIG_HOME: manifest.profile.config,
      XDG_DATA_HOME: manifest.profile.data, XDG_CACHE_HOME: manifest.profile.cache,
      // System file selectors must inherit the private display too.
      WAYLAND_DISPLAY: '', GDK_BACKEND: 'x11', QT_QPA_PLATFORM: 'xcb', GTK_USE_PORTAL: '0',
      DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + manifest.displayIsolation.sessionBus,
      LIBGL_ALWAYS_SOFTWARE: '1', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8',
    });
    manifest.state = 'running'; save(); console.log(path.join(run, 'session.json'));
    let baseline = memory();
    while (!stopping && !fs.existsSync(path.join(run, 'stop')) && alive(original) && alive(server)) {
      const row = memory(), elapsed = row.time - baseline.time;
      fs.appendFileSync(path.join(run, 'memory.jsonl'), JSON.stringify(row) + '\n');
      if (row.available < 256 * 1048576 || (elapsed >= 2000 && row.total - baseline.total > elapsed * 1000 * 0.5))
        throw new Error('Acute system-wide memory shortage');
      if (elapsed >= 2000) baseline = row;
      await pause(500);
    }
    if (!stopping && !fs.existsSync(path.join(run, 'stop'))) throw new Error('Original/display exited before explicit stop');
  } catch (error) {
    manifest.failure = error.message; process.exitCode = 1;
    console.error(error.message);
  } finally { await cleanup(); }
}
