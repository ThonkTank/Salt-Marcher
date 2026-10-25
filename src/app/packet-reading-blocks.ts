import type { SessionPacketBlock } from './session-packet-contracts';

export interface PacketReadingBlock extends SessionPacketBlock {
  parts?: SessionPacketBlock[];
}

/** One card and original action per contiguous note source. Parts retain their
 * own audience, text and live actions; the canonical packet is never rewritten. */
export function packetReadingBlocks(blocks: readonly SessionPacketBlock[]): PacketReadingBlock[] {
  const result: PacketReadingBlock[] = [];
  const noteId = (b: SessionPacketBlock) =>
    (b.kind === 'read-aloud' || b.kind === 'reference' || b.kind === 'gm') &&
    b.action?.kind === 'reference' &&
    b.action.ref.kind === 'note'
      ? b.action.ref.id
      : null;
  for (const block of blocks) {
    const previous = result.at(-1),
      id = noteId(block);
    if (previous && id && noteId(previous) === id) {
      previous.parts!.push({ ...block });
    } else if (id) {
      const at = block.heading.lastIndexOf(' · ');
      result.push({
        ...block,
        heading: at < 0 ? block.heading : block.heading.slice(0, at),
        parts: [{ ...block }],
      });
    } else result.push({ ...block });
  }
  return result;
}
