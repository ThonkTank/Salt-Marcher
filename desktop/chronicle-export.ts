import { open, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { ChronicleReadSession } from '../src/app/storage/chronicle-pages';
import type { ChronicleCategory, ChronicleCursor } from '../src/app/chronicle-contracts';
import { chronicleMarkdownHeader, chronicleMarkdownEntries } from '../src/app/storage/chronicle';

export async function exportChronicleFile(
  snapshot: {read:(...args:Parameters<ChronicleReadSession['read']>)=>ReturnType<ChronicleReadSession['read']>|Promise<ReturnType<ChronicleReadSession['read']>>},
  category: ChronicleCategory | 'all',
  search: string,
  destination: string,
  hooks: {
    check: () => void;
    progress: (written: number) => void
  }
) {
  const candidate = destination + '.chronicle-' + randomUUID() + '.tmp';
  let file: Awaited<ReturnType<typeof open>> | null = null,
    written = 0,
    cursor: ChronicleCursor | null = null;

  try {
    hooks.check();
    file = await open(candidate, 'wx');
    let first = true;

    do {
      hooks.check();
      const page = await snapshot.read(category, search, cursor, 1000);
      hooks.check();

      if (first) {
        await file.writeFile(chronicleMarkdownHeader(page.campaignName), 'utf8');
        first = false;
      }
      if (page.entries.length) {
        await file.writeFile((written ? '\n\n' : '') + chronicleMarkdownEntries(page.entries), 'utf8');
        written += page.entries.length;
      }

      cursor = page.next;
      hooks.progress(written);
      await new Promise<void>(resolve => setImmediate(resolve));
    } while (cursor);

    if (!written)
      await file.writeFile('_Keine passenden Einträge._', 'utf8');

    await file.writeFile('\n', 'utf8');
    hooks.check();
    await file.sync();
    await file.close();
    file = null;

    hooks.check();
    await rename(candidate, destination);
    return written;
  } finally {
    if (file)
      await file.close();

    await rm(candidate, { force: true });
  }
}
