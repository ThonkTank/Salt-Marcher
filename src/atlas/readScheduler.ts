import type { AtlasClient, ReadCommands } from "./client";
// A client owns physical read slots even if a presentation hook unmounts.
const clientReadSlots = new WeakMap<
  AtlasClient,
  { active: number; waiting: Array<() => void> }
>();
function readSlots(client: AtlasClient) {
  let slots = clientReadSlots.get(client);
  if (!slots) {
    slots = { active: 0, waiting: [] };
    clientReadSlots.set(client, slots);
  }
  return slots;
}
export async function scheduledRead<K extends keyof ReadCommands>(
  client: AtlasClient,
  cmd: K,
  args: ReadCommands[K]["args"],
  wanted: () => boolean = () => true,
): Promise<ReadCommands[K]["result"] | undefined> {
  const slots = readSlots(client);
  if (slots.active >= 4)
    await new Promise<void>((resolve) => slots.waiting.push(resolve));
  else slots.active++;
  try {
    if (!wanted()) return undefined;
    return await client.read(cmd, args);
  } finally {
    const next = slots.waiting.shift();
    if (next) next();
    else slots.active--;
  }
}
