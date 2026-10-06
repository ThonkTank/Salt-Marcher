import { type Door, type KeySection, type RoomV4, isStructuredRoom, uid } from "./model";
import { passageText } from "./commands";
import { Session } from "./session";
import { featureTextRange } from "./content";

export function structuredRoom(session: Session, roomId: string): RoomV4 {
  const room = session.entities.get(roomId);
  if (!isStructuredRoom(room)) throw new Error("Strukturierter Raum-Key nicht gefunden.");
  return room;
}

export function keySectionUrl(mapId: string, roomId: string, sectionId?: string, vault?: string): string {
  const query = new URLSearchParams({ map: mapId, room: roomId });
  if (sectionId) query.set("section", sectionId);
  if (vault) query.set("vault", vault);
  return "obsidian://dungeon-room?" + query.toString();
}

export function sectionMarkdown(session: Session, section: KeySection): string {
  if (section.kind === "markdown") return section.markdown;
  const door = session.entities.get(section.doorId) ??
    session.content.archive.flatMap((bundle) => bundle.entities)
      .find((entity) => entity.id === section.doorId);
  if (door?.kind !== "door") throw new Error("Durchgang des Key-Abschnitts fehlt.");
  const names: Record<Door["variant"], string> = {
    door: "Tür", window: "Fenster", bars: "Gitter", opening: "Offener Durchgang",
  };
  return "## " + names[door.variant] + "\n" + passageText(door);
}

export function sectionTitle(session: Session, section: KeySection): string {
  const text = sectionMarkdown(session, section);
  return text.match(/^#{1,6}\s+(.+)$/m)?.[1] ?? text.trim().split("\n", 1)[0]?.slice(0, 50) ?? "Abschnitt";
}

function replaceSections(session: Session, room: RoomV4, sections: readonly KeySection[], label: string): void {
  const after: RoomV4 = { ...room, key: { ...room.key, sections } };
  session.execute({ label, entities: [{ id: room.id, before: room, after }] });
}

export function addMarkdownSection(session: Session, roomId: string, afterId?: string): string {
  const room = structuredRoom(session, roomId);
  const section = { id: uid(), kind: "markdown" as const, markdown: "" };
  const sections = [...room.key.sections];
  const index = afterId ? sections.findIndex((item) => item.id === afterId) : sections.length - 1;
  sections.splice(index < 0 ? sections.length : index + 1, 0, section);
  replaceSections(session, room, sections, "Key-Abschnitt anlegen");
  return section.id;
}

export function editMarkdownSection(session: Session, roomId: string, sectionId: string, before: string, after: string): void {
  if (before === after) return;
  const room = structuredRoom(session, roomId);
  const section = room.key.sections.find((item) => item.id === sectionId);
  if (section?.kind !== "markdown" || section.markdown !== before)
    throw new Error("Der Key-Abschnitt wurde zwischenzeitlich geändert.");
  for (const occurrence of session.content.occurrences.filter((item) =>
    item.roomId === roomId && item.sectionId === sectionId))
    featureTextRange(after, occurrence.id);
  replaceSections(session, room, room.key.sections.map((item) =>
    item.id === sectionId ? { ...section, markdown: after } : item), "Key-Abschnitt bearbeiten");
}

export function moveKeySection(session: Session, roomId: string, sectionId: string, step: -1 | 1): void {
  const room = structuredRoom(session, roomId);
  const sections = [...room.key.sections];
  const index = sections.findIndex((item) => item.id === sectionId);
  const target = index + step;
  if (index < 0 || target < 0 || target >= sections.length) return;
  [sections[index], sections[target]] = [sections[target]!, sections[index]!];
  replaceSections(session, room, sections, "Key-Abschnitt verschieben");
}

export function removeMarkdownSection(session: Session, roomId: string, sectionId: string): void {
  const room = structuredRoom(session, roomId);
  const section = room.key.sections.find((item) => item.id === sectionId);
  if (section?.kind !== "markdown") throw new Error("Nur Markdown-Abschnitte können entfernt werden.");
  if (session.content.occurrences.some((item) => item.roomId === roomId && item.sectionId === sectionId))
    throw new Error("Der Abschnitt ist mit einem Feature verknüpft.");
  replaceSections(session, room, room.key.sections.filter((item) => item.id !== sectionId), "Key-Abschnitt entfernen");
}
