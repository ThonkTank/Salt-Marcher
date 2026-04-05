package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.DungeonLayout;

/**
 * Runtime descriptions should read from the same direct owners that the rest of the feature uses.
 *
 * <p>This seam writes read-only runtime description data from one parsed runtime location. Executable actions are
 * assembled separately from the same location so the description branch stays slim.
 */
public final class DungeonRuntimeDescriptionResolver {

    private DungeonRuntimeDescriptionResolver() {
        throw new AssertionError("No instances");
    }

    public static DungeonRuntimeDescription resolve(DungeonRuntimeLocation location) {
        if (location == null) {
            return null;
        }
        if (location.structure() instanceof DungeonLayout.CellStructure.RoomStructure) {
            return RoomRuntimeDescriptionBuilder.build(location);
        }
        if (location.structure() instanceof DungeonLayout.CellStructure.CorridorStructure) {
            return CorridorRuntimeDescriptionBuilder.build(location);
        }
        if (location.structure() instanceof DungeonLayout.CellStructure.StairStructure) {
            return StairRuntimeDescriptionBuilder.build(location);
        }
        if (location.structure() instanceof DungeonLayout.CellStructure.TransitionStructure) {
            return TransitionRuntimeDescriptionBuilder.build(location);
        }
        return null;
    }
}
