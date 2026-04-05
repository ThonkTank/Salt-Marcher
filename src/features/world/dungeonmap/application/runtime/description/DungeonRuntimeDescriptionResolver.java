package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;

/**
 * Runtime descriptions should read from the same direct owners that the rest of the feature uses.
 *
 * <p>If the runtime needs extra meaning, add it at the owner seam instead of inventing a runtime-only structure
 * hierarchy here.
 */
public final class DungeonRuntimeDescriptionResolver {

    private DungeonRuntimeDescriptionResolver() {
        throw new AssertionError("No instances");
    }

    public static DungeonRuntimeDescription resolve(
            DungeonLayout layout,
            DungeonRuntimeNavigationSnapshot navigation
    ) {
        CellCoord activeCell = navigation == null ? null : navigation.cell();
        int activeLevelZ = navigation == null ? 0 : navigation.levelZ();
        CardinalDirection heading = navigation == null ? CardinalDirection.defaultDirection() : navigation.heading();
        if (layout == null || activeCell == null) {
            return null;
        }
        DungeonLayout.CellStructure structure = layout.structureAtCell(activeCell, activeLevelZ);
        if (structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure) {
            return RoomRuntimeDescriptionBuilder.build(layout, roomStructure.room(), heading, activeCell, activeLevelZ);
        }
        if (structure instanceof DungeonLayout.CellStructure.CorridorStructure corridorStructure) {
            return CorridorRuntimeDescriptionBuilder.build(
                    layout,
                    corridorStructure.corridor(),
                    heading,
                    activeCell,
                    activeLevelZ);
        }
        if (structure instanceof DungeonLayout.CellStructure.StairStructure stairStructure) {
            return StairRuntimeDescriptionBuilder.build(layout, stairStructure.stair(), activeCell, activeLevelZ);
        }
        if (structure instanceof DungeonLayout.CellStructure.TransitionStructure transitionStructure) {
            return TransitionRuntimeDescriptionBuilder.build(transitionStructure.transition());
        }
        return null;
    }
}
