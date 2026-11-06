import {
  App,
  FileView,
  MarkdownRenderer,
  Menu,
  Modal,
  Notice,
  Scope,
  Setting,
  TFile,
  type WorkspaceLeaf,
} from "obsidian";
import { AtlasEditor } from "../../../features/atlas/atlas-editor";
import {
  newOverworld,
  serializeOverworld,
  type HexOrientation,
} from "../../../features/atlas/overworld";
import { VaultStore } from "../vault-stores";
import { FileConflict } from "../../../persistence";
import { AtlasRepository } from "../../../features/atlas/atlas-repository";
import { parseCityDocument } from "../../../features/city/codec";
import { parseDocument } from "../../../model";
import { CitySource } from "../../../features/city/commands";
import { DungeonAtlasSource } from "../../../features/dungeon/atlas-source";
import { CopyAtlasModal } from "./atlas-copy-modal";
import { AtlasCampaignHost, type AtlasCampaignServices } from "./atlas-campaign-host";
import type { AtlasCampaignMount, AtlasMountInput } from "../../../features/atlas/atlas-campaign-navigation";
import { sameSnapshot } from "../../../features/campaign/campaign-contracts";
import { parseLocationDocument } from "../../../features/location/location-schema";
import { newLocationPath } from "../../../features/atlas/location-owners";
import type { RelativeAtlasCamera } from "../../../features/atlas/relative-frame";
import { parseSpatialWorld } from "../../../features/atlas/spatial-schema";
import { inspectStandaloneAtlas, type AtlasStandaloneEntry } from "../../../features/atlas/atlas-standalone-entry";
import { encodeRasterFile, type RasterFileFormat } from "../../../features/verwaltung/raster-files";

export const ATLAS_VIEW = "dungeon-native-atlas";
export class AtlasView extends FileView {
  private editor?: AtlasEditor;
  private repository?: AtlasRepository;
  private generation = 0;
  private lifecycle: Promise<void> = Promise.resolve();
  private campaignHost?: AtlasCampaignHost;
  private pickerHost?: HTMLElement;
  private canvasHost?: HTMLElement;
  private retainedHost?: HTMLElement;
  private statusHost?: HTMLElement;
  private managed = false;
  private unregisteredMount?: { readonly revoked: boolean; revoke(retainWork: boolean): void };
  private discardedCamera?: { contextToken: string; camera: RelativeAtlasCamera };
  private assertCurrent: () => void = () => {};
  constructor(leaf: WorkspaceLeaf, private readonly campaigns?: AtlasCampaignServices) {
    super(leaf);
    this.scope = new Scope(this.app.scope);
    this.scope.register(["Mod"], "s", (event) =>
      this.editor?.handleSaveShortcut(event) ? false : undefined,
    );
  }
  getViewType(): string {
    return ATLAS_VIEW;
  }
  getDisplayText(): string {
    return this.file?.basename ?? "Atlas";
  }
  getIcon(): string {
    return "globe";
  }
  onLoadFile(file: TFile): Promise<void> {
    this.editor?.setInputBlocked(true);
    const generation = ++this.generation;
    return this.sequence(async () => {
      if (generation !== this.generation) return;
      await this.closeEditor();
      if (this.campaignHost && this.pickerHost) this.campaignHost.destroy(this.pickerHost);
      this.campaignHost = undefined;
      if (generation === this.generation)
        await this.loadFileContent(file, generation);
    });
  }
  private sequence(action: () => Promise<void>): Promise<void> {
    const next = this.lifecycle.then(action);
    this.lifecycle = next.catch(() => {});
    return next;
  }
  private async closeEditor(closingView = false): Promise<void> {
    const unregistered = this.unregisteredMount;
    if (this.editor) {
      this.editor.setInputBlocked(true);
      try {
        await this.editor.flush();
        if (this.repository?.dirty || this.repository?.hasDraft)
          await this.repository.persistDraft();
      } catch (error) {
        // Service closure already froze and retained this old editor synchronously.
        if (unregistered?.revoked) return;
        if (closingView && unregistered) {
          unregistered.revoke(true);
          new Notice("Atlasentwurf bleibt zur Einsicht erhalten. " + String(error));
          return;
        }
        this.editor?.setInputBlocked(false);
        new Notice(
          "Atlasentwurf konnte nicht gesichert werden. " + String(error),
        );
        throw error;
      }
      if (unregistered) unregistered.revoke(false);
      // The campaign mount owns suspension/retention and disposal of its editor.
      // Destroying it here would erase retained Keys and release the renderer twice.
      else if (!this.managed) this.editor?.destroy();
    }
    unregistered?.revoke(false);
    this.editor = undefined;
    this.repository = undefined;
    this.managed = false;
    this.assertCurrent = () => {};
  }
  private async campaignMount(input: AtlasMountInput): Promise<AtlasCampaignMount> {
    let alive = true, disposed = false, retained = false;
    const lease = () => {
      this.campaigns!.assertOpen?.();
      const context = this.campaigns!.provider.currentContext();
      if (!alive || !context || !sameSnapshot(context, input.context) || context.contextToken !== input.context.contextToken)
        throw new Error("Die Kampagnenbindung dieses Atlas wurde widerrufen.");
    };
    const vault = new VaultStore(this.app);
    const campaignSave = await this.campaigns!.createSave?.(input);
    lease(); input.assertCurrent();
    const repository = new AtlasRepository({
      read: async (path) => { lease(); const raw = await vault.read(path); lease(); return raw; },
      // FileTransaction guards the initial journal boundary. Its won old journal must finish under its old paths.
      compareAndWrite: (path, before, after) => vault.compareAndWrite(path, before, after),
    }, input.inventory.files.find((f) => f.kind === "world" && f.id === input.inventory.worldId)!.path, this.app.vault, {
      ...this.spatialOptions(), assertCurrent: lease, campaignSave,
      resolveLocation: async (id) => {
        lease();
        const expected = input.inventory.files.find((f) => f.kind === "location" && f.id === id);
        if (!expected) return newLocationPath(id); // explicitly local, unregistered drafts
        const matches: string[] = [];
        for (const file of this.app.vault.getFiles().filter((f) => f.extension === "location")) {
          lease(); const raw = await this.app.vault.read(file); lease();
          try { if (parseLocationDocument(raw).id === id) matches.push(file.path); } catch { /* nonmatching malformed candidate */ }
        }
        if (matches.length !== 1 || matches[0] !== expected.path) throw new Error("Bestätigte Ortsdatei fehlt oder ist mehrdeutig.");
        return expected.path;
      },
      resolveDetail: async (worldId, kind, id) => {
        lease();
        const matches = await this.spatialOptions().resolveDetail(worldId, kind, id); lease();
        const expected = input.inventory.files.find((f) => f.kind === kind && f.id === id);
        if (!expected || matches.length !== 1 || matches[0] !== expected.path) throw new Error("Bestätigte Detaildatei fehlt oder ist mehrdeutig.");
        return matches;
      },
    });
    const source = await repository.open(); lease(); input.assertCurrent();
    const root = this.contentEl.ownerDocument.createElement("div");
    const editor = new AtlasEditor(root, source.world, source, {
      assertCurrent: lease,
      navigation: {
        details: (id) => this.campaignHost!.details(id),
        navigate: (target) => { lease(); return this.campaignHost!.navigate(target); },
        bindDungeon: (locationId, placementId) => { lease(); return this.campaignHost!.bindDungeon(locationId, placementId); },
      },
      save: async () => {
        lease();
        if (!campaignSave) throw new Error("Bestätigter Campaign-Speicheranschluss fehlt.");
        await this.campaignHost!.save(); lease();
      },
      changed: async () => { lease(); await repository.persistDraft(); lease(); },
      status: () => ({ dirty: repository.dirty, hasDraft: repository.hasDraft }),
      menu: (event) => { lease(); this.showMenu(event, this.generation); },
      discard: async () => {
        lease(); const next = await repository.discard(); lease();
        return next;
      },
      discarded: () => {
        this.discardedCamera = { contextToken: input.context.contextToken, camera: editor.renderer.relativeCamera };
        queueMicrotask(() => { void this.campaignHost?.reopenAfterDiscard().catch((error) => new Notice(String(error))); });
      },
      spatial: {
        graph: () => repository.spatialGraph,
        city: (id) => { const s = repository.detail("city", id); if (!(s instanceof CitySource)) throw new Error("Stadtowner fehlt."); return s; },
        dungeon: (id) => { const s = repository.detail("dungeon", id); if (!(s instanceof DungeonAtlasSource)) throw new Error("Dungeonowner fehlt."); return s; },
      },
      locations: {
        read: (id) => repository.location(id).read(),
        ensure: async (id) => { lease(); const s = await repository.ensureLocation(id); lease(); return s.read(); },
        create: (doc, placement) => { lease(); return repository.createLocation(doc, placement); },
        edit: (doc) => { lease(); return repository.editLocation(doc); },
        move: (id, position) => { lease(); return repository.moveLocation(id, position); },
        markdown: (host, text, id) => MarkdownRenderer.render(this.app, text, host,
          input.inventory.files.find((f) => f.id === id)?.path ?? newLocationPath(id), this),
      },
    });
    editor.setInputBlocked(true);
    return {
      repository, renderer: editor.renderer,
      setInputBlocked: (blocked) => { editor.setInputBlocked(blocked); },
      prepareNavigation: async (current) => { current(); await editor.prepareNavigation(); current(); },
      prepareLeave: async (current) => { current(); await editor.flush(); current(); await repository.persistDraft(); current(); },
      navigate: (target, current) => { current(); editor.navigate(target, current); },
      resume: (current) => {
        current(); lease(); this.canvasHost!.replaceChildren(root);
        this.editor = editor; this.repository = repository; this.managed = true; this.assertCurrent = lease;
        if (this.discardedCamera?.contextToken === input.context.contextToken) editor.renderer.restoreCamera(this.discardedCamera.camera);
        this.discardedCamera = undefined;
        editor.setInputBlocked(false);
        void editor.init().catch((error) => { if (alive) { editor.setInputBlocked(true); root.dataset.loadError = String(error); new Notice(String(error)); } });
      },
      suspend: () => {
        alive = false;
        retained = editor.pendingKey || repository.dirty || repository.hasDraft;
        if (retained) editor.suspend();
        return retained ? "blocked-unsaved" : "recoverable";
      },
      dispose: () => {
        if (disposed) return;
        disposed = true; alive = false;
        if (this.editor === editor) { this.editor = undefined; this.repository = undefined; this.managed = false; }
        root.remove();
        if (retained) {
          const draft = { title: `Erhaltener Entwurf: ${input.context.name} – ${source.world.name}`, element: root };
          this.campaigns?.retainDraft?.(draft);
          this.showRetained(draft);
        } else editor.destroy();
      },
    };
  }
  private showRetained(draft: { title: string; element: HTMLElement }): void {
    const summary = draft.element.ownerDocument.createElement("summary");
    summary.textContent = draft.title;
    const details = draft.element.ownerDocument.createElement("details");
    details.append(summary, draft.element); this.retainedHost?.append(details);
  }
  private spatialOptions() {
    return {
      locations: true as const,
      details: true as const,
      resolveDetail: async (
        _worldId: string,
        kind: "city" | "dungeon",
        id: string,
      ) => {
        const matches: string[] = [];
        // Native ID lookup over the actual vault; every match is returned, so duplicates fail closed.
        for (const file of this.app.vault
          .getFiles()
          .filter((file) => file.extension === kind)) {
          let nativeId: string;
          try {
            const bytes = await this.app.vault.read(file);
            nativeId = (
              kind === "city" ? parseCityDocument(bytes) : parseDocument(bytes)
            ).id;
          } catch {
            continue;
          }
          if (nativeId === id) matches.push(file.path);
        }
        return matches;
      },
    };
  }
  private async loadFileContent(
    file: TFile,
    generation: number,
  ): Promise<void> {
    this.contentEl.replaceChildren();
    this.canvasHost = this.contentEl;
    const vault = new VaultStore(this.app);
    let standalone: AtlasStandaloneEntry | undefined, standaloneCurrent = () => {};
    if (this.campaigns) {
      this.contentEl.classList.add("dn-atlas-host");
      this.pickerHost = this.contentEl.createDiv({ cls: "dn-atlas-campaign-dock" });
      this.statusHost = this.contentEl.createEl("p", { attr: { role: "status" } });
      this.statusHost.className = "dn-atlas-host-status";
      this.canvasHost = this.contentEl.createDiv({ cls: "dn-atlas-canvas-host" });
      this.retainedHost = this.contentEl.createDiv({ cls: "dn-atlas-retained-drafts" });
      for (const draft of this.campaigns.retainedDrafts ?? []) this.showRetained(draft);
      this.campaignHost = new AtlasCampaignHost(this.pickerHost, this.campaigns, {
        openNative: (input) => this.campaignMount(input),
        prepareUnbound: async () => { if (this.editor && !this.managed) await this.closeEditor(); },
        changed: (reason) => { if (this.statusHost) this.statusHost.textContent = reason ?? ""; },
      });
      try { await this.campaignHost.refresh(); }
      catch (error) { this.statusHost.textContent = "Kampagnenbestand konnte nicht gelesen werden. " + String(error); return; }
      if (generation !== this.generation) return;
      try {
        const raw = await vault.read(file.path);
        if (raw === null) throw new Error("Atlasdatei fehlt.");
        const worldId = parseSpatialWorld(raw).id;
        if (await this.campaignHost.openFile(file.path, worldId, async (current) => {
          standaloneCurrent = current;
          standalone = await inspectStandaloneAtlas(vault, file.path, this.spatialOptions(), standaloneCurrent);
          if (generation !== this.generation) throw new Error("Atlasöffnung wurde abgelöst.");
          if (standalone.worldId !== worldId) throw new FileConflict(file.path);
          return standalone.identities;
        })) return;
      }
      catch (error) { this.statusHost.textContent = "Kampagne konnte nicht geöffnet werden. " + String(error); return; }
    }
    this.canvasHost.createEl("p", { text: "Atlas wird geöffnet …" });
    // Checked independent native atlases have a host lifetime, without Campaign authority.
    let alive = true, mounted = false, editor: AtlasEditor | undefined, nativeRepository: AtlasRepository | undefined;
    let unsubscribeClosed: () => void = () => {};
    const root = this.contentEl.ownerDocument.createElement("div");
    const lease = () => {
      this.campaigns?.assertOpen?.();
      standaloneCurrent();
      if (!alive || (!mounted && generation !== this.generation))
        throw new Error("Die Atlasansicht dieses Entwurfs wurde widerrufen.");
    };
    const mount = {
      get revoked() { return !alive; },
      revoke: (retainWork: boolean) => {
        if (!alive) return;
        alive = false;
        unsubscribeClosed();
        if (editor) {
          const retain = retainWork && (editor.pendingKey || nativeRepository?.dirty || nativeRepository?.hasDraft);
          if (retain) {
            editor.suspend();
            const draft = { title: `Erhaltener Atlasentwurf: ${editor.terrain.world.name} – ${file.path}`, element: root };
            this.campaigns?.retainDraft?.(draft);
            this.showRetained(draft);
          } else { editor.destroy(); root.remove(); }
          if (this.editor === editor) { this.editor = undefined; this.repository = undefined; }
        }
        if (this.unregisteredMount === mount) this.unregisteredMount = undefined;
      },
    };
    this.unregisteredMount = mount;
    unsubscribeClosed = this.campaigns?.subscribeClosed?.(() => mount.revoke(true)) ?? (() => {});
    try {
      lease();
      const repository = new AtlasRepository(
        standalone?.store ?? vault,
        file.path,
        this.app.vault,
        { ...this.spatialOptions(), assertCurrent: lease },
      );
      nativeRepository = repository;
      const source = await repository.open();
      await standalone?.finishOpen();
      lease();
      this.repository = repository;
      this.editor = editor = new AtlasEditor(root, source.world, source, {
        assertCurrent: lease,
        save: async () => { lease(); await repository.save(); lease(); },
        changed: async () => { lease(); await repository.persistDraft(); lease(); },
        status: () => ({
          dirty: repository.dirty,
          hasDraft: repository.hasDraft,
        }),
        menu: (event) => { lease(); this.showMenu(event, generation); },
        discard: async () => { lease(); const next = await repository.discard(); lease(); return next; },
        spatial: {
          graph: () => repository.spatialGraph,
          city: (id) => {
            const value = repository.detail("city", id);
            if (!(value instanceof CitySource))
              throw new Error("Stadtowner fehlt.");
            return value;
          },
          dungeon: (id) => {
            const value = repository.detail("dungeon", id);
            if (!(value instanceof DungeonAtlasSource))
              throw new Error("Dungeonowner fehlt.");
            return value;
          },
        },
        locations: {
          read: (id) => repository.location(id).read(),
          ensure: async (id) => { lease(); const source = await repository.ensureLocation(id); lease(); return source.read(); },
          create: (document, placement) =>
            { lease(); return repository.createLocation(document, placement); },
          edit: (document) => { lease(); return repository.editLocation(document); },
          move: (id, position) => { lease(); return repository.moveLocation(id, position); },
          markdown: (host, text, id) =>
            MarkdownRenderer.render(
              this.app,
              text,
              host,
              `Orte/${id}.location`,
              this,
            ),
        },
      });
      this.assertCurrent = lease;
      mounted = true;
      this.canvasHost.replaceChildren(root);
      await editor.init();
      lease();
      if (generation !== this.generation)
        throw new Error("Die Atlasansicht dieses Entwurfs wurde widerrufen.");
      this.campaignHost?.showUnregisteredAtlas();
    } catch (error) {
      mount.revoke(true);
      if (generation !== this.generation) return;
      this.canvasHost.replaceChildren();
      this.canvasHost.createEl("p", {
        text: "Atlas konnte nicht geöffnet werden. " + String(error),
      });
    }
  }
  private showMenu(event: MouseEvent, generation: number): void {
    const editor = this.editor,
      repository = this.repository;
    if (!editor || !repository || generation !== this.generation) return;
    const guard = this.assertCurrent;
    guard();
    new Menu()
      .addItem((item) =>
        item.setTitle("Kartenbild exportieren …").setIcon("image-file").onClick(() => {
          new AtlasExportModal(this.app, editor.terrain.world.name, async (request) => {
            guard();
            if (generation !== this.generation || this.editor !== editor)
              throw new Error("Die Ausgangskarte ist nicht mehr geöffnet.");
            const canvas = await editor.captureMap(request);
            guard();
            if (generation !== this.generation || this.editor !== editor)
              throw new Error("Die Karte wurde während des Exports geschlossen.");
            return canvas;
          }).open();
        }),
      )
      .addItem((item) =>
        item.setTitle("Speichern unter …").onClick(() => {
          new CopyAtlasModal(
            this.app,
            editor.terrain.world.name,
            async (name) => {
              guard();
              if (generation !== this.generation || this.editor !== editor)
                throw new Error("Die Ausgangskarte ist nicht mehr geöffnet.");
              await editor.flush();
              guard();
              if (generation !== this.generation || this.editor !== editor)
                throw new Error("Die Ausgangskarte ist nicht mehr geöffnet.");
              const path = `Atlanten/${name}.overworld`;
              await repository.copy(path, crypto.randomUUID(), name);
              return this.openCopy(path, generation, editor);
            },
            async (name) => {
              guard();
              const path = `Atlanten/${name}.overworld`;
              const target = new AtlasRepository(
                new VaultStore(this.app),
                path,
                this.app.vault,
                { ...this.spatialOptions(), assertCurrent: guard },
              );
              const state = await target.recoverCopy();
              guard();
              return { state, open: this.openCopy(path, generation, editor) };
            },
          ).open();
        }),
      )
      .addItem((item) =>
        item
          .setTitle("Entwurf verwerfen …")
          .setDisabled(
            !repository.dirty && !repository.hasDraft && !editor.pendingKey,
          )
          .onClick(() =>
            new DiscardAtlasModal(this.app, () => {
              guard();
              if (generation === this.generation && this.editor === editor)
                editor.discard();
            }).open(),
          ),
      )
      .showAtMouseEvent(event);
  }
  private openCopy(path: string, generation: number, editor: AtlasEditor) {
    const guard = this.assertCurrent;
    return async (): Promise<boolean> => {
      guard();
      if (generation !== this.generation || this.editor !== editor)
        return false;
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile))
        throw new Error("Gespeicherte Kopie wurde nicht gefunden.");
      await this.leaf.openFile(file);
      return true;
    };
  }
  onUnloadFile(): Promise<void> {
    this.editor?.setInputBlocked(true);
    this.generation++;
    return this.sequence(async () => {
      await this.closeEditor(true);
      if (this.campaignHost && this.pickerHost) this.campaignHost.destroy(this.pickerHost);
      this.campaignHost = undefined;
      this.contentEl.replaceChildren();
    });
  }
}
class AtlasExportModal extends Modal {
  private generation = 0;
  private busy = false;
  constructor(
    app: App,
    private readonly worldName: string,
    private readonly capture: (request: {
      readonly scope: "atlas" | "view";
      readonly width: number;
      readonly includeGrid: boolean;
    }) => Promise<HTMLCanvasElement>,
  ) {
    super(app);
  }
  onOpen(): void {
    const generation = ++this.generation;
    this.busy = false;
    this.setTitle("Atlas als Kartenbild exportieren");
    this.contentEl.empty();
    this.contentEl.createEl("p", {
      text: "Exportiere den gesamten belegten Atlas oder genau den sichtbaren Ausschnitt. Die Editor-Kamera bleibt unverändert.",
    });
    let scope: "atlas" | "view" = "atlas",
      width = 2048,
      includeGrid = true,
      format: RasterFileFormat = "png",
      quality = 90;
    const message = this.contentEl.createEl("p", { attr: { role: "status" } });
    new Setting(this.contentEl).setName("Ausschnitt").addDropdown((dropdown) =>
      dropdown.addOptions({ atlas: "Gesamter belegter Atlas", view: "Aktuelle Ansicht" })
        .setValue(scope).onChange((value) => { scope = value === "view" ? "view" : "atlas"; }));
    new Setting(this.contentEl).setName("Bildbreite")
      .setDesc("256 bis 2.048 Pixel; die Höhe folgt dem Seitenverhältnis der Ansicht.")
      .addSlider((slider) => slider.setLimits(256, 2048, 128).setValue(width)
        .setDynamicTooltip().onChange((value) => { width = value; }));
    new Setting(this.contentEl).setName("Hexraster anzeigen").addToggle((toggle) =>
      toggle.setValue(includeGrid).onChange((value) => { includeGrid = value; }));
    new Setting(this.contentEl).setName("Format").addDropdown((dropdown) =>
      dropdown.addOptions({ png: "PNG", jpeg: "JPEG", webp: "WebP" })
        .setValue(format).onChange((value) => {
          format = value === "jpeg" || value === "webp" ? value : "png";
        }));
    new Setting(this.contentEl).setName("Qualität")
      .setDesc("Wirkt bei JPEG und WebP.")
      .addSlider((slider) => slider.setLimits(40, 100, 5).setValue(quality)
        .setDynamicTooltip().onChange((value) => { quality = value; }));
    const action = new Setting(this.contentEl);
    action.addButton((button) => button.setButtonText("Exportieren").setCta().onClick(() => {
      if (this.busy) return;
      this.busy = true;
      message.textContent = "Kartenbild wird erstellt …";
      button.setDisabled(true);
      void (async () => {
        try {
          const canvas = await this.capture({ scope, width, includeGrid });
          if (generation !== this.generation) return;
          const raster = await encodeRasterFile(canvas, {
            format,
            ...(format === "png" ? {} : { quality: quality / 100 }),
          });
          if (generation !== this.generation) return;
          this.download(raster.blob, `${this.safeName(this.worldName)}.${format === "jpeg" ? "jpg" : format}`);
          this.close();
        } catch (error) {
          if (generation === this.generation)
            message.textContent = "Export fehlgeschlagen. " + String(error);
        } finally {
          if (generation === this.generation) {
            this.busy = false;
            button.setDisabled(false);
          }
        }
      })();
    }));
    action.addButton((button) => button.setButtonText("Abbrechen").onClick(() => this.close()));
  }
  private safeName(value: string): string {
    return value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ") || "Atlas";
  }
  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob),
      link = this.contentEl.ownerDocument.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    this.contentEl.append(link);
    try { link.click(); }
    finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
  }
  onClose(): void {
    this.generation++;
    this.contentEl.empty();
  }
}
class DiscardAtlasModal extends Modal {
  constructor(
    app: App,
    private discard: () => void,
  ) {
    super(app);
  }
  onOpen(): void {
    this.setTitle("Atlasentwurf verwerfen");
    this.contentEl.createEl("p", {
      text: "Zur letzten Speicherung zurückkehren? Ungespeicherte Änderungen werden verworfen.",
    });
    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText("Abbrechen").onClick(() => this.close()),
      )
      .addButton((button) =>
        button
          .setButtonText("Entwurf verwerfen")
          .setWarning()
          .onClick(() => {
            this.close();
            this.discard();
          }),
      );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
export class CreateAtlasModal extends Modal {
  constructor(
    app: App,
    private created: (path: string) => Promise<void>,
  ) {
    super(app);
  }
  onOpen(): void {
    this.setTitle("Atlas anlegen");
    let name = "Neue Welt",
      orientation: HexOrientation = "pointy",
      busy = false;
    new Setting(this.contentEl).setName("Name").addText((text) => {
      text.setValue(name).onChange((value) => {
        name = value;
      });
      text.inputEl.setAttribute("aria-label", "Atlasname");
    });
    new Setting(this.contentEl)
      .setName("Hex-Ausrichtung")
      .addDropdown((dropdown) => {
        dropdown
          .addOptions({ pointy: "Spitze oben", flat: "Flache Seite oben" })
          .setValue(orientation)
          .onChange((value) => {
            orientation = value as HexOrientation;
          });
        dropdown.selectEl.setAttribute("aria-label", "Hex-Ausrichtung");
      });
    this.contentEl.createEl("p", {
      text: "Der Atlas wächst mit seinem Inhalt. Die kleinsten Hexes sind 3 Meilen groß.",
    });
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("Atlas anlegen")
        .setCta()
        .onClick(async () => {
          if (busy) return;
          const clean = name.trim();
          if (
            !clean ||
            clean === "." ||
            clean === ".." ||
            /[\\/:*?"<>|]/.test(clean) ||
            clean.length > 200
          ) {
            new Notice(
              "Einen Atlasnamen ohne Pfad- oder Sonderzeichen eingeben.",
            );
            return;
          }
          const path = `Atlanten/${clean}.overworld`;
          busy = true;
          button.setDisabled(true);
          let saved = false;
          try {
            const folder = this.app.vault.getAbstractFileByPath("Atlanten");
            if (folder instanceof TFile)
              throw new Error("„Atlanten“ ist bereits eine Datei.");
            await new VaultStore(this.app).compareAndWrite(
              path,
              null,
              serializeOverworld(
                newOverworld(crypto.randomUUID(), clean, orientation),
              ),
            );
            saved = true;
            await this.created(path);
            this.close();
          } catch (error) {
            if (!saved && error instanceof FileConflict) {
              new Notice(
                "Ein Atlas mit diesem Namen ist bereits vorhanden. Einen anderen Namen wählen.",
              );
            } else {
              new Notice(
                (saved
                  ? "Atlas ist gespeichert; Öffnen fehlgeschlagen. "
                  : "Atlas konnte nicht angelegt werden. ") + String(error),
              );
            }
            if (saved) this.close();
          } finally {
            busy = false;
            button.setDisabled(false);
          }
        }),
    );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
