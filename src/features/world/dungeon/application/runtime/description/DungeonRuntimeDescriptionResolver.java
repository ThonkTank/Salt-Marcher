package features.world.dungeon.application.runtime.description;

import features.world.dungeon.application.runtime.DungeonRuntimeLocation;
import features.world.dungeon.dungeonmap.model.DungeonMap;

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
        if (location.structure() instanceof DungeonMap.CellStructure.RoomStructure) {
            return RoomRuntimeDescriptionBuilder.build(location);
        }
        if (location.structure() instanceof DungeonMap.CellStructure.CorridorStructure) {
            return CorridorRuntimeDescriptionBuilder.build(location);
        }
        if (location.structure() instanceof DungeonMap.CellStructure.StairStructure) {
            return StairRuntimeDescriptionBuilder.build(location);
        }
        if (location.structure() instanceof DungeonMap.CellStructure.TransitionStructure) {
            return TransitionRuntimeDescriptionBuilder.build(location);
        }
        return null;
    }
}
