import { watch } from 'node:fs';
import { mkdir, access, open, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createDevelopmentBuilder,
  developmentConfiguration,
} from './desktop-development-build.mjs';
import { DevelopmentQueue } from './development-queue.mjs';
import { launchDevelopmentChild } from './development-child.mjs';

export async function startDevelopment({
  root = process.cwd(),
  directory,
  dataDir,
  launch,
  log = console.log,
  onEvent = () => {},
} = {}) {
  const started = performance.now();
  root = path.resolve(root);
  const checkout = createHash('sha256').update(root).digest('hex').slice(0, 16);
  dataDir ??= path.join(
    process.env.XDG_DATA_HOME || path.join(homedir(), '.local/share'),
    'saltmarcher',
    'development',
    checkout,
  );
  await mkdir(dataDir, { recursive: true });
  directory ??= path.join(root, '.build/desktop-dev');
  await mkdir(directory, { recursive: true });
  const lockPath = path.join(directory, 'session.lock');
  let lock;
  try {
    lock = await open(lockPath, 'wx');
    await lock.writeFile(String(process.pid) + '\n');
  } catch (error) {
    throw Error(
      'Development output is already owned: ' +
        lockPath +
        '. If a previous launcher crashed, verify its recorded PID is gone before removing the lock.',
      { cause: error },
    );
  }
  let builder;
  try {
    builder = await createDevelopmentBuilder({ root, directory });
  } catch (error) {
    await lock.close();
    await rm(lockPath, { force: true });
    throw error;
  }
  const watchers = [];
  let child = null,
    stopping = false,
    restarting = false,
    stopPromise;
  const emit = (event) => {
    log(`[dev] ${JSON.stringify(event)}`);
    onEvent(event);
  };
  async function launchApp() {
    const current = await launchDevelopmentChild({
      root,
      runtime: builder.runtime,
      dataDir,
      launch,
      log,
    });
    child = current;
    await current.ready;
    void current.exit.then(
      (result) => {
        if (child === current && !restarting && !stopping) {
          emit({ kind: 'exited', ...result });
          void stop().catch((error) => emit({ kind: 'error', message: error.message }));
        }
      },
      (error) => {
        emit({ kind: 'error', message: error.message });
        void stop().catch((error) => emit({ kind: 'error', message: error.message }));
      },
    );
    return current;
  }
  const queue = new DevelopmentQueue(
    async (files, isCurrent) => {
      const begin = performance.now();
      const generation = await builder.prepare(files);
      if (!isCurrent()) {
        await generation.discard();
        return false;
      }
      if (!generation.outputs.length) {
        await generation.discard();
        return true;
      }
      try {
        if (generation.cssOnly) {
          await generation.publish();
          await child.styles(generation.outputs.map((file) => path.basename(file)));
        } else {
          restarting = true;
          await child.close();
          if (stopping) {
            await generation.discard();
            return true;
          }
          await generation.publish();
          await launchApp();
        }
        emit({
          kind: generation.cssOnly ? 'styles' : 'restart',
          pid: child.pid,
          files,
          outputs: generation.outputs,
          buildMs: Math.round(generation.durationMs),
          totalMs: Math.round(performance.now() - begin),
        });
        return true;
      } catch (error) {
        await generation.discard();
        throw error;
      } finally {
        restarting = false;
      }
    },
    { onError: (error) => emit({ kind: 'error', message: error.message }) },
  );
  async function stop() {
    if (stopPromise) return stopPromise;
    stopping = true;
    for (const watcher of watchers) watcher.close();
    // Ask the application to drain before awaiting a possibly blocked restart.
    stopPromise = (async () => {
      try {
        if (child) await child.close();
      } finally {
        await queue.stop();
        await builder.dispose();
        await lock.close();
        if (!child || child.exited) {
          await rm(lockPath, { force: true });
          emit({ kind: 'stopped' });
        } else
          emit({
            kind: 'blocked',
            pid: child.pid,
            message:
              'Application still running; output lock retained. Close the application normally.',
          });
      }
    })();
    return stopPromise;
  }
  try {
    let ready = false;
    const startupChanges = new Set();
    const changed = (file) => {
      file = file.split(path.sep).join('/');
      if (ready) queue.add(file);
      else startupChanges.add(file);
    };
    for (const folder of ['src', 'desktop', 'resources']) {
      const location = path.join(root, folder);
      try {
        await access(location);
      } catch {
        continue;
      }
      watchers.push(
        watch(location, { recursive: true }, (_event, file) => {
          if (file) changed(path.join(folder, file.toString()));
        }),
      );
    }
    // Watch directories rather than files: editors commonly replace files by rename.
    for (const folder of ['', 'tools'])
      watchers.push(
        watch(path.join(root, folder), (_event, file) => {
          if (file) {
            const relative = path.join(folder, file.toString()).split(path.sep).join('/');
            if (developmentConfiguration.has(relative)) changed(relative);
          }
        }),
      );
    let initial;
    do {
      startupChanges.clear();
      initial = await builder.prepare();
      if (!startupChanges.size) break;
      await initial.discard();
      if ([...startupChanges].some((file) => developmentConfiguration.has(file)))
        throw Error('Build configuration changed during startup; restart npm run dev.');
    } while (true);
    await initial.publish();
    await launchApp();
    emit({
      kind: 'ready',
      pid: child.pid,
      dataDir,
      runtime: builder.runtime,
      buildMs: Math.round(initial.durationMs),
      totalMs: Math.round(performance.now() - started),
    });
    ready = true;
    for (const file of startupChanges) queue.add(file);
    return {
      stop,
      queue,
      runtime: builder.runtime,
      dataDir,
      get pid() {
        return child?.pid;
      },
    };
  } catch (error) {
    await stop().catch((closeError) => log(closeError.message));
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some((arg, index) => index !== 0 || arg !== '--help') && args.length)
    throw Error('Usage: npm run dev (uses an isolated persistent development profile)');
  if (args[0] === '--help')
    console.log(
      'npm run dev: watch desktop/src/resources, refresh CSS or restart safely; Ctrl+C closes normally. Build-configuration changes require restarting this command.',
    );
  else {
    let session,
      requested = false;
    const stop = () => {
      requested = true;
      if (!session) return;
      void session.stop().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    session = await startDevelopment();
    if (requested) stop();
  }
}
