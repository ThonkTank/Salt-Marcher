import { open, rm } from 'node:fs/promises';
import { renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { sessionPacketMarkdown, type SessionPacket } from '../src/app/session-packet-contracts';

export async function exportSessionPacketFile(
  destination: string,
  packet: SessionPacket,
  check: () => void,
) {
  const candidate = path.join(
    path.dirname(destination),
    '.session-packet-' + randomUUID() + '.tmp',
  );
  let file: Awaited<ReturnType<typeof open>> | null = null,
    created = false;
  try {
    check();
    file = await open(candidate, 'wx');
    created = true;
    await file.writeFile(sessionPacketMarkdown(packet), 'utf8');
    await file.sync();
    await file.close();
    file = null;
    check();
    renameSync(candidate, destination);
  } finally {
    try {
      if (file) await file.close();
    } finally {
      if (created) await rm(candidate, { force: true });
    }
  }
}
