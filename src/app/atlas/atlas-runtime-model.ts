import type { Point } from '../shared/contracts';
import type { AtlasRenderView } from './campaign-atlas-contracts';
import type { TravelPreview, Hex } from '../runtime/world-contracts';
export function atlasWorldRoute(a: AtlasRenderView, preview: TravelPreview | null): Hex[] {
  const scene = a.scene;
  if (
    preview &&
    preview.request.sceneId === scene?.scene.id &&
    preview.request.mapId === a.terrain.id
  )
    return preview.route;
  const j = scene?.journey;
  return j &&
    j.sceneId === scene?.scene.id &&
    j.mapId === a.terrain.id &&
    ['active', 'paused', 'interrupted'].includes(j.status)
    ? j.route.slice(Math.max(0, j.nextIndex - 1))
    : [];
}
import { atlasFrame, localToAtlas, atlasHexPoint } from './campaign-atlas-model';
export function atlasPartyPoint(a: AtlasRenderView): Point | null {
  const p = a.geometry.position;
  if (p) {
    const b = a.bindings.find((b) => b.kind === 'dungeon' && b.ownerId === p.scopeId);
    return b ? localToAtlas(p, atlasFrame(a, b)) : null;
  }
  const s = a.scene?.position;
  if (!s) return null;
  if (s.city) {
    const b = a.bindings.find((b) => b.kind === 'city' && b.ownerId === s.city!.cityId);
    if (b) return localToAtlas(s.city, atlasFrame(a, b));
  }
  return s.outdoor ?? atlasHexPoint(s.q, s.r, a.terrain.hexMeters);
}
