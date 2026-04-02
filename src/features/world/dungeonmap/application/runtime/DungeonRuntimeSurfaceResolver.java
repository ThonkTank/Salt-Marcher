package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import ui.shell.DetailsNavigator;

import java.util.List;

/**
 * Runtime surfaces should read from the same direct owners that the rest of the feature uses.
 *
 * <p>If the runtime needs extra meaning, add it at the owner seam instead of inventing a runtime-only structure
 * hierarchy here.
 */
public final class DungeonRuntimeSurfaceResolver {

    private DungeonRuntimeSurfaceResolver() {
        throw new AssertionError("No instances");
    }

    public static DungeonRuntimeSurface resolve(
            DungeonLayout layout,
            CellCoord activeCell,
            int activeLevelZ,
            CardinalDirection heading
    ) {
        if (layout == null || activeCell == null) {
            return null;
        }
        DungeonLayout.CellStructure structure = layout.structureAtCell(activeCell, activeLevelZ);
        if (structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure) {
            return roomSurface(layout, roomStructure.room(), heading, activeCell, activeLevelZ);
        }
        if (structure instanceof DungeonLayout.CellStructure.CorridorStructure corridorStructure) {
            return corridorSurface(layout, corridorStructure.corridor(), heading, activeCell, activeLevelZ);
        }
        if (structure instanceof DungeonLayout.CellStructure.StairStructure stairStructure) {
            return stairOnlySurface(layout, stairStructure.stair(), activeCell, activeLevelZ);
        }
        if (structure instanceof DungeonLayout.CellStructure.TransitionStructure transitionStructure) {
            return transitionOnlySurface(layout, transitionStructure.transition(), activeCell, activeLevelZ);
        }
        return null;
    }

    private static DungeonRuntimeSurface roomSurface(
            DungeonLayout layout,
            Room room,
            CardinalDirection heading,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (room == null || room.roomId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                DungeonRuntimeLabels.roomLabel(room),
                new DetailsNavigator.EntryKey("dungeon-room", layout.mapId() + ":" + room.roomId()),
                room.narration().visualDescription(),
                DungeonRuntimeActionCatalog.describe(layout, room, heading, activeCell, activeLevelZ));
    }

    private static DungeonRuntimeSurface corridorSurface(
            DungeonLayout layout,
            Corridor corridor,
            CardinalDirection heading,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || corridor == null || corridor.corridorId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                DungeonRuntimeLabels.corridorLabel(layout, corridor),
                new DetailsNavigator.EntryKey("dungeon-corridor", layout.mapId() + ":" + corridor.corridorId()),
                "",
                DungeonRuntimeActionCatalog.describe(layout, corridor, heading, activeCell, activeLevelZ));
    }

    private static DungeonRuntimeSurface stairOnlySurface(
            DungeonLayout layout,
            features.world.dungeonmap.model.structures.stair.DungeonStair stair,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || stair == null || stair.stairId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                stair.label(),
                new DetailsNavigator.EntryKey("dungeon-stair", layout.mapId() + ":" + stair.stairId()),
                "Eine Treppe verbindet mehrere erschlossene Höhenstufen.",
                DungeonRuntimeActionCatalog.describe(layout, stair, activeCell, activeLevelZ));
    }

    private static DungeonRuntimeSurface transitionOnlySurface(
            DungeonLayout layout,
            DungeonTransition transition,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || transition == null || transition.transitionId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                transition.label(),
                new DetailsNavigator.EntryKey("dungeon-transition", layout.mapId() + ":" + transition.transitionId()),
                transition.description().isBlank() ? transition.label() : transition.description(),
                DungeonRuntimeActionCatalog.describe(layout, transition, activeCell, activeLevelZ));
    }
}
