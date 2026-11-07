import {
  isStructuredRoom,
  parseDocument,
  serializeDocument,
  type RoomV4,
} from "../../model";
import { dungeonDocumentChange, type DungeonAtlasSource } from "./atlas-source";

/** Only a transient text draft; the actual DungeonAtlasSource remains the document/Key authority. */
export class AtlasRoomKeyDraft {
  readonly before: string;
  readonly room: RoomV4;
  name: string;
  number: string;
  readonly markdown = new Map<string, string>();
  constructor(
    readonly source: DungeonAtlasSource,
    readonly roomId: string,
  ) {
    const snapshot = source.read();
    this.before = snapshot.documentBytes;
    const room = snapshot.document.entities.find((r) => r.id === roomId);
    if (!isStructuredRoom(room)) throw new Error("Nativer Raum-Key fehlt.");
    this.room = room;
    this.name = room.name;
    this.number = room.number;
    for (const s of room.key.sections)
      if (s.kind === "markdown") this.markdown.set(s.id, s.markdown);
  }
  get dirty(): boolean {
    return (
      this.name !== this.room.name ||
      this.number !== this.room.number ||
      this.room.key.sections.some(
        (s) => s.kind === "markdown" && this.markdown.get(s.id) !== s.markdown,
      )
    );
  }
  apply(): boolean {
    if (!this.dirty) return false;
    if (this.source.read().documentBytes !== this.before)
      throw new Error(
        "Raum wurde inzwischen geändert. Eingabe bleibt erhalten.",
      );
    const before = parseDocument(this.before);
    const next = {
      ...this.room,
      name: this.name,
      number: this.number,
      key: {
        ...this.room.key,
        sections: this.room.key.sections.map((s) =>
          s.kind === "markdown"
            ? { ...s, markdown: this.markdown.get(s.id)! }
            : s,
        ),
      },
    };
    // Native validation preserves passages, geometry and untouched Markdown instead of normalizing text.
    const after = parseDocument(
      serializeDocument({
        ...before,
        entities: before.entities.map((r) => (r.id === this.roomId ? next : r)),
      }),
    );
    return this.source.history.execute({
      label: "Raum-Key bearbeiten",
      changes: [dungeonDocumentChange(before, after)],
    });
  }
}
