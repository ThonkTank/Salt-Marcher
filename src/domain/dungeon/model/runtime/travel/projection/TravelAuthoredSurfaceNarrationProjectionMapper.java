package src.domain.dungeon.model.runtime.travel.projection;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.worldspace.DungeonRoom;
import src.domain.dungeon.model.worldspace.DungeonRoomExitDescription;

final class TravelAuthoredSurfaceNarrationProjectionMapper {

    private TravelAuthoredSurfaceNarrationProjectionMapper() {
    }

    static List<TravelAuthoredSurface.RoomNarration> toRoomNarrations(List<DungeonRoom> rooms) {
        List<TravelAuthoredSurface.RoomNarration> result = new ArrayList<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            TravelAuthoredSurface.RoomNarration narration = toRoomNarration(room);
            if (narration != null) {
                result.add(narration);
            }
        }
        return List.copyOf(result);
    }

    private static TravelAuthoredSurface.RoomNarration toRoomNarration(DungeonRoom room) {
        if (room == null || room.narration() == null) {
            return null;
        }
        return new TravelAuthoredSurface.RoomNarration(
                room.roomId(),
                toExits(room.narration().exitDescriptions()));
    }

    private static List<TravelAuthoredSurface.RoomExit> toExits(List<DungeonRoomExitDescription> descriptions) {
        List<TravelAuthoredSurface.RoomExit> result = new ArrayList<>();
        for (DungeonRoomExitDescription description
                : descriptions == null ? List.<DungeonRoomExitDescription>of() : descriptions) {
            if (description != null) {
                result.add(new TravelAuthoredSurface.RoomExit(
                        TravelGeometryProjectionMapper.toCoreCell(description.roomCell()),
                        directionFromName(description.direction() == null ? "" : description.direction().name()),
                        description.description()));
            }
        }
        return List.copyOf(result);
    }

    private static Direction directionFromName(String name) {
        return switch (name == null ? "" : name.trim()) {
            case "EAST" -> Direction.EAST;
            case "SOUTH" -> Direction.SOUTH;
            case "WEST" -> Direction.WEST;
            default -> Direction.NORTH;
        };
    }
}
