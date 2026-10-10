import { CampaignEntry, type CampaignEntryItem } from "./campaign-entry";
import {
  AtlasCampaignNavigation,
  type AtlasCampaignMount,
  type AtlasMountInput,
  type AtlasNavigationTarget,
} from "../features/atlas/atlas-campaign-navigation";
import {
  campaignCommandId,
  type CampaignId,
} from "../features/campaign/campaign-contracts";
import type { CampaignRuntimeNavigationProvider } from "../features/campaign/campaign-runtime-source";
import type { AtlasDetailEntryModel } from "./atlas-detail-entry";
import { CitySource } from "../features/city/commands";
import { DungeonAtlasSource } from "../features/dungeon/atlas-source";
import { isStructuredRoom } from "../model";

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
  campaignHint(path: string): Promise<CampaignId | null>;
}

/** One visible consumer of the actual Campaign provider and the existing safe Navigator. */
export class AtlasCampaignHost {
  private navigation: AtlasCampaignNavigation;
  private readonly picker: CampaignEntry;
  private entries: readonly CampaignEntryItem[] = [];
  private refreshVersion = 0;
  private operationVersion = 0;
  private closed = false;
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
      error ?? (state.kind === "unavailable" ? state.reason : null);
    this.picker.update({
      entries: this.entries,
      activeCampaignId:
        this.services.provider.currentContext()?.campaignId ?? null,
      activeUnavailableReason: reason ?? undefined,
    });
    this.access.changed(reason);
  }
  async openFile(path: string): Promise<boolean> {
    const id = await this.services.campaignHint(path);
    if (this.closed) return true;
    if (!id) return false;
    await this.openCampaign(id);
    return true;
  }
  async openCampaign(id: CampaignId): Promise<void> {
    if (this.closed) throw new Error("Atlasansicht ist geschlossen.");
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
    const navigation = this.navigation,
      state = navigation.state;
    if (state.kind !== "active") throw new Error(state.reason);
    const record = state.inventory.records.find(
      (r) =>
        r.kind === target.kind &&
        r.documentId === target.documentId &&
        r.id === target.recordId,
    );
    const owner = state.projection.owners.find(
      (o) => o.ownerId === record?.ownerId,
    );
    if (!record || !owner)
      throw new Error(
        "Dieses Ziel ist noch kein bestätigter Kampagnenbestand.",
      );
    const capture = await state.repository.captureNative({
      worldId: state.inventory.worldId,
      assertCurrent: state.assertCurrent,
      additionalLocations: state.inventory.files
        .filter((f) => f.kind === "location")
        .map((f) => ({ id: f.id!, path: f.path })),
    });
    state.assertCurrent();
    if (this.closed || navigation !== this.navigation)
      throw new Error("Atlasansicht wurde abgelöst.");
    await navigation.navigate({
      context: state.context,
      worldId: state.inventory.worldId,
      mountGeneration: state.generation,
      registryRevision: state.projection.registryRevision,
      projectionDigest: state.projection.projectionDigest,
      ownerId: owner.ownerId,
      ownerRevision: owner.ownerRevision,
      sourceGeneration: owner.source.generation,
      sourceDigest: capture.sourceDigest,
      basis: capture.basis,
      target: { ...target },
    });
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
      blockedReason: state.inventory.records.some(
        (r) => r.kind === "location" && r.id === locationId,
      )
        ? undefined
        : "Lokaler Ortsentwurf; noch nicht als Kampagnenbestand veröffentlicht.",
    };
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
