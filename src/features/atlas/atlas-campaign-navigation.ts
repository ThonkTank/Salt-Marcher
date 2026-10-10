import { immutable, isStructuredRoom, parseDocument, safePath } from "../../model";
import { parseCityDocument } from "../city/codec";
import { parseLocationDocument } from "../location/location-schema";
import {
  campaignContext, campaignContextToken, campaignCommandId, campaignId,
  sameSnapshot, payloadDigest, revisionToken,
  type CampaignContextProjection, type CampaignCommandId, type CampaignId,
} from "../campaign/campaign-contracts";
import type { CampaignActivationResult } from "../campaign/campaign-lifecycle";
import {
  campaignDomainOwnershipProjection,
  type CampaignDomainOwnershipProjectionV1, type CampaignOwnerRegistryPort,
} from "../campaign/campaign-ownership";
import type { AtlasRepository } from "./atlas-repository";
import type { AtlasCaptureBasis, AtlasNativeCaptureV1, AtlasNativeFile } from "./atlas-campaign-source";
import { nativeArray, nativeId, nativeRecord } from "./native-values";
import type { AtlasKeyTarget } from "./key-target";
import type { RigidFrame } from "./relative-frame";
import type { WorldPoint } from "./overworld";

export type AtlasNavigationKind = "world" | "location" | "location-section" |
  "city" | "building" | "dungeon" | "room" | "room-section";
export interface AtlasNavigationTarget {
  readonly kind: AtlasNavigationKind;
  readonly documentId: string;
  readonly recordId: string;
  readonly roomId: string | null;
}
export interface AtlasConfirmedInventory {
  readonly context: CampaignContextProjection;
  readonly registryId: string;
  readonly registryRevision: string;
  readonly projectionDigest: string;
  readonly worldId: string;
  /** Confirmed native locators/baselines, not an inferred Campaign inventory. */
  readonly files: readonly {
    readonly kind: AtlasNativeFile["kind"];
    readonly id: string | null;
    readonly path: string;
    readonly savedDigest: string | null;
  }[];
  readonly records: readonly {
    readonly id: string;
    readonly kind: AtlasNavigationKind;
    readonly documentId: string;
    readonly ownerId: string;
    readonly availability: "available" | "retired" | "unavailable";
  }[];
}
export interface AtlasInventoryPort {
  read(projection: CampaignDomainOwnershipProjectionV1, worldId: string): Promise<
    { readonly kind: "confirmed"; readonly inventory: AtlasConfirmedInventory } |
    { readonly kind: "unknown" | "unavailable" }
  >;
}
export interface AtlasResolvedNavigation {
  readonly target: AtlasNavigationTarget;
  readonly key: AtlasKeyTarget | null;
  readonly frame: RigidFrame | null;
  readonly localPoint: WorldPoint;
}
export interface AtlasCampaignMount {
  readonly repository: AtlasRepository;
  /** The existing renderer owns the one camera. */
  readonly renderer: object;
  setInputBlocked(blocked: boolean): undefined;
  prepareNavigation(assertCurrent: () => void): Promise<void>;
  /** Valid keys/gestures and durable draft before Lifecycle.activate; failure keeps the old editor. */
  prepareLeave(assertCurrent: () => void): Promise<void>;
  /** Synchronous camera/key commit; must check the lease immediately before its effects. */
  navigate(target: AtlasResolvedNavigation, assertCurrent: () => void): undefined;
  resume(assertCurrent: () => void): undefined;
  /** Keep unsaved work and won journal roll-forward under the old identity; never cancel publication. */
  suspend(reason: string): "recoverable" | "blocked-unsaved" | "publish-pending";
  /** Detach UI only. Sources/drafts retained by suspend are not discarded. */
  dispose(): undefined;
}
export interface AtlasMountInput {
  readonly context: CampaignContextProjection;
  readonly projection: CampaignDomainOwnershipProjectionV1;
  readonly inventory: AtlasConfirmedInventory;
  readonly generation: number;
  /** Factory/async loaders must check this before hydration, writes and UI effects. */
  readonly assertCurrent: () => void;
}
export interface AtlasCampaignNavigationPorts {
  currentContext(): CampaignContextProjection | null;
  readonly registry: CampaignOwnerRegistryPort;
  readonly inventory: AtlasInventoryPort;
  /** Constructs an inert mount from actual native Sources. No UI activation before resume. */
  openNative(input: AtlasMountInput): Promise<AtlasCampaignMount>;
  activate(commandId: CampaignCommandId, targetId: CampaignId, kind: "open" | "switch"): Promise<CampaignActivationResult>;
}
export interface AtlasNavigationRequest {
  readonly context: CampaignContextProjection;
  readonly worldId: string;
  readonly mountGeneration: number;
  readonly registryRevision: string;
  readonly projectionDigest: string;
  readonly ownerId: string;
  readonly ownerRevision: string;
  readonly sourceGeneration: string;
  readonly sourceDigest: string;
  readonly basis: AtlasCaptureBasis;
  readonly target: AtlasNavigationTarget;
}
interface MountEntry {
  readonly mount: AtlasCampaignMount;
  readonly repository: AtlasRepository;
  readonly source: AtlasRepository["terrainSource"];
  readonly history: AtlasRepository["terrainSource"]["history"];
  readonly renderer: object;
  readonly input: AtlasMountInput;
}
const kinds: readonly AtlasNavigationKind[] = ["world", "location", "location-section", "city", "building", "dungeon", "room", "room-section"];
function context(raw: CampaignContextProjection): CampaignContextProjection {
  const v = nativeRecord(raw, ["schemaVersion", "campaignId", "revision", "name", "namespace", "lifecycle", "contextToken"]);
  const { contextToken: token, ...snapshot } = v;
  return campaignContext(snapshot as unknown as CampaignContextProjection, campaignContextToken(token as string));
}
function sameContext(a: CampaignContextProjection | null, b: CampaignContextProjection | null): boolean {
  return a === b || !!a && !!b && sameSnapshot(a, b) && a.contextToken === b.contextToken;
}
function target(raw: AtlasNavigationTarget): AtlasNavigationTarget {
  const v = nativeRecord(raw, ["kind", "documentId", "recordId", "roomId"]);
  if (!kinds.includes(v.kind as AtlasNavigationKind)) throw new Error("Unbekanntes Atlasziel.");
  if ((v.kind === "room-section") !== (v.roomId !== null)) throw new Error("Fremdes Raumziel.");
  return Object.freeze({ kind: v.kind as AtlasNavigationKind, documentId: nativeId(v.documentId), recordId: nativeId(v.recordId), roomId: v.roomId === null ? null : nativeId(v.roomId) });
}
function inventory(raw: AtlasConfirmedInventory, p: CampaignDomainOwnershipProjectionV1, worldId: string): AtlasConfirmedInventory {
  const v = nativeRecord(raw, ["context", "registryId", "registryRevision", "projectionDigest", "worldId", "files", "records"]);
  if (!sameContext(context(v.context as CampaignContextProjection), p.context) || v.registryId !== p.registryId ||
      v.registryRevision !== p.registryRevision || v.projectionDigest !== p.projectionDigest || v.worldId !== worldId)
    throw new Error("Fremde oder veraltete Atlasbestandsbindung.");
  const paths = new Set<string>(), documents = new Set<string>(), ids = new Set<string>();
  const files = nativeArray(v.files).map((raw) => {
    const f = nativeRecord(raw, ["kind", "id", "path", "savedDigest"]);
    if (!["world", "terrain", "location", "city", "dungeon"].includes(f.kind as string) ||
        (f.kind === "terrain") !== (f.id === null) || typeof f.path !== "string") throw new Error("Unbekannte native Bestandsdatei.");
    safePath(f.path);
    const id = f.id === null ? null : nativeId(f.id);
    if (paths.has(f.path) || id !== null && documents.has(id)) throw new Error("Mehrdeutiger Atlasbestand.");
    paths.add(f.path); if (id !== null) documents.add(id);
    return { kind: f.kind as AtlasNativeFile["kind"], id, path: f.path, savedDigest: f.savedDigest === null ? null : payloadDigest(f.savedDigest as string) };
  });
  const records = nativeArray(v.records).map((raw) => {
    const r = nativeRecord(raw, ["id", "kind", "documentId", "ownerId", "availability"]);
    const id = nativeId(r.id), documentId = nativeId(r.documentId), kind = r.kind as AtlasNavigationKind;
    if (ids.has(id) || !kinds.includes(kind) || !documents.has(documentId) ||
        !["available", "retired", "unavailable"].includes(r.availability as string)) throw new Error("Mehrdeutige oder fehlende Atlasrecordbindung.");
    ids.add(id);
    const owner = p.owners.find((o) => o.ownerId === r.ownerId);
    const owned = owner?.records.find((o) => o.id === id);
    if (!owned || owned.recordType !== kind) throw new Error("Atlasrecord gehört keinem bestätigten Owner.");
    return { id, kind, documentId, ownerId: owner!.ownerId, availability: r.availability as "available" | "retired" | "unavailable" };
  });
  if (!files.some((f) => f.kind === "world" && f.id === worldId) ||
      !records.some((r) => r.kind === "world" && r.id === worldId && r.documentId === worldId && r.availability === "available"))
    throw new Error("Atlaswelt ist nicht bestätigt verfügbar.");
  return immutable({ context: p.context, registryId: p.registryId, registryRevision: p.registryRevision, projectionDigest: p.projectionDigest, worldId, files, records });
}
function checkFiles(c: AtlasNativeCaptureV1, i: AtlasConfirmedInventory): void {
  if (c.worldId !== i.worldId) throw new Error("Fremde native Atlaswelt.");
  if (i.files.some((expected) => !c.files.some((f) => f.path === expected.path))) throw new Error("Atlasbestand ist unvollständig.");
  for (const f of c.files) {
    const expected = i.files.find((v) => v.path === f.path);
    // New terrain files are subordinate local World drafts, never new confirmed Records.
    if (!expected && f.kind === "terrain" && f.before === null) continue;
    if (!expected || expected.kind !== f.kind || expected.id !== f.id || expected.savedDigest !== f.beforeDigest)
      throw new Error("Native Atlasdatei passt nicht zur bestätigten Basis.");
  }
}
function resolve(c: AtlasNativeCaptureV1, t: AtlasNavigationTarget): { key: AtlasKeyTarget | null; localPoint: WorldPoint } {
  const kind = t.kind === "location-section" ? "location" : t.kind === "building" ? "city" :
    t.kind === "room" || t.kind === "room-section" ? "dungeon" : t.kind;
  const f = c.files.find((f) => f.kind === kind && f.id === t.documentId && f.after !== null);
  if (!f) throw new Error("Natives Atlasziel fehlt.");
  let exists = false, key: AtlasKeyTarget | null = null, localPoint = { x: 0, y: 0 };
  if (kind === "world") exists = c.world.id === t.recordId && c.world.id === t.documentId;
  else if (kind === "location") {
    const doc = parseLocationDocument(f.after!);
    exists = t.kind === "location" ? doc.id === t.recordId : doc.sections.some((s) => s.id === t.recordId);
    key = { kind: "location", atlasId: c.worldId, documentId: doc.id, sectionId: t.kind === "location-section" ? t.recordId : null };
  } else if (kind === "city") {
    const doc = parseCityDocument(f.after!);
    if (t.kind === "city") exists = doc.id === t.recordId;
    else { const building = doc.buildings.find((b) => b.id === t.recordId); exists = !!building; if (building) localPoint = building.position; }
  } else {
    const doc = parseDocument(f.after!);
    if (t.kind === "dungeon") exists = doc.id === t.recordId;
    else {
      const room = doc.entities.find((r) => r.id === (t.roomId ?? t.recordId));
      exists = isStructuredRoom(room) && (t.kind === "room" || room.key.sections.some((s) => s.id === t.recordId));
      if (isStructuredRoom(room)) {
        localPoint = room.polygons[0]?.outer[0] ?? localPoint;
        key = { kind: "room", atlasId: c.worldId, documentId: doc.id, roomId: room.id, sectionId: t.kind === "room-section" ? t.recordId : null, anchor: null };
      }
    }
  }
  if (!exists) throw new Error("Natives Atlasziel fehlt oder besitzt einen anderen Typ.");
  return { key, localPoint };
}

/** Consumer only. Confirmed Context/Registry/inventory and an actual native mount are supplied by their owners. */
export class AtlasCampaignNavigation {
  private generation = 0;
  private active?: MountEntry;
  private pendingContext: CampaignContextProjection | null = null;
  private busy?: object;
  private closed = false;
  private readonly usedSources = new WeakSet<object>();
  private readonly retained: { context: CampaignContextProjection; mount: AtlasCampaignMount; reason: string }[] = [];
  private unavailable = "Atlas ist noch nicht geöffnet.";
  constructor(private readonly ports: AtlasCampaignNavigationPorts) {}
  get state() {
    this.contextChanged();
    return this.active ? Object.freeze({ kind: "active" as const, ...this.active.input, repository: this.active.repository,
      history: this.active.history, renderer: this.active.renderer }) : Object.freeze({ kind: "unavailable" as const, context: this.ports.currentContext(), reason: this.unavailable });
  }
  get retainedMounts() { return Object.freeze(this.retained.map((r) => Object.freeze({ ...r }))); }
  /** Host calls synchronously on external Context changes. Every lease also checks the actual Context. */
  contextChanged(): void {
    const expected = this.active?.input.context ?? this.pendingContext;
    if (expected && !sameContext(expected, this.ports.currentContext())) {
      this.generation++; this.pendingContext = null; this.busy = undefined;
      this.retire("CampaignContext wurde extern gewechselt.");
      this.unavailable = "Atlasbindung ist widerrufen; alte Arbeit bleibt unter ihrer alten Identität erhalten.";
    }
  }
  private retire(reason: string): void {
    const entry = this.active; this.active = undefined;
    if (!entry) return;
    if (this.generation === entry.input.generation) this.generation++;
    entry.mount.setInputBlocked(true);
    const retention = entry.mount.suspend(reason);
    if (retention !== "recoverable") this.retained.push({ context: entry.input.context, mount: entry.mount, reason: retention });
    entry.mount.dispose();
  }
  private guard(c: CampaignContextProjection, stamp: number, entry?: MountEntry): void {
    this.contextChanged();
    if (entry && this.active === entry && (entry.repository !== entry.mount.repository || entry.source !== entry.repository.terrainSource ||
        entry.history !== entry.source.history || entry.renderer !== entry.mount.renderer)) {
      this.retire("Native Source-/History-/Rendererbindung wurde ersetzt.");
      this.unavailable = "Native Atlasbindung ist widerrufen.";
    }
    if (this.closed || stamp !== this.generation || c.lifecycle !== "active" || !sameContext(c, this.ports.currentContext()) ||
        entry && (entry.repository !== entry.mount.repository || entry.source !== entry.repository.terrainSource ||
          entry.history !== entry.source.history || entry.renderer !== entry.mount.renderer || this.active !== entry))
      throw new Error("Atlas-Context, Mount oder Source ist veraltet.");
  }
  private async run<T>(action: (token: object) => Promise<T>): Promise<T> {
    this.contextChanged();
    if (this.closed || this.busy) throw new Error("Atlasnavigation ist geschlossen oder beschäftigt.");
    const token = {}; this.busy = token;
    try { return await action(token); } finally { if (this.busy === token) this.busy = undefined; }
  }
  private async verify(entry: MountEntry): Promise<void> {
    const guard = () => this.guard(entry.input.context, entry.input.generation, entry);
    guard(); const outcome = await this.ports.registry.verify(entry.input.projection); guard();
    if (outcome.kind !== "current") throw new Error("Atlasregistry ist nicht bestätigt aktuell.");
  }
  private capture(entry: MountEntry): Promise<AtlasNativeCaptureV1> {
    return entry.repository.captureNative({ worldId: entry.input.inventory.worldId,
      assertCurrent: () => this.guard(entry.input.context, entry.input.generation, entry),
      additionalLocations: entry.input.inventory.files.filter((f) => f.kind === "location").map((f) => ({ id: f.id!, path: f.path })) });
  }
  async open(expected: CampaignContextProjection, worldId: string): Promise<void> {
    const c = context(expected), id = nativeId(worldId);
    return this.run(() => this.mount(c, id));
  }
  private async mount(c: CampaignContextProjection, worldId: string): Promise<void> {
    this.guard(c, this.generation);
    if (this.active) {
      if (this.active.input.inventory.worldId === worldId && sameContext(this.active.input.context, c)) { await this.verify(this.active); return; }
      throw new Error("Vor dem Atlaswechsel muss die bisherige Arbeit gesichert werden.");
    }
    const stamp = ++this.generation; this.pendingContext = c;
    let created: AtlasCampaignMount | undefined;
    const guard = () => this.guard(c, stamp, this.active?.input.generation === stamp ? this.active : undefined);
    try {
      guard(); const read = await this.ports.registry.read(c); guard();
      if (read.kind !== "confirmed") throw new Error("Atlasregistry ist nicht bestätigt verfügbar.");
      const projection = campaignDomainOwnershipProjection(read.projection);
      if (!sameContext(projection.context, c)) throw new Error("Fremder Registrycontext.");
      const outcome = await this.ports.inventory.read(projection, worldId); guard();
      if (outcome.kind !== "confirmed") throw new Error("Atlasbestand ist nicht bestätigt verfügbar.");
      const inv = inventory(outcome.inventory, projection, worldId);
      const current = await this.ports.registry.verify(projection); guard();
      if (current.kind !== "current") throw new Error("Atlasregistry ist veraltet.");
      const input = Object.freeze({ context: c, projection, inventory: inv, generation: stamp, assertCurrent: guard });
      created = await this.ports.openNative(input); guard();
      const repository = created.repository, source = repository.terrainSource;
      if (this.usedSources.has(source) || source.world.id !== worldId) throw new Error("Wiederverwendete oder fremde Atlasquelle.");
      this.usedSources.add(source);
      const entry: MountEntry = { mount: created, repository, source, history: source.history, renderer: created.renderer, input };
      this.active = entry;
      const captured = await this.capture(entry); guard(); checkFiles(captured, inv);
      await this.verify(entry); guard();
      await repository.verifyNativeCapture(captured); guard();
      if (created.resume(guard) !== undefined) throw new Error("Atlasaktivierung muss synchron abschließen.");
      this.pendingContext = null;
    } catch (error) {
      const owned = this.active?.input.generation === stamp || this.generation === stamp;
      if (this.active?.input.generation === stamp) this.retire("Atlasladen fehlgeschlagen.");
      else if (created) { this.usedSources.add(created.repository.terrainSource); const reason = created.suspend("Verspäteter Atlasmount."); if (reason !== "recoverable") this.retained.push({ context: c, mount: created, reason }); created.dispose(); }
      if (this.pendingContext === c) this.pendingContext = null;
      if (owned) { if (this.generation === stamp) this.generation++; this.unavailable = error instanceof Error ? error.message : String(error); }
      throw error;
    }
  }
  async navigate(raw: AtlasNavigationRequest): Promise<void> {
    // Copy every expected value before the first await; requests cannot retarget pending work.
    const v = nativeRecord(raw, ["context", "worldId", "mountGeneration", "registryRevision", "projectionDigest", "ownerId", "ownerRevision", "sourceGeneration", "sourceDigest", "basis", "target"]);
    const basis = nativeRecord(v.basis, ["generation", "historyEpoch", "repositoryEpoch"]);
    if (Object.values(basis).some((n) => typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) ||
        !Number.isSafeInteger(v.mountGeneration) || (v.mountGeneration as number) < 1) throw new Error("Ungültige Atlaslebensdauer.");
    const request = Object.freeze({ ...v, context: context(v.context as CampaignContextProjection), target: target(v.target as AtlasNavigationTarget),
      worldId: nativeId(v.worldId), projectionDigest: payloadDigest(v.projectionDigest as string), sourceDigest: payloadDigest(v.sourceDigest as string),
      registryRevision: revisionToken(v.registryRevision as string, "Registryrevision"), basis: Object.freeze({ ...basis }) }) as unknown as AtlasNavigationRequest;
    return this.run(async () => {
      const entry = this.active; if (!entry) throw new Error("Kein aktiver Atlasmount.");
      const guard = () => this.guard(entry.input.context, entry.input.generation, entry);
      guard();
      const p = entry.input.projection, i = entry.input.inventory;
      const record = i.records.find((r) => r.id === request.target.recordId && r.documentId === request.target.documentId && r.kind === request.target.kind);
      const owner = p.owners.find((o) => o.ownerId === record?.ownerId);
      if (!sameContext(request.context, entry.input.context) || request.worldId !== i.worldId || request.mountGeneration !== entry.input.generation ||
          request.registryRevision !== p.registryRevision || request.projectionDigest !== p.projectionDigest || !record || record.availability !== "available" ||
          !owner || request.ownerId !== owner.ownerId || request.ownerRevision !== owner.ownerRevision || request.sourceGeneration !== owner.source.generation)
        throw new Error("Atlasziel oder Owner-/Mountbindung ist nicht bestätigt verfügbar.");
      await this.verify(entry); guard();
      const before = await this.capture(entry); guard(); checkFiles(before, i);
      if (before.sourceDigest !== request.sourceDigest || before.basis.generation !== request.basis.generation ||
          before.basis.historyEpoch !== request.basis.historyEpoch || before.basis.repositoryEpoch !== request.basis.repositoryEpoch)
        throw new Error("Erwarteter nativer Atlasquellstand ist veraltet.");
      resolve(before, request.target);
      entry.mount.setInputBlocked(true);
      try {
        await entry.mount.prepareNavigation(guard); guard();
        const captured = await this.capture(entry); guard(); checkFiles(captured, i);
        const resolved = resolve(captured, request.target);
        await this.verify(entry); guard();
        await entry.repository.verifyNativeCapture(captured); guard();
        let frame: RigidFrame | null = null;
        if (request.target.kind === "world") frame = { anchor: captured.world.origin, offsetsMeters: [], rotationRadians: 0, metersPerUnit: 1, originUnits: { x: 0, y: 0 }, precisionMeters: 0 };
        else if (request.target.kind === "location" || request.target.kind === "location-section") {
          const placement = captured.world.placements.find((p) => p.locationId === request.target.documentId);
          if (placement) frame = { anchor: placement.position, offsetsMeters: [], rotationRadians: 0, metersPerUnit: 1, originUnits: { x: 0, y: 0 }, precisionMeters: 0 };
        } else frame = entry.repository.spatialGraph.frame(request.target.documentId);
        guard();
        if (entry.mount.navigate(immutable({ target: request.target, ...resolved, frame }), guard) !== undefined)
          throw new Error("Kamera-/Keynavigation muss synchron abschließen.");
      } finally { if (this.active === entry && sameContext(entry.input.context, this.ports.currentContext())) entry.mount.setInputBlocked(false); }
    });
  }
  async switchCampaign(expected: CampaignContextProjection | null, commandId: CampaignCommandId, targetId: CampaignId, worldId: string): Promise<CampaignActivationResult> {
    const c = expected === null ? null : context(expected), command = campaignCommandId(commandId), id = campaignId(targetId), world = nativeId(worldId);
    return this.run(async (token) => {
      if (!sameContext(c, this.ports.currentContext())) throw new Error("Angeforderter Campaigncontext ist veraltet.");
      const old = this.active, stamp = this.generation;
      const guard = () => { if (c) this.guard(c, stamp, old); else if (this.closed || this.generation !== stamp || this.ports.currentContext() !== null) throw new Error("Aktivierungsbasis ist veraltet."); };
      old?.mount.setInputBlocked(true);
      let result: CampaignActivationResult;
      try {
        guard(); if (old) { await old.mount.prepareLeave(guard); guard(); }
        result = await this.ports.activate(command, id, c ? "switch" : "open");
      } catch (error) {
        this.contextChanged();
        if (old && this.active === old && sameContext(c, this.ports.currentContext())) old.mount.setInputBlocked(false);
        throw error;
      }
      this.contextChanged();
      if (!result.applied || !result.context || result.context.lifecycle !== "active" || !sameContext(result.context, this.ports.currentContext())) {
        if (old && this.active === old && sameContext(c, this.ports.currentContext())) old.mount.setInputBlocked(false);
        throw new Error("Aktivierung wurde nicht aktuell und aktiv angewendet.");
      }
      this.retire("Campaignwechsel wurde bestätigt.");
      this.busy = token;
      // A failed new mount never rolls back a confirmed Lifecycle activation.
      await this.mount(context(result.context), world);
      return result;
    });
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true; this.generation++; this.pendingContext = null; this.busy = undefined;
    this.retire("Atlasnavigation wurde geschlossen.");
  }
}
