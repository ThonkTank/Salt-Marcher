import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

/** Private inherited stdio; there is no network listener or renderer IPC capability. */
export async function launchDevelopmentChild({
  root,
  runtime,
  dataDir,
  launch,
  log = console.log,
}) {
  const token = randomBytes(32).toString('hex'),
    require = createRequire(path.join(root, 'package.json'));
  const executable = require('electron'),
    args = [path.join(runtime, 'main.cjs'), '--data-dir', dataDir];
  const env = {
    ...process.env,
    SALTMARCHER_DEV_TOKEN: token,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--enable-source-maps'].filter(Boolean).join(' '),
  };
  const child = launch
    ? await launch({ executable, args, env })
    : spawn(executable, args, { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let next = 0,
    buffer = '',
    safeClose = false,
    exited = false;
  const pending = new Map();
  let markReady, failReady;
  const ready = new Promise((resolve, reject) => {
    markReady = resolve;
    failReady = reject;
  });
  const readyTimer = setTimeout(
    () => failReady(Error('Development readiness acknowledgement timed out')),
    30000,
  );
  ready.finally(() => clearTimeout(readyTimer)).catch(() => {});
  child.stderr?.on('data', (chunk) => process.stderr.write(chunk));
  const exit = new Promise((resolve, reject) => {
    child.once('error', (error) => {
      failReady(error);
      reject(error);
    });
    child.once('close', (code, signal) => {
      exited = true;
      failReady(Error('Development application exited before readiness'));
      for (const task of pending.values()) {
        clearTimeout(task.timer);
        task.reject(Error('Development application exited'));
      }
      pending.clear();
      resolve({ code, signal, safeClose });
    });
  });
  // The readiness promise is observed first by the caller; retain spawn failures
  // for its subsequent exit inspection without an unhandled rejection.
  void exit.catch(() => {});
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      if (!line.startsWith('SALTMARCHER_DEV ')) {
        if (line) log(line);
        continue;
      }
      let message;
      try {
        message = JSON.parse(line.slice('SALTMARCHER_DEV '.length));
      } catch {
        continue;
      }
      if (message.event === 'ready') {
        markReady(message);
        continue;
      }
      if (message.event === 'closed') {
        safeClose = message.databaseClosed === true;
        continue;
      }
      const task = pending.get(message.id);
      if (!task) continue;
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.ok) task.resolve(message);
      else task.reject(Error(message.error));
    }
  });
  function request(action, files) {
    if (exited) return Promise.reject(Error('Development application already exited'));
    const id = ++next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error('Development ' + action + ' acknowledgement timed out'));
      }, 30000);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(
        JSON.stringify({ kind: 'saltmarcher-dev', token, id, action, files }) + '\n',
        (error) => {
          if (error) {
            clearTimeout(timer);
            pending.delete(id);
            reject(error);
          }
        },
      );
    });
  }
  return {
    ready,
    pid: child.pid,
    get exited() {
      return exited;
    },
    child,
    exit,
    styles: (files) => request('styles', files),
    async close() {
      if (!exited) await request('close');
      const notice = setTimeout(
        () =>
          log(
            'Development restart waits for the application to save/resolve its pending work. Close normally to continue.',
          ),
        10000,
      );
      try {
        const result = await exit;
        if (result.code !== 0 || result.signal || !result.safeClose)
          throw Error(
            'Development application did not confirm a normal store close; automatic restart stopped.',
          );
        return result;
      } finally {
        clearTimeout(notice);
      }
    },
  };
}
