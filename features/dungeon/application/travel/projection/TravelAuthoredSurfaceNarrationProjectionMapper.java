package features.dungeon.application.travel.projection;

import java.util.ArrayList;
import java.util.List;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.DungeonRoomExitDescription;

final class TravelAuthoredSurfaceNarrationProjectionMapper {

    private TravelAuthoredSurfaceNarrationProjectionMapper() {
    }

    static List<TravelAuthoredSurface.RoomNarration> toRoomNarrations(List<RoomRegion> rooms) {
        List<TravelAuthoredSurface.RoomNarration> result = new ArrayList<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            TravelAuthoredSurface.RoomNarration narration = toRoomNarration(room);
            if (narration != null) {
                result.add(narration);
            }
        }
        return List.copyOf(result);
    }

    private static TravelAuthoredSurface.RoomNarration toRoomNarration(RoomRegion room) {
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
                        TravelGeometryProjectionMapper.cellOrOrigin(description.roomCell()),
                        description.direction(),
                        description.description()));
            }
        }
        return List.copyOf(result);
    }
}
