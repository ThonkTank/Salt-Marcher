package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import ui.shell.DetailsNavigator;

import java.util.List;
import java.util.stream.Collectors;

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
            DungeonRuntimeLocation location,
            CubePoint activeTile,
            CardinalDirection heading
    ) {
        if (layout == null || location == null || activeTile == null) {
            return null;
        }
        if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            return roomSurface(layout, layout.findRoom(roomLocation.roomId()), heading, activeTile);
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridorLocation) {
            return corridorSurface(layout, layout.findCorridor(corridorLocation.corridorId()), heading, activeTile);
        }
        if (location instanceof DungeonRuntimeLocation.Tile
                || location instanceof DungeonRuntimeLocation.StairExit
                || location instanceof DungeonRuntimeLocation.Transition) {
            return tileSurface(layout, activeTile, heading);
        }
        return null;
    }

    private static DungeonRuntimeSurface tileSurface(DungeonLayout layout, CubePoint tile, CardinalDirection heading) {
        if (layout == null || tile == null) {
            return null;
        }
        DungeonLayout projectedLayout = layout.projectedToLevel(tile.z());
        DungeonLayout.CellStructure structure = projectedLayout.structureAtCell(tile.projectedCell().toPoint2i());
        if (structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure) {
            return roomSurface(layout, roomStructure.room(), heading, tile);
        }
        if (structure instanceof DungeonLayout.CellStructure.CorridorStructure corridorStructure) {
            return corridorSurface(layout, corridorStructure.corridor(), heading, tile);
        }
        if (structure instanceof DungeonLayout.CellStructure.StairStructure stairStructure) {
            return stairOnlySurface(layout, stairStructure.stair(), tile);
        }
        if (structure instanceof DungeonLayout.CellStructure.TransitionStructure transitionStructure) {
            return transitionOnlySurface(layout, transitionStructure.transition(), tile);
        }
        return null;
    }

    private static DungeonRuntimeSurface roomSurface(
            DungeonLayout layout,
            Room room,
            CardinalDirection heading,
            CubePoint activeTile
    ) {
        if (room == null || room.roomId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                DungeonRuntimeLabels.roomLabel(room),
                new DetailsNavigator.EntryKey("dungeon-room", layout.mapId() + ":" + room.roomId()),
                room.narration().visualDescription(),
                DungeonRuntimeDoorCatalog.describe(layout, room, heading),
                DungeonRuntimeStairCatalog.describe(layout, room, activeTile),
                DungeonRuntimeTransitionCatalog.describe(layout, room, activeTile));
    }

    private static DungeonRuntimeSurface corridorSurface(
            DungeonLayout layout,
            Corridor corridor,
            CardinalDirection heading,
            CubePoint activeTile
    ) {
        if (layout == null || corridor == null || corridor.corridorId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                DungeonRuntimeLabels.corridorLabel(layout, corridor),
                new DetailsNavigator.EntryKey("dungeon-corridor", layout.mapId() + ":" + corridor.corridorId()),
                "",
                DungeonRuntimeDoorCatalog.describe(layout, corridor, heading),
                DungeonRuntimeStairCatalog.describe(layout, corridor, activeTile),
                DungeonRuntimeTransitionCatalog.describe(layout, corridor, activeTile));
    }

    private static DungeonRuntimeSurface stairOnlySurface(
            DungeonLayout layout,
            features.world.dungeonmap.model.structures.stair.DungeonStair stair,
            CubePoint activeTile
    ) {
        if (layout == null || stair == null || stair.stairId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                stair.label(),
                new DetailsNavigator.EntryKey("dungeon-stair", layout.mapId() + ":" + stair.stairId()),
                "Eine Treppe verbindet mehrere erschlossene Höhenstufen.",
                List.of(),
                DungeonRuntimeStairCatalog.describeAtCells(
                        layout,
                        stair.occupiedPositions().stream()
                                .filter(position -> position != null && position.z() == (activeTile == null ? 0 : activeTile.z()))
                                .map(CubePoint::projectedCell)
                                .collect(Collectors.toSet()),
                        activeTile == null ? 0 : activeTile.z(),
                        activeTile),
                DungeonRuntimeTransitionCatalog.describeAtTile(layout, activeTile));
    }

    private static DungeonRuntimeSurface transitionOnlySurface(
            DungeonLayout layout,
            DungeonTransition transition,
            CubePoint activeTile
    ) {
        if (layout == null || transition == null || transition.transitionId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                transition.label(),
                new DetailsNavigator.EntryKey("dungeon-transition", layout.mapId() + ":" + transition.transitionId()),
                transition.description().isBlank() ? transition.label() : transition.description(),
                List.of(),
                List.of(),
                DungeonRuntimeTransitionCatalog.describeAtTile(layout, activeTile));
    }
}
