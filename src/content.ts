import {
  type ArchivedBundle,
  type DungeonContent,
  type DungeonRoute,
  type Entity,
  type FeatureDefinition,
  type FeatureKind,
  type FeatureOccurrence,
  type Floor,
  type MapObject,
  type Room,
  type RoomV4,
  isRoom,
  isStructuredRoom,
  uid,
} from "./model";
import { Session, textPatch, type RecordChange } from "./session";

export interface FeatureDefinitionInput {
  readonly name: string;
  readonly kind: FeatureKind;
  readonly xp?: number;
  readonly lootValue?: number;
  readonly encounter?: string;
  readonly description?: string;
  readonly reference?: string;
  readonly encounterLink?: string;
}
export interface FeatureOccurrenceInput {
  readonly quantity: number;
  readonly situation?: string;
  readonly reaction?: string;
  readonly markdown?: string;
}
export interface DungeonAnalysis {
  readonly definitions: number;
  readonly occurrences: number;
  readonly totalQuantity: number;
  readonly xp: number;
  readonly lootValue: number;
  readonly encounters: readonly {
    readonly name: string;
    readonly quantity: number;
    readonly xp: number;
  }[];
  readonly bossGoals: readonly DungeonRoute[];
}

function cleanNumber(value: number | undefined): number {
  return value === undefined || !Number.isFinite(value)
    ? 0
    : Math.max(0, value);
}
function letterMarker(index: number): string {
  let value = index,
    marker = "";
  while (value > 0) {
    value--;
    marker = String.fromCharCode(65 + (value % 26)) + marker;
    value = Math.floor(value / 26);
  }
  return marker;
}
function markerOrdinal(marker: string): number {
  if (!/^[A-Z]+$/.test(marker)) return 0;
  return [...marker].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
}
function nextStructuredMarker(room: RoomV4, content: DungeonContent): [string, number] {
  const creatureMarkers = new Set(content.occurrences.filter((item) =>
    content.definitions.find((definition) => definition.id === item.definitionId)?.kind === "creature")
    .map((item) => item.marker));
  const headings = room.key.sections.flatMap((section) =>
    section.kind === "markdown"
      ? [...section.markdown.matchAll(/^#{1,6}\s+([A-Z]+)\s*·/gm)]
          .map((match) => match[1]!).filter((marker) => !creatureMarkers.has(marker))
      : []);
  const assigned = content.occurrences.filter((item) => item.roomId === room.id &&
    content.definitions.find((definition) => definition.id === item.definitionId)?.kind !== "creature")
    .map((item) => item.marker);
  const next = Math.max(room.key.nextFeatureOrdinal ?? 1,
    ...[...headings, ...assigned].map((marker) => markerOrdinal(marker) + 1));
  return [letterMarker(next), next + 1];
}
export function featureTextStart(id: string): string {
  return `<!-- dungeon-feature:${id}:start -->`;
}
export function featureTextEnd(id: string): string {
  return `<!-- dungeon-feature:${id}:end -->`;
}
function featureSegment(id: string, markdown: string): string {
  if (markdown.includes(featureTextStart(id)) || markdown.includes(featureTextEnd(id)))
    throw new Error("Der Featuretext enthält eine interne Kennung.");
  return `${featureTextStart(id)}\n${markdown}\n${featureTextEnd(id)}`;
}
export function featureTextRange(markdown: string, id: string): [number, number] {
  const start = featureTextStart(id) + "\n", end = "\n" + featureTextEnd(id),
    begin = markdown.indexOf(start), finish = markdown.indexOf(end, begin + start.length);
  if (begin < 0 || finish < 0 || markdown.indexOf(start, begin + start.length) >= 0 ||
      markdown.indexOf(end, finish + end.length) >= 0)
    throw new Error("Die Featuretext-Grenzen fehlen oder sind mehrfach vorhanden.");
  return [begin + start.length, finish];
}
export function structuredFeatureText(session: Session, occurrence: FeatureOccurrence): string {
  const room = session.entities.get(occurrence.roomId);
  if (!isStructuredRoom(room)) throw new Error("Strukturierter Raum fehlt.");
  const section = room.key.sections.find((item) => item.id === occurrence.sectionId);
  if (section?.kind !== "markdown") throw new Error("Feature-Abschnitt fehlt.");
  const [start, end] = featureTextRange(section.markdown, occurrence.id);
  return section.markdown.slice(start, end);
}
function nextFeatureMarker(content: DungeonContent, roomId: string): string {
  const definitions = new Map(
      content.definitions.map((definition) => [definition.id, definition]),
    ),
    used = new Set(
      content.occurrences
        .filter(
          (occurrence) =>
            occurrence.roomId === roomId &&
            definitions.get(occurrence.definitionId)?.kind !== "creature",
        )
        .map((occurrence) => occurrence.marker.toUpperCase())
        .filter((marker) => /^[A-Z]+$/.test(marker)),
    );
  let index = 1;
  while (used.has(letterMarker(index))) index++;
  return letterMarker(index);
}
function creatureMarker(
  content: DungeonContent,
  definition: FeatureDefinition,
): string {
  const existing = content.occurrences.find(
    (occurrence) => occurrence.definitionId === definition.id,
  )?.marker;
  if (existing) return existing;
  const words = definition.name.toLocaleUpperCase("de-DE").match(/\p{L}+/gu) ?? [],
    compact = words.join(""),
    preferred =
      words.length > 1
        ? words
            .slice(0, 2)
            .map((word) => word[0])
            .join("")
        : compact.slice(0, 2),
    creatureDefinitions = new Set(
      content.definitions
        .filter((candidate) => candidate.kind === "creature")
        .map((candidate) => candidate.id),
    ),
    used = new Set(
      content.occurrences
        .filter(
          (occurrence) =>
            occurrence.definitionId !== definition.id &&
            creatureDefinitions.has(occurrence.definitionId),
        )
        .map((occurrence) => occurrence.marker.toUpperCase()),
    ),
    candidates = [
      preferred,
      ...Array.from({ length: Math.max(0, compact.length - 1) }, (_, index) =>
        (compact[0] ?? "K") + compact[index + 1],
      ),
      ...Array.from({ length: 26 }, (_, index) =>
        (compact[0] ?? "K") + String.fromCharCode(65 + index),
      ),
    ].filter((marker) => /^[A-ZÄÖÜ]{1,2}$/.test(marker));
  return candidates.find((marker) => !used.has(marker)) ?? "KR";
}
function nextMarker(
  content: DungeonContent,
  roomId: string,
  definition: FeatureDefinition,
): string {
  if (definition.kind === "creature")
    return creatureMarker(content, definition);
  return nextFeatureMarker(content, roomId);
}
function appendHeading(current: string, heading: string): string {
  const separator = current.endsWith("\n\n")
    ? ""
    : current.endsWith("\n")
      ? "\n"
      : "\n\n";
  return current + separator + heading + "\n\n";
}
function sentence(value: string): string {
  const trimmed = value.trim();
  return !trimmed || /[.!?]$/.test(trimmed) ? trimmed : trimmed + ".";
}
function optional(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
function featureBlock(
  occurrence: FeatureOccurrence,
  definition: FeatureDefinition,
): string {
  const parts = [
    definition.description ? sentence(definition.description) : "",
    definition.kind === "creature"
      ? `Besetzung: ${occurrence.quantity}× ${definition.name}.`
      : `Menge: ${occurrence.quantity}.`,
    definition.xp || definition.lootValue
      ? `Auswertung: ${[
          definition.xp
            ? `${(definition.xp * occurrence.quantity).toLocaleString("de-DE")} XP`
            : "",
          definition.lootValue
            ? `Beutewert ${(definition.lootValue * occurrence.quantity).toLocaleString("de-DE")}`
            : "",
        ]
          .filter(Boolean)
          .join(", ")}.`
      : "",
    occurrence.situation
      ? `Aktuelle Situation: ${sentence(occurrence.situation)}`
      : "",
    occurrence.reaction ? `Reaktion: ${sentence(occurrence.reaction)}` : "",
    definition.reference ? `Regeln: ${sentence(definition.reference)}` : "",
    definition.encounter
      ? `Encounter: ${definition.encounter}${
          definition.encounterLink ? ` (${definition.encounterLink})` : ""
        }.`
      : definition.encounterLink
        ? `Encounter: ${sentence(definition.encounterLink)}`
        : "",
  ].filter(Boolean);
  return (
    `<!-- dungeon-feature:${occurrence.id}:start -->\n` +
    parts.join(" ") +
    `\n<!-- dungeon-feature:${occurrence.id}:end -->`
  );
}
function replaceFeatureBlock(
  current: string,
  occurrence: FeatureOccurrence,
  definition: FeatureDefinition,
): string {
  const anchorName = occurrence.note?.anchor;
  if (!anchorName) throw new Error("Der Feature-Anker fehlt im Raum-Key.");
  const blockAnchor = `^${anchorName}`,
    existingBlockAt = current.indexOf(blockAnchor),
    headingMatch =
      existingBlockAt < 0
        ? current.match(
            new RegExp(
              `^#{1,6}\\s+${anchorName.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&",
              )}\\s*$`,
              "m",
            ),
          )
        : null,
    anchor = existingBlockAt >= 0 ? blockAnchor : anchorName,
    anchorAt =
      existingBlockAt >= 0
        ? existingBlockAt
        : headingMatch?.index === undefined
          ? -1
          : headingMatch.index + headingMatch[0].indexOf(anchor),
    heading = `## ${occurrence.marker} · ${definition.name} ${blockAnchor}`;
  if (anchorAt < 0) throw new Error("Der Feature-Anker fehlt im Raum-Key.");
  const lineStart = current.lastIndexOf("\n", anchorAt) + 1,
    lineEnd = current.indexOf("\n", anchorAt),
    anchorLine = current.slice(
      lineStart,
      lineEnd < 0 ? current.length : lineEnd,
    ),
    editorHeading = anchor === blockAnchor && anchorLine.startsWith("## "),
    withHeading = editorHeading
      ? current.slice(0, lineStart) +
        heading +
        current.slice(lineEnd < 0 ? current.length : lineEnd)
      : current,
    start = `<!-- dungeon-feature:${occurrence.id}:start -->`,
    end = `<!-- dungeon-feature:${occurrence.id}:end -->`,
    startAt = withHeading.indexOf(start),
    endAt = withHeading.indexOf(end, startAt + start.length),
    block = featureBlock(occurrence, definition);
  if (startAt >= 0 && endAt >= 0)
    return (
      withHeading.slice(0, startAt) +
      block +
      withHeading.slice(endAt + end.length)
    );

  const
    updatedAnchorAt = withHeading.indexOf(anchor),
    updatedLineEnd = withHeading.indexOf("\n", updatedAnchorAt);
  return (
    withHeading.slice(
      0,
      updatedLineEnd < 0 ? withHeading.length : updatedLineEnd + 1,
    ) +
    "\n" +
    block +
    "\n" +
    (updatedLineEnd < 0 ? "" : withHeading.slice(updatedLineEnd + 1))
  );
}
function occurrenceTextPatches(
  session: Session,
  occurrences: readonly FeatureOccurrence[],
  definitions: ReadonlyMap<string, FeatureDefinition>,
): ReturnType<typeof textPatch>[] {
  const byPath = new Map<string, FeatureOccurrence[]>();
  for (const occurrence of occurrences) {
    if (!occurrence.note) throw new Error("V4-Featuretexte werden in Phase 5 bearbeitet.");
    byPath.set(occurrence.note.path, [
      ...(byPath.get(occurrence.note.path) ?? []),
      occurrence,
    ]);
  }
  return [...byPath].map(([path, values]) => {
    const before = session.note(path);
    if (before === undefined || before === null)
      throw new Error("Raum-Key zuerst laden: " + path);
    let after = before;
    for (const occurrence of values) {
      const definition = definitions.get(occurrence.definitionId);
      if (!definition) throw new Error("Feature-Definition nicht gefunden.");
      after = replaceFeatureBlock(after, occurrence, definition);
    }
    return textPatch(path, before, after);
  });
}
function center(room: Room): { x: number; y: number } {
  const points = room.polygons.flatMap((polygon) => polygon.outer);
  return {
    x:
      points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y:
      points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}
function replaceContent(
  session: Session,
  label: string,
  after: DungeonContent,
  entities: readonly {
    id: string;
    before: Entity | null;
    after: Entity | null;
  }[] = [],
  texts: ReturnType<typeof textPatch>[] = [],
  floors: readonly RecordChange<Floor>[] = [],
): void {
  session.execute({
    label,
    content: { before: session.content, after },
    entities,
    texts,
    floors,
    affectsRules: true,
  });
}

export function createFeatureDefinition(
  session: Session,
  input: FeatureDefinitionInput,
): FeatureDefinition {
  const definition: FeatureDefinition = {
    id: uid(),
    name: input.name.trim(),
    kind: input.kind,
    xp: cleanNumber(input.xp),
    lootValue: cleanNumber(input.lootValue),
    ...(input.encounter?.trim() ? { encounter: input.encounter.trim() } : {}),
    ...(session.version === 3 && optional(input.description)
      ? { description: optional(input.description) }
      : {}),
    ...(optional(input.reference)
      ? { reference: optional(input.reference) }
      : {}),
    ...(optional(input.encounterLink)
      ? { encounterLink: optional(input.encounterLink) }
      : {}),
  };
  replaceContent(session, "Feature-Definition anlegen", {
    ...session.content,
    definitions: [...session.content.definitions, definition],
  });
  return definition;
}

export function updateFeatureDefinition(
  session: Session,
  id: string,
  input: FeatureDefinitionInput,
): FeatureDefinition {
  const before = session.content.definitions.find((value) => value.id === id);
  if (!before) throw new Error("Feature-Definition nicht gefunden.");
  const after: FeatureDefinition = {
    ...before,
    name: input.name.trim(),
    kind: input.kind,
    xp: cleanNumber(input.xp),
    lootValue: cleanNumber(input.lootValue),
    ...(input.encounter?.trim()
      ? { encounter: input.encounter.trim() }
      : { encounter: undefined }),
    description: session.version === 3 ? optional(input.description) : before.description,
    reference: optional(input.reference),
    encounterLink: optional(input.encounterLink),
  };
  const content = {
      ...session.content,
      definitions: session.content.definitions.map((value) =>
        value.id === id ? after : value,
      ),
    },
    definitions = new Map(
      content.definitions.map((value) => [value.id, value]),
    ),
    affected = content.occurrences.filter((value) => value.definitionId === id);
  replaceContent(
    session,
    "Feature-Definition bearbeiten",
    content,
    [],
    session.version === 3 ? occurrenceTextPatches(session, affected, definitions) : [],
  );
  return after;
}

export function createFeatureOccurrence(
  session: Session,
  definitionId: string,
  roomId: string,
  quantity = 1,
  entityId?: string,
  details: Omit<FeatureOccurrenceInput, "quantity"> = {},
  keyInput?: { readonly markdown: string; readonly sectionId?: string },
): FeatureOccurrence {
  const definition = session.content.definitions.find(
      (value) => value.id === definitionId,
    ),
    room = session.entities.get(roomId);
  if (!definition) throw new Error("Feature-Definition nicht gefunden.");
  if (!isRoom(room)) throw new Error("Raum nicht gefunden.");
  if (!Number.isInteger(quantity) || quantity <= 0)
    throw new Error("Die Menge muss eine positive ganze Zahl sein.");
  if (isStructuredRoom(room)) {
    if (!keyInput) throw new Error("V4-Featuretext fehlt.");
    const id = uid(),
      [marker, nextFeatureOrdinal] = definition.kind === "creature"
        ? [creatureMarker(session.content, definition), room.key.nextFeatureOrdinal]
        : nextStructuredMarker(room, session.content),
      emptyInitial = !keyInput.sectionId && room.key.sections.length === 1 &&
        room.key.sections[0]?.kind === "markdown" &&
        room.key.sections[0].markdown === "" &&
        !session.content.occurrences.some((item) => item.roomId === room.id),
      existing = keyInput.sectionId
        ? room.key.sections.find((section) => section.id === keyInput.sectionId)
        : emptyInitial ? room.key.sections[0] : undefined;
    if (keyInput.sectionId && existing?.kind !== "markdown")
      throw new Error("Gewählter Raumabschnitt fehlt.");
    const sectionId = existing?.id ?? uid(),
      section = existing?.kind === "markdown" && !emptyInitial
        ? { ...existing, markdown: existing.markdown +
            (existing.markdown.endsWith("\n") || !existing.markdown ? "" : "\n") +
            `**${marker} · ${definition.name}:**\n` + featureSegment(id, keyInput.markdown) }
        : { id: sectionId, kind: "markdown" as const,
            markdown: `## ${marker} · ${definition.name}:\n` + featureSegment(id, keyInput.markdown) },
      afterRoom: RoomV4 = { ...room, key: {
        ...room.key,
        ...(nextFeatureOrdinal !== undefined ? { nextFeatureOrdinal } : {}),
        sections: existing
          ? room.key.sections.map((item) => item.id === sectionId ? section : item)
          : [...room.key.sections, section],
      } },
      changes: RecordChange<Entity>[] = [{ id: room.id, before: room, after: afterRoom }];
    let linked = entityId;
    if (linked) {
      const object = session.entities.get(linked);
      if (object?.kind !== "object" || object.floorId !== room.floorId || object.roomId !== room.id)
        throw new Error("Das ausgewählte Kartenobjekt liegt nicht im Raum.");
      if (session.content.occurrences.some((item) => item.entityId === linked))
        throw new Error("Das Kartenobjekt besitzt bereits ein Feature.");
    } else {
      const position = center(room), object: MapObject = {
        id: uid(), kind: "object", floorId: room.floorId, roomId: room.id,
        x: position.x, y: position.y, rotation: 0, width: 0.8, height: 0.8,
        color: 0xf3efe4, label: "",
      };
      linked = object.id;
      changes.push({ id: object.id, before: null, after: object });
    }
    const occurrence: FeatureOccurrence = {
      id, definitionId, roomId: room.id, entityId: linked, marker, quantity, sectionId,
    };
    replaceContent(session, "Feature-Vorkommen anlegen", {
      ...session.content, occurrences: [...session.content.occurrences, occurrence],
    }, changes);
    return occurrence;
  }
  if (!room.note) throw new Error("V4-Features werden in Phase 5 angelegt.");
  const current = session.note(room.note.path);
  if (current === undefined)
    throw new Error("Raum-Key muss vor dem Verknüpfen geladen werden.");
  if (current === null) throw new Error("Raum-Key fehlt.");
  const id = uid(),
    marker = nextMarker(session.content, room.id, definition),
    anchor = "feature-" + id,
    occurrence: FeatureOccurrence = {
      id,
      definitionId,
      roomId: room.id,
      marker,
      quantity,
      note: { path: room.note.path, anchor },
      ...(optional(details.situation)
        ? { situation: optional(details.situation) }
        : {}),
      ...(optional(details.reaction)
        ? { reaction: optional(details.reaction) }
        : {}),
    },
    changes: { id: string; before: Entity | null; after: Entity | null }[] = [];
  if (entityId) {
    const entity = session.entities.get(entityId);
    if (!entity || entity.floorId !== room.floorId)
      throw new Error("Kartenobjekt und Raum liegen nicht im selben Geschoss.");
    (occurrence as { entityId?: string }).entityId = entity.id;
  } else {
    const position = center(room),
      markerEntity: MapObject = {
        id: uid(),
        kind: "object",
        floorId: room.floorId,
        roomId: room.id,
        x: position.x,
        y: position.y,
        rotation: 0,
        width: 0.8,
        height: 0.8,
        color: 0xf3efe4,
        label: marker,
        note: occurrence.note,
      };
    (occurrence as { entityId?: string }).entityId = markerEntity.id;
    changes.push({ id: markerEntity.id, before: null, after: markerEntity });
  }
  const nextText = appendHeading(
    current,
    `## ${marker} · ${definition.name} ^${anchor}\n\n${featureBlock(occurrence, definition)}`,
  );
  replaceContent(
    session,
    "Feature-Vorkommen anlegen",
    {
      ...session.content,
      occurrences: [...session.content.occurrences, occurrence],
    },
    changes,
    [textPatch(room.note.path, current, nextText)],
  );
  return occurrence;
}

export function updateFeatureQuantity(
  session: Session,
  id: string,
  quantity: number,
): FeatureOccurrence {
  if (!Number.isInteger(quantity) || quantity <= 0)
    throw new Error("Die Menge muss eine positive ganze Zahl sein.");
  const before = session.content.occurrences.find((value) => value.id === id);
  if (!before) throw new Error("Feature-Vorkommen nicht gefunden.");
  const after = { ...before, quantity },
    content = {
      ...session.content,
      occurrences: session.content.occurrences.map((value) =>
        value.id === id ? after : value,
      ),
    };
  replaceContent(
    session,
    "Feature-Menge ändern",
    content,
    [],
    session.version === 3 ? occurrenceTextPatches(
      session, [after],
      new Map(content.definitions.map((value) => [value.id, value])),
    ) : [],
  );
  return after;
}

export function updateFeatureOccurrence(
  session: Session,
  id: string,
  input: FeatureOccurrenceInput,
): FeatureOccurrence {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0)
    throw new Error("Die Menge muss eine positive ganze Zahl sein.");
  const before = session.content.occurrences.find((value) => value.id === id);
  if (!before) throw new Error("Feature-Vorkommen nicht gefunden.");
  if (session.version === 4) {
    const room = session.entities.get(before.roomId);
    if (!isStructuredRoom(room)) throw new Error("Strukturierter Raum fehlt.");
    const section = room.key.sections.find((item) => item.id === before.sectionId);
    if (section?.kind !== "markdown") throw new Error("Feature-Abschnitt fehlt.");
    const [start, end] = featureTextRange(section.markdown, before.id);
    const markdown = input.markdown ?? section.markdown.slice(start, end);
    const afterSection = { ...section,
      markdown: section.markdown.slice(0, start) + markdown + section.markdown.slice(end) };
    const afterRoom: RoomV4 = { ...room, key: { ...room.key, sections:
      room.key.sections.map((item) => item.id === section.id ? afterSection : item) } };
    const after: FeatureOccurrence = { ...before, quantity: input.quantity };
    replaceContent(session, "Feature-Vorkommen bearbeiten", {
      ...session.content,
      occurrences: session.content.occurrences.map((item) => item.id === id ? after : item),
    }, [{ id: room.id, before: room, after: afterRoom }]);
    return after;
  }
  const after: FeatureOccurrence = {
      ...before,
      quantity: input.quantity,
      situation: optional(input.situation),
      reaction: optional(input.reaction),
    },
    content = {
      ...session.content,
      occurrences: session.content.occurrences.map((value) =>
        value.id === id ? after : value,
      ),
    };
  replaceContent(
    session,
    "Feature-Vorkommen bearbeiten",
    content,
    [],
    occurrenceTextPatches(
      session,
      [after],
      new Map(content.definitions.map((value) => [value.id, value])),
    ),
  );
  return after;
}

export function executeLinkedObjectChanges(
  session: Session,
  label: string,
  entityChanges: readonly RecordChange<Entity>[],
): void {
  if (session.version !== 4) {
    session.execute({ label, entities: entityChanges });
    return;
  }
  const changes = new Map(entityChanges.map((change) => [change.id, change]));
  const rooms = new Map<string, RoomV4>();
  const currentRoom = (id: string): RoomV4 => {
    const entity = rooms.get(id) ?? changes.get(id)?.after ?? session.entities.get(id);
    if (!isStructuredRoom(entity)) throw new Error("Strukturierter Zielraum fehlt.");
    return entity;
  };
  const setRoom = (room: RoomV4): void => { rooms.set(room.id, room); };
  let occurrences = [...session.content.occurrences];
  for (const change of entityChanges) {
    const before = change.before, after = change.after;
    if (before?.kind !== "object" || after?.kind !== "object" ||
        before.roomId === after.roomId) continue;
    const linked = occurrences.find((item) => item.entityId === before.id);
    if (!linked) continue;
    if (!after.roomId) throw new Error("Ein verknüpftes Feature benötigt einen Zielraum.");
    const source = currentRoom(linked.roomId), target = currentRoom(after.roomId);
    const definition = session.content.definitions.find((item) => item.id === linked.definitionId);
    if (!definition) throw new Error("Feature-Definition fehlt.");
    const section = source.key.sections.find((item) => item.id === linked.sectionId);
    if (section?.kind !== "markdown") throw new Error("Feature-Abschnitt fehlt.");
    const [start, end] = featureTextRange(section.markdown, linked.id);
    const description = section.markdown.slice(start, end);
    const [marker, nextFeatureOrdinal] = definition.kind === "creature"
      ? [creatureMarker(session.content, definition), target.key.nextFeatureOrdinal]
      : nextStructuredMarker(target, { ...session.content, occurrences });
    const shared = session.content.occurrences.some((item) => item.id !== linked.id &&
      item.roomId === source.id && item.sectionId === section.id);
    let sectionId = section.id;
    if (shared) {
      const old = section.markdown;
      const preserved = old.slice(0, start - featureTextStart(linked.id).length - 1) +
        description + old.slice(end + 1 + featureTextEnd(linked.id).length);
      setRoom({ ...source, key: { ...source.key, sections: source.key.sections.map((item) =>
        item.id === section.id ? { ...section, markdown: preserved } : item) } });
      sectionId = uid();
      const copy = { id: sectionId, kind: "markdown" as const,
        markdown: `## ${marker} · ${definition.name}:\n` + featureSegment(linked.id, description) };
      setRoom({ ...target, key: { ...target.key,
        ...(nextFeatureOrdinal !== undefined ? { nextFeatureOrdinal } : {}),
        sections: [...target.key.sections, copy] } });
    } else {
      const heading = new RegExp(`^(##\\s+)${linked.marker}(\\s*·)`, "m");
      if (!heading.test(section.markdown))
        throw new Error("Die Feature-Kennzeichnung im Abschnitt fehlt.");
      const moved = { ...section, markdown: section.markdown.replace(heading, `$1${marker}$2`) };
      setRoom({ ...source, key: { ...source.key,
        sections: source.key.sections.filter((item) => item.id !== section.id) } });
      setRoom({ ...target, key: { ...target.key,
        ...(nextFeatureOrdinal !== undefined ? { nextFeatureOrdinal } : {}),
        sections: [...target.key.sections, moved] } });
    }
    occurrences = occurrences.map((item) => item.id === linked.id
      ? { ...item, roomId: target.id, marker, sectionId } : item);
  }
  for (const room of rooms.values())
    changes.set(room.id, { id: room.id, before: session.entities.get(room.id)!, after: room });
  session.execute({ label, entities: [...changes.values()],
    ...(rooms.size ? { content: { before: session.content,
      after: { ...session.content, occurrences } } } : {}) });
}

export function createRoute(
  session: Session,
  input: Omit<DungeonRoute, "id">,
): DungeonRoute {
  const route: DungeonRoute = {
    ...input,
    id: uid(),
    name: input.name.trim(),
    prerequisites: input.prerequisites
      .map((value) => value.trim())
      .filter(Boolean),
  };
  replaceContent(session, "Eingang oder Weg anlegen", {
    ...session.content,
    routes: [...session.content.routes, route],
  });
  return route;
}

export function updateRoute(
  session: Session,
  id: string,
  input: Omit<DungeonRoute, "id">,
): DungeonRoute {
  const before = session.content.routes.find((value) => value.id === id);
  if (!before) throw new Error("Eingang oder Weg nicht gefunden.");
  const after: DungeonRoute = {
    ...input,
    id,
    name: input.name.trim(),
    prerequisites: input.prerequisites
      .map((value) => value.trim())
      .filter(Boolean),
  };
  replaceContent(session, "Eingang oder Weg bearbeiten", {
    ...session.content,
    routes: session.content.routes.map((value) =>
      value.id === id ? after : value,
    ),
  });
  return after;
}

function bundleEntities(
  session: Session,
  occurrences: readonly FeatureOccurrence[],
): Entity[] {
  const occurrenceIds = new Set(occurrences.map((value) => value.id)),
    entityIds = new Set(
      occurrences.map((value) => value.entityId).filter(Boolean),
    ),
    result: Entity[] = [];
  for (const entity of session.entities.values()) {
    if (
      entityIds.has(entity.id) &&
      !isRoom(entity) &&
      session.dependents(entity.id).size === 0 &&
      session.content.occurrences.every(
        (value) => value.entityId !== entity.id || occurrenceIds.has(value.id),
      )
    )
      result.push(entity);
  }
  return result;
}
function positions<T extends { readonly id: string }>(
  all: readonly T[],
  selected: readonly T[],
): number[] {
  const byId = new Map(all.map((value, index) => [value.id, index]));
  return selected.map((value) => byId.get(value.id)!);
}
function insertAtOriginalPositions<T>(
  current: readonly T[],
  archived: readonly T[],
  archivedPositions: readonly number[],
): T[] {
  const result = [...current];
  archived
    .map((value, order) => ({
      value,
      position: archivedPositions[order]!,
      order,
    }))
    .sort((a, b) => a.position - b.position || a.order - b.order)
    .forEach(({ value, position }) =>
      result.splice(Math.min(position, result.length), 0, value),
    );
  return result;
}
function archive(
  session: Session,
  label: string,
  definitions: readonly FeatureDefinition[],
  occurrences: readonly FeatureOccurrence[],
  routes: readonly DungeonRoute[],
): ArchivedBundle {
  const entities = bundleEntities(session, occurrences),
    entityIds = new Set(entities.map((value) => value.id)),
    definitionIds = new Set(definitions.map((value) => value.id)),
    occurrenceIds = new Set(occurrences.map((value) => value.id)),
    routeIds = new Set(routes.map((value) => value.id)),
    bundle: ArchivedBundle = {
      id: uid(),
      label,
      archivedAt: new Date().toISOString(),
      floors: [],
      floorPositions: [],
      definitions,
      definitionPositions: positions(session.content.definitions, definitions),
      occurrences,
      occurrencePositions: positions(session.content.occurrences, occurrences),
      routes,
      routePositions: positions(session.content.routes, routes),
      entities,
      entityPositions: positions([...session.entities.values()], entities),
    };
  replaceContent(
    session,
    "Inhalte archivieren",
    {
      definitions: session.content.definitions.filter(
        (value) => !definitionIds.has(value.id),
      ),
      occurrences: session.content.occurrences.filter(
        (value) => !occurrenceIds.has(value.id),
      ),
      routes: session.content.routes.filter((value) => !routeIds.has(value.id)),
      archive: [...session.content.archive, bundle],
    },
    entities.map((entity) => ({
      id: entity.id,
      before: entity,
      after: null,
    })),
  );
  return bundle;
}

export function archiveOccurrence(
  session: Session,
  id: string,
): ArchivedBundle {
  const occurrence = session.content.occurrences.find(
    (value) => value.id === id,
  );
  if (!occurrence) throw new Error("Feature-Vorkommen nicht gefunden.");
  const definition = session.content.definitions.find(
    (value) => value.id === occurrence.definitionId,
  )!;
  const shared = session.content.occurrences.some(
    (value) => value.id !== id && value.definitionId === definition.id,
  );
  return archive(
    session,
    `${definition.name} in Raum ${occurrence.marker}`,
    shared ? [] : [definition],
    [occurrence],
    [],
  );
}

export function archiveDefinition(
  session: Session,
  id: string,
): ArchivedBundle {
  const definition = session.content.definitions.find(
    (value) => value.id === id,
  );
  if (!definition) throw new Error("Feature-Definition nicht gefunden.");
  const occurrences = session.content.occurrences.filter(
    (value) => value.definitionId === id,
  );
  return archive(session, definition.name, [definition], occurrences, []);
}

export function archiveRoute(session: Session, id: string): ArchivedBundle {
  const route = session.content.routes.find((value) => value.id === id);
  if (!route) throw new Error("Eingang oder Weg nicht gefunden.");
  return archive(session, route.name, [], [], [route]);
}

function archiveEntitySet(
  session: Session,
  entityIds: ReadonlySet<string>,
  label: string,
  floors: readonly Floor[] = [],
): ArchivedBundle {
  const entities = [...session.entities.values()].filter((entity) =>
      entityIds.has(entity.id),
    ),
    roomIds = new Set(
      entities
        .filter(isRoom)
        .map((entity) => entity.id),
    ),
    occurrences = session.content.occurrences.filter(
      (occurrence) =>
        roomIds.has(occurrence.roomId) ||
        (!!occurrence.entityId && entityIds.has(occurrence.entityId)),
    ),
    occurrenceIds = new Set(occurrences.map((occurrence) => occurrence.id)),
    routes = session.content.routes.filter(
      (route) =>
        roomIds.has(route.toRoomId) ||
        (!!route.fromRoomId && roomIds.has(route.fromRoomId)),
    ),
    routeIds = new Set(routes.map((route) => route.id)),
    remainingOccurrences = session.content.occurrences.filter(
      (occurrence) => !occurrenceIds.has(occurrence.id),
    ),
    usedDefinitions = new Set(
      remainingOccurrences.map((occurrence) => occurrence.definitionId),
    ),
    affectedDefinitions = new Set(
      occurrences.map((occurrence) => occurrence.definitionId),
    ),
    definitions = session.content.definitions.filter(
      (definition) =>
        affectedDefinitions.has(definition.id) &&
        !usedDefinitions.has(definition.id),
    ),
    definitionIds = new Set(definitions.map((definition) => definition.id));
  const bundle: ArchivedBundle = {
    id: uid(),
    label,
    archivedAt: new Date().toISOString(),
    floors,
    floorPositions: positions([...session.floors.values()], floors),
    definitions,
    definitionPositions: positions(session.content.definitions, definitions),
    occurrences,
    occurrencePositions: positions(session.content.occurrences, occurrences),
    routes,
    routePositions: positions(session.content.routes, routes),
    entities,
    entityPositions: positions([...session.entities.values()], entities),
  };
  replaceContent(
    session,
    "Auswahl archivieren",
    {
      definitions: session.content.definitions.filter(
        (definition) => !definitionIds.has(definition.id),
      ),
      occurrences: remainingOccurrences,
      routes: session.content.routes.filter((route) => !routeIds.has(route.id)),
      archive: [...session.content.archive, bundle],
    },
    entities.map((entity) => ({ id: entity.id, before: entity, after: null })),
    [],
    floors.map((floor) => ({ id: floor.id, before: floor, after: null })),
  );
  return bundle;
}

export function archiveEntities(
  session: Session,
  ids: readonly string[],
): ArchivedBundle {
  const entityIds = new Set<string>(),
    queue = [...ids];
  while (queue.length) {
    const id = queue.pop()!;
    if (entityIds.has(id)) continue;
    const entity = session.entities.get(id);
    if (!entity) continue;
    entityIds.add(id);
    for (const dependent of session.dependents(id)) queue.push(dependent);
  }
  if (!entityIds.size)
    throw new Error("Die Auswahl enthält keine Kartenobjekte.");
  return archiveEntitySet(
    session,
    entityIds,
    entityIds.size === 1
      ? "Kartenobjekt archiviert"
      : `${entityIds.size} Kartenobjekte archiviert`,
  );
}

export function archiveFloor(session: Session, id: string): ArchivedBundle {
  const floor = session.floors.get(id);
  if (!floor) throw new Error("Geschoss nicht gefunden.");
  if (session.floors.size <= 1)
    throw new Error("Mindestens ein Geschoss bleibt erforderlich.");
  const entityIds = new Set(
    [...session.entities.values()]
      .filter((entity) => entity.floorId === floor.id)
      .map((entity) => entity.id),
  );
  return archiveEntitySet(session, entityIds, `Geschoss ${floor.name}`, [
    floor,
  ]);
}

export function restoreArchive(session: Session, id: string): void {
  const bundle = session.content.archive.find((value) => value.id === id);
  if (!bundle) throw new Error("Archiveintrag nicht gefunden.");
  const same = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b),
    definitions = [...session.content.definitions],
    occurrences = [...session.content.occurrences],
    routes = [...session.content.routes],
    entityChanges: RecordChange<Entity>[] = [],
    floorChanges: RecordChange<Floor>[] = [];
  for (const [index, floor] of bundle.floors.entries()) {
    const existing = session.floors.get(floor.id);
    if (existing && !same(existing, floor))
      throw new Error(
        "Geschosskennung wurde seit der Archivierung neu belegt.",
      );
    if (!existing)
      floorChanges.push({
        id: floor.id,
        before: null,
        after: floor,
        afterIndex: bundle.floorPositions[index],
      });
  }
  for (const definition of bundle.definitions) {
    const existing = definitions.find((value) => value.id === definition.id);
    if (existing && !same(existing, definition))
      throw new Error("Definition wurde seit der Archivierung neu belegt.");
  }
  for (const [index, entity] of bundle.entities.entries()) {
    const existing = session.entities.get(entity.id);
    if (existing && !same(existing, entity))
      throw new Error("Kartenkennung wurde seit der Archivierung neu belegt.");
    if (!existing)
      entityChanges.push({
        id: entity.id,
        before: null,
        after: entity,
        afterIndex: bundle.entityPositions[index],
      });
  }
  for (const occurrence of bundle.occurrences) {
    if (occurrences.some((value) => value.id === occurrence.id))
      throw new Error("Vorkommen ist bereits aktiv.");
  }
  for (const route of bundle.routes) {
    if (routes.some((value) => value.id === route.id))
      throw new Error("Weg ist bereits aktiv.");
  }
  replaceContent(
    session,
    "Archivierte Inhalte wiederherstellen",
    {
      definitions: insertAtOriginalPositions(
        definitions,
        bundle.definitions,
        bundle.definitionPositions,
      ),
      occurrences: insertAtOriginalPositions(
        occurrences,
        bundle.occurrences,
        bundle.occurrencePositions,
      ),
      routes: insertAtOriginalPositions(
        routes,
        bundle.routes,
        bundle.routePositions,
      ),
      archive: session.content.archive.filter((value) => value.id !== id),
    },
    entityChanges,
    [],
    floorChanges,
  );
}

export function analyzeDungeon(content: DungeonContent): DungeonAnalysis {
  const definitions = new Map(
      content.definitions.map((value) => [value.id, value]),
    ),
    encounterTotals = new Map<string, { quantity: number; xp: number }>();
  let totalQuantity = 0,
    xp = 0,
    lootValue = 0;
  for (const occurrence of content.occurrences) {
    const definition = definitions.get(occurrence.definitionId);
    if (!definition) continue;
    totalQuantity += occurrence.quantity;
    xp += definition.xp * occurrence.quantity;
    lootValue += definition.lootValue * occurrence.quantity;
    if (definition.encounter) {
      const total = encounterTotals.get(definition.encounter) ?? {
        quantity: 0,
        xp: 0,
      };
      total.quantity += occurrence.quantity;
      total.xp += definition.xp * occurrence.quantity;
      encounterTotals.set(definition.encounter, total);
    }
  }
  return {
    definitions: content.definitions.length,
    occurrences: content.occurrences.length,
    totalQuantity,
    xp,
    lootValue,
    encounters: [...encounterTotals]
      .map(([name, total]) => ({ name, ...total }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    bossGoals: content.routes
      .filter((route) => route.bossGoalOrder !== undefined)
      .sort((a, b) => a.bossGoalOrder! - b.bossGoalOrder!),
  };
}
