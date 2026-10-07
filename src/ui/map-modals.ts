import { App, FileSystemAdapter, Modal, Notice, Setting, type ButtonComponent, type SliderComponent, type ToggleComponent } from "obsidian";
import { type ReferenceImage, type Settings } from "../model";
import { Session } from "../session";
import { type Prefab } from "../prefabs";
import { type AssetCatalog } from "../assets";
import { NEW_MAP_DEFAULT_SIZE, newMapDialogSize } from "../features/verwaltung/new-map-size";
import { resizeMap, type MapMargins } from "../commands";
import { generateLayout, type GeneratorKind } from "../generators";
import type DungeonPlugin from "../main";

function selectedLocalFilePath(file: File): string | undefined {
  const legacy = (file as File & { path?: string }).path;
  if (legacy) return legacy;
  try {
    const electron = require("electron") as {
      webUtils?: { getPathForFile(file: File): string };
    };
    return electron.webUtils?.getPathForFile(file) || undefined;
  } catch {
    return undefined;
  }
}
export class PrefabNameModal extends Modal {
  private answer?: (value: { set: string; name: string } | null) => void;
  constructor(app: App, private readonly prefabs: () => readonly Prefab[]) {
    super(app);
  }
  request(): Promise<{ set: string; name: string } | null> {
    return new Promise((resolve) => {
      this.answer = resolve;
      this.open();
    });
  }
  onOpen(): void {
    const existingSets = this.prefabs().map((prefab) => prefab.set);
    const sets = [...new Set(["Allgemein", ...existingSets])],
      temporarySets = new Set<string>(),
      returnSets = new Map<string, string>();
    let set = existingSets.at(-1) ?? "Allgemein", name = "";
    const render = () => {
      this.setTitle("Vorlage erstellen");
      this.contentEl.empty();
      new Setting(this.contentEl).setName("Sammlung")
        .addDropdown((dropdown) => dropdown
          .addOptions(Object.fromEntries(sets.map((value) => [value, value])))
          .setValue(set)
          .onChange((value) => { set = value; render(); }))
        .addButton((button) => button.setButtonText("+")
          .setTooltip("Sammlung hinzufügen")
          .onClick(() => renderNewSet()))
        .addButton((button) => button.setButtonText("−")
          .setTooltip("Leere Sammlung entfernen")
          .setDisabled(!temporarySets.has(set))
          .onClick(() => {
            const removed = set;
            temporarySets.delete(removed);
            sets.splice(sets.indexOf(removed), 1);
            const previous = returnSets.get(removed);
            returnSets.delete(removed);
            set = previous && sets.includes(previous) ? previous : sets[0]!;
            render();
          }));
      let createButton: ButtonComponent;
      let error: HTMLParagraphElement;
      const validate = () => {
        const duplicate = this.prefabs().some((prefab) =>
          prefab.set.toLocaleLowerCase() === set.toLocaleLowerCase() &&
          prefab.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
        error.setText(duplicate
          ? "In dieser Sammlung gibt es bereits eine Vorlage mit diesem Namen."
          : "");
        error.hidden = !duplicate;
        createButton.setDisabled(!name.trim() || duplicate);
        return !duplicate && !!name.trim();
      };
      new Setting(this.contentEl).setName("Name").addText((input) =>
        input.setPlaceholder("Vorlagenname").setValue(name)
          .onChange((value) => { name = value; validate(); }));
      error = this.contentEl.createEl("p", { cls: "dn-prefab-name-error" });
      error.setAttribute("role", "alert");
      error.style.color = "var(--text-error)";
      new Setting(this.contentEl).addButton((button) => {
        createButton = button;
        button.setButtonText("Erstellen").setCta().onClick(() => {
          if (!validate()) return;
          this.answer?.({ set, name: name.trim() });
          this.answer = undefined;
          this.close();
        });
      });
      validate();
    };
    const renderNewSet = () => {
      this.setTitle("Sammlung hinzufügen");
      this.contentEl.empty();
      let candidate = "";
      new Setting(this.contentEl).setName("Name").addText((input) =>
        input.setPlaceholder("Sammlungsname")
          .onChange((value) => { candidate = value; }));
      new Setting(this.contentEl)
        .addButton((button) => button.setButtonText("Hinzufügen")
          .setCta().onClick(() => {
            const value = candidate.trim();
            if (!value) return;
            const existing = sets.find((item) =>
              item.toLocaleLowerCase() === value.toLocaleLowerCase());
            if (existing) set = existing;
            else {
              sets.push(value);
              temporarySets.add(value);
              returnSets.set(value, set);
              set = value;
            }
            render();
          }))
        .addButton((button) => button.setButtonText("Abbrechen")
          .onClick(() => render()));
    };
    render();
  }
  onClose(): void {
    this.answer?.(null);
    this.answer = undefined;
    this.contentEl.empty();
  }
}
export class GeneratorModal extends Modal {
  private proposal: string[] = [];
  constructor(
    app: App,
    private session: Session,
    private floorId: string,
  ) {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText("Kartenassistent");
    this.contentEl.replaceChildren();
    const options: { kind: GeneratorKind; seed: number; amount: number } = {
      kind: "dungeon",
      seed: 1,
      amount: 12,
    };
    this.contentEl.createEl("p", {
      text: "Ein Vorschlag bleibt vollständig bearbeitbar. Neu generieren ersetzt nur den Vorschlag aus diesem geöffneten Assistenten.",
    });
    new Setting(this.contentEl)
      .setName("Generatorart")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("dungeon", "Dungeon")
          .addOption("cave", "Höhle")
          .onChange((value) => (options.kind = value as GeneratorKind)),
      );
    new Setting(this.contentEl).setName("Startwert").addText((input) =>
      input.setValue(String(options.seed)).onChange((value) => {
        options.seed = Number(value);
      }),
    );
    new Setting(this.contentEl)
      .setName("Räume oder Formdetails")
      .addText((input) =>
        input.setValue(String(options.amount)).onChange((value) => {
          options.amount = Number(value);
        }),
      );
    const actions = new Setting(this.contentEl);
    let generateButton!: ButtonComponent;
    actions.addButton((button) => {
      generateButton = button;
      button
        .setButtonText("Generieren")
        .setCta()
        .onClick(() => {
          try {
            const result = generateLayout(
              this.session,
              this.floorId,
              options,
              this.proposal,
            );
            this.proposal = result.map((entity) => entity.id);
            generateButton.setButtonText("Neu generieren");
          } catch (error) {
            new Notice(String(error));
          }
        });
    });
    actions.addButton((button) =>
      button.setButtonText("Fertigstellen").onClick(() => this.close()),
    );
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
export class ReferenceImagesModal extends Modal {
  constructor(
    app: App,
    private plugin: DungeonPlugin,
    private session: Session,
    private floorId: string,
  ) {
    super(app);
  }
  onOpen(): void {
    this.render();
  }
  private render(): void {
    this.titleEl.setText("Nachzeichenvorlagen");
    this.contentEl.replaceChildren();
    this.contentEl.createEl("p", {
      text: "Vorlagen liegen unter der Karte und lassen sich nach dem Import auswählen, verschieben, skalieren, drehen und ausblenden.",
    });
    const input = this.contentEl.createEl("input", {
      attr: { type: "file", accept: ".png,.jpg,.jpeg,.webp,image/*" },
      cls: "dn-hidden-input",
    });
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      void this.plugin
        .importReference(this.session, this.floorId, file)
        .then(() => {
          new Notice("Nachzeichenvorlage geladen.");
          this.render();
        })
        .catch((error) => new Notice(String(error), 10000));
    });
    new Setting(this.contentEl)
      .setName("Bild laden")
      .setDesc(
        "PNG, JPEG oder WebP; die Datei wird einmal im Vault gespeichert.",
      )
      .addButton((button) =>
        button
          .setButtonText("Bild wählen")
          .setCta()
          .onClick(() => input.click()),
      );
    const images = [...this.session.entities.values()].filter(
      (entity): entity is ReferenceImage =>
        entity.kind === "reference" && entity.floorId === this.floorId,
    );
    if (!images.length)
      this.contentEl.createEl("p", {
        text: "Auf diesem Geschoss ist noch keine Vorlage geladen.",
      });
    for (const image of images) {
      const row = new Setting(this.contentEl)
        .setName(image.name)
        .setDesc(
          image.width.toLocaleString("de-DE") +
            " × " +
            image.height.toLocaleString("de-DE") +
            " Felder",
        );
      row.addToggle((toggle) =>
        toggle.setValue(image.visible).onChange((visible) => {
          const current = this.session.entities.get(image.id);
          if (current?.kind !== "reference") return;
          this.session.execute({
            label: "Nachzeichenvorlage ein-/ausblenden",
            entities: [
              {
                id: current.id,
                before: current,
                after: { ...current, visible },
              },
            ],
          });
        }),
      );
      row.addExtraButton((button) =>
        button
          .setIcon("scan")
          .setTooltip("Auf Karte zentrieren")
          .onClick(() => {
            const current = this.session.entities.get(image.id);
            if (current?.kind !== "reference") return;
            this.session.execute({
              label: "Nachzeichenvorlage zentrieren",
              entities: [
                {
                  id: current.id,
                  before: current,
                  after: {
                    ...current,
                    x: this.session.settings.width / 2,
                    y: this.session.settings.height / 2,
                  },
                },
              ],
            });
          }),
      );
      row.addExtraButton((button) =>
        button
          .setIcon("trash-2")
          .setTooltip("Vorlage entfernen")
          .onClick(() => {
            const current = this.session.entities.get(image.id);
            if (current?.kind !== "reference") return;
            this.session.execute({
              label: "Nachzeichenvorlage entfernen",
              entities: [{ id: current.id, before: current, after: null }],
            });
            this.render();
          }),
      );
    }
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
export class MapInformationModal extends Modal {
  private generation = 0;
  constructor(
    app: App,
    private session: Session,
    private path: string,
    private catalog: AssetCatalog,
  ) {
    super(app);
  }
  onOpen(): void {
    void this.render();
  }
  private async render(): Promise<void> {
    const generation = ++this.generation;
    this.titleEl.setText("Karteninformationen");
    this.contentEl.replaceChildren();
    const { width, height, assetPacks = [] } = this.session.settings;
    new Setting(this.contentEl)
      .setName("Kartengröße")
      .setDesc(`${width} × ${height} Felder`);
    const adapter = this.app.vault.adapter;
    new Setting(this.contentEl)
      .setName("Dateiname")
      .setDesc(adapter instanceof FileSystemAdapter
        ? adapter.getFullPath(this.path) : this.path);
    const packages = new Setting(this.contentEl)
      .setName("Für diese Karte ausgewählte Assetpakete")
      .setDesc("Wird gelesen …");
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("Schließen").onClick(() => this.close()));
    try {
      const catalog = await this.catalog.read();
      if (generation !== this.generation) return;
      const names = assetPacks.map((id, index) => {
        const metadata = catalog.packs.find((record) =>
          record.metadata.id === id)?.metadata;
        return `${index + 1}. ${metadata?.name ?? id}` +
          (metadata?.author ? ` · ${metadata.author}` : "");
      });
      packages.setDesc(names.length ? names.join(", ") : "keine");
    } catch (error) {
      if (generation !== this.generation) return;
      packages.setDesc("Paketliste konnte nicht gelesen werden: " + String(error));
    }
  }
  onClose(): void {
    this.generation++;
    this.contentEl.replaceChildren();
  }
}
export class MapSettingsModal extends Modal {
  private generation = 0;
  constructor(
    app: App,
    private session: Session,
    private path: string,
    private catalog: AssetCatalog,
  ) {
    super(app);
  }
  onOpen(): void {
    void this.render();
  }
  private async render(): Promise<void> {
    const generation = ++this.generation;
    this.titleEl.setText("Kartengröße ändern");
    this.contentEl.replaceChildren();
    const current = this.session.settings;
    this.contentEl.createEl("p", { text: "Datei: " + this.path });
    const packageInfo = this.contentEl.createEl("p", {
      text: "Verwendete Pakete werden gelesen …",
    });
    try {
      const data = await this.catalog.read();
      if (generation !== this.generation) return;
      const selected = new Set(current.assetPacks ?? []),
        names = data.packs
          .filter((record) => selected.has(record.metadata.id))
          .map((record) => record.metadata.name);
      packageInfo.setText(
        "Verwendete Pakete: " + (names.length ? names.join(", ") : "keine"),
      );
    } catch (error) {
      packageInfo.setText(
        "Verwendete Pakete konnten nicht gelesen werden: " + String(error),
      );
    }
    if (generation !== this.generation) return;
    let wallShadows: ToggleComponent | undefined,
      objectShadows: ToggleComponent | undefined,
      buildingWear: SliderComponent | undefined;
    new Setting(this.contentEl).setName("Wandschatten").addToggle((toggle) => {
      wallShadows = toggle.setValue(current.wallShadows);
    });
    new Setting(this.contentEl)
      .setName("Objektschatten")
      .addToggle((toggle) => {
        objectShadows = toggle.setValue(current.objectShadows);
      });
    new Setting(this.contentEl)
      .setName("Zusätzliche Gebäudeabnutzung")
      .addSlider((slider) => {
        buildingWear = slider
          .setLimits(0, 100, 5)
          .setValue(current.buildingWear * 100)
          .setDynamicTooltip();
      });
    const margins: { -readonly [Key in keyof MapMargins]: number } = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
      labels: readonly [keyof MapMargins, string][] = [
        ["top", "Oben"],
        ["right", "Rechts"],
        ["bottom", "Unten"],
        ["left", "Links"],
      ];
    this.contentEl.createEl("p", {
      text:
        "Aktuell " +
        current.width.toLocaleString("de-DE") +
        " × " +
        current.height.toLocaleString("de-DE") +
        " Felder. Positive Werte erweitern, negative schneiden den sichtbaren Rand ab.",
    });
    const result = this.contentEl.createEl("p");
    const update = () => {
      const width = current.width + margins.left + margins.right,
        height = current.height + margins.top + margins.bottom;
      result.setText(
        "Neue Größe: " +
          width.toLocaleString("de-DE") +
          " × " +
          height.toLocaleString("de-DE") +
          " Felder",
      );
    };
    for (const [key, label] of labels)
      new Setting(this.contentEl)
        .setName(label + " in Feldern")
        .addText((input) =>
          input
            .setValue("0")
            .setPlaceholder("0")
            .onChange((value) => {
              margins[key] = Number(value);
              update();
            }),
        );
    update();
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("Übernehmen")
        .setCta()
        .onClick(() => {
          try {
            resizeMap(this.session, margins, {
              wallShadows: wallShadows?.getValue() ?? current.wallShadows,
              objectShadows: objectShadows?.getValue() ?? current.objectShadows,
              buildingWear:
                (buildingWear?.getValue() ?? current.buildingWear * 100) / 100,
            });
            this.close();
          } catch (error) {
            new Notice(String(error));
          }
        }),
    );
  }
  onClose(): void {
    this.generation++;
    this.contentEl.replaceChildren();
  }
}
export class AssetPackagesModal extends Modal {
  private generation = 0;
  constructor(
    app: App,
    private catalog: AssetCatalog,
    private changed: () => Promise<void>,
    private session?: Session,
    private nativeArchive?: {
      status(): { path?: string; count: number; error?: string };
      choose(path: string): Promise<void>;
    },
  ) {
    super(app);
  }
  onOpen(): void {
    void this.render();
  }
  onClose(): void {
    this.generation++;
    this.contentEl.replaceChildren();
  }
  private async render(): Promise<void> {
    const generation = ++this.generation;
    this.titleEl.setText("Assetpakete");
    this.contentEl.replaceChildren();
    this.contentEl.createEl("p", {
      text: "Pakete werden einmal im Vault gespeichert. Bilder lädt der Editor erst bei Bedarf.",
    });
    const loading = this.contentEl.createEl("p", {
      text: "Katalog wird gelesen …",
    });
    try {
      const data = await this.catalog.read();
      if (generation !== this.generation) return;
      loading.remove();
      const mapPacks = new Set(
          this.session?.settings.assetPacks ??
            data.packs
              .filter((record) => record.enabled)
              .map((record) => record.metadata.id),
        ),
        mapBuiltIns = this.session?.settings.builtInAssets ?? data.builtIns,
        updateMap = (
          patch: Partial<
            Pick<Settings, "assetPacks" | "builtInAssets">
          >,
        ) => {
          if (!this.session) return;
          const before = this.session.settings,
            after = { ...before, ...patch };
          if (JSON.stringify(before) === JSON.stringify(after)) return;
          this.session.execute({
            label: "Kartenassets ändern",
            settings: { before, after },
          });
        };
      new Setting(this.contentEl)
        .setName(
          this.session ? "Grundformen dieser Karte" : "Eingebaute Grundassets",
        )
        .setDesc(
          "Einfache lesbare Formen bleiben verfügbar, auch wenn kein Paket aktiv ist.",
        )
        .addToggle((toggle) =>
          toggle.setValue(mapBuiltIns).onChange(async (value) => {
            try {
              if (this.session) updateMap({ builtInAssets: value });
              else {
                await this.catalog.setBuiltIns(value);
                await this.changed();
              }
            } catch (error) {
              new Notice(String(error));
              void this.render();
            }
          }),
        );
      if (this.nativeArchive) {
        const status = this.nativeArchive.status();
        const nativeInput = this.contentEl.createEl("input", {
          attr: { type: "file", accept: ".pck" },
          cls: "dn-hidden-input",
        });
        nativeInput.addEventListener("change", () => {
          const selected = nativeInput.files?.[0];
          nativeInput.value = "";
          if (!selected) return;
          const sourcePath = selectedLocalFilePath(selected);
          if (!sourcePath) {
            new Notice("Der Dateipfad konnte nicht gelesen werden.");
            return;
          }
          void this.nativeArchive!.choose(sourcePath)
            .then(() => {
              new Notice("Dungeondraft-Pfadassets geladen.");
              return this.render();
            })
            .catch((error) => new Notice(String(error), 10000));
        });
        const sourceName = status.path?.split(/[\\/]/).at(-1);
        new Setting(this.contentEl)
          .setName("Dungeondraft-Originalassets")
          .setDesc(status.error ?? (sourceName
            ? `${sourceName}: ${status.count} Pfadtexturen verfügbar.`
            : "Originaldatei von Dungeondraft 1.2.0.1 auswählen; sie bleibt an ihrem Ort."))
          .addButton((button) => button
            .setButtonText("Originaldatei wählen")
            .onClick(() => nativeInput.click()));
      }
      const input = this.contentEl.createEl("input", {
        attr: { type: "file", accept: ".dungeondraft_pack", multiple: "" },
        cls: "dn-hidden-input",
      });
      input.addEventListener("change", () => {
        const files = [...(input.files ?? [])];
        if (!files.length) return;
        input.value = "";
        void this.catalog
          .add(files)
          .then(async (records) => {
            new Notice(records.length + " Assetpaket(e) übernommen.");
            await this.changed();
            if (this.session)
              updateMap({
                assetPacks: [
                  ...new Set([
                    ...mapPacks,
                    ...records.map((record) => record.metadata.id),
                  ]),
                ],
              });
            return this.render();
          })
          .catch((error) => new Notice(String(error), 10000));
      });
      new Setting(this.contentEl)
        .setName("Dungeondraft-Pakete importieren")
        .setDesc(
          "Nur Pakete mit ausdrücklicher Freigabe für andere Kartenprogramme.",
        )
        .addButton((button) =>
          button
            .setButtonText("Pakete wählen")
            .setCta()
            .onClick(() => input.click()),
        );
      let search = "";
      const packageRows: {
          record: (typeof data.packs)[number];
          element: HTMLElement;
        }[] = [],
        applySearch = () => {
          const query = search.trim().toLocaleLowerCase("de");
          for (const row of packageRows)
            row.element.toggleAttribute(
              "hidden",
              !!query &&
                !`${row.record.metadata.name} ${row.record.metadata.author ?? ""}`
                  .toLocaleLowerCase("de")
                  .includes(query),
            );
        };
      new Setting(this.contentEl).setName("Pakete suchen").addText((field) => {
        field.inputEl.type = "search";
        field.setPlaceholder("Name oder Autor").onChange((value) => {
          search = value;
          applySearch();
        });
      });
      const list = this.contentEl.createDiv("dn-pack-list");
      if (!data.packs.length)
        list.createEl("p", { text: "Noch keine Pakete importiert." });
      for (const record of data.packs) {
        const row = new Setting(list)
          .setName(record.metadata.name)
          .setDesc(
            record.assetCount.toLocaleString("de-DE") +
              " Assets · " +
              (record.metadata.author ?? "Autor nicht angegeben"),
          );
        packageRows.push({ record, element: row.settingEl });
        row.addToggle((toggle) =>
          toggle
            .setValue(
              this.session ? mapPacks.has(record.metadata.id) : record.enabled,
            )
            .onChange(async (enabled) => {
              try {
                if (this.session) {
                  if (enabled) mapPacks.add(record.metadata.id);
                  else mapPacks.delete(record.metadata.id);
                  updateMap({ assetPacks: [...mapPacks] });
                } else {
                  await this.catalog.setEnabled(record.metadata.id, enabled);
                  await this.changed();
                }
              } catch (error) {
                new Notice(String(error));
                void this.render();
              }
            }),
        );
        row.addExtraButton((button) =>
          button
            .setIcon("trash-2")
            .setTooltip("Paket entfernen")
            .onClick(() => {
              void this.catalog
                .remove(record.metadata.id)
                .then(async () => {
                  await this.changed();
                  return this.render();
                })
                .catch((error) => new Notice(String(error), 10000));
            }),
        );
      }
    } catch (error) {
      loading.setText("Katalog konnte nicht gelesen werden: " + String(error));
    }
  }
}
export class CreateDungeonModal extends Modal {
  private generation = 0;
  constructor(
    app: App,
    private plugin: DungeonPlugin,
  ) {
    super(app);
  }
  onOpen(): void {
    void this.render();
  }
  private async render(
    size: { width: number; height: number } = NEW_MAP_DEFAULT_SIZE,
  ): Promise<void> {
    const generation = ++this.generation,
      catalog = await this.plugin.assets.read();
    if (generation !== this.generation) return;
    this.titleEl.setText("Dungeon anlegen");
    this.contentEl.replaceChildren();
    let name = "",
      width = size.width,
      height = size.height,
      presetName = "",
      selectedPreset = "",
      builtInAssets = catalog.builtIns,
      wallShadows = true,
      objectShadows = true,
      disableBuildingWear = this.plugin.disableBuildingWearForNewMap,
      startKind: GeneratorKind | "empty" = "empty",
      generatorSeed = 1,
      generatorAmount = 12;
    const assetPacks = new Set(
        catalog.packs
          .filter((record) => record.enabled)
          .map((record) => record.metadata.id),
      ),
      presets = [...this.plugin.sizePresets()];
    this.contentEl.createEl("p", {
      text: "Neue Karte mit verknüpften Raum-Keys. 1 Feld entspricht 5 Fuß.",
    });
    new Setting(this.contentEl)
      .setName("Name")
      .addText((t) =>
        t.setPlaceholder("Name des Dungeons").onChange((v) => (name = v)),
      );
    let widthInput!: HTMLInputElement, heightInput!: HTMLInputElement;
    new Setting(this.contentEl)
      .setName("Breite in Feldern")
      .addText((t) =>
        t.setValue(String(width)).onChange((v) => (width = Number(v))),
      );
    widthInput = this.contentEl.querySelectorAll<HTMLInputElement>(
      ".setting-item input",
    )[1]!;
    new Setting(this.contentEl)
      .setName("Höhe in Feldern")
      .addText((t) =>
        t.setValue(String(height)).onChange((v) => (height = Number(v))),
      );
    heightInput = this.contentEl.querySelectorAll<HTMLInputElement>(
      ".setting-item input",
    )[2]!;
    const presetSetting = new Setting(this.contentEl).setName("Größenvorlage");
    presetSetting.addDropdown((dropdown) => {
      dropdown.addOption("", "Freie Größe");
      for (const preset of presets)
        dropdown.addOption(
          preset.name,
          preset.name + " (" + preset.width + " × " + preset.height + ")",
        );
      dropdown.onChange((value) => {
        selectedPreset = value;
        const preset = presets.find((candidate) => candidate.name === value);
        if (!preset) return;
        width = preset.width;
        height = preset.height;
        widthInput.value = String(width);
        heightInput.value = String(height);
      });
    });
    presetSetting.addExtraButton((button) =>
      button
        .setIcon("trash-2")
        .setTooltip("Gewählte Vorlage löschen")
        .onClick(async () => {
          if (!selectedPreset) return;
          await this.plugin.removeSizePreset(selectedPreset);
          void this.render({ width, height });
        }),
    );
    new Setting(this.contentEl)
      .setName("Aktuelle Größe als Vorlage")
      .addText((input) =>
        input
          .setPlaceholder("Vorlagenname")
          .onChange((value) => (presetName = value)),
      )
      .addButton((button) =>
        button.setButtonText("Merken").onClick(async () => {
          try {
            await this.plugin.saveSizePreset(presetName, width, height);
            new Notice("Größenvorlage gespeichert.");
            void this.render({ width, height });
          } catch (error) {
            new Notice(String(error));
          }
        }),
      );
    new Setting(this.contentEl)
      .setName("Eingebaute Grundassets")
      .addToggle((toggle) =>
        toggle
          .setValue(builtInAssets)
          .onChange((value) => (builtInAssets = value)),
      );
    new Setting(this.contentEl)
      .setName("Wandschatten")
      .addToggle((toggle) =>
        toggle.setValue(wallShadows).onChange((value) => (wallShadows = value)),
      );
    new Setting(this.contentEl)
      .setName("Objektschatten")
      .addToggle((toggle) =>
        toggle
          .setValue(objectShadows)
          .onChange((value) => (objectShadows = value)),
      );
    new Setting(this.contentEl)
      .setName("Gebäudeabnutzung deaktivieren")
      .addToggle((toggle) =>
        toggle.setValue(disableBuildingWear).onChange((value) => {
          disableBuildingWear = value;
          this.plugin.disableBuildingWearForNewMap = value;
        }),
      );
    new Setting(this.contentEl)
      .setName("Startinhalt")
      .setDesc("Der Vorschlag ist nach dem Anlegen normal bearbeitbar.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("empty", "Leere Karte")
          .addOption("dungeon", "Dungeonvorschlag")
          .addOption("cave", "Höhlenvorschlag")
          .onChange((value) => (startKind = value as typeof startKind)),
      );
    new Setting(this.contentEl)
      .setName("Generator-Startwert")
      .addText((input) =>
        input.setValue(String(generatorSeed)).onChange((value) => {
          generatorSeed = Number(value);
        }),
      );
    new Setting(this.contentEl)
      .setName("Generator-Räume oder Formdetails")
      .addText((input) =>
        input.setValue(String(generatorAmount)).onChange((value) => {
          generatorAmount = Number(value);
        }),
      );
    if (catalog.packs.length) {
      this.contentEl.createEl("h3", { text: "Assetpakete dieser Karte" });
      for (const record of catalog.packs)
        new Setting(this.contentEl)
          .setName(record.metadata.name)
          .setDesc(record.metadata.author ?? "Autor nicht angegeben")
          .addToggle((toggle) =>
            toggle
              .setValue(assetPacks.has(record.metadata.id))
              .onChange((enabled) => {
                if (enabled) assetPacks.add(record.metadata.id);
                else assetPacks.delete(record.metadata.id);
              }),
          );
    }
    new Setting(this.contentEl).addButton((b) =>
      b
        .setButtonText("Anlegen")
        .setCta()
        .onClick(async () => {
          b.setDisabled(true);
          try {
            const size = newMapDialogSize(width, height);
            await this.plugin.create(
              name,
              size.width,
              size.height,
              {
                assetPacks: [...assetPacks],
                builtInAssets,
              },
              startKind === "empty"
                ? undefined
                : {
                    kind: startKind,
                    seed: generatorSeed,
                    amount: generatorAmount,
                  },
              { wallShadows, objectShadows, buildingWear: 0,
                nativeBuildingWear: !disableBuildingWear },
            );
            this.close();
          } catch (error) {
            new Notice(String(error));
            b.setDisabled(false);
          }
        }),
    );
  }
  onClose(): void {
    this.generation++;
    this.contentEl.replaceChildren();
  }
}
