import type { Point } from "./contracts";
import type { AtlasRenderView } from "./campaign-atlas-contracts";
import {
  atlasFrame,
  localToAtlas,
  atlasHexPoint,
} from "./campaign-atlas-model";
export function atlasPartyPoint(a: AtlasRenderView): Point | null {
  const p = a.geometry.position;
  if (p) {
    const b = a.bindings.find(
      (b) => b.kind === "dungeon" && b.ownerId === p.scopeId,
    );
    return b ? localToAtlas(p, atlasFrame(a, b)) : null;
  }
  const s = a.scene?.position;
  if (!s) return null;
  if (s.city) {
    const b = a.bindings.find(
      (b) => b.kind === "city" && b.ownerId === s.city!.cityId,
    );
    if (b) return localToAtlas(s.city, atlasFrame(a, b));
  }
  return s.outdoor ?? atlasHexPoint(s.q, s.r, a.terrain.hexMeters);
}
