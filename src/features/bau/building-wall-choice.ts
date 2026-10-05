import type { Building, Material } from "../../model";

export type BuildingWallChoice =
  | { readonly kind: "basic" }
  | { readonly kind: "asset"; readonly assetId: string }
  | { readonly kind: "none" };

export type BuildingDrawStyle = Pick<
  Building,
  "layer" | "fill" | "wall" | "wallWidth" | "wallAssetId" | "material"
>;

export interface BuildingFloorDefaults {
  readonly layer: number;
  readonly color: number;
  readonly wallColor: number;
  readonly wallWidth: number;
}

/** Resolve the wall gallery choice before composing a new Building. */
export function buildingDrawStyle(
  defaults: BuildingFloorDefaults,
  material: Material | undefined,
  choice: BuildingWallChoice,
): BuildingDrawStyle {
  if (choice.kind === "asset" && !choice.assetId.trim())
    throw new Error("Eine Paketwand braucht eine Assetkennung.");
  return {
    layer: defaults.layer,
    fill: defaults.color,
    wall: defaults.wallColor,
    wallWidth: choice.kind === "none" ? 0 : defaults.wallWidth,
    ...(choice.kind === "asset" ? { wallAssetId: choice.assetId } : {}),
    ...(material ? { material } : {}),
  };
}

/** None keeps the floor polygon but asks the renderer to omit its wall ring. */
export function buildingHasWall(
  style: Pick<Building, "wallWidth" | "wallAssetId">,
): boolean {
  return style.wallWidth > 0;
}

/** Keep differently selected walls and tints out of the same compose batch. */
export function buildingStyleKey(style: BuildingDrawStyle): string {
  const material = style.material;
  return JSON.stringify([
    style.layer,
    style.fill,
    style.wall,
    style.wallWidth,
    style.wallAssetId ?? null,
    material
      ? [
          material.asset ?? null,
          material.assetId ?? null,
          material.assetPart ?? null,
          material.tileSize,
          material.tint,
          material.rotation,
        ]
      : null,
  ]);
}
