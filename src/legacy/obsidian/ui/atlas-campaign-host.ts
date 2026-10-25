import { CampaignEntry, type CampaignEntryItem } from "./campaign-entry";
import {
  AtlasCampaignNavigation,
  type AtlasCampaignMount,
  type AtlasMountInput,
  type AtlasNavigationTarget,
} from "../../../features/atlas/atlas-campaign-navigation";
import {
  campaignCommandId,
  type CampaignId,
} from "../../../features/campaign/campaign-contracts";
import type { CampaignRuntimeNavigationProvider } from "../../../features/campaign/campaign-runtime-source";
import type { AtlasDetailEntryModel } from "./atlas-detail-entry";
import { CitySource } from "../../../features/city/commands";
import { DungeonAtlasSource } from "../../../features/dungeon/atlas-source";
import { isStructuredRoom } from "../../../model";
import type { AtlasCampaignManifestSave } from "../../../features/atlas/atlas-campaign-save";
import type { MwsImportMediaInventoryPort } from "../../../features/campaign/mws-complete-import-media";
import type { CampaignContextProjection } from "../../../features/campaign/campaign-contracts";
import type { WorldNotesCampaignCommitParticipant } from "../../../features/campaign/world-notes-commit";

export interface AtlasCampaignServices {
  readonly provider: CampaignRuntimeNavigationProvider;
  assertOpen?(): void;
  subscribeClosed?(closed: () => void): () => void;
  readonly retainedDrafts?: readonly {
    readonly title: string;
    readonly element: HTMLElement;
  }[];
  retainDraft?(draft: {
    readonly title: string;
    readonly element: HTMLElement;
  }): void;
  /** A requested target only. The Navigator independently confirms Registry and inventory. */
  worldHint(id: CampaignId): Promise<string>;
  campaignHint(path: string, worldId: string,
    standalone: (assertCurrent: () => void) => Promise<readonly string[]>): Promise<CampaignId | null>;
  createSave?(input: AtlasMountInput): Promise<AtlasCampaignManifestSave>;
  /** Campaign-authorized World Notes producer bound to the current manifest and Context. */
  createWorldNotesSave?(input: {
    readonly context: CampaignContextProjection;
    readonly assertCurrent: () => void;
  }): Promise<WorldNotesCampaignCommitParticipant>;
  /** Host-bound bytes for the existing Complete-Import media review. */
  createImportMediaInventory?(root: string): MwsImportMediaInventoryPort;
}

/** One visible consumer of the actual Campaign provider and the existing safe Navigator. */
export class AtlasCampaignHost {
  private navigation: AtlasCampaignNavigation;
  private readonly picker: CampaignEntry;
  private entries: readonly CampaignEntryItem[] = [];
  private refreshVersion = 0;
  private operationVersion = 0;
  private closed = false;
  private unregistered = false;
  private unsubscribe: () => void;
  private unsubscribeClosed: () => void = () => {};
  constructor(
    host: HTMLElement,
    private readonly services: AtlasCampaignServices,
    private readonly access: {
      openNative(input: AtlasMountInput): Promise<AtlasCampaignMount>;
      prepareUnbound(): Promise<void>;
      changed(reason: string | null): void;
    },
  ) {
    this.navigation = this.newNavigation();
    this.picker = new CampaignEntry(host, {
      onOpen: async (id) => {
        await this.openCampaign(id);
        return {
          activeCampaignId:
            services.provider.currentContext()?.campaignId ?? null,
        };
      },
      onRetry: () => this.refresh(),
    });
    // Text input and the picker never reach the canvas's pointer/keyboard router.
    for (const name of [
      "keydown",
      "keyup",
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "click",
      "dblclick",
      "contextmenu",
      "wheel",
    ])
      host.addEventListener(name, this.stop);
    this.unsubscribe = services.provider.subscribeContextChanged(() => {
      this.navigation.contextChanged();
      this.update(); // synchronous revocation; no delayed list load grants authority
    });
    this.unsubscribeClosed =
      services.subscribeClosed?.(() => {
        this.navigation.contextChanged();
        this.update();
      }) ?? (() => {});
  }
  private readonly stop = (event: Event) => event.stopPropagation();
  private newNavigation(): AtlasCampaignNavigation {
    const p = this.services.provider;
    return new AtlasCampaignNavigation({
      currentContext: () => {
        try {
          this.services.assertOpen?.();
          return p.currentContext();
        } catch {
          return null;
        }
      },
      registry: p.registry,
      inventory: p.inventory,
      activate: (command, id, kind) => p.activate(command, id, kind),
      openNative: (input) => this.access.openNative(input),
    });
  }
  get state() {
    return this.navigation.state;
  }
  async save(): Promise<void> {
    const navigation = this.navigation;
    if (this.closed) throw new Error("Atlasansicht ist geschlossen.");
    try { await navigation.save(); }
    finally { if (!this.closed && navigation === this.navigation) this.update(); }
  }
  showUnregisteredAtlas(): void {
    if (this.closed) return;
    this.unregistered = true;
    this.update(); // Keep available campaigns visible, without claiming membership for this leaf.
  }
  async refresh(): Promise<void> {
    const version = ++this.refreshVersion;
    const entries = await this.services.provider.entries();
    if (this.closed || version !== this.refreshVersion) return;
    this.entries = entries;
    this.update();
  }
  private update(error?: string): void {
    if (this.closed) return;
    const state = this.navigation.state;
    const reason =
      error ?? (!this.unregistered && state.kind === "unavailable" ? state.reason : null);
    this.picker.update({
      entries: this.entries,
      activeCampaignId:
        this.unregistered ? null : this.services.provider.currentContext()?.campaignId ?? null,
      activeUnavailableReason: reason ?? undefined,
    });
    this.access.changed(reason);
  }
  async openFile(path: string, worldId: string,
    standalone: (assertCurrent: () => void) => Promise<readonly string[]>): Promise<boolean> {
    const id = await this.services.campaignHint(path, worldId, standalone);
    if (this.closed) return true;
    if (!id) return false;
    await this.openCampaign(id);
    return true;
  }
  async openCampaign(id: CampaignId): Promise<void> {
    if (this.closed) throw new Error("Atlasansicht ist geschlossen.");
    this.unregistered = false;
    const version = ++this.operationVersion;
    const navigation = this.navigation,
      expected = this.services.provider.currentContext();
    try {
      const world = await this.services.worldHint(id);
      if (this.closed || navigation !== this.navigation)
        throw new Error("Atlasansicht wurde abgelöst.");
      await this.access.prepareUnbound();
      await navigation.switchCampaign(
        expected,
        campaignCommandId(crypto.randomUUID()),
        id,
        world,
      );
      if (
        !this.closed &&
        navigation === this.navigation &&
        version === this.operationVersion
      )
        this.update();
    } catch (error) {
      if (
        !this.closed &&
        navigation === this.navigation &&
        version === this.operationVersion
      ) {
        const actual = this.services.provider.currentContext();
        this.update(
          actual === expected || actual?.campaignId === id
            ? String(error)
            : undefined,
        );
      }
      throw error;
    }
  }
  async navigate(target: Readonly<AtlasNavigationTarget>): Promise<void> {
    const navigation = this.navigation, state = navigation.state;
    if (state.kind !== "active") throw new Error(state.reason);
    state.assertCurrent();
    if (this.closed || navigation !== this.navigation)
      throw new Error("Atlasansicht wurde abgelöst.");
    await navigation.navigateCurrent(target);
  }
  details(locationId: string): AtlasDetailEntryModel {
    const state = this.navigation.state;
    if (state.kind !== "active")
      return { locationName: "", entries: [], blockedReason: state.reason };
    const location = state.repository.location(locationId).read();
    if (!location)
      return {
        locationName: "",
        entries: [],
        blockedReason: "Orts-Key ist noch nicht geladen.",
      };
    const documents = new Set([
      locationId,
      ...location.detailMaps.map((d) => d.documentId),
    ]);
    const world = state.repository.spatialGraph.world();
    if (world.version === 2) {
      for (const p of world.detailPlacements)
        if (p.parent.kind === "location" && p.parent.locationId === locationId)
          documents.add(p.documentId);
      for (const p of world.detailPlacements)
        if (p.parent.kind === "city-building" && documents.has(p.parent.cityId))
          documents.add(p.documentId);
    }
    const entries = state.inventory.records
      .filter((r) => documents.has(r.documentId))
      .map((r) => {
        let label = r.kind === "location" ? "Orts-Key" : r.kind;
        let roomId: string | null = null;
        if (r.kind === "location-section")
          label =
            location.sections.find((s) => s.id === r.id)?.title ??
            "Ortsabschnitt";
        else if (["city", "building"].includes(r.kind)) {
          const source = state.repository.detail("city", r.documentId);
          if (source instanceof CitySource)
            label =
              r.kind === "city"
                ? `Stadtplan: ${source.read().name}`
                : (source.read().buildings.find((b) => b.id === r.id)?.name ??
                  "Haus");
        } else if (["dungeon", "room", "room-section"].includes(r.kind)) {
          const source = state.repository.detail("dungeon", r.documentId);
          if (source instanceof DungeonAtlasSource) {
            const document = source.read().document;
            if (r.kind === "dungeon") label = "Dungeonkarte";
            else {
              const room = document.entities.find(
                (e) =>
                  isStructuredRoom(e) &&
                  (r.kind === "room"
                    ? e.id === r.id
                    : e.key.sections.some((s) => s.id === r.id)),
              );
              if (isStructuredRoom(room)) {
                label =
                  r.kind === "room"
                    ? `Raum ${room.number}: ${room.name}`
                    : `Raumabschnitt: ${room.name}`;
                if (r.kind === "room-section") roomId = room.id;
              }
            }
          }
        }
        return {
          label,
          target: {
            kind: r.kind,
            documentId: r.documentId,
            recordId: r.id,
            roomId,
          },
          unavailableReason:
            r.availability !== "available"
              ? "Ziel ist nicht verfügbar."
              : undefined,
        };
      });
    return {
      locationName: location.name,
      entries,
      dungeonBindings: world.version === 2 ? world.detailPlacements.flatMap((p) => {
        if (p.kind !== "dungeon" || p.parent.kind === "location" && p.parent.locationId === locationId &&
            location.detailMaps.some((d) => d.kind === "dungeon" && d.documentId === p.documentId)) return [];
        const confirmed = state.inventory.records.some((r) => r.kind === "dungeon" && r.id === p.documentId && r.availability === "available") &&
          state.projection.owners.some((o) => o.records.some((r) => r.id === p.id && r.recordType === "dungeon-placement"));
        if (!confirmed) return [];
        const source = state.repository.detail("dungeon", p.documentId);
        if (!(source instanceof DungeonAtlasSource)) return [];
        const entrance = source.read().document.entities.find((r) => r.id === p.entrances[0]?.roomId);
        return [{
          placementId: p.id,
          label: isStructuredRoom(entrance) ? `Dungeonkarte – ${entrance.name}` : "Dungeonkarte",
          description: p.parent.kind === "location"
            ? `Bisher am Ort ${state.repository.location(p.parent.locationId).read()?.name ?? "ohne Namen"}.`
            : "Bisher an einem Haus verortet.",
        }];
      }) : [],
      blockedReason: state.inventory.records.some(
        (r) => r.kind === "location" && r.id === locationId,
      )
        ? undefined
        : "Lokaler Ortsentwurf; noch nicht als Kampagnenbestand veröffentlicht.",
    };
  }
  bindDungeon(locationId: string, placementId: string): boolean {
    const state = this.navigation.state;
    if (this.closed || state.kind !== "active") throw new Error("Kampagnenatlas ist nicht verfügbar.");
    state.assertCurrent();
    const model = this.details(locationId);
    if (model.blockedReason || !model.dungeonBindings?.some((p) => p.placementId === placementId))
      throw new Error(model.blockedReason ?? "Dungeon ist für diese Verortung nicht verfügbar.");
    return state.repository.bindDungeonAtLocation(locationId, placementId);
  }
  /** Discard deliberately resets Sources/History; all earlier navigation callbacks are revoked. */
  async reopenAfterDiscard(): Promise<void> {
    const context = this.services.provider.currentContext();
    if (!context || this.closed) throw new Error("Kampagnenbindung fehlt.");
    this.navigation.dispose();
    this.navigation = this.newNavigation();
    await this.navigation.open(
      context,
      await this.services.worldHint(context.campaignId),
    );
    this.update();
  }
  destroy(host: HTMLElement): void {
    if (this.closed) return;
    this.closed = true;
    ++this.refreshVersion;
    this.unsubscribe();
    this.unsubscribeClosed();
    this.navigation.dispose();
    this.picker.destroy();
    for (const name of [
      "keydown",
      "keyup",
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "click",
      "dblclick",
      "contextmenu",
      "wheel",
    ])
      host.removeEventListener(name, this.stop);
  }
}
