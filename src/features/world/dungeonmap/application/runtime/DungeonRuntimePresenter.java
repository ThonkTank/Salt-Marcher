package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.stream.Stream;

public final class DungeonRuntimePresenter {

    private DungeonRuntimePresenter() {
    }

    public static String activeLocationLabel(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (layout == null || location == null) {
            return "Kein Standort";
        }
        if (location instanceof DungeonRuntimeLocation.Tile tileLocation) {
            return structureLabelAtTile(layout, tileLocation.tile());
        }
        if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            return roomLabel(layout, roomLocation.roomId());
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridorLocation) {
            Corridor corridor = layout.findCorridor(corridorLocation.corridorId());
            return corridor == null ? "Korridor" : corridorLabel(layout, corridor.roomIds().stream());
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent componentLocation) {
            CorridorNetwork network = layout.corridorNetworks().stream()
                    .filter(candidate -> candidate.networkId().equals(componentLocation.componentId()))
                    .findFirst()
                    .orElse(null);
            return network == null ? "Korridor" : corridorLabel(layout, network.roomIds().stream());
        }
        return "Kein Standort";
    }

    public static String tileLabel(DungeonRuntimeLocation location) {
        if (!(location instanceof DungeonRuntimeLocation.Tile tileLocation)) {
            return "\u2014";
        }
        return tileLabel(tileLocation.tile());
    }

    public static String tileLabel(Point2i tile) {
        return tile == null ? "\u2014" : tile.x() + ", " + tile.y();
    }

    public static String headingLabel(DungeonHeading heading) {
        DungeonHeading resolved = heading == null ? DungeonHeading.defaultHeading() : heading;
        return resolved.label();
    }

    public static String structureLabelAtTile(DungeonLayout layout, Point2i tile) {
        if (layout == null || tile == null) {
            return "Kein Standort";
        }
        Room room = layout.roomAtCell(tile);
        if (room != null) {
            return roomLabel(layout, room.roomId());
        }
        CorridorNetwork network = layout.corridorNetworkAtCell(tile);
        if (network != null) {
            return corridorLabel(layout, network.roomIds().stream());
        }
        Corridor corridor = layout.corridorsAtCell(tile).stream().findFirst().orElse(null);
        if (corridor != null) {
            return corridorLabel(layout, corridor.roomIds().stream());
        }
        return "Kein Standort";
    }

    public static String roomLabel(DungeonLayout layout, Long roomId) {
        Room room = roomForId(layout, roomId);
        if (room == null) {
            return roomId == null ? "Raum" : "Raum " + roomId;
        }
        return room.name() == null || room.name().isBlank() ? "Raum " + room.roomId() : room.name();
    }

    public static String roomLabel(Room room) {
        if (room == null) {
            return "Raum";
        }
        return room.name() == null || room.name().isBlank() ? "Raum " + room.roomId() : room.name();
    }

    public static Room roomForLocation(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (layout == null || location == null) {
            return null;
        }
        if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            return roomForId(layout, roomLocation.roomId());
        }
        if (location instanceof DungeonRuntimeLocation.Tile tileLocation) {
            return layout.roomAtCell(tileLocation.tile());
        }
        return null;
    }

    public static String corridorLabel(DungeonLayout layout, Corridor corridor) {
        if (corridor == null) {
            return "Korridor";
        }
        return corridorLabel(layout, corridor.roomIds().stream());
    }

    public static String corridorNetworkLabel(DungeonLayout layout, CorridorNetwork network) {
        if (network == null) {
            return "Korridor";
        }
        return corridorLabel(layout, network.roomIds().stream());
    }

    private static Room roomForId(DungeonLayout layout, Long roomId) {
        return layout == null ? null : layout.findRoom(roomId);
    }

    private static String corridorLabel(DungeonLayout layout, Stream<Long> roomIds) {
        String joinedRooms = roomIds
                .map(roomId -> roomLabel(layout, roomId))
                .distinct()
                .sorted(String::compareToIgnoreCase)
                .reduce((left, right) -> left + ", " + right)
                .orElse("Korridor");
        return "Korridor: " + joinedRooms;
    }
}
