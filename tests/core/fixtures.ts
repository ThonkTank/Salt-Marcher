import { newDocument as createDocument } from "../../src/model";
import { Session } from "../../src/session";
import { createRoom } from "../../src/commands";
import { FileConflict, type FileStore } from "../../src/persistence";

export const newDocument: typeof createDocument = (name, width, height, assets, appearance, version = 3) =>
  createDocument(name, width, height, assets, appearance, version);

export class MemoryStore implements FileStore {
  files = new Map<string, string>();
  calls = 0;
  failAt = Infinity;
  hook?: (path: string) => void;
  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }
  async compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ): Promise<void> {
    this.hook?.(path);
    this.calls++;
    if (this.calls === this.failAt)
      throw new Error("simulated interrupted write");
    if ((await this.read(path)) !== before) throw new FileConflict(path);
    if (after === null) this.files.delete(path);
    else this.files.set(path, after);
  }
}
export const mapPath = "QA/Karte.dungeon";
export function fixture() {
  const s = new Session(newDocument("Prüfdungeon", 80, 60));
  const floor = s.floors.values().next().value!.id;
  const room = createRoom(
    s,
    floor,
    [
      { x: 2, y: 2 },
      { x: 14, y: 2 },
      { x: 14, y: 12 },
      { x: 2, y: 12 },
    ],
    "QA/Räume",
  );
  return { s, floor, room };
}
