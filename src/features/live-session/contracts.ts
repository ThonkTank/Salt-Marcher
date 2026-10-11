import {
  campaignId,
  characterId,
  commandId,
  generationId,
  liveSceneId,
  maskId,
  ownerId,
  preparationId,
  referenceId,
  revision,
  type CampaignId,
  type CharacterId,
  type CommandId,
  type GenerationId,
  type LiveSceneId,
  type MaskId,
  type OwnerId,
  type PreparationId,
  type ReferenceId,
  type Revision,
} from "./ids";

export interface OwnerReference {
  readonly ownerId: OwnerId;
  readonly referenceId: ReferenceId;
  readonly ownerRevision: Revision;
}

export interface ClockOwnerIdentity {
  readonly ownerId: OwnerId;
  readonly generationId: GenerationId;
}

export interface ClockReference extends OwnerReference {
  readonly generationId: GenerationId;
}

export interface ClockValueV1 {
  readonly codecId: "smr07.elapsed-seconds";
  readonly codecVersion: 1;
  readonly canonicalValue: string;
}

export interface PartyCharacterProfileProjection {
  readonly name: string;
  readonly playerName?: string;
  readonly species?: string;
  readonly characterClass?: string;
  readonly languages?: readonly string[];
  readonly level?: number;
  readonly passivePerception?: number;
  readonly passiveInvestigation?: number;
  readonly passiveInsight?: number;
  readonly armorClass?: number;
  readonly movementSpeedFeet?: number;
}

export interface PartyCharacterProgressProjection {
  readonly currentXp: number;
  readonly currentLevelXpFloor?: number;
  readonly nextLevelXpThreshold?: number;
  readonly xpSinceLongRest: number;
  readonly xpSinceShortRest: number;
}

export type PartySceneAssignment =
  | { readonly status: "inactive" }
  | { readonly status: "not-started" }
  | {
      readonly status: "assigned";
      readonly liveSceneId: LiveSceneId;
      readonly sceneRevision: Revision;
    }
  | {
      readonly status: "pending";
      readonly commandId: CommandId;
      readonly ownerId: OwnerId;
    };

export interface PartyCharacterProjection {
  readonly characterId: CharacterId;
  readonly active: boolean;
  readonly profile: PartyCharacterProfileProjection;
  readonly progress: PartyCharacterProgressProjection;
  readonly sceneAssignment: PartySceneAssignment;
}

export interface PartyProjection {
  readonly kind: "party-projection";
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly partyRevision: Revision;
  readonly characters: readonly PartyCharacterProjection[];
}

export interface PreparationSource {
  readonly ownerId: OwnerId;
  readonly sourceId: ReferenceId;
  readonly sourceRevision: Revision;
}

export interface PreparationSnapshot {
  readonly kind: "preparation-snapshot";
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly preparationId: PreparationId;
  readonly preparationRevision: Revision;
  readonly source: PreparationSource;
  readonly title: string;
  readonly notes: string;
  readonly locationRef?: OwnerReference;
  readonly contentPins: readonly OwnerReference[];
  readonly encounterPlanRef?: OwnerReference;
}

export interface PendingAssignment {
  readonly characterId: CharacterId;
  readonly commandId: CommandId;
  readonly ownerId: OwnerId;
}

export interface MaskReference {
  readonly maskId: MaskId;
  readonly kind: string;
  readonly ownerId: OwnerId;
  readonly ownerRevision: Revision;
  readonly lifecycle: "active" | "suspended" | "archived" | "pending";
}

export interface OwnerReconciliation {
  readonly ownerId: OwnerId;
  readonly status: "current" | "pending" | "unavailable";
  readonly ownerRevision?: Revision;
  readonly commandId?: CommandId;
}

export interface LiveSceneSourceSnapshot {
  readonly kind: "live-scene-source";
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly liveSceneId: LiveSceneId;
  readonly sceneRevision: Revision;
  readonly lifecycle: "active" | "prepared" | "retired" | "archived";
  readonly primary: boolean;
  readonly characterIds: readonly CharacterId[];
  readonly pendingAssignments: readonly PendingAssignment[];
  readonly locationRef?: OwnerReference;
  readonly sceneClockRef?: ClockReference;
  readonly groupRefs: readonly OwnerReference[];
  readonly maskRefs: readonly MaskReference[];
  readonly reconciliations: readonly OwnerReconciliation[];
  readonly contentPins: readonly OwnerReference[];
}

export type FocusSourceSnapshot =
  | {
      readonly kind: "focus-source";
      readonly version: 1;
      readonly status: "active";
      readonly campaignId: CampaignId;
      readonly focusRevision: Revision;
      readonly liveSceneId: LiveSceneId;
      readonly sceneRevision: Revision;
    }
  | {
      readonly kind: "focus-source";
      readonly version: 1;
      readonly status: "none";
      readonly campaignId: CampaignId;
      readonly focusRevision: Revision;
    }
  | {
      readonly kind: "focus-source";
      readonly version: 1;
      readonly status: "pending";
      readonly campaignId: CampaignId;
      readonly focusRevision: Revision;
      readonly commandId: CommandId;
      readonly pendingLiveSceneId?: LiveSceneId;
    }
  | {
      readonly kind: "focus-source";
      readonly version: 1;
      readonly status: "unavailable";
      readonly campaignId: CampaignId;
      readonly focusRevision: Revision;
      readonly ownerId: OwnerId;
    };

function record(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
  label = "Wert",
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} muss ein Objekt sein.`);
  const result = value as Record<string, unknown>,
    prototype = Object.getPrototypeOf(result),
    keys = Reflect.ownKeys(result),
    allowed = new Set([...required, ...optional]);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    required.some((key) => !Object.hasOwn(result, key)) ||
    keys.some((key) => typeof key !== "string" || !allowed.has(key)) ||
    Object.values(Object.getOwnPropertyDescriptors(result)).some(
      (descriptor) => !Object.hasOwn(descriptor, "value"),
    )
  )
    throw new Error(
      `${label} enthält unbekannte, berechnete oder unvollständige Daten.`,
    );
  return result;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    throw new Error(`${label} muss eine vollständige native Liste sein.`);
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value"))
      throw new Error(
        `${label} enthält ausgelassene oder berechnete Einträge.`,
      );
  }
  return value;
}

function text(value: unknown, label: string, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    value.length > 20_000 ||
    (!allowEmpty && !value.trim())
  )
    throw new Error(`${label} ist kein gültiger Text.`);
  return value;
}

function optionalText(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : text(value, label);
}

function natural(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error(`${label} ist keine nichtnegative sichere Ganzzahl.`);
  return value as number;
}

function optionalNatural(value: unknown, label: string): number | undefined {
  return value === undefined ? undefined : natural(value, label);
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean")
    throw new Error(`${label} muss boolesch sein.`);
  return value;
}

function unique<T>(
  values: readonly T[],
  key: (value: T) => string,
  label: string,
): readonly T[] {
  const seen = new Set<string>();
  for (const value of values) {
    const identity = key(value);
    if (seen.has(identity))
      throw new Error(`${label} enthält doppelte Kennungen.`);
    seen.add(identity);
  }
  return values;
}

export function parseOwnerReference(
  value: unknown,
  label = "OwnerReference",
): OwnerReference {
  const row = record(
    value,
    ["ownerId", "referenceId", "ownerRevision"],
    [],
    label,
  );
  return Object.freeze({
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    referenceId: referenceId(row.referenceId, `${label}.referenceId`),
    ownerRevision: revision(row.ownerRevision, `${label}.ownerRevision`),
  });
}

export function parseClockReference(
  value: unknown,
  label = "ClockReference",
): ClockReference {
  const row = record(
    value,
    ["ownerId", "generationId", "referenceId", "ownerRevision"],
    [],
    label,
  );
  return Object.freeze({
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    generationId: generationId(row.generationId, `${label}.generationId`),
    referenceId: referenceId(row.referenceId, `${label}.referenceId`),
    ownerRevision: revision(row.ownerRevision, `${label}.ownerRevision`),
  });
}

export function parseClockOwnerIdentity(
  value: unknown,
  label = "ClockOwnerIdentity",
): ClockOwnerIdentity {
  const row = record(value, ["ownerId", "generationId"], [], label);
  return Object.freeze({
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    generationId: generationId(row.generationId, `${label}.generationId`),
  });
}

const MIN_CLOCK_VALUE = -(1n << 63n);
const MAX_CLOCK_VALUE = (1n << 63n) - 1n;

export function parseClockValue(
  value: unknown,
  label = "ClockValueV1",
): ClockValueV1 {
  const row = record(
    value,
    ["codecId", "codecVersion", "canonicalValue"],
    [],
    label,
  );
  if (row.codecId !== "smr07.elapsed-seconds" || row.codecVersion !== 1)
    throw new Error(`${label} besitzt einen unbekannten Codec.`);
  if (
    typeof row.canonicalValue !== "string" ||
    !/^(?:0|-?[1-9][0-9]*)$/u.test(row.canonicalValue)
  )
    throw new Error(`${label}.canonicalValue ist nicht kanonisch.`);
  const parsed = BigInt(row.canonicalValue);
  if (parsed < MIN_CLOCK_VALUE || parsed > MAX_CLOCK_VALUE)
    throw new Error(
      `${label}.canonicalValue liegt außerhalb von signed 64 Bit.`,
    );
  return Object.freeze({
    codecId: "smr07.elapsed-seconds",
    codecVersion: 1,
    canonicalValue: row.canonicalValue,
  });
}

function ownerReferences(
  value: unknown,
  label: string,
): readonly OwnerReference[] {
  return Object.freeze(
    unique(
      array(value, label).map((entry, index) =>
        parseOwnerReference(entry, `${label}[${index}]`),
      ),
      (entry) => `${entry.ownerId}\u0000${entry.referenceId}`,
      label,
    ),
  );
}

export function parsePartyCharacterProfile(
  value: unknown,
  label = "PartyCharacterProfile",
): PartyCharacterProfileProjection {
  const row = record(
      value,
      ["name"],
      [
        "playerName",
        "species",
        "characterClass",
        "languages",
        "level",
        "passivePerception",
        "passiveInvestigation",
        "passiveInsight",
        "armorClass",
        "movementSpeedFeet",
      ],
      label,
    ),
    languages =
      row.languages === undefined
        ? undefined
        : Object.freeze(
            array(row.languages, `${label}.languages`).map((entry, index) =>
              text(entry, `${label}.languages[${index}]`),
            ),
          );
  if (
    languages &&
    new Set(languages.map((entry) => entry.toLowerCase())).size !==
      languages.length
  )
    throw new Error(`${label}.languages enthält doppelte Werte.`);
  return Object.freeze({
    name: text(row.name, `${label}.name`),
    ...(optionalText(row.playerName, `${label}.playerName`) === undefined
      ? {}
      : { playerName: optionalText(row.playerName, `${label}.playerName`) }),
    ...(optionalText(row.species, `${label}.species`) === undefined
      ? {}
      : { species: optionalText(row.species, `${label}.species`) }),
    ...(optionalText(row.characterClass, `${label}.characterClass`) ===
    undefined
      ? {}
      : {
          characterClass: optionalText(
            row.characterClass,
            `${label}.characterClass`,
          ),
        }),
    ...(languages === undefined ? {} : { languages }),
    ...(optionalNatural(row.level, `${label}.level`) === undefined
      ? {}
      : { level: optionalNatural(row.level, `${label}.level`) }),
    ...(optionalNatural(row.passivePerception, `${label}.passivePerception`) ===
    undefined
      ? {}
      : {
          passivePerception: optionalNatural(
            row.passivePerception,
            `${label}.passivePerception`,
          ),
        }),
    ...(optionalNatural(
      row.passiveInvestigation,
      `${label}.passiveInvestigation`,
    ) === undefined
      ? {}
      : {
          passiveInvestigation: optionalNatural(
            row.passiveInvestigation,
            `${label}.passiveInvestigation`,
          ),
        }),
    ...(optionalNatural(row.passiveInsight, `${label}.passiveInsight`) ===
    undefined
      ? {}
      : {
          passiveInsight: optionalNatural(
            row.passiveInsight,
            `${label}.passiveInsight`,
          ),
        }),
    ...(optionalNatural(row.armorClass, `${label}.armorClass`) === undefined
      ? {}
      : { armorClass: optionalNatural(row.armorClass, `${label}.armorClass`) }),
    ...(optionalNatural(row.movementSpeedFeet, `${label}.movementSpeedFeet`) ===
    undefined
      ? {}
      : {
          movementSpeedFeet: optionalNatural(
            row.movementSpeedFeet,
            `${label}.movementSpeedFeet`,
          ),
        }),
  });
}

export function parsePartyCharacterProgress(
  value: unknown,
  label = "PartyCharacterProgress",
): PartyCharacterProgressProjection {
  const row = record(
      value,
      ["currentXp", "xpSinceLongRest", "xpSinceShortRest"],
      ["currentLevelXpFloor", "nextLevelXpThreshold"],
      label,
    ),
    currentXp = natural(row.currentXp, `${label}.currentXp`),
    xpSinceLongRest = natural(row.xpSinceLongRest, `${label}.xpSinceLongRest`),
    xpSinceShortRest = natural(
      row.xpSinceShortRest,
      `${label}.xpSinceShortRest`,
    ),
    currentLevelXpFloor = optionalNatural(
      row.currentLevelXpFloor,
      `${label}.currentLevelXpFloor`,
    ),
    nextLevelXpThreshold = optionalNatural(
      row.nextLevelXpThreshold,
      `${label}.nextLevelXpThreshold`,
    );
  if (
    xpSinceShortRest > xpSinceLongRest ||
    xpSinceLongRest > currentXp ||
    (currentLevelXpFloor !== undefined && currentXp < currentLevelXpFloor) ||
    (nextLevelXpThreshold !== undefined && nextLevelXpThreshold <= currentXp)
  )
    throw new Error(`${label} enthält widersprüchliche Fortschrittswerte.`);
  return Object.freeze({
    currentXp,
    xpSinceLongRest,
    xpSinceShortRest,
    ...(currentLevelXpFloor === undefined ? {} : { currentLevelXpFloor }),
    ...(nextLevelXpThreshold === undefined ? {} : { nextLevelXpThreshold }),
  });
}

function sceneAssignment(value: unknown, label: string): PartySceneAssignment {
  const base = record(
    value,
    ["status"],
    ["liveSceneId", "sceneRevision", "commandId", "ownerId"],
    label,
  );
  if (base.status === "inactive") {
    record(value, ["status"], [], label);
    return Object.freeze({ status: "inactive" });
  }
  if (base.status === "not-started") {
    record(value, ["status"], [], label);
    return Object.freeze({ status: "not-started" });
  }
  if (base.status === "assigned") {
    const row = record(
      value,
      ["status", "liveSceneId", "sceneRevision"],
      [],
      label,
    );
    return Object.freeze({
      status: "assigned",
      liveSceneId: liveSceneId(row.liveSceneId, `${label}.liveSceneId`),
      sceneRevision: revision(row.sceneRevision, `${label}.sceneRevision`),
    });
  }
  if (base.status === "pending") {
    const row = record(value, ["status", "commandId", "ownerId"], [], label);
    return Object.freeze({
      status: "pending",
      commandId: commandId(row.commandId, `${label}.commandId`),
      ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    });
  }
  throw new Error(`${label}.status ist unbekannt.`);
}

export function parsePartyProjection(value: unknown): PartyProjection {
  const root = record(
    value,
    ["kind", "version", "campaignId", "partyRevision", "characters"],
    [],
    "PartyProjection",
  );
  if (root.kind !== "party-projection" || root.version !== 1)
    throw new Error("PartyProjection besitzt einen unbekannten Vertrag.");
  const characters = unique(
    array(root.characters, "PartyProjection.characters").map((entry, index) => {
      const label = `PartyProjection.characters[${index}]`,
        row = record(
          entry,
          ["characterId", "active", "profile", "progress", "sceneAssignment"],
          [],
          label,
        ),
        active = bool(row.active, `${label}.active`),
        assignment = sceneAssignment(
          row.sceneAssignment,
          `${label}.sceneAssignment`,
        );
      if (
        (active && assignment.status === "inactive") ||
        (!active && assignment.status !== "inactive")
      )
        throw new Error(
          `${label} besitzt eine widersprüchliche Scene-Zuordnung.`,
        );
      return Object.freeze({
        characterId: characterId(row.characterId, `${label}.characterId`),
        active,
        profile: parsePartyCharacterProfile(row.profile, `${label}.profile`),
        progress: parsePartyCharacterProgress(
          row.progress,
          `${label}.progress`,
        ),
        sceneAssignment: assignment,
      });
    }),
    (entry) => entry.characterId,
    "PartyProjection.characters",
  );
  return Object.freeze({
    kind: "party-projection",
    version: 1,
    campaignId: campaignId(root.campaignId, "PartyProjection.campaignId"),
    partyRevision: revision(
      root.partyRevision,
      "PartyProjection.partyRevision",
    ),
    characters: Object.freeze(characters),
  });
}

export function parsePreparationSnapshot(value: unknown): PreparationSnapshot {
  const root = record(
    value,
    [
      "kind",
      "version",
      "campaignId",
      "preparationId",
      "preparationRevision",
      "source",
      "title",
      "notes",
      "contentPins",
    ],
    ["locationRef", "encounterPlanRef"],
    "PreparationSnapshot",
  );
  if (root.kind !== "preparation-snapshot" || root.version !== 1)
    throw new Error("PreparationSnapshot besitzt einen unbekannten Vertrag.");
  const source = record(
    root.source,
    ["ownerId", "sourceId", "sourceRevision"],
    [],
    "PreparationSnapshot.source",
  );
  return Object.freeze({
    kind: "preparation-snapshot",
    version: 1,
    campaignId: campaignId(root.campaignId, "PreparationSnapshot.campaignId"),
    preparationId: preparationId(
      root.preparationId,
      "PreparationSnapshot.preparationId",
    ),
    preparationRevision: revision(
      root.preparationRevision,
      "PreparationSnapshot.preparationRevision",
    ),
    source: Object.freeze({
      ownerId: ownerId(source.ownerId, "PreparationSnapshot.source.ownerId"),
      sourceId: referenceId(
        source.sourceId,
        "PreparationSnapshot.source.sourceId",
      ),
      sourceRevision: revision(
        source.sourceRevision,
        "PreparationSnapshot.source.sourceRevision",
      ),
    }),
    title: text(root.title, "PreparationSnapshot.title", true),
    notes: text(root.notes, "PreparationSnapshot.notes", true),
    ...(root.locationRef === undefined
      ? {}
      : {
          locationRef: parseOwnerReference(
            root.locationRef,
            "PreparationSnapshot.locationRef",
          ),
        }),
    contentPins: ownerReferences(
      root.contentPins,
      "PreparationSnapshot.contentPins",
    ),
    ...(root.encounterPlanRef === undefined
      ? {}
      : {
          encounterPlanRef: parseOwnerReference(
            root.encounterPlanRef,
            "PreparationSnapshot.encounterPlanRef",
          ),
        }),
  });
}

function pendingAssignments(value: unknown): readonly PendingAssignment[] {
  return Object.freeze(
    unique(
      array(value, "LiveSceneSource.pendingAssignments").map((entry, index) => {
        const label = `LiveSceneSource.pendingAssignments[${index}]`,
          row = record(
            entry,
            ["characterId", "commandId", "ownerId"],
            [],
            label,
          );
        return Object.freeze({
          characterId: characterId(row.characterId, `${label}.characterId`),
          commandId: commandId(row.commandId, `${label}.commandId`),
          ownerId: ownerId(row.ownerId, `${label}.ownerId`),
        });
      }),
      (entry) => entry.characterId,
      "LiveSceneSource.pendingAssignments",
    ),
  );
}

function maskReferences(value: unknown): readonly MaskReference[] {
  return Object.freeze(
    unique(
      array(value, "LiveSceneSource.maskRefs").map((entry, index) => {
        const label = `LiveSceneSource.maskRefs[${index}]`,
          row = record(
            entry,
            ["maskId", "kind", "ownerId", "ownerRevision", "lifecycle"],
            [],
            label,
          );
        if (
          !(["active", "suspended", "archived", "pending"] as const).includes(
            row.lifecycle as never,
          )
        )
          throw new Error(`${label}.lifecycle ist unbekannt.`);
        return Object.freeze({
          maskId: maskId(row.maskId, `${label}.maskId`),
          kind: text(row.kind, `${label}.kind`),
          ownerId: ownerId(row.ownerId, `${label}.ownerId`),
          ownerRevision: revision(row.ownerRevision, `${label}.ownerRevision`),
          lifecycle: row.lifecycle as MaskReference["lifecycle"],
        });
      }),
      (entry) => `${entry.ownerId}\u0000${entry.maskId}`,
      "LiveSceneSource.maskRefs",
    ),
  );
}

function reconciliations(value: unknown): readonly OwnerReconciliation[] {
  return Object.freeze(
    unique(
      array(value, "LiveSceneSource.reconciliations").map((entry, index) => {
        const label = `LiveSceneSource.reconciliations[${index}]`,
          row = record(
            entry,
            ["ownerId", "status"],
            ["ownerRevision", "commandId"],
            label,
          );
        if (
          !(["current", "pending", "unavailable"] as const).includes(
            row.status as never,
          )
        )
          throw new Error(`${label}.status ist unbekannt.`);
        if (row.status === "current" && row.ownerRevision === undefined)
          throw new Error(`${label} benötigt eine OwnerRevision.`);
        if (row.status === "pending" && row.commandId === undefined)
          throw new Error(`${label} benötigt eine CommandId.`);
        return Object.freeze({
          ownerId: ownerId(row.ownerId, `${label}.ownerId`),
          status: row.status as OwnerReconciliation["status"],
          ...(row.ownerRevision === undefined
            ? {}
            : {
                ownerRevision: revision(
                  row.ownerRevision,
                  `${label}.ownerRevision`,
                ),
              }),
          ...(row.commandId === undefined
            ? {}
            : { commandId: commandId(row.commandId, `${label}.commandId`) }),
        });
      }),
      (entry) => entry.ownerId,
      "LiveSceneSource.reconciliations",
    ),
  );
}

export function parseLiveSceneSource(value: unknown): LiveSceneSourceSnapshot {
  const root = record(
    value,
    [
      "kind",
      "version",
      "campaignId",
      "liveSceneId",
      "sceneRevision",
      "lifecycle",
      "primary",
      "characterIds",
      "pendingAssignments",
      "groupRefs",
      "maskRefs",
      "reconciliations",
      "contentPins",
    ],
    ["locationRef", "sceneClockRef"],
    "LiveSceneSource",
  );
  if (root.kind !== "live-scene-source" || root.version !== 1)
    throw new Error("LiveSceneSource besitzt einen unbekannten Vertrag.");
  if (
    !(["active", "prepared", "retired", "archived"] as const).includes(
      root.lifecycle as never,
    )
  )
    throw new Error("LiveSceneSource.lifecycle ist unbekannt.");
  const characterIds = Object.freeze(
    unique(
      array(root.characterIds, "LiveSceneSource.characterIds").map(
        (entry, index) =>
          characterId(entry, `LiveSceneSource.characterIds[${index}]`),
      ),
      (entry) => entry,
      "LiveSceneSource.characterIds",
    ),
  );
  return Object.freeze({
    kind: "live-scene-source",
    version: 1,
    campaignId: campaignId(root.campaignId, "LiveSceneSource.campaignId"),
    liveSceneId: liveSceneId(root.liveSceneId, "LiveSceneSource.liveSceneId"),
    sceneRevision: revision(
      root.sceneRevision,
      "LiveSceneSource.sceneRevision",
    ),
    lifecycle: root.lifecycle as LiveSceneSourceSnapshot["lifecycle"],
    primary: bool(root.primary, "LiveSceneSource.primary"),
    characterIds,
    pendingAssignments: pendingAssignments(root.pendingAssignments),
    ...(root.locationRef === undefined
      ? {}
      : {
          locationRef: parseOwnerReference(
            root.locationRef,
            "LiveSceneSource.locationRef",
          ),
        }),
    ...(root.sceneClockRef === undefined
      ? {}
      : {
          sceneClockRef: parseClockReference(
            root.sceneClockRef,
            "LiveSceneSource.sceneClockRef",
          ),
        }),
    groupRefs: ownerReferences(root.groupRefs, "LiveSceneSource.groupRefs"),
    maskRefs: maskReferences(root.maskRefs),
    reconciliations: reconciliations(root.reconciliations),
    contentPins: ownerReferences(
      root.contentPins,
      "LiveSceneSource.contentPins",
    ),
  });
}

export function parseFocusSource(value: unknown): FocusSourceSnapshot {
  const base = record(
    value,
    ["kind", "version", "status", "campaignId", "focusRevision"],
    [
      "liveSceneId",
      "sceneRevision",
      "commandId",
      "pendingLiveSceneId",
      "ownerId",
    ],
    "FocusSource",
  );
  if (base.kind !== "focus-source" || base.version !== 1)
    throw new Error("FocusSource besitzt einen unbekannten Vertrag.");
  const common = {
    kind: "focus-source" as const,
    version: 1 as const,
    campaignId: campaignId(base.campaignId, "FocusSource.campaignId"),
    focusRevision: revision(base.focusRevision, "FocusSource.focusRevision"),
  };
  if (base.status === "active") {
    const row = record(
      value,
      [
        "kind",
        "version",
        "status",
        "campaignId",
        "focusRevision",
        "liveSceneId",
        "sceneRevision",
      ],
      [],
      "FocusSource",
    );
    return Object.freeze({
      ...common,
      status: "active",
      liveSceneId: liveSceneId(row.liveSceneId, "FocusSource.liveSceneId"),
      sceneRevision: revision(row.sceneRevision, "FocusSource.sceneRevision"),
    });
  }
  if (base.status === "none") {
    record(
      value,
      ["kind", "version", "status", "campaignId", "focusRevision"],
      [],
      "FocusSource",
    );
    return Object.freeze({ ...common, status: "none" });
  }
  if (base.status === "pending") {
    const row = record(
      value,
      ["kind", "version", "status", "campaignId", "focusRevision", "commandId"],
      ["pendingLiveSceneId"],
      "FocusSource",
    );
    return Object.freeze({
      ...common,
      status: "pending",
      commandId: commandId(row.commandId, "FocusSource.commandId"),
      ...(row.pendingLiveSceneId === undefined
        ? {}
        : {
            pendingLiveSceneId: liveSceneId(
              row.pendingLiveSceneId,
              "FocusSource.pendingLiveSceneId",
            ),
          }),
    });
  }
  if (base.status === "unavailable") {
    const row = record(
      value,
      ["kind", "version", "status", "campaignId", "focusRevision", "ownerId"],
      [],
      "FocusSource",
    );
    return Object.freeze({
      ...common,
      status: "unavailable",
      ownerId: ownerId(row.ownerId, "FocusSource.ownerId"),
    });
  }
  throw new Error("FocusSource.status ist unbekannt.");
}
