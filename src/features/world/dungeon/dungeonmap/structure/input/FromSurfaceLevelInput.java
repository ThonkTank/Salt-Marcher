package features.world.dungeon.dungeonmap.structure.input;

import java.util.Collection;

/**
 * Canonical request for materializing one level of structure topology from a resolved walkable surface.
 */
@SuppressWarnings("unused")
public record FromSurfaceLevelInput(
        int levelZ,
        features.world.dungeon.geometry.GridArea surfaceArea,
        Collection<features.world.dungeon.dungeonmap.structure.model.boundary.door.Door> doors
) {
}
