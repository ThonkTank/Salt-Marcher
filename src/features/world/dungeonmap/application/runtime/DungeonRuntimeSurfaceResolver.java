package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import ui.shell.DetailsNavigator;

import java.util.List;
import java.util.stream.Collectors;

public final class DungeonRuntimeSurfaceResolver {

    private DungeonRuntimeSurfaceResolver() {
        throw new AssertionError("No instances");
    }

    public static DungeonRuntimeSurface resolve(
            DungeonLayout layout,
            DungeonRuntimeLocation location,
            DungeonHeading heading
    ) {
        if (layout == null || location == null) {
            return null;
        }
        if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            return roomSurface(layout, layout.findRoom(roomLocation.roomId()), heading, null);
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent componentLocation) {
            CorridorNetwork network = layout.findCorridorNetwork(componentLocation.componentId());
            return corridorNetworkSurface(layout, network, heading, null);
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridorLocation) {
            Corridor corridor = layout.findCorridor(corridorLocation.corridorId());
            CorridorNetwork network = corridor == null ? null : layout.corridorNetworkForCorridor(corridor.corridorId());
            return network != null
                    ? corridorNetworkSurface(layout, network, heading, null)
                    : corridorSurface(layout, corridor, heading, null);
        }
        if (location instanceof DungeonRuntimeLocation.Tile tileLocation) {
            return tileSurface(layout, tileLocation.tile(), heading);
        }
        if (location instanceof DungeonRuntimeLocation.StairExit stairExit) {
            return tileSurface(layout, stairExit.tile(), heading);
        }
        return null;
    }

    private static DungeonRuntimeSurface tileSurface(DungeonLayout layout, CubePoint tile, DungeonHeading heading) {
        if (layout == null || tile == null) {
            return null;
        }
        DungeonLayout projectedLayout = layout.projectedToLevel(tile.z());
        DungeonLayout.CellStructure structure = projectedLayout.structureAtCell(tile.projectedCell());
        if (structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure) {
            return roomSurface(layout, roomStructure.room(), heading, tile);
        }
        if (structure instanceof DungeonLayout.CellStructure.NetworkStructure networkStructure) {
            return corridorNetworkSurface(layout, networkStructure.network(), heading, tile);
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
            DungeonHeading heading,
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
                DungeonRuntimeTransitionCatalog.describe(layout, room));
    }

    private static DungeonRuntimeSurface corridorNetworkSurface(
            DungeonLayout layout,
            CorridorNetwork network,
            DungeonHeading heading,
            CubePoint activeTile
    ) {
        if (layout == null || network == null || network.networkId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                DungeonRuntimeLabels.corridorNetworkLabel(layout, network),
                new DetailsNavigator.EntryKey("dungeon-corridor-network", layout.mapId() + ":" + network.networkId()),
                "",
                DungeonRuntimeDoorCatalog.describe(layout, network, heading),
                DungeonRuntimeStairCatalog.describe(layout, network, activeTile),
                DungeonRuntimeTransitionCatalog.describe(layout, network));
    }

    private static DungeonRuntimeSurface corridorSurface(
            DungeonLayout layout,
            Corridor corridor,
            DungeonHeading heading,
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
                DungeonRuntimeTransitionCatalog.describe(layout, corridor));
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
                stair.name(),
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
