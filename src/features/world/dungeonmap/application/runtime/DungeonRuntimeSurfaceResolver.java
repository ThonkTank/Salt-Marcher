package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import ui.shell.DetailsNavigator;

import java.util.List;

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
            return roomSurface(layout, layout.findRoom(roomLocation.roomId()), heading);
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent componentLocation) {
            CorridorNetwork network = layout.findCorridorNetwork(componentLocation.componentId());
            return corridorNetworkSurface(layout, network, heading);
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridorLocation) {
            Corridor corridor = layout.findCorridor(corridorLocation.corridorId());
            CorridorNetwork network = corridor == null ? null : layout.corridorNetworkForCorridor(corridor.corridorId());
            return network != null
                    ? corridorNetworkSurface(layout, network, heading)
                    : corridorSurface(layout, corridor, heading);
        }
        if (location instanceof DungeonRuntimeLocation.Tile tileLocation) {
            DungeonLayout projectedLayout = layout.projectedToLevel(tileLocation.tile().z());
            DungeonStair stair = layout.stairsAtPoint(tileLocation.tile()).stream()
                    .filter(candidate -> candidate != null)
                    .findFirst()
                    .orElse(null);
            if (stair != null) {
                return stairSurface(layout, stair, tileLocation.tile());
            }
            DungeonLayout.CellStructure structure = projectedLayout.structureAtCell(tileLocation.tile().projectedCell());
            if (structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure) {
                return roomSurface(layout, roomStructure.room(), heading);
            }
            if (structure instanceof DungeonLayout.CellStructure.NetworkStructure networkStructure) {
                return corridorNetworkSurface(layout, networkStructure.network(), heading);
            }
            if (structure instanceof DungeonLayout.CellStructure.CorridorStructure corridorStructure) {
                return corridorSurface(layout, corridorStructure.corridor(), heading);
            }
            return null;
        }
        if (location instanceof DungeonRuntimeLocation.StairExit stairExit) {
            return stairSurface(layout, layout.findStair(stairExit.stairId()), stairExit.tile());
        }
        return null;
    }

    private static DungeonRuntimeSurface roomSurface(DungeonLayout layout, Room room, DungeonHeading heading) {
        if (room == null || room.roomId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                DungeonRuntimeLabels.roomLabel(room),
                new DetailsNavigator.EntryKey("dungeon-room", layout.mapId() + ":" + room.roomId()),
                room.narration().visualDescription(),
                DungeonRuntimeDoorCatalog.describe(layout, room, heading),
                List.of());
    }

    private static DungeonRuntimeSurface corridorNetworkSurface(
            DungeonLayout layout,
            CorridorNetwork network,
            DungeonHeading heading
    ) {
        if (layout == null || network == null || network.networkId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                DungeonRuntimeLabels.corridorNetworkLabel(layout, network),
                new DetailsNavigator.EntryKey("dungeon-corridor-network", layout.mapId() + ":" + network.networkId()),
                "",
                DungeonRuntimeDoorCatalog.describe(layout, network, heading),
                List.of());
    }

    private static DungeonRuntimeSurface corridorSurface(
            DungeonLayout layout,
            Corridor corridor,
            DungeonHeading heading
    ) {
        if (layout == null || corridor == null || corridor.corridorId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                DungeonRuntimeLabels.corridorLabel(layout, corridor),
                new DetailsNavigator.EntryKey("dungeon-corridor", layout.mapId() + ":" + corridor.corridorId()),
                "",
                DungeonRuntimeDoorCatalog.describe(layout, corridor, heading),
                List.of());
    }

    private static DungeonRuntimeSurface stairSurface(DungeonLayout layout, DungeonStair stair, features.world.dungeonmap.model.geometry.CubePoint activeTile) {
        if (layout == null || stair == null || stair.stairId() == null) {
            return null;
        }
        List<DungeonRuntimeSurfaceAction> actions = stair.exits().stream()
                .filter(exit -> exit != null && exit.position() != null)
                .filter(exit -> activeTile == null || !activeTile.equals(exit.position()))
                .map(exit -> toStairAction(stair, exit))
                .toList();
        return new DungeonRuntimeSurface(
                stair.name(),
                new DetailsNavigator.EntryKey("dungeon-stair", layout.mapId() + ":" + stair.stairId()),
                "Eine Treppe verbindet mehrere erschlossene Höhenstufen.",
                List.of(),
                actions);
    }

    private static DungeonRuntimeSurfaceAction toStairAction(DungeonStair stair, DungeonStairExit exit) {
        String label = exit.label() == null || exit.label().isBlank()
                ? "Nach z=" + exit.position().z()
                : exit.label();
        return new DungeonRuntimeSurfaceAction(
                label,
                "Bewegt die Gruppe auf die verbundene Ebene.",
                DungeonRuntimeLocation.stairExit(stair.stairId(), exit.position()));
    }
}
