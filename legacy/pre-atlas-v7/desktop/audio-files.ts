import { createHash, randomUUID } from 'node:crypto';
import { constants, createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { readArchive, writeArchive, waitForDrain, completeOutput, closeOutput } from './zip-files';
import {
  audioMimeTypes,
  type AudioAsset,
  type AudioTransferProgress,
} from '../src/app/runtime/music-contracts';
import {
  audioFile,
  validateAudioLibrary,
  type audioLibrarySnapshot,
} from '../src/app/storage/music';

type Library = ReturnType<typeof audioLibrarySnapshot>;
export type TransferHooks = {
  cancelled: () => boolean;
  progress: (p: AudioTransferProgress) => void;
};
function throwIfCancelled(hooks: TransferHooks) {
  if (hooks.cancelled()) throw new Error('Audioübertragung abgebrochen.');
}

export async function copyAudio(
  source: string,
  root: string,
  hooks: TransferHooks,
): Promise<AudioAsset['media']> {
  const extension = path.extname(source).toLowerCase();
  if (!audioMimeTypes[extension]) throw new Error('Nicht unterstützte Audio-Dateiendung.');
  throwIfCancelled(hooks);
  await mkdir(root, { recursive: true });
  const temp = path.join(root, '.import-' + randomUUID()),
    digest = createHash('sha256');
  const output = createWriteStream(temp, { flags: 'wx' }),
    done = completeOutput(output);
  let bytes = 0;
  try {
    for await (const chunk of createReadStream(source)) {
      throwIfCancelled(hooks);
      digest.update(chunk);
      bytes += chunk.length;
      if (!output.write(chunk)) await waitForDrain(output);
      hooks.progress({ phase: 'Audiodatei kopieren', bytes, files: 0, busy: true });
    }
    output.end();
    await done;
    throwIfCancelled(hooks);
    const sha256 = digest.digest('hex');
    await rename(temp, path.join(root, sha256 + extension));
    return {
      sha256,
      extension,
      bytes,
      mime: audioMimeTypes[extension]!,
      originalName: path.basename(source),
    };
  } catch (error) {
    await closeOutput(output, done);
    await rm(temp, { force: true });
    throw error;
  }
}

export async function exportAudioBundle(
  filename: string,
  root: string,
  library: Library,
  hooks: TransferHooks,
) {
  validateAudioLibrary(library);
  const media = new Map<string, AudioAsset>();
  for (const asset of library.assets) {
    const name = asset.media.sha256 + asset.media.extension,
      existingMedia = media.get(name);
    if (existingMedia && existingMedia.media.bytes !== asset.media.bytes)
      throw new Error('Widersprüchliche Mediengröße: ' + asset.name);
    media.set(name, asset);
  }
  const entries = [...media].map(([name, asset]) => ({
    name: 'audio/' + name,
    filename: audioFile(root, asset),
    sha256: asset.media.sha256,
    bytes: asset.media.bytes,
  }));
  await writeArchive(filename, library, entries, {
    check: () => throwIfCancelled(hooks),
    progress: (bytes, files) =>
      hooks.progress({ phase: 'Musikbibliothek exportieren', bytes, files, busy: true }),
  });
}

export async function importAudioBundle(
  filename: string,
  root: string,
  hooks: TransferHooks,
): Promise<Library> {
  const extracted = await readArchive(
    filename,
    root,
    (name) => /^audio\/[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(name),
    (value) => {
      const library = value as Library;
      validateAudioLibrary(library);
      const files = new Map<string, { name: string; sha256: string; bytes: number }>();
      for (const asset of library.assets) {
        const name = 'audio/' + asset.media.sha256 + asset.media.extension,
          existingMedia = files.get(name);
        if (existingMedia && existingMedia.bytes !== asset.media.bytes)
          throw new Error('Widersprüchliche Mediengröße: ' + asset.name);
        files.set(name, { name, sha256: asset.media.sha256, bytes: asset.media.bytes });
      }
      return files;
    },
    {
      check: () => throwIfCancelled(hooks),
      progress: (bytes, files) =>
        hooks.progress({ phase: 'Musikbibliothek importieren', bytes, files, busy: true }),
    },
  );
  // Rollback owns only new copies; pre-existing media must survive a failed import.
  const newlyPublishedPaths: string[] = [];
  try {
    for (const [name, file] of extracted.files) {
      throwIfCancelled(hooks);
      const destination = path.join(root, path.basename(name));
      try {
        await copyFile(path.join(extracted.dir, name), destination, constants.COPYFILE_EXCL);
        newlyPublishedPaths.push(destination);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        // An existing content-addressed name is reusable only if its bytes still match.
        const digest = createHash('sha256');
        let existingBytes = 0;
        for await (const chunk of createReadStream(destination)) {
          throwIfCancelled(hooks);
          digest.update(chunk);
          existingBytes += chunk.length;
        }
        if (existingBytes !== file.bytes || digest.digest('hex') !== file.sha256)
          throw new Error('Vorhandene Medienbytes sind beschädigt: ' + name);
      }
    }
    throwIfCancelled(hooks);
    return extracted.manifest as Library;
  } catch (error) {
    for (const destination of newlyPublishedPaths) await rm(destination, { force: true });
    throw error;
  } finally {
    await rm(extracted.dir, { recursive: true, force: true });
  }
}
