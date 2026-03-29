package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.stream.Stream;

public final class DungeonRuntimeLabels {

    private DungeonRuntimeLabels() {
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
            CorridorNetwork network = layout.findCorridorNetwork(componentLocation.componentId());
            return network == null ? "Korridor" : corridorLabel(layout, network.roomIds().stream());
        }
        if (location instanceof DungeonRuntimeLocation.StairExit stairExit) {
            return structureLabelAtTile(layout, stairExit.tile());
        }
        if (location instanceof DungeonRuntimeLocation.Transition transitionLocation) {
            DungeonTransition transition = layout.findTransition(transitionLocation.transitionId());
            return transition == null ? "Übergang" : transition.label();
        }
        return "Kein Standort";
    }

    public static String tileLabel(DungeonRuntimeLocation location) {
        if (!(location instanceof DungeonRuntimeLocation.Tile tileLocation)) {
            return "\u2014";
        }
        return tileLabel(tileLocation.tile());
    }

    public static String tileLabel(CubePoint tile) {
        return tile == null ? "\u2014" : tile.x() + ", " + tile.y() + ", z=" + tile.z();
    }

    public static String headingLabel(CardinalDirection heading) {
        CardinalDirection resolved = heading == null ? CardinalDirection.defaultDirection() : heading;
        return resolved.label();
    }

    public static String structureLabelAtTile(DungeonLayout layout, CubePoint tile) {
        if (layout == null || tile == null) {
            return "Kein Standort";
        }
        DungeonLayout.CellStructure structure = layout.projectedToLevel(tile.z()).structureAtCell(tile.projectedCell());
        if (structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure) {
            return roomLabel(roomStructure.room());
        }
        if (structure instanceof DungeonLayout.CellStructure.NetworkStructure networkStructure) {
            return corridorNetworkLabel(layout, networkStructure.network());
        }
        if (structure instanceof DungeonLayout.CellStructure.CorridorStructure corridorStructure) {
            return corridorLabel(layout, corridorStructure.corridor());
        }
        DungeonStair stair = layout.stairsAtPoint(tile).stream().findFirst().orElse(null);
        if (stair != null) {
            return stair.label();
        }
        DungeonTransition transition = layout.transitionsAtPoint(tile).stream().findFirst().orElse(null);
        if (transition != null) {
            return transition.label();
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
            return layout.projectedToLevel(tileLocation.tile().z()).roomAtCell(tileLocation.tile().projectedCell());
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
