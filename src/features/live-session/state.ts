import {
  parseFocusSource,
  parseLiveSceneSource,
  parseOwnerReference,
  parsePartyProjection,
  parsePreparationSnapshot,
  type FocusSourceSnapshot,
  type LiveSceneSourceSnapshot,
  type OwnerReference,
  type PartyProjection,
  type PreparationSnapshot,
} from "./contracts";
import {
  liveSceneId,
  type CampaignId,
  type CharacterId,
  type CommandId,
  type GenerationId,
  type LiveSceneId,
  type OwnerId,
  type Revision,
} from "./ids";
import { exactArray, exactRecord, exactText, uniqueBy } from "./validation";
import {
  parseReconciliationDuty,
  reconciliationOwnerKey,
  type PendingConsumerReconciliation,
} from "./mask-reconciliation";

export type {
  PendingConsumerReconciliation,
  ReconciliationTargetEndpoint,
} from "./mask-reconciliation";

export interface RuntimeSceneState {
  readonly kind: "runtime-scene-state";
  readonly version: 1;
  readonly source: LiveSceneSourceSnapshot;
  readonly title: string;
  readonly notes: string;
  readonly preparedFrom?: PreparationSnapshot;
  readonly encounterPlanRef?: OwnerReference;
}

export interface LiveSessionAggregateState {
  readonly kind: "live-session-aggregate-state";
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly party: PartyProjection;
  readonly focus: FocusSourceSnapshot;
  readonly primarySceneId: LiveSceneId | null;
  readonly scenes: readonly RuntimeSceneState[];
  readonly pendingReconciliations: readonly PendingConsumerReconciliation[];
}

function parsePendingReconciliation(
  value: unknown,
  index: number,
): PendingConsumerReconciliation {
  const label = `LiveSessionAggregateState.pendingReconciliations[${index}]`,
    parsed = parseReconciliationDuty(value, label);
  if (parsed.delivery !== "pending")
    throw new Error(`${label} ist keine Pending-Reconciliation.`);
  return parsed as PendingConsumerReconciliation;
}

function parseRuntimeScene(value: unknown, index: number): RuntimeSceneState {
  const label = `LiveSessionAggregateState.scenes[${index}]`,
    row = exactRecord(
      value,
      ["kind", "version", "source", "title", "notes"],
      ["preparedFrom", "encounterPlanRef"],
      label,
    );
  if (row.kind !== "runtime-scene-state" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const source = parseLiveSceneSource(row.source),
    preparedFrom =
      row.preparedFrom === undefined
        ? undefined
        : parsePreparationSnapshot(row.preparedFrom),
    encounterPlanRef =
      row.encounterPlanRef === undefined
        ? undefined
        : parseOwnerReference(
            row.encounterPlanRef,
            `${label}.encounterPlanRef`,
          );
  if (
    (preparedFrom?.encounterPlanRef === undefined) !==
    (encounterPlanRef === undefined)
  )
    throw new Error(
      `${label}.encounterPlanRef widerspricht der Preparation-Provenienz.`,
    );
  if (
    preparedFrom &&
    (preparedFrom.campaignId !== source.campaignId ||
      preparedFrom.title !== row.title ||
      preparedFrom.notes !== row.notes ||
      preparedFrom.locationRef?.ownerId !== source.locationRef?.ownerId ||
      preparedFrom.locationRef?.referenceId !==
        source.locationRef?.referenceId ||
      preparedFrom.locationRef?.ownerRevision !==
        source.locationRef?.ownerRevision)
  )
    throw new Error(`${label} widerspricht seiner Preparation-Provenienz.`);
  if (
    preparedFrom &&
    (preparedFrom.contentPins.length !== source.contentPins.length ||
      preparedFrom.contentPins.some((pin, pinIndex) => {
        const sourcePin = source.contentPins[pinIndex];
        return (
          sourcePin === undefined ||
          pin.ownerId !== sourcePin.ownerId ||
          pin.referenceId !== sourcePin.referenceId ||
          pin.ownerRevision !== sourcePin.ownerRevision
        );
      }))
  )
    throw new Error(`${label}.contentPins widersprechen der Preparation.`);
  if (
    encounterPlanRef !== undefined &&
    (preparedFrom?.encounterPlanRef?.ownerId !== encounterPlanRef.ownerId ||
      preparedFrom.encounterPlanRef.referenceId !==
        encounterPlanRef.referenceId ||
      preparedFrom.encounterPlanRef.ownerRevision !==
        encounterPlanRef.ownerRevision)
  )
    throw new Error(`${label}.encounterPlanRef widerspricht der Preparation.`);
  if (
    source.lifecycle === "prepared" &&
    (source.primary ||
      source.characterIds.length ||
      source.pendingAssignments.length ||
      source.maskRefs.length ||
      source.maskParticipationProjections.length)
  )
    throw new Error(`${label} enthält eine aktive Prepared Runtime.`);
  if (source.lifecycle === "prepared" && !preparedFrom)
    throw new Error(`${label} benötigt Preparation-Provenienz.`);
  if (
    source.lifecycle !== "prepared" &&
    preparedFrom !== undefined &&
    preparedFrom.campaignId !== source.campaignId
  )
    throw new Error(`${label} besitzt fremde Preparation-Provenienz.`);
  const ownerRevisionById = new Map<string, Revision>(),
    maskById = new Map<string, (typeof source.maskRefs)[number]>(),
    ownerStatus = new Map<string, (typeof source.reconciliations)[number]>(),
    ownerKey = (owner: OwnerId, generation: GenerationId) =>
      `${owner}\u0000${generation}`,
    maskKey = (owner: OwnerId, generation: GenerationId, mask: string) =>
      `${ownerKey(owner, generation)}\u0000${mask}`;
  for (const mask of source.maskRefs) {
    const key = ownerKey(mask.ownerId, mask.generationId),
      existing = ownerRevisionById.get(key);
    if (existing !== undefined && existing !== mask.ownerRevision)
      throw new Error(
        `${label} enthält widersprüchliche Masken-OwnerRevisionen.`,
      );
    ownerRevisionById.set(key, mask.ownerRevision);
    maskById.set(maskKey(mask.ownerId, mask.generationId, mask.maskId), mask);
  }
  for (const owner of source.reconciliations) {
    if (owner.generationId === undefined) {
      if (source.maskRefs.some((mask) => mask.ownerId === owner.ownerId))
        throw new Error(
          `${label} benötigt für Maskenowner eine vollständige Generation.`,
        );
      if (owner.ownerRevision === undefined)
        throw new Error(`${label} benötigt eine gebundene OwnerRevision.`);
      continue;
    }
    const key = ownerKey(owner.ownerId, owner.generationId),
      maskRevision = ownerRevisionById.get(key);
    if (maskRevision === undefined)
      throw new Error(
        `${label} enthält eine ungebundene Maskenowner-Generation.`,
      );
    ownerStatus.set(key, owner);
    if (
      owner.ownerRevision === undefined ||
      owner.ownerRevision !== maskRevision
    )
      throw new Error(`${label} enthält eine widersprüchliche OwnerRevision.`);
  }
  const projectionKeys = new Set<string>();
  for (const projection of source.maskParticipationProjections) {
    const key = ownerKey(
        projection.ownerIdentity.ownerId,
        projection.ownerIdentity.generationId,
      ),
      fullKey = maskKey(
        projection.ownerIdentity.ownerId,
        projection.ownerIdentity.generationId,
        projection.maskId,
      ),
      mask = maskById.get(fullKey),
      status = ownerStatus.get(key)?.status ?? "current";
    if (
      !mask ||
      mask.kind !== projection.maskKind ||
      mask.ownerRevision !== projection.ownerRevision ||
      mask.lifecycle !== projection.lifecycle
    )
      throw new Error(`${label} enthält eine ungebundene Maskenprojektion.`);
    if (status !== "current" || projection.lifecycle === "pending")
      throw new Error(
        `${label} behandelt keine aktuelle Maskenprojektion als current.`,
      );
    if (
      projection.participantCharacterIds.some(
        (character) =>
          !source.characterIds.includes(character) ||
          source.pendingAssignments.some(
            (pending) => pending.characterId === character,
          ),
      )
    )
      throw new Error(`${label} enthält eine scene-fremde Maskenteilnahme.`);
    projectionKeys.add(fullKey);
  }
  for (const mask of source.maskRefs) {
    const key = ownerKey(mask.ownerId, mask.generationId),
      status = ownerStatus.get(key)?.status ?? "current",
      fullKey = maskKey(mask.ownerId, mask.generationId, mask.maskId);
    if (
      status === "current" &&
      (mask.lifecycle === "pending" || !projectionKeys.has(fullKey))
    )
      throw new Error(
        `${label} besitzt keinen vollständigen Current-Maskensnapshot.`,
      );
    if (status !== "current" && projectionKeys.has(fullKey))
      throw new Error(
        `${label} projiziert einen pending Maskenowner als current.`,
      );
  }
  for (const [key, owner] of ownerStatus) {
    if (owner.status !== "current") continue;
    const refOrder = source.maskRefs
        .filter((mask) => ownerKey(mask.ownerId, mask.generationId) === key)
        .map((mask) => mask.maskId),
      projectionOrder = source.maskParticipationProjections
        .filter(
          (projection) =>
            ownerKey(
              projection.ownerIdentity.ownerId,
              projection.ownerIdentity.generationId,
            ) === key,
        )
        .map((projection) => projection.maskId);
    if (
      refOrder.length !== projectionOrder.length ||
      refOrder.some((mask, index) => mask !== projectionOrder[index])
    )
      throw new Error(
        `${label} besitzt keine stabile Masken-Projektionsreihenfolge.`,
      );
  }
  return Object.freeze({
    kind: "runtime-scene-state",
    version: 1,
    source,
    title: exactText(row.title, `${label}.title`, true),
    notes: exactText(row.notes, `${label}.notes`, true),
    ...(preparedFrom === undefined ? {} : { preparedFrom }),
    ...(encounterPlanRef === undefined ? {} : { encounterPlanRef }),
  });
}

export function parseLiveSessionAggregateState(
  value: unknown,
): LiveSessionAggregateState {
  const root = exactRecord(
    value,
    [
      "kind",
      "version",
      "campaignId",
      "party",
      "focus",
      "primarySceneId",
      "scenes",
      "pendingReconciliations",
    ],
    [],
    "LiveSessionAggregateState",
  );
  if (root.kind !== "live-session-aggregate-state" || root.version !== 1)
    throw new Error(
      "LiveSessionAggregateState besitzt einen unbekannten Vertrag.",
    );
  const party = parsePartyProjection(root.party),
    focus = parseFocusSource(root.focus),
    scenes = Object.freeze(
      uniqueBy(
        exactArray(root.scenes, "LiveSessionAggregateState.scenes").map(
          parseRuntimeScene,
        ),
        (scene) => scene.source.liveSceneId,
        "LiveSessionAggregateState.scenes",
      ),
    ),
    pendingReconciliations = Object.freeze(
      uniqueBy(
        exactArray(
          root.pendingReconciliations,
          "LiveSessionAggregateState.pendingReconciliations",
        ).map(parsePendingReconciliation),
        (entry) => `${reconciliationOwnerKey(entry)}\u0000${entry.commandId}`,
        "LiveSessionAggregateState.pendingReconciliations",
      ),
    ),
    campaignId = party.campaignId;
  if (root.campaignId !== campaignId || focus.campaignId !== campaignId)
    throw new Error("LiveSessionAggregateState enthält eine fremde Campaign.");
  if (scenes.some((scene) => scene.source.campaignId !== campaignId))
    throw new Error("LiveSessionAggregateState enthält eine fremde Scene.");
  if (pendingReconciliations.some((entry) => entry.campaignId !== campaignId))
    throw new Error(
      "LiveSessionAggregateState enthält eine fremde Reconciliation.",
    );
  const sceneById = new Map(
      scenes.map((scene) => [scene.source.liveSceneId, scene.source]),
    ),
    envelopeByCommand = new Map<string, PendingConsumerReconciliation>();
  for (const duty of pendingReconciliations) {
    const envelopeKey = duty.commandId,
      priorEnvelope = envelopeByCommand.get(envelopeKey);
    if (
      priorEnvelope !== undefined &&
      (priorEnvelope.commandDigest !== duty.commandDigest ||
        priorEnvelope.sourceSceneId !== duty.sourceSceneId ||
        priorEnvelope.partyRevisionBefore !== duty.partyRevisionBefore ||
        priorEnvelope.partyRevisionAfter !== duty.partyRevisionAfter ||
        priorEnvelope.sourceRevisionBefore !== duty.sourceRevisionBefore ||
        priorEnvelope.sourceRevisionAfter !== duty.sourceRevisionAfter ||
        priorEnvelope.sourceLifecycleAfter !== duty.sourceLifecycleAfter ||
        JSON.stringify(priorEnvelope.target) !== JSON.stringify(duty.target) ||
        priorEnvelope.affectedCharacterIds.length !==
          duty.affectedCharacterIds.length ||
        priorEnvelope.affectedCharacterIds.some(
          (entry, index) => entry !== duty.affectedCharacterIds[index],
        ))
    )
      throw new Error(
        "LiveSessionAggregateState enthält widersprüchliche Command-Envelopes.",
      );
    envelopeByCommand.set(envelopeKey, duty);
    const source = sceneById.get(duty.sourceSceneId),
      target =
        duty.target.kind === "none"
          ? undefined
          : sceneById.get(duty.target.liveSceneId);
    if (
      !source ||
      (duty.target.kind !== "none" && !target) ||
      source.liveSceneId === target?.liveSceneId
    )
      throw new Error(
        "LiveSessionAggregateState enthält eine Reconciliation ohne Scene-Bindung.",
      );
    if (
      duty.target.kind !== "none" &&
      target !== undefined &&
      target.sceneRevision < duty.target.revisionAfter
    )
      throw new Error(
        "LiveSessionAggregateState enthält eine stale Reconciliation-Zielbindung.",
      );
    if (duty.sourceRevisionAfter > source.sceneRevision)
      throw new Error(
        "LiveSessionAggregateState enthält eine zukünftige Reconciliation-Sourcebindung.",
      );
    if (
      (source.lifecycle === "active" &&
        duty.sourceLifecycleAfter === "retired") ||
      (duty.sourceRevisionAfter === source.sceneRevision &&
        duty.sourceLifecycleAfter !== source.lifecycle)
    )
      throw new Error(
        "LiveSessionAggregateState enthält eine falsche Reconciliation-Lifecyclebindung.",
      );
    const affected = new Set(duty.affectedCharacterIds),
      partyOrdered = party.characters
        .filter((character) => affected.has(character.characterId))
        .map((character) => character.characterId);
    if (
      duty.partyRevisionAfter > party.partyRevision ||
      partyOrdered.length !== duty.affectedCharacterIds.length ||
      partyOrdered.some(
        (character, index) => character !== duty.affectedCharacterIds[index],
      )
    )
      throw new Error(
        "LiveSessionAggregateState enthält eine ungebundene Party-Reconciliation.",
      );
    if (duty.kind === "mask-owner-reconciliation") {
      const masks =
          duty.scope.kind === "complete-mask-delta"
            ? duty.scope.masks
            : duty.scope.knownMaskRefs,
        owner = source.reconciliations.find(
          (entry) =>
            entry.ownerId === duty.ownerIdentity.ownerId &&
            entry.generationId === duty.ownerIdentity.generationId,
        ),
        ownerMasks = source.maskRefs.filter(
          (entry) =>
            entry.ownerId === duty.ownerIdentity.ownerId &&
            entry.generationId === duty.ownerIdentity.generationId,
        ),
        requiresFullCoverage =
          duty.scope.kind === "owner-scope-unresolved" ||
          (duty.scope.kind === "complete-mask-delta" &&
            duty.scope.operation === "source-retired");
      if (
        masks.some((pin) => {
          const mask = source.maskRefs.find(
            (entry) =>
              entry.maskId === pin.maskId &&
              entry.ownerId === duty.ownerIdentity.ownerId &&
              entry.generationId === duty.ownerIdentity.generationId,
          );
          return (
            !mask ||
            mask.kind !== pin.maskKind ||
            mask.ownerRevision !== pin.expectedOwnerRevision ||
            mask.lifecycle !== pin.lifecycleBefore
          );
        }) ||
        owner?.status !== "pending" ||
        owner.ownerRevision !== duty.expectedOwnerRevision ||
        !owner.pendingCommandIds?.includes(duty.commandId) ||
        (requiresFullCoverage && masks.length !== ownerMasks.length)
      )
        throw new Error(
          "LiveSessionAggregateState enthält eine ungebundene Masken-Reconciliation.",
        );
    } else {
      const owner = source.reconciliations.find(
        (entry) =>
          entry.ownerId === duty.ownerId && entry.generationId === undefined,
      );
      if (owner?.ownerRevision !== duty.expectedOwnerRevision)
        throw new Error(
          "LiveSessionAggregateState enthält eine ungebundene Owner-Reconciliation.",
        );
    }
  }
  for (const source of sceneById.values()) {
    for (const owner of source.reconciliations) {
      if (owner.generationId === undefined || owner.status !== "pending")
        continue;
      for (const pendingCommandId of owner.pendingCommandIds ?? []) {
        const matching = pendingReconciliations.filter(
          (duty) =>
            duty.kind === "mask-owner-reconciliation" &&
            duty.sourceSceneId === source.liveSceneId &&
            duty.commandId === pendingCommandId &&
            duty.ownerIdentity.ownerId === owner.ownerId &&
            duty.ownerIdentity.generationId === owner.generationId,
        );
        if (matching.length !== 1)
          throw new Error(
            "LiveSessionAggregateState enthält einen pending Maskenowner ohne eindeutige Duty.",
          );
      }
    }
  }

  const activeScenes = scenes.filter(
      (scene) => scene.source.lifecycle === "active",
    ),
    primaries = activeScenes.filter((scene) => scene.source.primary),
    primarySceneId =
      root.primarySceneId === null
        ? null
        : liveSceneId(
            root.primarySceneId,
            "LiveSessionAggregateState.primarySceneId",
          );
  if (
    (activeScenes.length === 0 &&
      (primarySceneId !== null || primaries.length !== 0)) ||
    (activeScenes.length > 0 &&
      (primarySceneId === null ||
        primaries.length !== 1 ||
        primaries[0]?.source.liveSceneId !== primarySceneId))
  )
    throw new Error(
      "LiveSessionAggregateState besitzt keine eindeutige Primary Scene.",
    );
  if (
    scenes.some(
      (scene) => scene.source.lifecycle !== "active" && scene.source.primary,
    )
  )
    throw new Error("Nur eine aktive Scene darf Primary sein.");
  if (activeScenes.some((scene) => scene.source.sceneClockRef === undefined))
    throw new Error("Jede aktive Scene benötigt genau eine SceneClock.");
  uniqueBy(
    activeScenes.map((scene) => scene.source.sceneClockRef!),
    (clock) =>
      `${clock.ownerId}\u0000${clock.generationId}\u0000${clock.referenceId}`,
    "LiveSessionAggregateState.activeSceneClocks",
  );

  const activeById = new Map(
      activeScenes.map((scene) => [scene.source.liveSceneId, scene.source]),
    ),
    characterScene = new Map<CharacterId, LiveSceneId>(),
    pendingScene = new Map<
      CharacterId,
      {
        readonly liveSceneId: LiveSceneId;
        readonly commandId: CommandId;
        readonly ownerId: OwnerId;
      }
    >();
  for (const scene of activeScenes) {
    for (const characterId of scene.source.characterIds) {
      if (characterScene.has(characterId) || pendingScene.has(characterId))
        throw new Error("Eine CharacterId liegt in mehreren aktiven Scenes.");
      characterScene.set(characterId, scene.source.liveSceneId);
    }
    for (const pending of scene.source.pendingAssignments) {
      if (
        pendingScene.has(pending.characterId) ||
        characterScene.has(pending.characterId)
      )
        throw new Error(
          "Eine CharacterId besitzt mehrere aktuelle Scene-Zuordnungen.",
        );
      pendingScene.set(pending.characterId, {
        liveSceneId: scene.source.liveSceneId,
        commandId: pending.commandId,
        ownerId: pending.ownerId,
      });
    }
  }
  const partyById = new Map(
    party.characters.map((character) => [character.characterId, character]),
  );
  for (const character of party.characters) {
    const assignment = character.sceneAssignment;
    if (!character.active) {
      if (
        characterScene.has(character.characterId) ||
        pendingScene.has(character.characterId)
      )
        throw new Error("Eine inaktive CharacterId liegt in einer Scene.");
      continue;
    }
    if (assignment.status === "not-started") {
      if (activeScenes.length)
        throw new Error(
          "Nach Initialisierung darf keine aktive Figur not-started sein.",
        );
      continue;
    }
    if (assignment.status === "assigned") {
      const scene = activeById.get(assignment.liveSceneId);
      if (
        !scene ||
        scene.sceneRevision !== assignment.sceneRevision ||
        characterScene.get(character.characterId) !== assignment.liveSceneId
      )
        throw new Error("Party- und Scene-Zuordnung widersprechen sich.");
      continue;
    }
    const pending = pendingScene.get(character.characterId);
    if (
      assignment.status !== "pending" ||
      pending === undefined ||
      pending.commandId !== assignment.commandId ||
      pending.ownerId !== assignment.ownerId
    )
      throw new Error(
        "Aktive Partyfigur besitzt keine aktuelle Scene-Zuordnung.",
      );
  }
  for (const characterId of [
    ...characterScene.keys(),
    ...pendingScene.keys(),
  ]) {
    if (!partyById.get(characterId)?.active)
      throw new Error("Eine Scene referenziert keine aktive Partyfigur.");
  }

  if (focus.status === "active") {
    const scene = activeById.get(focus.liveSceneId);
    if (!scene || scene.sceneRevision !== focus.sceneRevision)
      throw new Error("Focus referenziert keine aktuelle aktive Scene.");
  }
  return Object.freeze({
    kind: "live-session-aggregate-state",
    version: 1,
    campaignId,
    party,
    focus,
    primarySceneId,
    scenes,
    pendingReconciliations,
  });
}

export function createUninitializedLiveSessionState(
  partyValue: unknown,
): LiveSessionAggregateState {
  const party = parsePartyProjection(partyValue);
  if (
    party.characters.some(
      (character) =>
        character.active && character.sceneAssignment.status !== "not-started",
    )
  )
    throw new Error(
      "Eine nicht initialisierte Party darf keine Scene-Zuordnung besitzen.",
    );
  return parseLiveSessionAggregateState({
    kind: "live-session-aggregate-state",
    version: 1,
    campaignId: party.campaignId,
    party,
    focus: {
      kind: "focus-source",
      version: 1,
      status: "none",
      campaignId: party.campaignId,
      focusRevision: 0,
    },
    primarySceneId: null,
    scenes: [],
    pendingReconciliations: [],
  });
}
