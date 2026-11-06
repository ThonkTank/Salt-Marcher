import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  isMemoryBounded,
  cgroupMemory,
  delegatedCheckRoot,
  LOCAL_MEMORY_HIGH,
  LOCAL_MEMORY_MAX,
} from './local-check-policy.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const filename = fileURLToPath(import.meta.url);
const read = (file) => readFileSync(file, 'utf8').trim();
const control = (args) =>
  spawnSync('systemctl', ['--user', ...args], { encoding: 'utf8', timeout: 3000 });
function cancelScope(unit) {
  // Cancel this unit's pending start, rather than replacing it with another queued stop.
  const job = control(['show', unit, '-p', 'Job', '--value']).stdout?.trim();
  if (/^[1-9]\d*$/.test(job ?? '')) control(['cancel', job]);
  control(['kill', '--kill-whom=all', '--signal=SIGKILL', unit]);
}
function createGroup(group, unit) {
  const root = delegatedCheckRoot(group);
  if (!root) return null;
  const directory = path.join(root, unit);
  let created = false;
  try {
    if (!read(path.join(root, 'cgroup.subtree_control')).split(/\s+/).includes('memory'))
      return null;
    mkdirSync(directory);
    created = true;
    const inherited = cgroupMemory();
    writeFileSync(
      path.join(directory, 'memory.high'),
      String(Math.min(LOCAL_MEMORY_HIGH, inherited.high ?? Infinity)),
    );
    writeFileSync(
      path.join(directory, 'memory.max'),
      String(Math.min(LOCAL_MEMORY_MAX, inherited.max ?? Infinity)),
    );
    writeFileSync(path.join(directory, 'memory.oom.group'), '1');
    if (
      Number(read(path.join(directory, 'memory.high'))) > LOCAL_MEMORY_HIGH ||
      Number(read(path.join(directory, 'memory.max'))) > LOCAL_MEMORY_MAX
    )
      throw Error('Local cgroup limits were not applied.');
    return directory;
  } catch (error) {
    if (created) {
      try {
        rmdirSync(directory);
      } catch {}
      throw error; // Partial setup is a failure, never an unbounded retry.
    }
    if (['EACCES', 'EPERM', 'EROFS'].includes(error.code)) return null;
    throw error;
  }
}
async function removeGroup(directory) {
  // The launcher stays outside the group. Reap all descendants, including children
  // detached from the command's process group, before removing only our own cgroup.
  const peak = Number(read(path.join(directory, 'memory.peak')));
  const leftover = read(path.join(directory, 'cgroup.procs'));
  if (leftover) writeFileSync(path.join(directory, 'cgroup.kill'), '1');
  for (let attempt = 0; attempt < 100; attempt++) {
    if (!/populated 1/.test(read(path.join(directory, 'cgroup.events')))) {
      rmdirSync(directory);
      return { peak, reapedDescendants: !!leftover, removed: true };
    }
    await delay(20);
  }
  throw Error('Local check left populated cgroup: ' + directory);
}
export async function runLocalCheck(
  command,
  args,
  { ci = !!process.env.CI, backend = 'auto', startupMs = 30000 } = {},
) {
  const inherited = cgroupMemory(),
    group = inherited.group;
  const bounded = process.platform === 'linux' && isMemoryBounded();
  const isolated = process.platform === 'linux' && !ci && (!bounded || backend === 'systemd');
  const unit = 'salt-check-' + randomUUID();
  const directory = isolated && backend !== 'systemd' ? createGroup(group, unit) : null;
  const scoped = isolated && !directory;
  const policy = directory
    ? 'delegated-2G-3G'
    : scoped
      ? 'systemd-2G-3G'
      : bounded
        ? 'existing-bounded'
        : ci
          ? 'ci'
          : 'portable';
  const evidence = path.resolve('.build/local-checks', unit);
  mkdirSync(evidence, { recursive: true });
  const marker = path.join(evidence, 'started.json');
  const entry = [filename, '--bounded-entry', directory ?? '-', marker, command, ...args];
  const executable = scoped ? 'systemd-run' : isolated ? process.execPath : command;
  const argv = scoped
    ? [
        '--user',
        '--scope',
        '--quiet',
        '--collect',
        '--unit=' + unit,
        '-p',
        'MemoryHigh=2G',
        '-p',
        'MemoryMax=3G',
        '--',
        process.execPath,
        ...entry,
      ]
    : isolated
      ? entry
      : args;
  console.log(`Local check: ${policy}; group=${group || 'unavailable'}`);
  const started = performance.now(),
    startedAt = Date.now();
  let result, child, timer, killTimer, failure;
  const signals = ['SIGINT', 'SIGTERM'];
  const stop = (signal) => {
    if (scoped) cancelScope(unit + '.scope');
    child?.kill(signal);
    killTimer ??= setTimeout(() => {
      if (directory) {
        try {
          writeFileSync(path.join(directory, 'cgroup.kill'), '1');
        } catch {}
      }
      child?.kill('SIGKILL');
    }, 2000);
  };
  const handlers = signals.map((signal) => () => stop(signal));
  try {
    result = await new Promise((resolve, reject) => {
      child = spawn(executable, argv, {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=2304',
        },
      });
      signals.forEach((signal, i) => process.on(signal, handlers[i]));
      if (isolated)
        timer = setInterval(
          () => {
            if (existsSync(marker)) {
              clearInterval(timer);
              return;
            }
            if (performance.now() - started >= startupMs) {
              failure = `Local ${scoped ? 'systemd scope' : 'cgroup'} did not start within ${startupMs} ms (${unit}); command was not confirmed bounded.`;
              console.error(failure);
              clearInterval(timer);
              stop('SIGTERM');
            }
          },
          Math.min(100, startupMs),
        );
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
  } catch (error) {
    failure = error.message;
    result = { code: 1, signal: null };
  } finally {
    clearInterval(timer);
    clearTimeout(killTimer);
    signals.forEach((signal, i) => process.off(signal, handlers[i]));
    if (scoped && (!existsSync(marker) || result?.signal)) cancelScope(unit + '.scope');
    try {
      if (directory) result = { ...result, cleanup: await removeGroup(directory) };
    } catch (error) {
      failure = error.message;
    }
  }
  if (isolated && result?.code === 0 && !existsSync(marker))
    failure = 'Local check exited before confirming bounded command startup.';
  if (failure) result = { ...result, code: 1, signal: null, error: failure };
  result = {
    ...result,
    policy,
    group,
    startupMs: existsSync(marker) ? JSON.parse(read(marker)).startedAt - startedAt : null,
    totalMs: performance.now() - started,
    evidence,
  };
  writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
export function propagateExit(result) {
  if (result.error) console.error(result.error);
  if (result.signal) process.kill(process.pid, result.signal);
  else process.exitCode = result.code ?? 1;
}
async function boundedEntry(directory, marker, command, args) {
  const start = performance.now();
  if (directory !== '-') writeFileSync(path.join(directory, 'cgroup.procs'), String(process.pid));
  if (!isMemoryBounded())
    throw Error('Refusing to execute command without verified local 2G/3G cgroup limits.');
  writeFileSync(
    marker,
    JSON.stringify({
      ...cgroupMemory(),
      startedAt: Date.now(),
      entryMs: performance.now() - start,
    }),
  );
  const child = spawn(command, args, { stdio: 'inherit' });
  const signals = ['SIGINT', 'SIGTERM'];
  const handlers = signals.map((signal) => () => child.kill(signal));
  signals.forEach((signal, i) => process.on(signal, handlers[i]));
  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
  } finally {
    signals.forEach((signal, i) => process.off(signal, handlers[i]));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === filename) {
  const args = process.argv.slice(2);
  if (args[0] === '--bounded-entry') {
    args.shift();
    const [directory, marker, command, ...rest] = args;
    propagateExit(await boundedEntry(directory, marker, command, rest));
  } else {
    if (args[0] === '--') args.shift();
    const command = args.shift();
    if (!command) throw Error('Usage: npm run verify:local -- COMMAND [ARGUMENTS]');
    propagateExit(await runLocalCheck(command, args));
  }
}
