import { type MapDocument, type RoomV4, isStructuredRoom } from "./model";
import { sectionMarkdown } from "./room-key";
import { Session } from "./session";

export interface RoomDocument {
  readonly id: string;
  readonly number: string;
  readonly name: string;
  readonly path: string;
  readonly text: string;
  readonly sections: readonly { id: string; title: string }[];
}

export function stripFeatureBoundaries(markdown: string): string {
  return markdown.replace(/^<!-- dungeon-feature:[^\r\n]+:start -->\r?\n/gm, "")
    .replace(/^\r?\n<!-- dungeon-feature:[^\r\n]+:end -->/gm, "");
}

export function projectedRoomDocuments(doc: MapDocument): RoomDocument[] {
  if (doc.version !== 4) return [];
  const session = new Session(doc);
  return [...session.entities.values()].filter(isStructuredRoom)
    .filter((room) => !!room.key.sourcePath)
    .sort((a, b) => Number(a.number) - Number(b.number))
    .map((room) => ({
      id: room.id,
      number: room.number,
      name: room.name,
      path: room.key.sourcePath!,
      text: `---\nroom_id: "${room.number}"\n---\n` + room.key.sections
        .map((section) => stripFeatureBoundaries(sectionMarkdown(session, section))).join(""),
      sections: room.key.sections.map((section) => ({
        id: section.id,
        title: section.kind === "markdown"
          ? section.markdown.match(/^#{1,6} ([^\r\n]+)/m)?.[1] ?? ""
          : "Durchgang",
      })),
    }));
}

export function roomSectionForAnchor(room: RoomV4, anchor?: string): string | undefined {
  if (!anchor) return room.key.sections[0]?.id;
  const value = anchor.replace(/^\^/, "");
  const block = new RegExp("(?:^|\\s)\\^" + value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "m");
  const section = room.key.sections.find((section) => section.kind === "markdown" &&
    (section.markdown.match(/^#{1,6} ([^\r\n]+)/m)?.[1] === value ||
      block.test(section.markdown)));
  return section?.id;
}
