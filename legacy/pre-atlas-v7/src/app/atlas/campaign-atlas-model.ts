import { type AtlasFrame, localToAtlas } from './atlas-coordinates';
import type { AtlasRenderView } from './campaign-atlas-view-contracts';
import type { AtlasBinding } from './atlas-binding-contracts';

export function atlasFrame(
  atlas: Pick<AtlasRenderView, 'cities' | 'bindings'>,
  b: AtlasBinding,
): AtlasFrame {
  const frames = (atlas as import('./atlas-region-view-contracts').AtlasRegionView).region?.frames;
  const resolved = frames && Object.hasOwn(frames, b.id) ? frames[b.id] : null;
  if (resolved) return { ...resolved };
  if (b.parent === 'world') return { x: b.x, y: b.y, angle: b.angle };
  const city = atlas.cities.find((c) => c.units.some((u) => u.id === b.parentId)),
    unit = city?.units.find((u) => u.id === b.parentId),
    parent = atlas.bindings.find((p) => p.kind === 'city' && p.ownerId === city?.header.id);
  if (!unit?.position || !parent) throw new Error('Gebäude ist noch nicht im Atlas verortet.');
  const base = atlasFrame(atlas, parent),
    at = localToAtlas(unit.position, base),
    pose = { ...at, angle: base.angle + (unit.angle ?? 0) },
    offset = localToAtlas({ x: b.x, y: b.y }, pose);
  return { ...offset, angle: pose.angle + b.angle };
}
