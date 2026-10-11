import { evidenceDigest } from "./evidence";
import { parsePartyProjection, type PartyProjection } from "./contracts";
import {
  campaignId,
  characterId,
  commandDigest,
  commandId,
  ownerId,
  receiptId,
  referenceId,
  revision,
  type CampaignId,
  type CharacterId,
  type CommandDigest,
  type CommandId,
  type OwnerId,
  type ReceiptId,
  type ReferenceId,
  type Revision,
} from "./ids";
import { exactArray, exactBoolean, exactRecord, uniqueBy } from "./validation";

export type PartyHistoryDigest = (canonical: string) => string;

interface PartyHistoryEntryBinding {
  readonly entryId: ReferenceId;
  readonly causeCommandId: CommandId;
  readonly causeCommandDigest: CommandDigest;
  readonly causeReceiptId: ReceiptId;
  readonly partyRevisionBefore: Revision;
  readonly partyRevisionAfter: Revision;
}

export interface ReversiblePartyHistoryEntry
  extends PartyHistoryEntryBinding {
  readonly kind: "party-history-entry";
  readonly version: 1;
  readonly status: "reversible";
  readonly actionKind: string;
  readonly characterIds: readonly CharacterId[];
  readonly dependencies: readonly PartyHistoryDependency[];
  readonly before: PartyProjection;
  readonly after: PartyProjection;
}

export interface SealedPartyHistoryEntry extends PartyHistoryEntryBinding {
  readonly kind: "party-history-entry";
  readonly version: 1;
  readonly status: "sealed-deletion";
  readonly actionKind: string;
  readonly subject: "[UNKNOWN]";
  readonly tombstoneId: ReferenceId;
  readonly survivingCharacterIds: readonly CharacterId[];
  readonly beforeHash: string;
  readonly afterHash: string;
}

export type PartyHistoryEntry =
  | ReversiblePartyHistoryEntry
  | SealedPartyHistoryEntry;

export interface PartyHistoryDependency {
  readonly kind: "party-history-dependency";
  readonly version: 1;
  readonly ownerId: OwnerId;
  readonly targetId: ReferenceId;
  readonly revisionBefore: Revision;
  readonly revisionAfter: Revision;
  readonly undoDisposition: "restore" | "remove-if-unchanged";
  readonly redoDisposition: "restore";
}

export interface PartyHistoryParticipantInput {
  readonly kind: "party-history-participant-input";
  readonly version: 1;
  readonly ownerId: OwnerId;
  readonly targetId: ReferenceId;
  readonly currentRevision: Revision;
  readonly targetUnused: boolean;
}

export interface PartyHistoryParticipantPlan {
  readonly kind: "party-history-participant-plan";
  readonly version: 1;
  readonly ownerId: OwnerId;
  readonly targetId: ReferenceId;
  readonly revisionBefore: Revision;
  readonly revisionAfter: Revision;
  readonly disposition: "restore" | "remove-if-unchanged";
}

export interface PartyHistoryOperation {
  readonly kind: "party-history-operation";
  readonly version: 1;
  readonly direction: "undo" | "redo";
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly receiptId: ReceiptId;
  readonly entryId: ReferenceId;
  readonly partyRevisionBefore: Revision;
  readonly partyRevisionAfter: Revision;
  readonly participantPlans: readonly PartyHistoryParticipantPlan[];
}

export interface PartyCommandHistory {
  readonly kind: "party-command-history";
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly historyRevision: Revision;
  readonly cursor: number;
  readonly entries: readonly PartyHistoryEntry[];
  readonly operations: readonly PartyHistoryOperation[];
}

export interface PartyHistoryCommand {
  readonly kind: "undo-party-history" | "redo-party-history";
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly receiptId: ReceiptId;
  readonly expectedPartyRevision: Revision;
  readonly expectedHistoryRevision: Revision;
  readonly cancelled: boolean;
  readonly participantInputs: readonly PartyHistoryParticipantInput[];
}

export type PartyHistoryResult =
  | {
      readonly status: "applied";
      readonly party: PartyProjection;
      readonly history: PartyCommandHistory;
      readonly operation: PartyHistoryOperation;
    }
  | {
      readonly status: "rejected" | "cancelled";
      readonly party: PartyProjection;
      readonly history: PartyCommandHistory;
      readonly reason:
        | "cancelled"
        | "foreign-campaign"
        | "stale-party"
        | "stale-history"
        | "nothing-to-undo"
        | "nothing-to-redo"
        | "irreversible-boundary"
        | "causal-conflict";
    };

const MAX_HISTORY = 100;

function evidence(value: unknown, label: string): string {
  return evidenceDigest(value, label);
}

function parseEntryBinding(
  row: Record<string, unknown>,
  label: string,
): PartyHistoryEntryBinding {
  return Object.freeze({
    entryId: referenceId(row.entryId, `${label}.entryId`),
    causeCommandId: commandId(
      row.causeCommandId,
      `${label}.causeCommandId`,
    ),
    causeCommandDigest: commandDigest(
      row.causeCommandDigest,
      `${label}.causeCommandDigest`,
    ),
    causeReceiptId: receiptId(
      row.causeReceiptId,
      `${label}.causeReceiptId`,
    ),
    partyRevisionBefore: revision(
      row.partyRevisionBefore,
      `${label}.partyRevisionBefore`,
    ),
    partyRevisionAfter: revision(
      row.partyRevisionAfter,
      `${label}.partyRevisionAfter`,
    ),
  });
}

function dependencyKey(value: {
  readonly ownerId: OwnerId;
  readonly targetId: ReferenceId;
}): string {
  return `${value.ownerId}\u0000${value.targetId}`;
}

function parseDependency(
  value: unknown,
  label: string,
): PartyHistoryDependency {
  const row = exactRecord(
    value,
    [
      "kind",
      "version",
      "ownerId",
      "targetId",
      "revisionBefore",
      "revisionAfter",
      "undoDisposition",
      "redoDisposition",
    ],
    [],
    label,
  );
  if (
    row.kind !== "party-history-dependency" ||
    row.version !== 1 ||
    !(row.undoDisposition === "restore" ||
      row.undoDisposition === "remove-if-unchanged") ||
    row.redoDisposition !== "restore"
  )
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const before = revision(row.revisionBefore, `${label}.revisionBefore`),
    after = revision(row.revisionAfter, `${label}.revisionAfter`);
  if (after <= before)
    throw new Error(`${label} besitzt keine vorwärts gerichtete Revision.`);
  return Object.freeze({
    kind: "party-history-dependency",
    version: 1,
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    targetId: referenceId(row.targetId, `${label}.targetId`),
    revisionBefore: before,
    revisionAfter: after,
    undoDisposition: row.undoDisposition,
    redoDisposition: "restore",
  });
}

function parseEntry(
  value: unknown,
  campaign: CampaignId,
  index: number,
): PartyHistoryEntry {
  const label = `PartyCommandHistory.entries[${index}]`,
    baseKeys = [
      "kind",
      "version",
      "status",
      "entryId",
      "causeCommandId",
      "causeCommandDigest",
      "causeReceiptId",
      "partyRevisionBefore",
      "partyRevisionAfter",
      "actionKind",
    ] as const,
    preliminary = exactRecord(value, ["kind", "version", "status"], [
      ...baseKeys.filter((key) => !["kind", "version", "status"].includes(key)),
      "characterIds",
      "dependencies",
      "before",
      "after",
      "subject",
      "tombstoneId",
      "survivingCharacterIds",
      "beforeHash",
      "afterHash",
    ], label);
  if (preliminary.kind !== "party-history-entry" || preliminary.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const actionKind =
      typeof preliminary.actionKind === "string" &&
      preliminary.actionKind.length > 0 &&
      preliminary.actionKind.length <= 128
        ? preliminary.actionKind
        : undefined,
    binding = parseEntryBinding(preliminary, label);
  if (!actionKind) throw new Error(`${label}.actionKind ist ungültig.`);
  if (binding.partyRevisionAfter <= binding.partyRevisionBefore)
    throw new Error(`${label} besitzt keine vorwärts gerichtete Revision.`);
  if (preliminary.status === "reversible") {
    const row = exactRecord(
        value,
        [...baseKeys, "characterIds", "dependencies", "before", "after"],
        [],
        label,
      ),
      before = parsePartyProjection(row.before),
      after = parsePartyProjection(row.after),
      characterIds = Object.freeze(
        uniqueBy(
          exactArray(row.characterIds, `${label}.characterIds`).map((id, i) =>
            characterId(id, `${label}.characterIds[${i}]`),
          ),
          String,
          `${label}.characterIds`,
        ),
      ),
      dependencies = Object.freeze(
        uniqueBy(
          exactArray(row.dependencies, `${label}.dependencies`).map(
            (dependency, dependencyIndex) =>
              parseDependency(
                dependency,
                `${label}.dependencies[${dependencyIndex}]`,
              ),
          ),
          dependencyKey,
          `${label}.dependencies`,
        ),
      );
    if (
      before.campaignId !== campaign ||
      after.campaignId !== campaign ||
      before.partyRevision !== binding.partyRevisionBefore ||
      after.partyRevision !== binding.partyRevisionAfter ||
      characterIds.length === 0
    )
      throw new Error(`${label} bindet keine gültigen Party-Fakten.`);
    return Object.freeze({
      kind: "party-history-entry",
      version: 1,
      status: "reversible",
      ...binding,
      actionKind,
      characterIds,
      dependencies,
      before,
      after,
    });
  }
  if (preliminary.status === "sealed-deletion") {
    const row = exactRecord(
        value,
        [
          ...baseKeys,
          "subject",
          "tombstoneId",
          "survivingCharacterIds",
          "beforeHash",
          "afterHash",
        ],
        [],
        label,
      ),
      survivingCharacterIds = Object.freeze(
        uniqueBy(
          exactArray(
            row.survivingCharacterIds,
            `${label}.survivingCharacterIds`,
          ).map((id, i) =>
            characterId(id, `${label}.survivingCharacterIds[${i}]`),
          ),
          String,
          `${label}.survivingCharacterIds`,
        ),
      );
    if (row.subject !== "[UNKNOWN]")
      throw new Error(`${label} enthält rekonstruierbare Löschhistorie.`);
    return Object.freeze({
      kind: "party-history-entry",
      version: 1,
      status: "sealed-deletion",
      ...binding,
      actionKind,
      subject: "[UNKNOWN]",
      tombstoneId: referenceId(row.tombstoneId, `${label}.tombstoneId`),
      survivingCharacterIds,
      beforeHash: evidence(row.beforeHash, `${label}.beforeHash`),
      afterHash: evidence(row.afterHash, `${label}.afterHash`),
    });
  }
  throw new Error(`${label} besitzt einen unbekannten Status.`);
}

function parseOperation(
  value: unknown,
  index: number,
): PartyHistoryOperation {
  const label = `PartyCommandHistory.operations[${index}]`,
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "direction",
        "commandId",
        "commandDigest",
        "receiptId",
        "entryId",
        "partyRevisionBefore",
        "partyRevisionAfter",
        "participantPlans",
      ],
      [],
      label,
    );
  if (
    row.kind !== "party-history-operation" ||
    row.version !== 1 ||
    !(row.direction === "undo" || row.direction === "redo")
  )
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const before = revision(row.partyRevisionBefore, `${label}.partyRevisionBefore`),
    after = revision(row.partyRevisionAfter, `${label}.partyRevisionAfter`);
  if (after !== before + 1)
    throw new Error(`${label} erhöht die PartyRevision nicht genau einmal.`);
  const participantPlans = Object.freeze(
    uniqueBy(
      exactArray(row.participantPlans, `${label}.participantPlans`).map(
        (value, participantIndex) =>
          parseParticipantPlan(
            value,
            `${label}.participantPlans[${participantIndex}]`,
          ),
      ),
      dependencyKey,
      `${label}.participantPlans`,
    ),
  );
  return Object.freeze({
    kind: "party-history-operation",
    version: 1,
    direction: row.direction,
    commandId: commandId(row.commandId, `${label}.commandId`),
    commandDigest: commandDigest(row.commandDigest, `${label}.commandDigest`),
    receiptId: receiptId(row.receiptId, `${label}.receiptId`),
    entryId: referenceId(row.entryId, `${label}.entryId`),
    partyRevisionBefore: before,
    partyRevisionAfter: after,
    participantPlans,
  });
}

function parseParticipantInput(
  value: unknown,
  label: string,
): PartyHistoryParticipantInput {
  const row = exactRecord(
    value,
    [
      "kind",
      "version",
      "ownerId",
      "targetId",
      "currentRevision",
      "targetUnused",
    ],
    [],
    label,
  );
  if (row.kind !== "party-history-participant-input" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "party-history-participant-input",
    version: 1,
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    targetId: referenceId(row.targetId, `${label}.targetId`),
    currentRevision: revision(
      row.currentRevision,
      `${label}.currentRevision`,
    ),
    targetUnused: exactBoolean(row.targetUnused, `${label}.targetUnused`),
  });
}

function parseParticipantPlan(
  value: unknown,
  label: string,
): PartyHistoryParticipantPlan {
  const row = exactRecord(
    value,
    [
      "kind",
      "version",
      "ownerId",
      "targetId",
      "revisionBefore",
      "revisionAfter",
      "disposition",
    ],
    [],
    label,
  );
  if (
    row.kind !== "party-history-participant-plan" ||
    row.version !== 1 ||
    !(row.disposition === "restore" ||
      row.disposition === "remove-if-unchanged")
  )
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const before = revision(row.revisionBefore, `${label}.revisionBefore`),
    after = revision(row.revisionAfter, `${label}.revisionAfter`);
  if (after <= before)
    throw new Error(`${label} besitzt keine vorwärts gerichtete Revision.`);
  return Object.freeze({
    kind: "party-history-participant-plan",
    version: 1,
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    targetId: referenceId(row.targetId, `${label}.targetId`),
    revisionBefore: before,
    revisionAfter: after,
    disposition: row.disposition,
  });
}

export function parsePartyCommandHistory(value: unknown): PartyCommandHistory {
  const label = "PartyCommandHistory",
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "campaignId",
        "historyRevision",
        "cursor",
        "entries",
        "operations",
      ],
      [],
      label,
    );
  if (row.kind !== "party-command-history" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const campaign = campaignId(row.campaignId, `${label}.campaignId`),
    entries = Object.freeze(
      uniqueBy(
        exactArray(row.entries, `${label}.entries`).map((entry, index) =>
          parseEntry(entry, campaign, index),
        ),
        (entry) => entry.entryId,
        `${label}.entries`,
      ),
    ),
    operations = Object.freeze(
      uniqueBy(
        exactArray(row.operations, `${label}.operations`).map(parseOperation),
        (operation) => operation.commandId,
        `${label}.operations`,
      ),
    ),
    cursor = row.cursor;
  if (
    entries.length > MAX_HISTORY ||
    !Number.isSafeInteger(cursor) ||
    (cursor as number) < 0 ||
    (cursor as number) > entries.length ||
    operations.some((operation) =>
      entries.every((entry) => entry.entryId !== operation.entryId),
    )
  )
    throw new Error(`${label} besitzt einen ungültigen Cursor oder Umfang.`);
  const entryCommands = entries.map((entry) => entry.causeCommandId),
    operationCommands = operations.map((operation) => operation.commandId),
    receiptIds = [
      ...entries.map((entry) => entry.causeReceiptId),
      ...operations.map((operation) => operation.receiptId),
    ];
  if (
    new Set([...entryCommands, ...operationCommands]).size !==
      entryCommands.length + operationCommands.length ||
    new Set(receiptIds).size !== receiptIds.length
  )
    throw new Error(`${label} enthält wiederverwendete Commands oder Receipts.`);
  return Object.freeze({
    kind: "party-command-history",
    version: 1,
    campaignId: campaign,
    historyRevision: revision(row.historyRevision, `${label}.historyRevision`),
    cursor: cursor as number,
    entries,
    operations,
  });
}

export function createPartyCommandHistory(
  campaignValue: unknown,
): PartyCommandHistory {
  return Object.freeze({
    kind: "party-command-history",
    version: 1,
    campaignId: campaignId(campaignValue, "PartyCommandHistory.campaignId"),
    historyRevision: revision(0),
    cursor: 0,
    entries: Object.freeze([]),
    operations: Object.freeze([]),
  });
}

function samePartyContent(left: PartyProjection, right: PartyProjection): boolean {
  return JSON.stringify(left.characters) === JSON.stringify(right.characters);
}

export function recordPartyHistory(
  historyValue: unknown,
  input: {
    readonly entryId: unknown;
    readonly actionKind: string;
    readonly characterIds: readonly unknown[];
    readonly commandId: unknown;
    readonly commandDigest: unknown;
    readonly receiptId: unknown;
    readonly before: unknown;
    readonly after: unknown;
    readonly dependencies?: readonly unknown[];
  },
): PartyCommandHistory {
  const history = parsePartyCommandHistory(historyValue),
    before = parsePartyProjection(input.before),
    after = parsePartyProjection(input.after),
    entry = parseEntry(
      {
        kind: "party-history-entry",
        version: 1,
        status: "reversible",
        entryId: input.entryId,
        causeCommandId: input.commandId,
        causeCommandDigest: input.commandDigest,
        causeReceiptId: input.receiptId,
        partyRevisionBefore: before.partyRevision,
        partyRevisionAfter: after.partyRevision,
        actionKind: input.actionKind,
        characterIds: input.characterIds,
        dependencies: input.dependencies ?? [],
        before,
        after,
      },
      history.campaignId,
      history.cursor,
    );
  if (
    before.campaignId !== history.campaignId ||
    after.campaignId !== history.campaignId ||
    after.partyRevision !== before.partyRevision + 1 ||
    history.entries.some((existing) => existing.entryId === entry.entryId)
  )
    throw new Error("PartyHistory-Aktion bindet keine neue atomare PartyRevision.");
  const branch = history.entries.slice(0, history.cursor),
    causalPredecessor = branch.at(-1);
  if (
    causalPredecessor?.status === "reversible" &&
    !samePartyContent(before, causalPredecessor.after)
  )
    throw new Error("PartyHistory-Aktion widerspricht dem kausalen Vorgänger.");
  const entries = [...branch, entry].slice(-MAX_HISTORY),
    retainedEntryIds = new Set(entries.map((candidate) => candidate.entryId));
  return parsePartyCommandHistory({
    ...history,
    historyRevision: history.historyRevision + 1,
    cursor: entries.length,
    entries,
    operations: history.operations.filter((operation) =>
      retainedEntryIds.has(operation.entryId),
    ),
  });
}

export function parsePartyHistoryCommand(value: unknown): PartyHistoryCommand {
  const label = "PartyHistoryCommand",
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "campaignId",
        "commandId",
        "commandDigest",
        "receiptId",
        "expectedPartyRevision",
        "expectedHistoryRevision",
        "cancelled",
        "participantInputs",
      ],
      [],
      label,
    );
  if (
    !(row.kind === "undo-party-history" || row.kind === "redo-party-history") ||
    row.version !== 1
  )
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: row.kind,
    version: 1,
    campaignId: campaignId(row.campaignId, `${label}.campaignId`),
    commandId: commandId(row.commandId, `${label}.commandId`),
    commandDigest: commandDigest(row.commandDigest, `${label}.commandDigest`),
    receiptId: receiptId(row.receiptId, `${label}.receiptId`),
    expectedPartyRevision: revision(
      row.expectedPartyRevision,
      `${label}.expectedPartyRevision`,
    ),
    expectedHistoryRevision: revision(
      row.expectedHistoryRevision,
      `${label}.expectedHistoryRevision`,
    ),
    cancelled: exactBoolean(row.cancelled, `${label}.cancelled`),
    participantInputs: Object.freeze(
      uniqueBy(
        exactArray(row.participantInputs, `${label}.participantInputs`).map(
          (input, index) =>
            parseParticipantInput(
              input,
              `${label}.participantInputs[${index}]`,
            ),
        ),
        dependencyKey,
        `${label}.participantInputs`,
      ),
    ),
  });
}

export function applyPartyHistoryCommand(
  historyValue: unknown,
  partyValue: unknown,
  commandValue: unknown,
): PartyHistoryResult {
  const history = parsePartyCommandHistory(historyValue),
    party = parsePartyProjection(partyValue),
    command = parsePartyHistoryCommand(commandValue),
    reject = (
      reason: Extract<PartyHistoryResult, { status: "rejected" | "cancelled" }>["reason"],
    ): PartyHistoryResult =>
      Object.freeze({
        status: reason === "cancelled" ? "cancelled" : "rejected",
        party,
        history,
        reason,
      });
  if (command.cancelled) return reject("cancelled");
  if (
    command.campaignId !== party.campaignId ||
    command.campaignId !== history.campaignId
  )
    return reject("foreign-campaign");
  if (command.expectedPartyRevision !== party.partyRevision)
    return reject("stale-party");
  if (command.expectedHistoryRevision !== history.historyRevision)
    return reject("stale-history");
  const undo = command.kind === "undo-party-history",
    index = undo ? history.cursor - 1 : history.cursor;
  if (index < 0) return reject("nothing-to-undo");
  if (index >= history.entries.length) return reject("nothing-to-redo");
  const entry = history.entries[index]!;
  if (entry.status === "sealed-deletion") return reject("irreversible-boundary");
  const expected = undo ? entry.after : entry.before,
    target = undo ? entry.before : entry.after;
  if (!samePartyContent(party, expected)) return reject("causal-conflict");
  if (command.participantInputs.length !== entry.dependencies.length)
    return reject("causal-conflict");
  const participantPlans: PartyHistoryParticipantPlan[] = [];
  for (const dependency of entry.dependencies) {
    const input = command.participantInputs.find(
      (candidate) => dependencyKey(candidate) === dependencyKey(dependency),
    ),
      previousPlan = [...history.operations]
        .reverse()
        .find((operation) => operation.entryId === entry.entryId)
        ?.participantPlans.find(
          (plan) => dependencyKey(plan) === dependencyKey(dependency),
        ),
      expectedCurrentRevision =
        previousPlan?.revisionAfter ?? dependency.revisionAfter;
    if (
      !input ||
      input.currentRevision !== expectedCurrentRevision ||
      (undo &&
        dependency.undoDisposition === "remove-if-unchanged" &&
        !input.targetUnused)
    )
      return reject("causal-conflict");
    participantPlans.push(
      Object.freeze({
        kind: "party-history-participant-plan" as const,
        version: 1 as const,
        ownerId: dependency.ownerId,
        targetId: dependency.targetId,
        revisionBefore: input.currentRevision,
        revisionAfter: revision(
          input.currentRevision + 1,
          "PartyHistoryParticipantPlan.revisionAfter",
        ),
        disposition: undo
          ? dependency.undoDisposition
          : dependency.redoDisposition,
      }),
    );
  }
  const nextParty = parsePartyProjection({
      ...target,
      partyRevision: party.partyRevision + 1,
    }),
    operation = parseOperation(
      {
        kind: "party-history-operation",
        version: 1,
        direction: undo ? "undo" : "redo",
        commandId: command.commandId,
        commandDigest: command.commandDigest,
        receiptId: command.receiptId,
        entryId: entry.entryId,
        partyRevisionBefore: party.partyRevision,
        partyRevisionAfter: nextParty.partyRevision,
        participantPlans,
      },
      history.operations.length,
    ),
    nextHistory = parsePartyCommandHistory({
      ...history,
      historyRevision: history.historyRevision + 1,
      cursor: undo ? history.cursor - 1 : history.cursor + 1,
      operations: [...history.operations, operation].slice(-MAX_HISTORY),
    });
  return Object.freeze({
    status: "applied",
    party: nextParty,
    history: nextHistory,
    operation,
  });
}

function historyHash(
  party: PartyProjection,
  digest: PartyHistoryDigest,
): string {
  return evidenceDigest(
    digest(JSON.stringify(["party-history-fact", 1, party])),
    "PartyHistoryFact.hash",
  );
}

export function sealPartyHistoryForDeletion(
  historyValue: unknown,
  input: {
    readonly entryId: unknown;
    readonly commandId: unknown;
    readonly commandDigest: unknown;
    readonly receiptId: unknown;
    readonly tombstoneId: unknown;
    readonly deletedCharacterId: unknown;
    readonly before: unknown;
    readonly after: unknown;
  },
  digest: PartyHistoryDigest,
): PartyCommandHistory {
  if (typeof digest !== "function") throw new Error("PartyHistoryDigest fehlt.");
  const history = parsePartyCommandHistory(historyValue),
    before = parsePartyProjection(input.before),
    after = parsePartyProjection(input.after),
    deleted = characterId(
      input.deletedCharacterId,
      "PartyHistoryDeletion.deletedCharacterId",
    ),
    tombstone = referenceId(
      input.tombstoneId,
      "PartyHistoryDeletion.tombstoneId",
    );
  if (
    before.campaignId !== history.campaignId ||
    after.campaignId !== history.campaignId ||
    after.partyRevision !== before.partyRevision + 1 ||
    !before.characters.some((character) => character.characterId === deleted) ||
    after.characters.some((character) => character.characterId === deleted)
  )
    throw new Error("PartyHistoryDeletion bindet keine permanente Löschung.");
  const sealedBranch = history.entries.slice(0, history.cursor).map((entry) => {
      if (
        entry.status !== "reversible" ||
        (!entry.before.characters.some(
          (character) => character.characterId === deleted,
        ) &&
          !entry.after.characters.some(
            (character) => character.characterId === deleted,
          ))
      )
        return entry;
      return parseEntry(
        {
          kind: "party-history-entry",
          version: 1,
          status: "sealed-deletion",
          entryId: entry.entryId,
          causeCommandId: entry.causeCommandId,
          causeCommandDigest: entry.causeCommandDigest,
          causeReceiptId: entry.causeReceiptId,
          partyRevisionBefore: entry.partyRevisionBefore,
          partyRevisionAfter: entry.partyRevisionAfter,
          actionKind: entry.actionKind,
          subject: "[UNKNOWN]",
          tombstoneId: tombstone,
          survivingCharacterIds: entry.characterIds.filter(
            (id) => id !== deleted,
          ),
          beforeHash: historyHash(entry.before, digest),
          afterHash: historyHash(entry.after, digest),
        },
        history.campaignId,
        0,
      );
    }),
    deletionEntry = parseEntry(
      {
        kind: "party-history-entry",
        version: 1,
        status: "sealed-deletion",
        entryId: input.entryId,
        causeCommandId: input.commandId,
        causeCommandDigest: input.commandDigest,
        causeReceiptId: input.receiptId,
        partyRevisionBefore: before.partyRevision,
        partyRevisionAfter: after.partyRevision,
        actionKind: "permanent-character-deletion",
        subject: "[UNKNOWN]",
        tombstoneId: tombstone,
        survivingCharacterIds: [],
        beforeHash: historyHash(before, digest),
        afterHash: historyHash(after, digest),
      },
      history.campaignId,
      sealedBranch.length,
    ),
    entries = [...sealedBranch, deletionEntry].slice(-MAX_HISTORY);
  return parsePartyCommandHistory({
    ...history,
    historyRevision: history.historyRevision + 1,
    cursor: entries.length,
    entries,
    operations: history.operations.filter((operation) =>
      entries.some((entry) => entry.entryId === operation.entryId),
    ),
  });
}
