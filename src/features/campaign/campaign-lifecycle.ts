import {
  campaignCommandId,
  campaignContext,
  campaignContextToken,
  campaignId,
  campaignReceipt,
  campaignReceiptId,
  campaignRevision,
  campaignSnapshot,
  sameSnapshot,
  type CampaignCommandId,
  type CampaignContextProjection,
  type CampaignContextToken,
  type CampaignId,
  type CampaignNamespace,
  type CampaignReceipt,
  type CampaignReceiptId,
  type CampaignSnapshotV1,
} from "./campaign-contracts";

export interface CampaignMutationRequest {
  readonly commandId: CampaignCommandId;
  readonly receiptId: CampaignReceiptId;
  readonly kind: "create" | "rename";
  readonly before: CampaignSnapshotV1 | null;
  readonly after: CampaignSnapshotV1;
}
export type CampaignPortOutcome =
  | { readonly kind: "confirmed"; readonly snapshot: CampaignSnapshotV1 }
  | { readonly kind: "conflict" }
  | { readonly kind: "outcome_unknown" };
export interface CampaignLifecyclePort {
  read(campaignId: CampaignId): Promise<CampaignSnapshotV1 | null>;
  publish(request: CampaignMutationRequest): Promise<CampaignPortOutcome>;
  status(commandId: CampaignCommandId, receiptId: CampaignReceiptId): Promise<CampaignPortOutcome>;
}
export interface CampaignLifecycleFactories {
  campaignId(): CampaignId;
  namespace(): CampaignNamespace;
  contextToken(): CampaignContextToken;
  receiptId(): CampaignReceiptId;
}
interface StagedCommand {
  readonly fingerprint: string;
  readonly request: CampaignMutationRequest;
  readonly expectedContext: CampaignContextProjection | null;
  receipt: CampaignReceipt;
  publishStarted: boolean;
  running?: Promise<CampaignReceipt>;
}
export interface CampaignActivationResult {
  readonly receipt: CampaignReceipt;
  readonly context: CampaignContextProjection | null;
  readonly applied: boolean;
}
interface Activation {
  readonly fingerprint: string;
  readonly sequence: number;
  readonly token: CampaignContextToken;
  readonly receiptId: CampaignReceiptId;
  readonly promise: Promise<CampaignActivationResult>;
}

function sameContext(
  a: CampaignContextProjection | null,
  b: CampaignContextProjection | null,
): boolean {
  return a === b || !!a && !!b && a.campaignId === b.campaignId &&
    a.revision === b.revision && a.namespace === b.namespace &&
    a.contextToken === b.contextToken;
}
function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}

export class CampaignLifecycle {
  private readonly commands = new Map<CampaignCommandId, StagedCommand>();
  private readonly activations = new Map<CampaignCommandId, Activation>();
  private readonly allocatedReceiptIds = new Set<CampaignReceiptId>();
  private readonly allocatedContextTokens = new Set<CampaignContextToken>();
  private current: CampaignContextProjection | null = null;
  private activationSequence = 0;

  constructor(
    private readonly port: CampaignLifecyclePort,
    private readonly factories: CampaignLifecycleFactories,
  ) {}

  get context(): CampaignContextProjection | null {
    return this.current;
  }

  private assertCommandUnused(commandId: CampaignCommandId): void {
    if (this.activations.has(commandId))
      throw new Error("Command-ID gehört bereits zu einer Aktivierung.");
  }
  private receiptId(): CampaignReceiptId {
    const value = campaignReceiptId(String(this.factories.receiptId()));
    if (this.allocatedReceiptIds.has(value))
      throw new Error("Receipt-Fabrik erzeugt keine eindeutigen IDs.");
    this.allocatedReceiptIds.add(value);
    return value;
  }
  private contextToken(): CampaignContextToken {
    const value = campaignContextToken(String(this.factories.contextToken()));
    if (this.allocatedContextTokens.has(value))
      throw new Error("Context-Fabrik erzeugt keine eindeutigen IDs.");
    this.allocatedContextTokens.add(value);
    return value;
  }
  private existingOrStage(
    commandId: CampaignCommandId,
    commandFingerprint: string,
    build: () => Omit<StagedCommand, "fingerprint" | "publishStarted">,
  ): CampaignReceipt {
    this.assertCommandUnused(commandId);
    const existing = this.commands.get(commandId);
    if (existing) {
      if (existing.fingerprint !== commandFingerprint)
        throw new Error("Command-ID wurde mit anderem Auftrag wiederverwendet.");
      return existing.receipt;
    }
    const staged = { ...build(), fingerprint: commandFingerprint, publishStarted: false };
    this.commands.set(commandId, staged);
    return staged.receipt;
  }

  stageCreate(commandId: CampaignCommandId, name: string): CampaignReceipt {
    commandId = campaignCommandId(String(commandId));
    const commandFingerprint = fingerprint(["create", name]);
    return this.existingOrStage(commandId, commandFingerprint, () => {
      const targetCampaignId = campaignId(String(this.factories.campaignId())),
        after = campaignSnapshot({
          schemaVersion: 1,
          campaignId: targetCampaignId,
          revision: campaignRevision(1),
          name,
          namespace: this.factories.namespace(),
          lifecycle: "active",
        }),
        receiptId = this.receiptId();
      return {
        request: Object.freeze({ commandId, receiptId, kind: "create", before: null, after }),
        expectedContext: null,
        receipt: campaignReceipt({
          commandId, receiptId, kind: "create", status: "staged",
          sourceCampaignId: null, targetCampaignId, expectedRevision: null, contextToken: null,
        }),
      };
    });
  }

  stageRename(
    commandId: CampaignCommandId,
    expectedContext: CampaignContextProjection,
    name: string,
  ): CampaignReceipt {
    commandId = campaignCommandId(String(commandId));
    const before = campaignSnapshot({
        schemaVersion: expectedContext.schemaVersion,
        campaignId: expectedContext.campaignId,
        revision: expectedContext.revision,
        name: expectedContext.name,
        namespace: expectedContext.namespace,
        lifecycle: expectedContext.lifecycle,
      }),
      commandFingerprint = fingerprint(["rename", before, expectedContext.contextToken, name]);
    return this.existingOrStage(commandId, commandFingerprint, () => {
      const after = campaignSnapshot({
        ...before,
        revision: campaignRevision(before.revision + 1),
        name,
      }), receiptId = this.receiptId();
      return {
        request: Object.freeze({ commandId, receiptId, kind: "rename", before, after }),
        expectedContext: campaignContext(before, expectedContext.contextToken),
        receipt: campaignReceipt({
          commandId, receiptId, kind: "rename", status: "staged",
          sourceCampaignId: before.campaignId, targetCampaignId: before.campaignId,
          expectedRevision: before.revision, contextToken: expectedContext.contextToken,
        }),
      };
    });
  }

  cancel(commandId: CampaignCommandId): boolean {
    commandId = campaignCommandId(String(commandId));
    const command = this.commands.get(commandId);
    if (!command) throw new Error("Unbekannte Command-ID.");
    if (command.publishStarted || !["staged", "validated"].includes(command.receipt.status))
      return false;
    command.receipt = campaignReceipt({ ...command.receipt, status: "cancelled_before_publish" });
    return true;
  }

  execute(commandId: CampaignCommandId): Promise<CampaignReceipt> {
    commandId = campaignCommandId(String(commandId));
    const command = this.commands.get(commandId);
    if (!command) return Promise.reject(new Error("Unbekannte Command-ID."));
    if (command.running) return command.running;
    if (["finalized", "cancelled_before_publish", "conflict", "outcome_unknown"].includes(command.receipt.status))
      return Promise.resolve(command.receipt);
    if (command.expectedContext && !sameContext(this.current, command.expectedContext)) {
      command.receipt = campaignReceipt({ ...command.receipt, status: "conflict" });
      return Promise.resolve(command.receipt);
    }
    command.receipt = campaignReceipt({ ...command.receipt, status: "validated" });
    command.publishStarted = true;
    command.running = Promise.resolve().then(() => this.port.publish(command.request)).then((outcome) =>
      this.applyOutcome(command, outcome), () => {
        command.receipt = campaignReceipt({ ...command.receipt, status: "outcome_unknown" });
        return command.receipt;
      });
    return command.running;
  }

  query(commandId: CampaignCommandId): Promise<CampaignReceipt> {
    commandId = campaignCommandId(String(commandId));
    const command = this.commands.get(commandId);
    if (!command) return Promise.reject(new Error("Unbekannte Command-ID."));
    if (command.receipt.status !== "outcome_unknown") return Promise.resolve(command.receipt);
    return this.port.status(commandId, command.request.receiptId).then((outcome) =>
      this.applyOutcome(command, outcome));
  }

  private applyOutcome(command: StagedCommand, outcome: CampaignPortOutcome): CampaignReceipt {
    if (outcome.kind === "outcome_unknown") {
      command.receipt = campaignReceipt({ ...command.receipt, status: "outcome_unknown" });
      return command.receipt;
    }
    if (outcome.kind === "conflict") {
      command.receipt = campaignReceipt({ ...command.receipt, status: "conflict" });
      return command.receipt;
    }
    const confirmed = campaignSnapshot(outcome.snapshot);
    if (!sameSnapshot(confirmed, command.request.after)) {
      command.receipt = campaignReceipt({ ...command.receipt, status: "conflict" });
      throw new Error("Bestätigter Campaign-Snapshot weicht vom Auftrag ab.");
    }
    command.receipt = campaignReceipt({ ...command.receipt, status: "finalized" });
    if (command.expectedContext && sameContext(this.current, command.expectedContext))
      this.current = campaignContext(confirmed, command.expectedContext.contextToken);
    return command.receipt;
  }

  activate(
    commandId: CampaignCommandId,
    targetId: CampaignId,
    kind: "open" | "switch" = "open",
  ): Promise<CampaignActivationResult> {
    commandId = campaignCommandId(String(commandId));
    if (this.commands.has(commandId))
      return Promise.reject(new Error("Command-ID gehört bereits zu einer Mutation."));
    const target = campaignId(String(targetId)), commandFingerprint = fingerprint([kind, target]);
    const existing = this.activations.get(commandId);
    if (existing) {
      if (existing.fingerprint !== commandFingerprint)
        return Promise.reject(new Error("Command-ID wurde mit anderer Aktivierung wiederverwendet."));
      return existing.promise;
    }
    const sequence = ++this.activationSequence,
      token = this.contextToken(), receiptId = this.receiptId();
    const promise = Promise.resolve().then(() => this.port.read(target)).then((raw): CampaignActivationResult => {
      if (raw === null) return Object.freeze({
        receipt: campaignReceipt({
          commandId, receiptId, kind, status: "conflict",
          sourceCampaignId: target, targetCampaignId: target,
          expectedRevision: null, contextToken: token,
        }),
        context: null,
        applied: false,
      });
      const snapshot = campaignSnapshot(raw);
      if (snapshot.campaignId !== target) throw new Error("Geladene Campaign besitzt eine fremde Identität.");
      const context = campaignContext(snapshot, token), applied = sequence === this.activationSequence;
      if (applied) this.current = context;
      return Object.freeze({
        receipt: campaignReceipt({
          commandId, receiptId, kind, status: "finalized",
          sourceCampaignId: target, targetCampaignId: target,
          expectedRevision: snapshot.revision, contextToken: token,
        }),
        context,
        applied,
      });
    });
    this.activations.set(commandId, { fingerprint: commandFingerprint, sequence, token, receiptId, promise });
    return promise;
  }
}
