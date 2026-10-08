import {
  type Entity,
  type Material,
  type Light,
  type Door,
  type Surface,
  type MapPath,
  type Roof,
  type MapObject,
  type ReferenceImage,
  type CompassDirection,
  type PassageDetails,
  isRoom,
} from "./model";
import { Session } from "./session";
import { type AssetDefinition, type AssetKind } from "./assets";
import { updatePassage } from "./commands";
import {
  alphaByteFromOpacity,
  opacityFromAlphaByte,
} from "./features/material/pattern-appearance";
import { newPathLibrarySearchState } from "./features/material/path-library-search";
import { mountPathLibraryView } from "./features/material/path-library-view";
import { mountPatternColorPicker } from "./features/material/pattern-color-picker";
import {
  mountBuildingColorPicker,
  type BuildingColorSample,
  type MountedBuildingColorPicker,
} from "./features/bau/building-color-picker";
import { mountLightColorPalette } from "./features/objekte/light-color-palette";
import {
  nativePathDimensions,
  nativePathWidthFactor,
} from "./features/material/native-path-scale";
import {
  isNativeFloorAssetId,
  isNativeWallAssetId,
} from "./features/material/native-path-catalog";
import {
  mountObjectColorPicker,
  NATIVE_OBJECT_PALETTE,
  type MountedObjectColorPicker,
  type ObjectColorPickerHooks,
} from "./features/objekte/rgba-picker";
import { mountScatterColorPicker } from "./features/objekte/scatter-picker-dismiss";
import {
  createObjectLibraryTilePreview,
  type ObjectLibraryTilePreview,
} from "./features/objekte/library-tile-preview";
import type { ColorableObjectSource } from "./renderer";

export type Tool =
  | "select"
  | "edit-points"
  | "room"
  | "polygon"
  | "ellipse"
  | "corridor"
  | "wall"
  | "door"
  | "object"
  | "prefab"
  | "scatter"
  | "cave"
  | "material"
  | "pattern"
  | "path"
  | "roof"
  | "water"
  | "terrain"
  | "light"
  | "pan";
export interface ToolSettings {
  brushRadius: number;
  corridorRadius: number;
  floorMode: "draw" | "erase";
  material?: Material;
  layer: number;
  light: Pick<Light, "radius" | "intensity" | "color" | "shadows" | "assetId">;
  room: {
    wallAssetId?: string;
    wallAlpha?: number;
    wallBevel?: boolean;
    styleReady?: boolean;
  };
  wall: {
    smooth: boolean;
    width: number;
    layer: number;
    shadow: boolean;
    color: number;
    alpha: number;
    assetId?: string;
  };
  surfaceShape: "rectangle" | "ellipse" | "polygon";
  waterShape: "brush" | "rectangle" | "ellipse" | "polygon";
  surfaces: Record<
    "floor" | "cave" | "pattern" | "water" | "terrain",
    {
      layer: number;
      color: number;
      wallColor: number;
      wallAlpha?: number;
      wallWidth: number;
      opacity?: number;
      effect?: "none" | "ripples";
    }
  >;
  path: Omit<MapPath, "id" | "kind" | "floorId" | "points">;
  roof: Pick<
    Roof,
    "roofType" | "color" | "outlineColor" | "layer" | "material"
  >;
  roofShape: "rectangle" | "polygon";
  object: Pick<
    MapObject,
    | "rotation"
    | "width"
    | "height"
    | "color"
    | "alpha"
    | "label"
    | "assetId"
    | "layer"
    | "shadow"
    | "blocksLight"
    | "flip"
  >;
  objectScale: number;
  objectSorting: "over" | "under";
  objectPreset: "furniture" | "chest" | "pillar" | "marker";
  scatter: {
    spacing: number;
    spread: number;
    rotationJitter: number;
    scaleJitter: number;
    seed: number;
  };
  portal: Pick<Door, "variant" | "width" | "assetId"> & {
    blocksLight: boolean;
    flip: boolean;
    freestanding: boolean;
    rotation: number;
    passage: PassageDetails;
  };
}
export const toolSettings = (): ToolSettings => ({
  brushRadius: 2,
  corridorRadius: 0.5,
  floorMode: "draw",
  layer: 100,
  light: { radius: 8, intensity: 1, color: 0xffc979, shadows: true },
  room: { wallBevel: true },
  wall: { smooth: false, width: 0.22, layer: 700, shadow: true,
    color: 0x403e39, alpha: 255 },
  surfaceShape: "rectangle",
  waterShape: "brush",
  surfaces: {
    floor: {
      layer: 200,
      color: 0xbfb09a,
      wallColor: 0x403e39,
      wallWidth: 0.2,
      opacity: 1,
      effect: "none",
    },
    cave: {
      layer: -300,
      color: 0xafa99b,
      wallColor: 0x454443,
      wallAlpha: 255,
      wallWidth: 0.3,
      opacity: 1,
      effect: "none",
    },
    pattern: {
      layer: 100,
      color: 0xb4976c,
      wallColor: 0x5d4a35,
      wallWidth: 0.08,
      opacity: 1,
      effect: "none",
    },
    water: {
      layer: -50,
      color: 0x6faac2,
      wallColor: 0xbed9df,
      wallWidth: 0.2,
      opacity: 0.82,
      effect: "ripples",
    },
    terrain: {
      layer: -500,
      color: 0x718657,
      wallColor: 0x718657,
      wallWidth: 0,
      opacity: 0.78,
      effect: "none",
    },
  },
  path: {
    closed: false,
    smooth: true,
    width: 1.2,
    style: "road",
    color: 0xa99473,
    outlineColor: 0x625744,
    outlineWidth: 0.12,
    layer: 500,
    start: "round",
    end: "round",
    blocksLight: false,
  },
  roof: {
    roofType: "hip",
    color: 0x8d5d4a,
    outlineColor: 0x46352f,
    layer: 400,
  },
  roofShape: "rectangle",
  object: {
    rotation: 0,
    width: 1,
    height: 1,
    color: 0x6b3834,
    alpha: 255,
    label: "",
    layer: 100,
    shadow: true,
    blocksLight: false,
    flip: false,
  },
  objectScale: 1,
  objectSorting: "over",
  objectPreset: "furniture",
  scatter: {
    spacing: 2,
    spread: 0.8,
    rotationJitter: Math.PI,
    scaleJitter: 0.2,
    seed: 1,
  },
  portal: {
    variant: "door",
    width: 1,
    blocksLight: true,
    flip: false,
    freestanding: false,
    rotation: 0,
    passage: {
      description: "",
      state: "closed",
      hidden: false,
    },
  },
});

export function buildingStyleDefaultColor(asset: AssetDefinition | undefined): number {
  const hex = asset?.color?.replace(/^#/, "") ?? "ffffff";
  return /^[0-9a-f]{6}$/i.test(hex) ? Number.parseInt(hex, 16) : 0xffffff;
}

/** Small DOM inspector. Values commit through the same history as canvas edits. */
export class Properties {
  private pathLibrarySearch = newPathLibrarySearchState();
  private objectPicker?: MountedObjectColorPicker;
  private buildingPicker?: MountedBuildingColorPicker;
  private objectLibraryPreview?: ObjectLibraryTilePreview;
  constructor(
    private root: HTMLElement,
    private session: Session,
    readonly defaults: ToolSettings,
    private notice: (message: string) => void,
    private assets: () => readonly AssetDefinition[] = () => [],
    private assetUrl: (reference: string) => string = () => "",
    private defaultsChanged: () => void = () => {},
    private adoptFloor: (id: string) => void = () => {},
    private previewObjectColor: (id: string, color: number, alpha: number) => void = () => {},
    private clearObjectColorPreview: (id: string) => void = () => {},
    private colorableObjectSource: (id: string) => ColorableObjectSource | undefined = () => undefined,
    private sampleMapColor: (onPreview?: (sample: BuildingColorSample) => void) => Promise<BuildingColorSample | null> = async () => null,
    private previewToolObject: () => void = () => {},
  ) {}
  private field(
    label: string,
    type: string,
    value: string,
    change: (input: HTMLInputElement) => void,
    min?: string,
    max?: string,
    step?: string,
  ): HTMLInputElement {
    const row = document.createElement("label");
    row.className = "dn-field";
    const name = document.createElement("span");
    name.textContent = label;
    const input = document.createElement("input");
    input.type = type;
    input.setAttribute("aria-label", label);
    if (type === "checkbox") input.checked = value === "true";
    else input.value = value;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;
    input.addEventListener("change", () => {
      try {
        const before = JSON.stringify(this.defaults);
        change(input);
        if (before !== JSON.stringify(this.defaults)) this.defaultsChanged();
      } catch (error) {
        this.notice(String(error));
      }
    });
    row.append(name, input);
    this.root.append(row);
    return input;
  }
  private change(e: Entity, patch: Partial<Entity>): void {
    const current = this.session.entities.get(e.id);
    if (!current) throw new Error("Objekt wurde entfernt.");
    this.session.execute({
      label: "Eigenschaften ändern",
      entities: [
        {
          id: e.id,
          before: current,
          after: { ...current, ...patch } as Entity,
        },
      ],
    });
  }
  private choice(
    label: string,
    value: string,
    options: readonly [string, string][],
    change: (value: string) => void,
    preview = false,
    previewUpdated?: (image: HTMLImageElement, value: string) => void,
  ): HTMLImageElement | undefined {
    const row = document.createElement("label");
    row.className = "dn-field";
    const name = document.createElement("span"),
      select = document.createElement("select");
    name.textContent = label;
    select.setAttribute("aria-label", label);
    for (const [key, text] of options) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = text;
      select.append(option);
    }
    select.value = value;
    const image = preview ? document.createElement("img") : undefined,
      updatePreview = () => {
        if (!image) return;
        const asset = this.assets().find(
            (candidate) => candidate.id === select.value,
          ),
          part = asset
            ? ["preview", "image", "tile", "floor", "tiles", "texture"].find(
                (key) => asset.files[key],
              )
            : undefined,
          url = asset && part ? this.assetUrl(asset.id + "\0" + part) : "";
        image.src = url;
        image.hidden = !url;
        previewUpdated?.(image, select.value);
      };
    if (image) {
      image.className = "dn-asset-preview";
      image.alt = label + " Vorschau";
      image.loading = "lazy";
    }
    select.addEventListener("change", () => {
      try {
        const before = JSON.stringify(this.defaults);
        change(select.value);
        // A selected map object can synchronously rebuild the panel in change().
        // Do not bind a late preview to the detached previous row.
        if (row.parentElement === this.root) updatePreview();
        if (before !== JSON.stringify(this.defaults)) this.defaultsChanged();
      } catch (error) {
        this.notice(String(error));
      }
    });
    row.append(name, select);
    if (options.length > 12) {
      const search = document.createElement("input");
      search.type = "search";
      search.className = "dn-choice-search";
      search.placeholder = "Suchen …";
      search.setAttribute("aria-label", label + " suchen");
      search.addEventListener("input", () => {
        const query = search.value.trim().toLocaleLowerCase("de");
        for (const option of select.options)
          option.hidden =
            !!query &&
            option.value !== value &&
            !option.textContent?.toLocaleLowerCase("de").includes(query);
      });
      row.insertBefore(search, select);
    }
    if (image) {
      row.append(image);
      updatePreview();
    }
    this.root.append(row);
    return image;
  }
  private bindObjectLibraryPreview(
    image: HTMLImageElement,
    assetId: string,
    color: number,
    alpha: number,
  ): void {
    this.objectLibraryPreview?.dispose();
    this.objectLibraryPreview = undefined;
    if (!assetId) return;
    const source = this.colorableObjectSource(assetId);
    if (!source) return;
    const preview = createObjectLibraryTilePreview(
      image,
      source.image,
      source.settings,
    );
    this.objectLibraryPreview = preview;
    this.previewObjectLibraryColor(color, alpha);
  }
  private previewObjectLibraryColor(color: number, alpha: number): void {
    const preview = this.objectLibraryPreview;
    if (!preview) return;
    void preview.set(color, alpha).catch((error) => {
      if (this.objectLibraryPreview === preview)
        this.notice("Objektvorschau konnte nicht geladen werden: " + String(error));
    });
  }
  private renderBuildingGallery(
    label: string,
    assets: readonly AssetDefinition[],
    selectedId: string | undefined,
    choose: (id: string | undefined) => void,
    none = false,
  ): void {
    const heading = document.createElement("h3");
    heading.textContent = label;
    this.root.append(heading);
    const gallery = document.createElement("div");
    gallery.className = "dn-building-gallery";
    gallery.setAttribute("role", "group");
    gallery.setAttribute("aria-label", label);
    const entries = none
      ? [{ id: "", name: "Keine Wand" } as Pick<AssetDefinition, "id" | "name">,
          ...assets]
      : assets;
    for (const asset of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dn-building-style";
      button.title = asset.name;
      button.setAttribute("aria-label", asset.name);
      button.setAttribute("aria-pressed", String(asset.id === (selectedId ?? "")));
      if (asset.id) {
        const image = document.createElement("img");
        image.alt = "";
        image.loading = "lazy";
        image.src = this.assetUrl(asset.id + "\0image");
        button.append(image);
      } else button.textContent = "×";
      button.addEventListener("click", () => {
        const before = JSON.stringify(this.defaults);
        choose(asset.id || undefined);
        if (before !== JSON.stringify(this.defaults)) this.defaultsChanged();
      });
      gallery.append(button);
    }
    this.root.append(gallery);
  }
  private renderBuildingStyleControls(tool: Tool, selected: string | undefined,
    floorId: string, floorTool: boolean): void {
    if (!floorTool) return;
    const all = this.assets(),
      floors = all.filter((asset) => asset.kind === "tileset"),
      walls = all.filter((asset) => asset.kind === "wall"),
      nativeFloors = floors.filter((asset) => isNativeFloorAssetId(asset.id)),
      nativeWalls = walls.filter((asset) => isNativeWallAssetId(asset.id));
    if (!this.defaults.material?.assetId && nativeFloors.length) {
      const first = nativeFloors[0]!;
      const color = buildingStyleDefaultColor(first);
      this.defaults.material = { assetId: first.id, assetPart: "image",
        tileSize: first.nativeTileSizeFields ?? 4, tint: color, rotation: 0 };
      this.defaults.surfaces.floor = { ...this.defaults.surfaces.floor, color };
      this.defaultsChanged();
    }
    if (!this.defaults.room.styleReady && nativeWalls.length) {
      const first = nativeWalls[0]!;
      this.defaults.room = { ...this.defaults.room,
        wallAssetId: first.id, wallAlpha: 255,
        styleReady: true };
      this.defaults.surfaces.floor = { ...this.defaults.surfaces.floor,
        wallColor: buildingStyleDefaultColor(first), wallWidth: 0.2 };
      this.defaultsChanged();
    }
    const refresh = () => this.render(tool, selected, floorId);
    if (floors.length) this.renderBuildingGallery("Bodenstil", floors,
      this.defaults.material?.assetId, (id) => {
        const asset = floors.find((item) => item.id === id);
        if (!asset) return;
        const color = buildingStyleDefaultColor(asset);
        this.defaults.material = { assetId: asset.id,
          assetPart: asset.files.image ? "image" : "tiles",
          tileSize: asset.nativeTileSizeFields ?? 4, tint: color, rotation: 0 };
        this.defaults.surfaces.floor = { ...this.defaults.surfaces.floor,
          color, opacity: 1 };
        refresh();
      });
    if (walls.length) this.renderBuildingGallery("Wandstil", walls,
      this.defaults.room.wallAssetId, (id) => {
        const asset = walls.find((item) => item.id === id);
        this.defaults.room = { ...this.defaults.room, wallAssetId: id,
          wallAlpha: 255, styleReady: true };
        this.defaults.surfaces.floor = { ...this.defaults.surfaces.floor,
          wallWidth: id ? 0.2 : 0,
          ...(asset ? { wallColor: buildingStyleDefaultColor(asset) } : {}) };
        refresh();
      }, true);
    const floorReset = document.createElement("button");
    floorReset.type = "button";
    floorReset.textContent = "Bodenfarbe zurücksetzen";
    floorReset.addEventListener("click", () => {
      const asset = floors.find((item) => item.id === this.defaults.material?.assetId);
      if (!asset?.color) return;
      const color = buildingStyleDefaultColor(asset);
      this.defaults.surfaces.floor = { ...this.defaults.surfaces.floor,
        color, opacity: 1 };
      if (this.defaults.material)
        this.defaults.material = { ...this.defaults.material, tint: color };
      this.defaultsChanged();
      refresh();
    });
    this.root.append(floorReset);
    const wallReset = document.createElement("button");
    wallReset.type = "button";
    wallReset.textContent = "Wandfarbe zurücksetzen";
    wallReset.addEventListener("click", () => {
      const asset = walls.find((item) => item.id === this.defaults.room.wallAssetId);
      if (!asset?.color) return;
      this.defaults.surfaces.floor = { ...this.defaults.surfaces.floor,
        wallColor: buildingStyleDefaultColor(asset) };
      this.defaults.room = { ...this.defaults.room, wallAlpha: 255 };
      this.defaultsChanged();
      refresh();
    });
    this.root.append(wallReset);
    const floorColor = document.createElement("button");
    floorColor.type = "button";
    floorColor.textContent = "Bodenfarbe RGBA";
    floorColor.style.borderColor = "#" +
      this.defaults.surfaces.floor.color.toString(16).padStart(6, "0");
    floorColor.addEventListener("click", () => {
      this.buildingPicker?.close();
      const floor = this.defaults.surfaces.floor;
      this.buildingPicker = mountBuildingColorPicker(this.root,
        floor.color, alphaByteFromOpacity(floor.opacity ?? 1),
        "Bodenfarbe", {
          onCommit: (color, alpha) => {
            this.defaults.surfaces.floor = { ...this.defaults.surfaces.floor,
              color, opacity: opacityFromAlphaByte(alpha) };
            if (this.defaults.material)
              this.defaults.material = { ...this.defaults.material, tint: color };
            this.defaultsChanged();
            refresh();
          },
          sampleMapColor: this.sampleMapColor,
          onClose: () => { this.buildingPicker = undefined; },
        });
    });
    this.root.append(floorColor);
    const wallColor = document.createElement("button");
    wallColor.type = "button";
    wallColor.textContent = "Wandfarbe RGBA";
    wallColor.style.borderColor = "#" +
      this.defaults.surfaces.floor.wallColor.toString(16).padStart(6, "0");
    wallColor.addEventListener("click", () => {
      this.buildingPicker?.close();
      this.buildingPicker = mountBuildingColorPicker(this.root,
        this.defaults.surfaces.floor.wallColor,
        this.defaults.room.wallAlpha ?? 255,
        "Wandfarbe", {
          onCommit: (color, alpha) => {
            this.defaults.surfaces.floor = { ...this.defaults.surfaces.floor,
              wallColor: color };
            this.defaults.room = { ...this.defaults.room, wallAlpha: alpha };
            this.defaultsChanged();
            refresh();
          },
          sampleMapColor: this.sampleMapColor,
          onClose: () => { this.buildingPicker = undefined; },
        });
    });
    this.root.append(wallColor);
    this.field("Bevel Corners", "checkbox",
      String(this.defaults.room.wallBevel ?? true),
      (input) => { this.defaults.room = { ...this.defaults.room,
        wallBevel: input.checked }; });
  }
  private renderFloorControls(tool: Tool, e: Entity | undefined,
    floorTool: boolean, selected: string | undefined, floorId: string): void {
    if (floorTool) {
      this.choice(
        "Modus",
        this.defaults.floorMode,
        [
          ["draw", "Zeichnen"],
          ["erase", "Ausradieren"],
        ],
        (value) =>
          (this.defaults.floorMode = value as ToolSettings["floorMode"]),
      );
      if (tool === "corridor")
        this.field(
          "Gangradius in Feldern",
          "number",
          String(this.defaults.corridorRadius),
          (input) => {
            const value = input.valueAsNumber;
            if (!Number.isFinite(value) || value <= 0)
              throw new Error("Der Gangradius muss positiv sein.");
            this.defaults.corridorRadius = value;
          },
          ".1",
          undefined,
          ".25",
        );
      const help = document.createElement("p");
      help.className = "dn-help";
      help.textContent =
        tool === "corridor"
          ? "Eckpunkte setzen · Doppelklick oder Enter beendet · Alt radiert vorübergehend · E wechselt den Modus"
          : tool === "polygon"
            ? "Eckpunkte setzen · Doppelklick beendet · Rücktaste entfernt den letzten Punkt · Alt radiert vorübergehend · E wechselt den Modus"
          : "Ziehen: Grundriss formen · Alt radiert vorübergehend · E wechselt den Modus";
      this.root.append(help);
    }
    if (e?.kind === "building" && !isRoom(e)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Raum anlegen";
      button.className = "mod-cta";
      button.addEventListener("click", () => {
        try {
          this.adoptFloor(e.id);
        } catch (error) {
          this.notice(error instanceof Error ? error.message : String(error));
        }
      });
      this.root.append(button);
    }
    const packageWalls = this.assets().filter((asset) => asset.kind === "wall");
    if (e?.kind === "wall" || tool === "wall") {
      const wall = e?.kind === "wall" ? e : this.defaults.wall;
      const update = (patch: Partial<ToolSettings["wall"]>) => {
        this.defaults.wall = { ...this.defaults.wall, ...patch };
        if (e?.kind === "wall") this.change(e, patch);
      };
      this.field("Kurvige Wand", "checkbox", String(wall.smooth), (i) =>
        update({ smooth: i.checked }),
      );
      this.field(
        "Wandbreite in Feldern",
        "number",
        String(wall.width),
        (i) => update({ width: i.valueAsNumber }),
        ".05",
        undefined,
        ".05",
      );
      this.field(
        "Zeichenreihenfolge",
        "number",
        String(wall.layer ?? 700),
        (i) => update({ layer: i.valueAsNumber }),
        undefined,
        undefined,
        "100",
      );
      this.field("Schatten", "checkbox", String(wall.shadow ?? true), (i) =>
        update({ shadow: i.checked }),
      );
      if (packageWalls.length)
        this.choice(
          "Paketwand",
          wall.assetId ?? "",
          [
            ["", "Lesbare Grundwand"],
            ...packageWalls.map(
              (asset) => [asset.id, asset.name] as [string, string],
            ),
          ],
          (assetId) => update({ assetId: assetId || undefined }),
          true,
        );
      const color = document.createElement("button");
      color.type = "button";
      color.textContent = "Wandfarbe RGBA";
      color.style.borderColor = "#" + wall.color.toString(16).padStart(6, "0");
      color.addEventListener("click", () => {
        this.buildingPicker?.close();
        this.buildingPicker = mountBuildingColorPicker(this.root,
          wall.color, wall.alpha ?? 255, "Wandfarbe", {
            onCommit: (nextColor, alpha) => {
              update({ color: nextColor, alpha });
              this.defaultsChanged();
              this.render(tool, selected, floorId);
            },
            sampleMapColor: this.sampleMapColor,
            onClose: () => { this.buildingPicker = undefined; },
          });
      });
      this.root.append(color);
    }
  }
  private renderPortalControls(tool: Tool, e: Entity | undefined): void {
    if (e?.kind === "door" || tool === "door") {
      const portal = e?.kind === "door" ? e : this.defaults.portal;
      const update = (patch: Partial<ToolSettings["portal"]>) => {
        this.defaults.portal = { ...this.defaults.portal, ...patch };
        if (e?.kind === "door") this.change(e, patch);
      };
      const passage: PassageDetails = portal.passage ?? {
          description: "",
          state: portal.variant === "opening" ? "open" : "closed",
          hidden: false,
        },
        updatePassageDetails = (patch: Partial<PassageDetails>) => {
          const current =
              (e?.kind === "door"
                ? (this.session.entities.get(e.id) as Door | undefined)?.passage
                : this.defaults.portal.passage) ?? passage,
            next: PassageDetails = { ...current, ...patch };
          if (e?.kind === "door") updatePassage(this.session, e.id, next);
          else
            this.defaults.portal = {
              ...this.defaults.portal,
              passage: next,
            };
        },
        optionalInteger = (input: HTMLInputElement): number | undefined => {
          if (!input.value.trim()) return undefined;
          const value = input.valueAsNumber;
          if (!Number.isInteger(value) || value <= 0)
            throw new Error("Der Wert muss eine positive ganze Zahl sein.");
          return value;
        };
      const packagePortals = this.assets().filter(
        (asset) => asset.kind === "portal",
      );
      if (packagePortals.length)
        this.choice(
          "Paketportal",
          portal.assetId ?? "",
          [
            ["", "Lesbares Grundsymbol"],
            ...packagePortals.map(
              (asset) => [asset.id, asset.name] as [string, string],
            ),
          ],
          (assetId) => update({ assetId: assetId || undefined }),
          true,
        );
      this.choice(
        "Portalart",
        portal.variant,
        [
          ["door", "Tür"],
          ["window", "Fenster"],
          ["bars", "Gitter"],
          ["opening", "Offener Durchgang"],
        ],
        (variant) => update({ variant: variant as Door["variant"] }),
      );
      this.field(
        "Portalbreite in Feldern",
        "number",
        String(portal.width),
        (i) => update({ width: i.valueAsNumber }),
        ".1",
        undefined,
        ".25",
      );
      this.field(
        "Blockiert Licht",
        "checkbox",
        String(portal.blocksLight ?? true),
        (i) => update({ blocksLight: i.checked }),
      );
      this.field(
        "Um 180° drehen",
        "checkbox",
        String(portal.flip ?? false),
        (i) => update({ flip: i.checked }),
      );
      this.choice(
        "Himmelsrichtung",
        passage.direction ?? "",
        [
          ["", e?.kind === "door" ? "Nicht gesetzt" : "Automatisch aus Karte"],
          ["north", "Norden"],
          ["northeast", "Nordosten"],
          ["east", "Osten"],
          ["southeast", "Südosten"],
          ["south", "Süden"],
          ["southwest", "Südwesten"],
          ["west", "Westen"],
          ["northwest", "Nordwesten"],
        ],
        (direction) =>
          updatePassageDetails({
            direction: (direction || undefined) as CompassDirection | undefined,
          }),
      );
      this.field("Beschreibung", "text", passage.description, (i) =>
        updatePassageDetails({ description: i.value }),
      );
      this.choice(
        "Zustand",
        passage.state,
        [
          ["open", "Offen"],
          ["closed", "Geschlossen"],
          ["locked", "Verschlossen"],
        ],
        (state) =>
          updatePassageDetails({ state: state as PassageDetails["state"] }),
      );
      this.field("Versteckt", "checkbox", String(passage.hidden), (i) =>
        updatePassageDetails({
          hidden: i.checked,
          ...(!i.checked ? { hiddenDC: undefined } : {}),
        }),
      );
      this.field(
        "SG zum Entdecken",
        "number",
        passage.hiddenDC ? String(passage.hiddenDC) : "",
        (i) => updatePassageDetails({ hiddenDC: optionalInteger(i) }),
        "1",
        undefined,
        "1",
      );
      this.field(
        "HP",
        "number",
        passage.hp ? String(passage.hp) : "",
        (i) => updatePassageDetails({ hp: optionalInteger(i) }),
        "1",
        undefined,
        "1",
      );
      this.field(
        "RK",
        "number",
        passage.ac ? String(passage.ac) : "",
        (i) => updatePassageDetails({ ac: optionalInteger(i) }),
        "1",
        undefined,
        "1",
      );
      this.field("Schlüssel-Verweis", "text", passage.key ?? "", (i) =>
        updatePassageDetails({ key: i.value.trim() || undefined }),
      );
      if (tool === "door" && e?.kind !== "door") {
        this.field(
          "Freistehend",
          "checkbox",
          String(this.defaults.portal.freestanding),
          (i) => update({ freestanding: i.checked }),
        );
        if (this.defaults.portal.freestanding)
          this.field(
            "Drehung in Grad",
            "number",
            String(Math.round((this.defaults.portal.rotation * 180) / Math.PI)),
            (i) => update({ rotation: (i.valueAsNumber * Math.PI) / 180 }),
            undefined,
            undefined,
            "5",
          );
      }
    }
  }
  private renderSurfaceControls(tool: Tool, e: Entity | undefined,
    floorTool: boolean): void {
    if (
      tool === "cave" ||
      tool === "material" ||
      (tool === "water" && this.defaults.waterShape === "brush") ||
      tool === "terrain"
    ) {
      this.field(
        "Pinselradius in Feldern",
        "number",
        String(this.defaults.brushRadius),
        (i) => {
          const v = i.valueAsNumber;
          if (!Number.isFinite(v) || v <= 0)
            throw new Error("Pinselradius muss positiv sein.");
          this.defaults.brushRadius = v;
        },
        ".1",
        undefined,
        ".5",
      );
      const help = document.createElement("p");
      help.className = "dn-help";
      help.textContent = "Ziehen: malen · Alt + Ziehen: ausradieren";
      this.root.append(help);
    }
    if (tool === "water" && this.defaults.waterShape !== "brush") {
      const help = document.createElement("p");
      help.className = "dn-help";
      help.textContent =
        this.defaults.waterShape === "polygon"
          ? "Eckpunkte setzen · Enter beendet · Alt radiert die Form aus"
          : "Ziehen: Wasserfläche formen · Alt radiert die Form aus";
      this.root.append(help);
    }
    if (
      e?.kind === "surface" ||
      floorTool ||
      tool === "cave" ||
      tool === "material" ||
      tool === "pattern" ||
      tool === "water" ||
      tool === "terrain"
    ) {
      const category = floorTool
          ? "floor"
          : tool === "cave" ||
              tool === "pattern" ||
              tool === "water" ||
              tool === "terrain"
            ? tool
            : undefined,
        surfaceDefaults = category
          ? this.defaults.surfaces[category]
          : undefined;
      this.field(
        "Zeichenreihenfolge",
        "number",
        String(
          e?.kind === "surface"
            ? e.layer
            : (surfaceDefaults?.layer ?? this.defaults.layer),
        ),
        (i) => {
          const layer = i.valueAsNumber;
          if (!Number.isFinite(layer))
            throw new Error("Ungültige Zeichenreihenfolge.");
          this.defaults.layer = layer;
          if (category)
            this.defaults.surfaces[category] = {
              ...this.defaults.surfaces[category],
              layer,
            };
          if (e?.kind === "surface") this.change(e, { layer });
        },
        undefined,
        undefined,
        "100",
      );
    }
    if (tool === "pattern")
      this.choice(
        "Flächenform",
        this.defaults.surfaceShape,
        [
          ["rectangle", "Rechteck"],
          ["ellipse", "Ellipse"],
          ["polygon", "Polygon"],
        ],
        (value) =>
          (this.defaults.surfaceShape = value as ToolSettings["surfaceShape"]),
      );
    if (tool === "water")
      this.choice(
        "Zeichenform",
        this.defaults.waterShape,
        [
          ["brush", "Pinsel"],
          ["rectangle", "Rechteck"],
          ["ellipse", "Ellipse"],
          ["polygon", "Polygon"],
        ],
        (value) =>
          (this.defaults.waterShape = value as ToolSettings["waterShape"]),
      );
  }
  private renderSurfaceAndPathControls(tool: Tool, e: Entity | undefined, floorTool: boolean, selected: string | undefined, floorId: string): void {
    if (
      e?.kind === "surface" ||
      floorTool ||
      tool === "cave" ||
      tool === "pattern" ||
      tool === "water" ||
      tool === "terrain"
    ) {
      const category =
          e?.kind === "building"
            ? "floor"
            : e?.kind === "surface"
            ? e.category
            : floorTool
              ? "floor"
              : tool === "cave" ||
                  tool === "pattern" ||
                  tool === "water" ||
                  tool === "terrain"
                ? tool
                : "pattern",
        defaults =
          category === "floor" ||
          category === "cave" ||
          category === "pattern" ||
          category === "water" ||
          category === "terrain"
            ? this.defaults.surfaces[category]
            : undefined,
        surface =
          e?.kind === "building"
            ? {
                layer: e.layer,
                color: e.fill,
                wallColor: e.wall,
                wallWidth: e.wallWidth,
              }
            : e?.kind === "surface"
              ? e
              : defaults;
      if (surface) {
        const update = (patch: Partial<Surface>) => {
          if (
            category === "floor" ||
            category === "cave" ||
            category === "pattern" ||
            category === "water" ||
            category === "terrain"
          )
            this.defaults.surfaces[category] = {
              ...this.defaults.surfaces[category],
              ...patch,
            };
          if (e?.kind === "building")
            this.change(e, {
              ...(patch.layer === undefined ? {} : { layer: patch.layer }),
              ...(patch.color === undefined ? {} : { fill: patch.color }),
              ...(patch.wallColor === undefined
                ? {}
                : { wall: patch.wallColor }),
              ...(patch.wallWidth === undefined
                ? {}
                : { wallWidth: patch.wallWidth }),
            });
          else if (e?.kind === "surface") this.change(e, patch);
        };
        this.field(
          category === "cave"
            ? "Höhlenbodenfarbe"
            : category === "water"
              ? "Tiefe Wasserfarbe"
              : "Flächenfarbe",
          "color",
          "#" + surface.color.toString(16).padStart(6, "0"),
          (i) => update({ color: parseInt(i.value.slice(1), 16) }),
        );
        this.field(
          category === "pattern" ? "Alpha (0–255)" : "Deckkraft",
          category === "pattern" ? "number" : "range",
          String(category === "pattern"
            ? alphaByteFromOpacity(surface.opacity ?? 1)
            : surface.opacity ?? 1),
          (i) => update({
            opacity: category === "pattern"
              ? opacityFromAlphaByte(i.valueAsNumber)
              : i.valueAsNumber,
          }),
          category === "pattern" ? "0" : "0.1",
          category === "pattern" ? "255" : "1",
          category === "pattern" ? "1" : ".05",
        );
        if (category === "pattern")
          mountPatternColorPicker(this.root, {
            initial: { color: surface.color, opacity: surface.opacity ?? 1 },
            onAccept: ({ color, opacity }) => {
              if (color === surface.color && opacity === (surface.opacity ?? 1))
                return;
              const before = JSON.stringify(this.defaults);
              update({ color, opacity });
              if (before !== JSON.stringify(this.defaults)) this.defaultsChanged();
              this.render(tool, selected, floorId);
            },
          });
        this.field(
          category === "water" ? "Uferbreite" : "Konturbreite",
          "number",
          String(surface.wallWidth),
          (i) => update({ wallWidth: i.valueAsNumber }),
          "0",
          undefined,
          ".05",
        );
        this.field(
          category === "water"
            ? "Flache Wasserfarbe"
            : category === "cave" || category === "floor"
              ? "Wandfarbe"
              : "Konturfarbe",
          "color",
          "#" + surface.wallColor.toString(16).padStart(6, "0"),
          (i) => update({ wallColor: parseInt(i.value.slice(1), 16) }),
        );
        if (category === "cave") {
          const caveColor = document.createElement("button");
          caveColor.type = "button";
          caveColor.textContent = "Höhlenwandfarbe RGBA";
          caveColor.style.borderColor = "#" + surface.wallColor.toString(16).padStart(6, "0");
          caveColor.addEventListener("click", () => {
            this.buildingPicker?.close();
            this.buildingPicker = mountBuildingColorPicker(this.root,
              surface.wallColor, surface.wallAlpha ?? 255,
              "Höhlenwandfarbe", {
                onCommit: (wallColor, wallAlpha) => {
                  this.defaults.surfaces.cave = {
                    ...this.defaults.surfaces.cave, wallColor, wallAlpha };
                  const entities = [...this.session.entities.values()]
                    .filter((item): item is Surface =>
                      item.kind === "surface" && item.category === "cave" &&
                      item.floorId === floorId &&
                      (item.wallColor !== wallColor ||
                        (item.wallAlpha ?? 255) !== wallAlpha))
                    .map((item) => ({ id: item.id, before: item,
                      after: { ...item, wallColor, wallAlpha } }));
                  if (entities.length) this.session.execute({
                    label: "Höhlenwandfarbe ändern", entities,
                  });
                  this.defaultsChanged();
                  this.render(tool, selected, floorId);
                },
                sampleMapColor: this.sampleMapColor,
                onClose: () => { this.buildingPicker = undefined; },
              });
          });
          this.root.append(caveColor);
        }
        if (category === "water")
          this.choice(
            "Wassereffekt",
            surface.effect ?? "none",
            [
              ["none", "Ruhig"],
              ["ripples", "Wellen"],
            ],
            (value) => update({ effect: value as Surface["effect"] }),
          );
      }
    }
    if (e?.kind === "path" || tool === "path") {
      const path = e?.kind === "path" ? e : this.defaults.path;
      const pathAssetId = e?.kind === "path"
        ? e.material?.assetId : this.defaults.material?.assetId;
      const pathTexture = this.assets().find((asset) => asset.id === pathAssetId)
        ?.pathTexturePixels;
      const nativeWidthUnit = pathTexture
        ? nativePathDimensions(pathTexture, 1).width : undefined;
      const update = (patch: Partial<MapPath>) => {
        this.defaults.path = { ...this.defaults.path, ...patch };
        if (e?.kind === "path") this.change(e, patch);
      };
      this.choice(
        "Pfadart",
        path.style,
        [
          ["road", "Weg"],
          ["rope", "Seil"],
          ["rail", "Schienen"],
          ["stones", "Trittsteine"],
          ["hedge", "Hecke"],
        ],
        (value) => update({ style: value as MapPath["style"] }),
      );
      this.field("Kurviger Pfad", "checkbox", String(path.smooth), (i) =>
        update({ smooth: i.checked }),
      );
      this.field("Geschlossener Pfad", "checkbox", String(path.closed), (i) =>
        update({ closed: i.checked }),
      );
      this.field(
        nativeWidthUnit ? "Pfadbreite (Originalfaktor)" : "Pfadbreite in Feldern",
        "number",
        String(nativeWidthUnit ? path.width / nativeWidthUnit : path.width),
        (i) => {
          if (!nativeWidthUnit || !pathTexture) {
            update({ width: i.valueAsNumber });
            return;
          }
          const currentMaterial = e?.kind === "path"
            ? e.material : this.defaults.material;
          if (!currentMaterial) throw new Error("Pfadmaterial fehlt.");
          const dimensions = nativePathDimensions(pathTexture, i.valueAsNumber);
          const nextMaterial = {
            ...currentMaterial,
            tileSize: dimensions.repeatLength,
          };
          this.defaults.material = nextMaterial;
          update({ width: dimensions.width,
            material: nextMaterial });
        },
        ".1",
        undefined,
        ".1",
      );
      this.field(
        "Pfadfarbe",
        "color",
        "#" + path.color.toString(16).padStart(6, "0"),
        (i) => update({ color: parseInt(i.value.slice(1), 16) }),
      );
      this.field(
        "Konturfarbe",
        "color",
        "#" + path.outlineColor.toString(16).padStart(6, "0"),
        (i) => update({ outlineColor: parseInt(i.value.slice(1), 16) }),
      );
      this.field(
        "Konturbreite",
        "number",
        String(path.outlineWidth),
        (i) => update({ outlineWidth: i.valueAsNumber }),
        "0",
        undefined,
        ".05",
      );
      this.choice(
        "Pfadanfang",
        path.start,
        [
          ["round", "Rund"],
          ["square", "Gerade"],
          ["hidden", "Ausblenden"],
        ],
        (value) => update({ start: value as MapPath["start"] }),
      );
      this.choice(
        "Pfadende",
        path.end,
        [
          ["round", "Rund"],
          ["square", "Gerade"],
          ["taper", "Verjüngt"],
          ["hidden", "Ausblenden"],
        ],
        (value) => update({ end: value as MapPath["end"] }),
      );
      this.field("Blockiert Licht", "checkbox", String(path.blocksLight), (i) =>
        update({ blocksLight: i.checked }),
      );
    }
  }
  private renderRoofControls(tool: Tool, e: Entity | undefined): void {
    if (e?.kind === "roof" || tool === "roof") {
      const roof = e?.kind === "roof" ? e : this.defaults.roof;
      const update = (patch: Partial<Roof>) => {
        this.defaults.roof = { ...this.defaults.roof, ...patch };
        if (e?.kind === "roof") this.change(e, patch);
      };
      if (tool === "roof")
        this.choice(
          "Zeichenmodus",
          this.defaults.roofShape,
          [
            ["rectangle", "Schnellrechteck"],
            ["polygon", "Freie Kontur"],
          ],
          (value) =>
            (this.defaults.roofShape = value as ToolSettings["roofShape"]),
        );
      this.choice(
        "Dachform",
        roof.roofType,
        [
          ["gable", "Satteldach"],
          ["hip", "Walmdach"],
          ["dormer", "Gaube"],
          ["flat", "Flachdach"],
        ],
        (value) => {
          const roofType = value as Roof["roofType"];
          if (e?.kind === "roof" && roofType !== "flat" && !e.ridge.length) {
            const xs = e.points.map((point) => point.x),
              ys = e.points.map((point) => point.y),
              minX = Math.min(...xs),
              maxX = Math.max(...xs),
              minY = Math.min(...ys),
              maxY = Math.max(...ys),
              horizontal = maxX - minX >= maxY - minY;
            update({
              roofType,
              ridge: horizontal
                ? [
                    { x: minX + (maxX - minX) * 0.2, y: (minY + maxY) / 2 },
                    { x: maxX - (maxX - minX) * 0.2, y: (minY + maxY) / 2 },
                  ]
                : [
                    { x: (minX + maxX) / 2, y: minY + (maxY - minY) * 0.2 },
                    { x: (minX + maxX) / 2, y: maxY - (maxY - minY) * 0.2 },
                  ],
            });
          } else update({ roofType });
        },
      );
      this.field(
        "Dachfarbe",
        "color",
        "#" + roof.color.toString(16).padStart(6, "0"),
        (i) => update({ color: parseInt(i.value.slice(1), 16) }),
      );
    }
  }
  private renderMaterialControls(tool: Tool, e: Entity | undefined, selected: string | undefined, floorId: string): void {
    if (
      e?.kind === "building" ||
      e?.kind === "surface" ||
      e?.kind === "path" ||
      e?.kind === "roof" ||
      tool === "room" ||
      tool === "polygon" ||
      tool === "ellipse" ||
      tool === "material" ||
      tool === "pattern" ||
      tool === "path" ||
      tool === "roof" ||
      tool === "water" ||
      tool === "terrain"
    ) {
      let material =
        e?.kind === "building" ||
        e?.kind === "surface" ||
        e?.kind === "path" ||
        e?.kind === "roof"
          ? e.material
          : this.defaults.material;
      const materialKinds: AssetKind[] =
          e?.kind === "roof" || tool === "roof"
            ? ["roof"]
            : e?.kind === "path" || tool === "path"
              ? ["path"]
              : e?.kind === "building" ||
                  tool === "room" ||
                  tool === "polygon" ||
                  tool === "ellipse" ||
                  tool === "corridor"
                ? ["tileset", "material"]
                : e?.kind === "surface"
                  ? e.category === "cave"
                    ? ["cave"]
                    : e.category === "pattern"
                        ? ["pattern"]
                        : e.category === "terrain"
                          ? ["terrain"]
                          : ["material"]
                  : tool === "pattern"
                    ? ["pattern"]
                    : tool === "terrain"
                      ? ["terrain"]
                      : ["material", "tileset"],
        packageMaterials = this.assets().filter((asset) =>
          materialKinds.includes(asset.kind),
        ),
        materialAssetId = material?.assetId;
      if (
        !e &&
        materialAssetId &&
        !packageMaterials.some((asset) => asset.id === materialAssetId)
      )
        material = this.defaults.material = undefined;
      const choosePackageMaterial = (value: string) => {
        const asset = packageMaterials.find(
            (candidate) => candidate.id === value,
          ),
          nativePath = asset?.kind === "path" ? asset.pathTexturePixels : undefined,
          previousPath = material?.assetId
            ? packageMaterials.find((candidate) => candidate.id === material.assetId)
              ?.pathTexturePixels
            : undefined,
          currentPathWidth = e?.kind === "path" ? e.width : this.defaults.path.width,
          widthFactor = previousPath
            ? nativePathWidthFactor(currentPathWidth, previousPath) : 1,
          nativeDimensions = nativePath
            ? nativePathDimensions(nativePath, widthFactor) : undefined,
          pathWidth = nativeDimensions?.width,
          next: Material | undefined = asset
            ? {
                assetId: asset.id,
                assetPart:
                  asset.kind === "roof"
                    ? "tiles"
                    : asset.kind === "cave"
                      ? "floor"
                      : asset.kind === "material"
                        ? "tile"
                        : "image",
                tileSize: nativeDimensions?.repeatLength ?? material?.tileSize ?? 4,
                tint: material?.tint ?? 0xffffff,
                rotation: material?.rotation ?? 0,
              }
            : undefined;
        if (e?.kind === "path")
          this.change(e, { material: next, ...(pathWidth && { width: pathWidth }) });
        else if (e?.kind === "building" || e?.kind === "surface" ||
          e?.kind === "roof")
          this.change(e, { material: next });
        if (pathWidth && !e)
          this.defaults.path = { ...this.defaults.path, width: pathWidth };
        this.defaults.material = next;
        if (!e) this.render(tool, selected, floorId);
      };
      if (packageMaterials.length)
        this.choice(
          "Paketmaterial",
          material?.assetId ?? "",
          [
            ["", "Grunddarstellung"],
            ...packageMaterials.map(
              (asset) => [asset.id, asset.name] as [string, string],
            ),
          ],
          choosePackageMaterial,
          true,
        );
      if (e?.kind === "path" || (!e && tool === "path"))
        mountPathLibraryView(this.root, {
          tiles: packageMaterials.map((asset) => ({
            id: asset.id,
            name: asset.name,
            previewUrl: this.assetUrl(asset.id + "\0image"),
          })),
          searchState: this.pathLibrarySearch,
          selectedId: material?.assetId,
          matches: (tile, query) =>
            tile.name
              .toLocaleLowerCase("de")
              .includes(query.trim().toLocaleLowerCase("de")),
          onSearchStateChange: (state) => {
            this.pathLibrarySearch = state;
          },
          onSelect: (id) => {
            if (id === material?.assetId) return;
            try {
              const before = JSON.stringify(this.defaults);
              choosePackageMaterial(id);
              if (before !== JSON.stringify(this.defaults))
                this.defaultsChanged();
            } catch (error) {
              this.notice(String(error));
            }
          },
        });
      this.field(
        "Materialbild im Vault",
        "text",
        material?.asset ?? "",
        (i) => {
          const value = i.value.trim();
          const next = value
            ? {
                asset: value,
                tileSize: material?.tileSize ?? 4,
                tint: material?.tint ?? 0xffffff,
                rotation: material?.rotation ?? 0,
              }
            : undefined;
          if (
            e?.kind === "building" ||
            e?.kind === "surface" ||
            e?.kind === "path" ||
            e?.kind === "roof"
          )
            this.change(e, { material: next });
          this.defaults.material = next;
        },
      );
      if (material) {
        this.field(
          "Materialgröße in Feldern",
          "number",
          String(material.tileSize),
          (i) => {
            const next = { ...material, tileSize: i.valueAsNumber };
            if (
              e?.kind === "building" ||
              e?.kind === "surface" ||
              e?.kind === "path" ||
              e?.kind === "roof"
            )
              this.change(e, { material: next });
            this.defaults.material = next;
          },
          ".1",
          undefined,
          ".5",
        );
        this.field(
          "Materialfarbe",
          "color",
          "#" + material.tint.toString(16).padStart(6, "0"),
          (i) => {
            const next = {
              ...material,
              tint: parseInt(i.value.slice(1), 16),
            };
            if (
              e?.kind === "building" ||
              e?.kind === "surface" ||
              e?.kind === "path" ||
              e?.kind === "roof"
            )
              this.change(e, { material: next });
            this.defaults.material = next;
          },
        );
        this.field(
          "Materialdrehung in Grad",
          "number",
          String(Math.round((material.rotation * 180) / Math.PI)),
          (i) => {
            const next = {
              ...material,
              rotation: (i.valueAsNumber * Math.PI) / 180,
            };
            if (
              e?.kind === "building" ||
              e?.kind === "surface" ||
              e?.kind === "path" ||
              e?.kind === "roof"
            )
              this.change(e, { material: next });
            this.defaults.material = next;
          },
          undefined,
          undefined,
          "15",
        );
      }
    }
  }
  private renderLightControls(tool: Tool, e: Entity | undefined): void {
    if (e?.kind === "light" || tool === "light") {
      const light = e?.kind === "light" ? e : this.defaults.light;
      const update = (patch: Partial<Light>) => {
        if (e?.kind === "light") this.change(e, patch);
        else this.defaults.light = { ...this.defaults.light, ...patch };
      };
      const packageLights = this.assets().filter(
        (asset) => asset.kind === "light",
      );
      if (packageLights.length)
        this.choice(
          "Paketlicht",
          light.assetId ?? "",
          [
            ["", "Weiches Grundlicht"],
            ...packageLights.map(
              (asset) => [asset.id, asset.name] as [string, string],
            ),
          ],
          (assetId) => update({ assetId: assetId || undefined }),
          true,
        );
      this.field(
        "Lichtreichweite in Feldern",
        "number",
        String(light.radius),
        (i) => update({ radius: i.valueAsNumber }),
        ".1",
        undefined,
        ".5",
      );
      this.field(
        "Lichtstärke",
        "number",
        String(light.intensity),
        (i) => update({ intensity: i.valueAsNumber }),
        "0",
        "4",
        ".1",
      );
      const lightColorInput = this.field(
        "Lichtfarbe",
        "color",
        "#" + light.color.toString(16).padStart(6, "0"),
        (i) => update({ color: parseInt(i.value.slice(1), 16) }),
      );
      if (tool === "light" && !e)
        mountLightColorPalette(this.root, (color) => {
          if (this.defaults.light.color === color) return;
          update({ color });
          lightColorInput.value = "#" + color.toString(16).padStart(6, "0");
          this.defaultsChanged();
        });
      this.field("Schatten", "checkbox", String(light.shadows), (i) =>
        update({ shadows: i.checked }),
      );
    }
  }
  private renderReferenceControls(e: Entity | undefined): void {
    if (e?.kind === "reference") {
      const image = e;
      const update = (patch: Partial<ReferenceImage>) =>
        this.change(image, patch);
      this.field("Vorlagenname", "text", image.name, (i) =>
        update({ name: i.value }),
      );
      this.field("Sichtbar", "checkbox", String(image.visible), (i) =>
        update({ visible: i.checked }),
      );
      this.field(
        "Vorlagendeckkraft",
        "range",
        String(image.opacity),
        (i) => update({ opacity: i.valueAsNumber }),
        "0",
        "1",
        ".05",
      );
      this.field("Vorlage X", "number", String(image.x), (i) =>
        update({ x: i.valueAsNumber }),
      );
      this.field("Vorlage Y", "number", String(image.y), (i) =>
        update({ y: i.valueAsNumber }),
      );
      this.field(
        "Vorlagenbreite in Feldern",
        "number",
        String(image.width),
        (i) => update({ width: i.valueAsNumber }),
        ".1",
      );
      this.field(
        "Vorlagenhöhe in Feldern",
        "number",
        String(image.height),
        (i) => update({ height: i.valueAsNumber }),
        ".1",
      );
      this.field(
        "Vorlagendrehung in Grad",
        "number",
        String(Math.round((image.rotation * 180) / Math.PI)),
        (i) => update({ rotation: (i.valueAsNumber * Math.PI) / 180 }),
        undefined,
        undefined,
        "1",
      );
    }
  }
  private renderNativeObjectControls(): void {
    const object = this.defaults.object;
    const update = (patch: Partial<MapObject>) => {
      this.defaults.object = { ...this.defaults.object, ...patch };
    };
    this.choice("Layer", String(object.layer ?? 100), [
      ["-400", "-400: Below Ground"], ["-100", "-100: Below Water"],
      ["100", "100: User Layer 1"], ["200", "200: User Layer 2"],
      ["300", "300: User Layer 3"], ["400", "400: User Layer 4"],
      ["700", "700: Above Walls"], ["900", "900: Above Roofs"],
    ], (value) => update({ layer: Number(value) }));
    const sorting = document.createElement("div");
    sorting.className = "dn-object-sorting";
    sorting.setAttribute("role", "group");
    sorting.setAttribute("aria-label", "Sorting");
    for (const [value, label] of [["over", "↑ Over"], ["under", "↓ Under"]] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("aria-pressed", String(this.defaults.objectSorting === value));
      button.addEventListener("click", () => {
        this.defaults.objectSorting = value;
        for (const child of sorting.querySelectorAll("button"))
          child.setAttribute("aria-pressed", String(child === button));
        this.defaultsChanged();
      });
      sorting.append(button);
    }
    this.root.append(sorting);
    const rotation = this.field("Rotation", "number",
      String(Math.round(object.rotation * 180 / Math.PI)),
      (input) => update({ rotation: input.valueAsNumber * Math.PI / 180 }),
      "-360", "360", "1");
    const rotationSlider = this.field("Rotation-Regler", "range",
      rotation.value, (input) => {
        rotation.value = input.value;
        update({ rotation: input.valueAsNumber * Math.PI / 180 });
      }, "-180", "180", "1");
    rotation.addEventListener("change", () => { rotationSlider.value = rotation.value; });
    const setScale = (value: number) => {
      if (!Number.isFinite(value) || value <= 0) return;
      const prior = this.defaults.objectScale || 1;
      const size = this.assets().find((asset) => asset.id === object.assetId)
        ?.objectSizeFields;
      this.defaults.objectScale = value;
      update({ width: (size?.width ?? this.defaults.object.width / prior) * value,
        height: (size?.height ?? this.defaults.object.height / prior) * value });
    };
    const scale = this.field("Scale", "number", String(this.defaults.objectScale),
      (input) => setScale(input.valueAsNumber), "0.01", "100", "0.01");
    const scaleSlider = this.field("Scale-Regler", "range", scale.value,
      (input) => { scale.value = input.value; setScale(input.valueAsNumber); },
      "0.01", "5", "0.01");
    scale.addEventListener("change", () => { scaleSlider.value = scale.value; });
    this.field("Shadow", "checkbox", String(object.shadow ?? true),
      (input) => update({ shadow: input.checked }));
    this.field("Block Light", "checkbox", String(object.blocksLight ?? false),
      (input) => update({ blocksLight: input.checked }));
    const colorLabel = document.createElement("div");
    colorLabel.textContent = "Custom Color";
    this.root.append(colorLabel);
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.setAttribute("aria-label", "Objektfarbe RGBA öffnen");
    swatch.style.cssText = "width:100%;height:32px;border:2px solid var(--background-modifier-border);";
    const syncSwatch = () => {
      const current = this.defaults.object;
      swatch.style.backgroundColor = `rgba(${(current.color >> 16) & 255},${(current.color >> 8) & 255},${current.color & 255},${(current.alpha ?? 255) / 255})`;
    };
    const openPicker = () => {
      if (this.objectPicker) return;
      this.objectPicker = mountObjectColorPicker(this.root,
        this.defaults.object.color, this.defaults.object.alpha ?? 255, {
          onPreview: (color, alpha) => {
            update({ color, alpha });
            syncSwatch();
            this.previewObjectLibraryColor(color, alpha);
            this.previewToolObject();
          },
          onCommit: (color, alpha) => {
            update({ color, alpha });
            this.defaultsChanged();
          },
          sampleMapColor: this.sampleMapColor,
          onClose: () => { this.objectPicker = undefined; },
        });
    };
    swatch.addEventListener("click", openPicker);
    syncSwatch();
    this.root.append(swatch);
    const palette = document.createElement("div");
    palette.className = "dn-object-palette";
    palette.style.cssText = "display:grid;grid-template-columns:repeat(6,1fr);gap:4px;";
    for (const color of NATIVE_OBJECT_PALETTE) {
      const button = document.createElement("button");
      button.type = "button";
      button.title = "#" + color.toString(16).padStart(6, "0");
      button.setAttribute("aria-label", "Objektfarbe " + button.title);
      button.style.cssText = `height:24px;border-radius:50%;background:#${color.toString(16).padStart(6, "0")};`;
      button.addEventListener("click", () => {
        update({ color, alpha: 255 });
        syncSwatch();
        this.previewObjectLibraryColor(color, 255);
        this.defaultsChanged();
      });
      palette.append(button);
    }
    this.root.append(palette);
  }

  private renderObjectControls(tool: Tool, e: Entity | undefined): void {
    if (tool === "object") {
      this.renderNativeObjectControls();
      return;
    }
    if (e?.kind === "object" || tool === "scatter") {
      const selectedObject = tool === "select" && e?.kind === "object" ? e : undefined;
      let object = selectedObject ?? this.defaults.object;
      const update = (patch: Partial<MapObject>) => {
        if (selectedObject) this.change(selectedObject, patch);
        else {
          this.defaults.object = { ...this.defaults.object, ...patch };
          if (patch.assetId === undefined &&
              (patch.color !== undefined || patch.alpha !== undefined))
            this.previewObjectLibraryColor(
              this.defaults.object.color,
              this.defaults.object.alpha ?? 255,
            );
        }
      };
      const packageObjects = this.assets().filter(
        (asset) => asset.kind === "object",
      );
      if (
        !selectedObject &&
        object.assetId &&
        !packageObjects.some((asset) => asset.id === object.assetId)
      )
        object = this.defaults.object = {
          ...this.defaults.object,
          assetId: undefined,
        };
      const libraryTile = selectedObject && packageObjects.length
        ? this.choice(
            "Paketobjekt",
            object.assetId ?? "",
            [
              ["", "Grundform"],
              ...packageObjects.map(
                (asset) => [asset.id, asset.name] as [string, string],
              ),
            ],
            (assetId) => {
              this.objectPicker?.close("escape");
              this.objectLibraryPreview?.dispose();
              this.objectLibraryPreview = undefined;
              update({
                assetId: assetId || undefined,
                color: assetId ? 0xffffff : object.color,
              });
            },
            true,
            (image, assetId) => {
              const current = selectedObject
                ? this.session.entities.get(selectedObject.id)
                : undefined;
              this.bindObjectLibraryPreview(
                image,
                assetId,
                current?.kind === "object" ? current.color : this.defaults.object.color,
                current?.kind === "object"
                  ? current.alpha ?? 255 : this.defaults.object.alpha ?? 255,
              );
            },
          )
        : undefined;
      if (!selectedObject)
        this.choice(
          "Möbelset",
          this.defaults.objectPreset,
          [
            ["furniture", "Möbel"],
            ["chest", "Truhe"],
            ["pillar", "Säule"],
            ["marker", "Marker"],
          ],
          (value) => {
            const preset = value as ToolSettings["objectPreset"],
              styles = {
                furniture: { width: 1.6, height: 0.9, color: 0x795438 },
                chest: { width: 1.1, height: 0.7, color: 0x8f622f },
                pillar: { width: 0.8, height: 0.8, color: 0x8d8980 },
                marker: { width: 1, height: 1, color: 0xb84343 },
              };
            this.defaults.objectPreset = preset;
            this.defaults.object = {
              ...this.defaults.object,
              ...styles[preset],
            };
          },
        );
      this.field(
        "Drehung in Grad",
        "number",
        String(Math.round((object.rotation * 180) / Math.PI)),
        (i) => update({ rotation: (i.valueAsNumber * Math.PI) / 180 }),
        undefined,
        undefined,
        "15",
      );
      this.field(
        "Zeichenreihenfolge",
        "number",
        String(object.layer ?? 500),
        (i) => update({ layer: i.valueAsNumber }),
        undefined,
        undefined,
        "100",
      );
      this.field(
        "Breite in Feldern",
        "number",
        String(object.width),
        (i) => update({ width: i.valueAsNumber }),
        ".1",
        undefined,
        ".1",
      );
      this.field(
        "Höhe in Feldern",
        "number",
        String(object.height),
        (i) => update({ height: i.valueAsNumber }),
        ".1",
        undefined,
        ".1",
      );
      this.field(
        "Objektfarbe",
        "color",
        "#" + object.color.toString(16).padStart(6, "0"),
        (i) => update({ color: parseInt(i.value.slice(1), 16) }),
      );
      const pickerButton = document.createElement("button");
      pickerButton.type = "button";
      pickerButton.textContent = "RGBA-Farbe wählen";
      pickerButton.setAttribute("aria-label", "Objektfarbe RGBA öffnen");
      pickerButton.addEventListener("click", () => {
        const selectedId = selectedObject?.id;
        const selectedEntity = selectedId
          ? this.session.entities.get(selectedId) : undefined;
        const currentColor = selectedEntity?.kind === "object"
          ? selectedEntity : this.defaults.object;
        if (!selectedId && libraryTile)
          this.previewObjectLibraryColor(
            currentColor.color,
            currentColor.alpha ?? 255,
          );
        pickerButton.disabled = true;
        const hooks: ObjectColorPickerHooks = {
            onPreview: (color, alpha) => {
              if (selectedId) this.previewObjectColor(selectedId, color, alpha);
              else this.previewObjectLibraryColor(color, alpha);
            },
            onCommit: (color, alpha) => {
              if (selectedObject) this.change(selectedObject, { color, alpha });
              else {
                this.defaults.object = { ...this.defaults.object, color, alpha };
                this.defaultsChanged();
              }
            },
            onClose: () => {
              if (selectedId) this.clearObjectColorPreview(selectedId);
              this.objectPicker = undefined;
              pickerButton.disabled = false;
            },
          };
        this.objectPicker = tool === "scatter" && !selectedId
          ? mountScatterColorPicker(
              this.root, pickerButton, currentColor.color,
              currentColor.alpha ?? 255, hooks,
            )
          : mountObjectColorPicker(
              this.root, currentColor.color, currentColor.alpha ?? 255, hooks,
            );
      });
      this.root.append(pickerButton);
      this.field(
        "Objektfarbe Alpha (0–255)",
        "number",
        String(object.alpha ?? 255),
        (i) => {
          const alpha = i.valueAsNumber;
          if (!Number.isInteger(alpha) || alpha < 0 || alpha > 255)
            throw new Error("Objektfarbe Alpha muss zwischen 0 und 255 liegen.");
          update({ alpha });
        },
        "0",
        "255",
        "1",
      );
      this.field("Schatten", "checkbox", String(object.shadow ?? true), (i) =>
        update({ shadow: i.checked }),
      );
      this.field(
        "Blockiert Licht",
        "checkbox",
        String(object.blocksLight ?? false),
        (i) => update({ blocksLight: i.checked }),
      );
      this.field(
        "Horizontal spiegeln",
        "checkbox",
        String(object.flip ?? false),
        (i) => update({ flip: i.checked }),
      );
    }
  }

  private renderScatterAndFloorProperties(tool: Tool, floorId: string): void {
    if (tool === "scatter") {
      this.field(
        "Streuabstand in Feldern",
        "number",
        String(this.defaults.scatter.spacing),
        (i) => (this.defaults.scatter.spacing = i.valueAsNumber),
        ".1",
        undefined,
        ".1",
      );
      this.field(
        "Streuradius in Feldern",
        "number",
        String(this.defaults.scatter.spread),
        (i) => (this.defaults.scatter.spread = i.valueAsNumber),
        "0",
        undefined,
        ".1",
      );
      this.field(
        "Größenabweichung",
        "range",
        String(this.defaults.scatter.scaleJitter),
        (i) => (this.defaults.scatter.scaleJitter = i.valueAsNumber),
        "0",
        ".8",
        ".05",
      );
      this.field(
        "Zufallsdrehung",
        "checkbox",
        String(this.defaults.scatter.rotationJitter > 0),
        (i) => (this.defaults.scatter.rotationJitter = i.checked ? Math.PI : 0),
      );
    }
    const f = this.session.floors.get(floorId);
    if (!f) return;
    const heading = document.createElement("h4");
    heading.textContent = "Geschoss";
    this.root.append(heading);
    this.field("Geschossname", "text", f.name, (i) => {
      const current = this.session.floors.get(f.id)!;
      this.session.execute({
        label: "Geschoss umbenennen",
        floors: [
          { id: f.id, before: current, after: { ...current, name: i.value } },
        ],
      });
    });
    this.field(
      "Höhe",
      "number",
      String(f.elevation),
      (i) => {
        const current = this.session.floors.get(f.id)!;
        this.session.execute({
          label: "Geschosshöhe ändern",
          floors: [
            {
              id: f.id,
              before: current,
              after: { ...current, elevation: i.valueAsNumber },
            },
          ],
        });
      },
      undefined,
      undefined,
      "1",
    );
    this.field(
      "Umgebungslicht",
      "range",
      String(f.ambient ?? 1),
      (i) => {
        const current = this.session.floors.get(f.id)!;
        this.session.execute({
          label: "Umgebungslicht ändern",
          floors: [
            {
              id: f.id,
              before: current,
              after: { ...current, ambient: i.valueAsNumber },
            },
          ],
        });
      },
      "0",
      "1",
      ".05",
    );
  }
  render(tool: Tool, selected: string | undefined, floorId: string): void {
    const buildingPicker = this.buildingPicker;
    this.buildingPicker = undefined;
    buildingPicker?.close();
    const activePicker = this.objectPicker;
    this.objectPicker = undefined;
    activePicker?.close("escape");
    this.objectLibraryPreview?.dispose();
    this.objectLibraryPreview = undefined;
    this.root.replaceChildren();
    const e = selected ? this.session.entities.get(selected) : undefined;
    if (tool === "edit-points") {
      const help = document.createElement("p");
      help.className = "dn-help";
      help.textContent = "Gebäude wählen · Eckpunkt oder Kantenmitte ziehen · Delete/Rücktaste entfernt Punkt oder Dreipunktumriss";
      this.root.append(help);
    }
    const floorTool =
      tool === "room" ||
      tool === "polygon" ||
      tool === "ellipse" ||
      tool === "corridor";
    this.renderFloorControls(tool, e, floorTool, selected, floorId);
    this.renderBuildingStyleControls(tool, selected, floorId,
      floorTool || tool === "edit-points");
    this.renderPortalControls(tool, e);
    this.renderSurfaceControls(tool, e, floorTool);
    this.renderSurfaceAndPathControls(tool, e, floorTool, selected, floorId);
    this.renderRoofControls(tool, e);
    this.renderMaterialControls(tool, e, selected, floorId);
    this.renderLightControls(tool, e);
    this.renderReferenceControls(e);
    this.renderObjectControls(tool, e);
    this.renderScatterAndFloorProperties(tool, floorId);
  }
}
