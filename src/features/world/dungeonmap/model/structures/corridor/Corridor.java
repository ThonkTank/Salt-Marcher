package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.objects.TileShape;

import java.util.ArrayList;
import java.util.List;

public final class Corridor {

    private final Long corridorId;
    private final long mapId;
    private final List<Long> roomIds;
    private final List<TileShape> geometry;
    private final List<RoomLink> roomLinks;

    public Corridor(Long corridorId, long mapId, List<Long> roomIds) {
        this(corridorId, mapId, roomIds, List.of());
    }

    public Corridor(Long corridorId, long mapId, List<Long> roomIds, List<TileShape> geometry) {
        this.corridorId = corridorId;
        this.mapId = mapId;
        this.roomIds = roomIds == null ? List.of() : List.copyOf(roomIds);
        this.geometry = geometry == null ? List.of() : List.copyOf(geometry);
        this.roomLinks = deriveRoomLinks(this.roomIds);
    }

    public Long corridorId() {
        return corridorId;
    }

    public long mapId() {
        return mapId;
    }

    public List<Long> roomIds() {
        return roomIds;
    }

    public List<TileShape> geometry() {
        return geometry;
    }

    public List<RoomLink> roomLinks() {
        return roomLinks;
    }

    private static List<RoomLink> deriveRoomLinks(List<Long> roomIds) {
        List<RoomLink> links = new ArrayList<>();
        for (int index = 1; index < roomIds.size(); index++) {
            Long fromRoomId = roomIds.get(index - 1);
            Long toRoomId = roomIds.get(index);
            if (fromRoomId == null || toRoomId == null || fromRoomId.equals(toRoomId)) {
                continue;
            }
            links.add(new RoomLink(fromRoomId, toRoomId));
        }
        return List.copyOf(links);
    }

    public record RoomLink(long fromRoomId, long toRoomId) {
    }
}
