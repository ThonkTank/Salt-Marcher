import { App, ButtonComponent, Modal, Setting, SliderComponent, TextComponent } from "obsidian";
import { defaultExportQualityPercent, exportFormatLabels, exportPixelDimensions,
  exportQualityPercent, nonNegativePercent, qualityForExportRequest,
  supportsExportQuality,
  positivePixelsPerCell, validExportCrop,
  type ExportAdvancedKey, type ExportAdvancedOptions, type ExportChoice,
  type ExportCrop, type ExportFormat, type ExportRequest } from "./export-options";

export { positivePixelsPerCell } from "./export-options";
export type { ExportFormat, ExportRequest } from "./export-options";

export interface ExportResult {
  blob: Blob;
  filename: string;
}

export interface ExportDialogConfig {
  initial: ExportRequest;
  onExport: (request: ExportRequest, signal: AbortSignal) =>
    ExportResult | Promise<ExportResult>;
  advanced?: {
    /** A control is active only when the export callback applies its value. */
    supported: readonly ExportAdvancedKey[];
    levels?: readonly ExportChoice[];
    cameraFilters?: readonly ExportChoice[];
    gridPresets?: readonly ExportChoice[];
    mapSize?: { width: number; height: number };
    initial?: Partial<ExportAdvancedOptions>;
    selectCrop?: (previous: ExportCrop | null, signal: AbortSignal) =>
      ExportCrop | null | Promise<ExportCrop | null>;
  };
}

export class ExportDialog extends Modal {
  private readonly initial: ExportRequest;
  private readonly onExport: ExportDialogConfig["onExport"];
  private readonly advanced?: ExportDialogConfig["advanced"];
  private controller?: AbortController;
  private generation = 0;
  private busy = false;

  constructor(app: App, config: ExportDialogConfig) {
    super(app);
    if (!(config.initial.format in exportFormatLabels) ||
      !Number.isSafeInteger(config.initial.pixelsPerCell) ||
      config.initial.pixelsPerCell <= 0 ||
      (config.initial.qualityPercent !== undefined &&
        exportQualityPercent(String(config.initial.qualityPercent)) === null))
      throw new RangeError("Ungültige Exportvorgabe");
    this.initial = { ...config.initial };
    this.onExport = config.onExport;
    this.advanced = config.advanced;
    const supported = new Set(config.advanced?.supported ?? []);
    const needs = (key: ExportAdvancedKey, available: boolean) => {
      if (supported.has(key) && !available)
        throw new RangeError(`${key}: Exportoption ohne anwendbaren Hostwert`);
    };
    needs("sourceLevelId", !!config.advanced?.levels?.length);
    needs("overlayLevelId", !!config.advanced?.levels?.length);
    needs("cameraFilterId", !!config.advanced?.cameraFilters?.length);
    needs("gridPresetId", !!config.advanced?.gridPresets?.length);
    needs("crop", !!config.advanced?.selectCrop && !!config.advanced?.mapSize);
    const mapSize = config.advanced?.mapSize;
    if (mapSize && (!Number.isSafeInteger(mapSize.width) || mapSize.width <= 0 ||
      !Number.isSafeInteger(mapSize.height) || mapSize.height <= 0))
      throw new RangeError("Ungültige Kartengröße für den Export");
  }

  onOpen(): void {
    this.generation++;
    this.controller = new AbortController();
    this.busy = false;
    this.setTitle("Karte exportieren");
    this.contentEl.empty();
    this.contentEl.style.maxHeight = "75vh";
    this.contentEl.style.overflowY = "auto";

    let format = this.initial.format;
    let pixelsText = String(this.initial.pixelsPerCell);
    let includeGrid = this.initial.includeGrid;
    let includeLighting = this.initial.includeLighting;
    let qualityText = String(this.initial.qualityPercent ?? defaultExportQualityPercent);
    let qualitySetting: Setting | undefined;
    let qualitySlider: SliderComponent | undefined;
    let qualityInput: TextComponent | undefined;
    const supported = new Set(this.advanced?.supported ?? []);
    const supports = (key: ExportAdvancedKey) => supported.has(key);
    const levels = this.advanced?.levels ?? [];
    const displayLevels = levels.length ? levels : [{ id: "ground", label: "Ground" }];
    const filters = this.advanced?.cameraFilters ?? [{ id: "none", label: "None" }];
    const presets = this.advanced?.gridPresets ?? [{ id: "custom", label: "Custom" }];
    const initial = { ...this.initial.advanced, ...this.advanced?.initial };
    let sourceLevelId = initial.sourceLevelId ?? displayLevels[0]?.id ?? "ground";
    let sourceLighting = initial.sourceLighting ?? true;
    let brightnessText = String(initial.brightnessPercent ?? 100);
    let focusText = String(initial.focusPercent ?? 100);
    let overlayLevelId = initial.overlayLevelId ?? null;
    let overlayLighting = initial.overlayLighting ?? true;
    let opacityText = String(initial.overlayOpacityPercent ?? 100);
    let cameraFilterId = initial.cameraFilterId ?? filters[0]?.id ?? "none";
    let gridPresetId = initial.gridPresetId ?? presets[0]?.id ?? "custom";
    let crop = initial.crop ?? null;
    let exportButton: ButtonComponent | undefined;
    let cropButton: ButtonComponent | undefined;
    let resetCropButton: ButtonComponent | undefined;
    let outputDimensions: HTMLElement | undefined;
    const message = this.contentEl.createDiv({ cls: "dn-export-message" });
    message.setAttribute("role", "alert");
    const valid = () => positivePixelsPerCell(pixelsText) !== null &&
      qualityForExportRequest(format, qualityText) !== null &&
      (!supports("sourceLevelId") || levels.some(({ id }) => id === sourceLevelId)) &&
      (!supports("brightnessPercent") || nonNegativePercent(brightnessText) !== null) &&
      (!supports("focusPercent") || nonNegativePercent(focusText) !== null) &&
      (!supports("overlayLevelId") || overlayLevelId === null ||
        levels.some(({ id }) => id === overlayLevelId)) &&
      (!supports("overlayOpacityPercent") || nonNegativePercent(opacityText, 100) !== null) &&
      (!supports("cameraFilterId") || filters.some(({ id }) => id === cameraFilterId)) &&
      (!supports("gridPresetId") || presets.some(({ id }) => id === gridPresetId)) &&
      (!supports("crop") || crop === null || validExportCrop(crop, this.advanced?.mapSize));
    const refresh = () => {
      if (qualitySetting)
        qualitySetting.settingEl.style.display = supportsExportQuality(format) ? "" : "none";
      exportButton?.setDisabled(this.busy || !valid());
      cropButton?.setDisabled(this.busy || !supports("crop"));
      resetCropButton?.setDisabled(this.busy || !supports("crop") || crop === null);
      if (outputDimensions) {
        const ppi = positivePixelsPerCell(pixelsText);
        const dimensions = ppi && this.advanced?.mapSize
          ? exportPixelDimensions(this.advanced.mapSize, ppi,
            supports("crop") ? crop : null) : null;
        outputDimensions.textContent = dimensions
          ? `Ausgabe: ${dimensions.width} × ${dimensions.height} Pixel`
          : "Ausgabemaße noch nicht verfügbar";
      }
    };
    const row = (name: string, key: ExportAdvancedKey) => {
      const setting = new Setting(this.contentEl).setName(name);
      if (!supports(key)) setting.setDesc("Noch nicht verfügbar; Wirkung im Original offen.");
      return setting;
    };
    const choices = (items: readonly ExportChoice[]) =>
      Object.fromEntries(items.map(({ id, label }) => [id, label]));

    new Setting(this.contentEl).setName("Format").addDropdown((dropdown) =>
      dropdown.addOptions(exportFormatLabels).setValue(format).onChange((value) => {
        if (value in exportFormatLabels) format = value as ExportFormat;
        refresh();
      }));
    qualitySetting = new Setting(this.contentEl).setName("Quality (%)")
      .addSlider((slider) => {
        qualitySlider = slider.setLimits(0, 100, 1)
          .setValue(exportQualityPercent(qualityText) ?? defaultExportQualityPercent)
          .onChange((value) => {
            qualityText = String(value);
            qualityInput?.setValue(qualityText);
            refresh();
          });
      })
      .addText((input) => {
        qualityInput = input;
        input.inputEl.type = "number";
        input.inputEl.min = "0";
        input.inputEl.max = "100";
        input.inputEl.step = "1";
        input.setValue(qualityText).onChange((value) => {
          qualityText = value;
          const parsed = exportQualityPercent(value);
          if (parsed !== null) qualitySlider?.setValue(parsed);
          refresh();
        });
      });
    new Setting(this.contentEl).setName("Pixel pro Feld")
      .addText((input) => {
        input.inputEl.type = "number";
        input.inputEl.min = "1";
        input.inputEl.step = "1";
        input.setValue(pixelsText).onChange((value) => {
          pixelsText = value;
          message.textContent = "";
          refresh();
        });
      });
    new Setting(this.contentEl).setName("Raster exportieren")
      .addToggle((toggle) => toggle.setValue(includeGrid).onChange((value) => {
        includeGrid = value;
      }));
    new Setting(this.contentEl).setName("Beleuchtung exportieren")
      .addToggle((toggle) => toggle.setValue(includeLighting).onChange((value) => {
        includeLighting = value;
      }));
    row("Source Level", "sourceLevelId").addDropdown((dropdown) => dropdown
      .addOptions(choices(displayLevels))
      .setValue(sourceLevelId).setDisabled(!supports("sourceLevelId"))
      .onChange((value) => { sourceLevelId = value; refresh(); }));
    row("Source Lighting", "sourceLighting").addToggle((toggle) => toggle
      .setValue(sourceLighting).setDisabled(!supports("sourceLighting"))
      .onChange((value) => { sourceLighting = value; }));
    row("Brightness (%)", "brightnessPercent").addText((input) => {
      input.inputEl.type = "number";
      input.inputEl.min = "0";
      input.inputEl.step = "any";
      input.setValue(brightnessText).setDisabled(!supports("brightnessPercent"))
        .onChange((value) => { brightnessText = value; refresh(); });
    });
    row("Focus (%)", "focusPercent").addText((input) => {
      input.inputEl.type = "number";
      input.inputEl.min = "0";
      input.inputEl.step = "any";
      input.setValue(focusText).setDisabled(!supports("focusPercent"))
        .onChange((value) => { focusText = value; refresh(); });
    });
    row("Overlay Level", "overlayLevelId").addDropdown((dropdown) => dropdown
      .addOptions({ "": "---", ...choices(levels) })
      .setValue(overlayLevelId ?? "").setDisabled(!supports("overlayLevelId"))
      .onChange((value) => { overlayLevelId = value || null; refresh(); }));
    row("Overlay Lighting", "overlayLighting").addToggle((toggle) => toggle
      .setValue(overlayLighting).setDisabled(!supports("overlayLighting"))
      .onChange((value) => { overlayLighting = value; }));
    row("Opacity (%)", "overlayOpacityPercent").addText((input) => {
      input.inputEl.type = "number";
      input.inputEl.min = "0";
      input.inputEl.max = "100";
      input.inputEl.step = "any";
      input.setValue(opacityText).setDisabled(!supports("overlayOpacityPercent"))
        .onChange((value) => { opacityText = value; refresh(); });
    });
    row("Camera Filter", "cameraFilterId").addDropdown((dropdown) => dropdown
      .addOptions(choices(filters)).setValue(cameraFilterId)
      .setDisabled(!supports("cameraFilterId"))
      .onChange((value) => { cameraFilterId = value; refresh(); }));
    row("Grid Presets", "gridPresetId").addDropdown((dropdown) => dropdown
      .addOptions(choices(presets)).setValue(gridPresetId)
      .setDisabled(!supports("gridPresetId"))
      .onChange((value) => { gridPresetId = value; refresh(); }));
    outputDimensions = this.contentEl.createDiv({ cls: "dn-export-dimensions" });
    new Setting(this.contentEl).setName("Show in Folder on Finish")
      .setDesc("Noch nicht verfügbar; Wirkung im Original offen.")
      .addToggle((toggle) => toggle.setValue(true).setDisabled(true));
    row("Crop", "crop")
      .addButton((button) => {
        cropButton = button.setButtonText("Crop").setDisabled(!supports("crop"));
        button.onClick(() => {
          if (this.busy || !this.controller || !this.advanced?.selectCrop) return;
          this.busy = true;
          refresh();
          const generation = this.generation;
          const signal = this.controller.signal;
          void (async () => {
            try {
              const selected = await this.advanced!.selectCrop!(crop, signal);
              if (signal.aborted || generation !== this.generation) return;
              if (selected !== null) {
                if (!validExportCrop(selected, this.advanced?.mapSize))
                  throw new RangeError("Der Zuschnitt liegt außerhalb der Karte.");
                crop = selected;
              }
            } catch (error) {
              if (signal.aborted || generation !== this.generation) return;
              message.textContent = error instanceof Error
                ? error.message : "Zuschnitt fehlgeschlagen.";
            } finally {
              if (generation === this.generation) {
                this.busy = false;
                refresh();
              }
            }
          })();
        });
      })
      .addButton((button) => {
        resetCropButton = button.setButtonText("Reset Crop")
          .setDisabled(!supports("crop") || crop === null);
        button.onClick(() => { crop = null; refresh(); });
      });
    new Setting(this.contentEl)
      .addButton((button) => {
        exportButton = button.setButtonText("Exportieren").setCta();
        button.onClick(() => {
          const pixelsPerCell = positivePixelsPerCell(pixelsText);
          const quality = qualityForExportRequest(format, qualityText);
          if (pixelsPerCell === null || quality === null || !valid() ||
            this.busy || !this.controller) {
            message.textContent = "Bitte die Exportwerte prüfen.";
            return;
          }
          this.busy = true;
          refresh();
          message.textContent = "Export wird erstellt …";
          const generation = this.generation;
          const signal = this.controller.signal;
          const advanced: Partial<ExportAdvancedOptions> = {};
          if (supports("sourceLevelId")) advanced.sourceLevelId = sourceLevelId;
          if (supports("sourceLighting")) advanced.sourceLighting = sourceLighting;
          if (supports("brightnessPercent"))
            advanced.brightnessPercent = nonNegativePercent(brightnessText)!;
          if (supports("focusPercent"))
            advanced.focusPercent = nonNegativePercent(focusText)!;
          if (supports("overlayLevelId")) advanced.overlayLevelId = overlayLevelId;
          if (supports("overlayLighting")) advanced.overlayLighting = overlayLighting;
          if (supports("overlayOpacityPercent"))
            advanced.overlayOpacityPercent = nonNegativePercent(opacityText, 100)!;
          if (supports("cameraFilterId")) advanced.cameraFilterId = cameraFilterId;
          if (supports("gridPresetId")) advanced.gridPresetId = gridPresetId;
          if (supports("crop")) advanced.crop = crop;
          const request: ExportRequest = {
            format, pixelsPerCell, includeGrid, includeLighting,
            ...quality,
            ...(Object.keys(advanced).length && { advanced }),
          };
          void (async () => {
            try {
              const result = await this.onExport(request, signal);
              if (signal.aborted || generation !== this.generation) return;
              if (!result?.blob || typeof result.filename !== "string" ||
                !result.filename.trim() || /[\\/]/.test(result.filename))
                throw new Error("Der Export hat keinen gültigen Dateinamen geliefert.");
              this.download(result.blob, result.filename.trim());
              this.close();
            } catch (error) {
              if (signal.aborted || generation !== this.generation) return;
              message.textContent = error instanceof Error
                ? `Export fehlgeschlagen: ${error.message}` : "Export fehlgeschlagen.";
            } finally {
              if (generation === this.generation) {
                this.busy = false;
                refresh();
              }
            }
          })();
        });
      })
      .addButton((button) => button.setButtonText("Abbrechen")
        .onClick(() => this.close()));
    refresh();
  }

  onClose(): void {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    this.busy = false;
    this.contentEl.empty();
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.contentEl.ownerDocument.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    this.contentEl.appendChild(link);
    try { link.click(); }
    finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
  }
}
