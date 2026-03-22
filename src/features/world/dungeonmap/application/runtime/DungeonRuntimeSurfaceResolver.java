package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;
import ui.shell.DetailsNavigator;

public final class DungeonRuntimeSurfaceResolver {

    private static final String CORRIDOR_VISUAL_DESCRIPTION = "Ein Korridor verbindet die angrenzenden Bereiche.";

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
            DungeonLayout.CellStructure structure = layout.structureAtCell(tileLocation.tile());
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
                DungeonRuntimeDoorCatalog.describe(layout, room, heading));
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
                CORRIDOR_VISUAL_DESCRIPTION,
                DungeonRuntimeDoorCatalog.describe(layout, network, heading));
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
                CORRIDOR_VISUAL_DESCRIPTION,
                DungeonRuntimeDoorCatalog.describe(layout, corridor, heading));
    }
}
