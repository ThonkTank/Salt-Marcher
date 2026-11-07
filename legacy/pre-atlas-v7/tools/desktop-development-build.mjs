import { context } from 'esbuild';
import { constants } from 'node:fs';
import { mkdir, mkdtemp, cp, rm, rename, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { desktopBuildPlan, desktopAssets } from './desktop-build-plan.mjs';
import {
  desktopBuildMetadata,
  copyDesktopAssets,
  writeDesktopDocuments,
} from './desktop-build-output.mjs';

export const developmentConfiguration = new Set([
  'package.json',
  'package-lock.json',
  'src/app/data-format.json',
  'tools/desktop-build-plan.mjs',
  'tools/desktop-build-output.mjs',
  'tools/desktop-entry-environments.mjs',
  'tools/atlas-runtime-licenses.mjs',
  'tools/desktop-markup.mjs',
  'tools/desktop-styles.mjs',
  'tools/desktop-development-build.mjs',
  'tools/dev-desktop.mjs',
  'tools/development-child.mjs',
  'tools/development-queue.mjs',
]);
const cssFiles = new Set(['ui/app.css', 'ui/player.css', 'ui/preset-settings.css']);

/** Serial caller; failed generations never modify the running application's files. */
export async function createDevelopmentBuilder({
  root = process.cwd(),
  directory = path.join(root, '.build/desktop-dev'),
} = {}) {
  root = path.resolve(root);
  directory = path.resolve(directory);
  const runtime = path.join(directory, 'runtime');
  await mkdir(directory, { recursive: true });
  const metadata = await desktopBuildMetadata(root);
  const bundles = [];
  let initial = true,
    configurationError = null;
  try {
    for (const options of desktopBuildPlan({
      outdir: runtime,
      version: metadata.applicationVersion,
      development: true,
    })) {
      bundles.push({
        options,
        context: await context({
          ...options,
          absWorkingDir: root,
          write: false,
          metafile: true,
          logLevel: 'silent',
        }),
        inputs: new Set(),
        failed: false,
      });
    }
  } catch (error) {
    await Promise.all(bundles.map((b) => b.context.dispose()));
    throw error;
  }
  async function prepare(files = []) {
    const start = performance.now(),
      changes = new Set(files.map((f) => f.split(path.sep).join('/')));
    if (!initial)
      for (const file of changes)
        if (developmentConfiguration.has(file))
          configurationError = Error(
            file + ' changed; stop and restart npm run dev to reload build configuration.',
          );
    if (configurationError) throw configurationError;
    const stage = await mkdtemp(path.join(directory, 'candidate-')),
      outputs = new Set(),
      built = [];
    try {
      if (!initial) await cp(runtime, stage, { recursive: true, mode: constants.COPYFILE_FICLONE });
      for (const bundle of bundles) {
        if (!initial && !bundle.failed && ![...changes].some((file) => bundle.inputs.has(file)))
          continue;
        bundle.failed = true;
        const result = await bundle.context.rebuild();
        bundle.inputs = new Set(
          Object.keys(result.metafile.inputs).map((file) =>
            path.relative(root, path.resolve(root, file)).split(path.sep).join('/'),
          ),
        );
        bundle.failed = false;
        built.push(...bundle.options.entryPoints);
        for (const file of result.outputFiles) {
          const relative = path.relative(runtime, file.path);
          if (relative.startsWith('..') || path.isAbsolute(relative))
            throw Error('Build output escaped development runtime');
          const target = path.join(stage, relative);
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, file.contents);
          outputs.add(relative.split(path.sep).join('/'));
        }
      }
      await copyDesktopAssets(stage, { root, changes: initial ? null : changes });
      for (const [source, target] of desktopAssets)
        if (initial || changes.has(source)) outputs.add(target);
      // Use the sole HTML reader. A missing or malformed fragment aborts this generation.
      if (
        initial ||
        [...changes].some((file) => file.startsWith('src/app/') && file.endsWith('.html'))
      ) {
        await writeDesktopDocuments(stage, metadata, root);
        outputs.add('ui/index.html');
      }
      const cssOnly =
        !initial && outputs.size > 0 && [...outputs].every((file) => cssFiles.has(file));
      let settled = false;
      return {
        stage,
        runtime,
        cssOnly,
        outputs: [...outputs],
        built,
        durationMs: performance.now() - start,
        async discard() {
          if (!settled) {
            settled = true;
            await rm(stage, { recursive: true, force: true });
          }
        },
        async publish() {
          if (settled) throw Error('Development generation already settled');
          if (cssOnly) {
            for (const file of outputs) {
              const destination = path.join(runtime, file),
                temporary = destination + '.dev-next';
              await writeFile(temporary, await readFile(path.join(stage, file)));
              await rename(temporary, destination);
            }
            await rm(stage, { recursive: true, force: true });
          } else {
            const previous = path.join(directory, 'previous');
            await rm(previous, { recursive: true, force: true });
            let moved = false;
            try {
              await rename(runtime, previous);
              moved = true;
            } catch (error) {
              if (error.code !== 'ENOENT') throw error;
            }
            try {
              await rename(stage, runtime);
            } catch (error) {
              if (moved) await rename(previous, runtime);
              throw error;
            }
            await rm(previous, { recursive: true, force: true });
          }
          initial = false;
          settled = true;
        },
      };
    } catch (error) {
      // A successful earlier bundle in an aborted generation must also rebuild:
      // no output from this stage has reached the running application.
      for (const bundle of bundles)
        if (built.some((entry) => bundle.options.entryPoints.includes(entry))) bundle.failed = true;
      await rm(stage, { recursive: true, force: true });
      throw error;
    }
  }
  return {
    runtime,
    prepare,
    async dispose() {
      for (const bundle of bundles) await bundle.context.dispose();
    },
  };
}
