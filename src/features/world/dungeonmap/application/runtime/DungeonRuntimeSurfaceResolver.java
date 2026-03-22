package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;
import ui.shell.DetailsNavigator;

import java.util.Comparator;

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
            return roomSurface(layout.findRoom(roomLocation.roomId()), layout.mapId(), heading);
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent componentLocation) {
            CorridorNetwork network = layout.corridorNetworks().stream()
                    .filter(candidate -> candidate.networkId().equals(componentLocation.componentId()))
                    .findFirst()
                    .orElse(null);
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
            Room room = layout.roomAtCell(tileLocation.tile());
            if (room != null) {
                return roomSurface(room, layout.mapId(), heading);
            }
            CorridorNetwork network = layout.corridorNetworkAtCell(tileLocation.tile());
            if (network != null) {
                return corridorNetworkSurface(layout, network, heading);
            }
            Corridor corridor = layout.corridorsAtCell(tileLocation.tile()).stream()
                    .filter(candidate -> candidate != null && candidate.corridorId() != null)
                    .min(Comparator.comparing(Corridor::corridorId))
                    .orElse(null);
            return corridorSurface(layout, corridor, heading);
        }
        return null;
    }

    private static DungeonRuntimeSurface roomSurface(Room room, long mapId, DungeonHeading heading) {
        if (room == null || room.roomId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                DungeonRuntimePresenter.roomLabel(room),
                new DetailsNavigator.EntryKey("dungeon-room", mapId + ":" + room.roomId()),
                room.narration().visualDescription(),
                DungeonRuntimeDoorCatalog.describe(room, heading));
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
                DungeonRuntimePresenter.corridorNetworkLabel(layout, network),
                new DetailsNavigator.EntryKey("dungeon-corridor-network", layout.mapId() + ":" + network.networkId()),
                CORRIDOR_VISUAL_DESCRIPTION,
                DungeonRuntimeDoorCatalog.describe(network, heading));
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
                DungeonRuntimePresenter.corridorLabel(layout, corridor),
                new DetailsNavigator.EntryKey("dungeon-corridor", layout.mapId() + ":" + corridor.corridorId()),
                CORRIDOR_VISUAL_DESCRIPTION,
                DungeonRuntimeDoorCatalog.describe(corridor, heading));
    }
}
