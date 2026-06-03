package src.domain.dungeon.model.worldspace;


import java.util.LinkedHashMap;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.Room;

public record DungeonRoom(
        long roomId,
        long mapId,
        long clusterId,
        String name,
        Map<Integer, DungeonCell> floorAnchors,
        DungeonRoomNarration narration
) {
    public DungeonRoom {
        name = name == null || name.isBlank() ? "Raum " + roomId : name.trim();
        floorAnchors = copyFloorAnchors(floorAnchors);
        narration = narration == null ? DungeonRoomNarration.empty() : narration;
    }

    @Override
    public Map<Integer, DungeonCell> floorAnchors() {
        return Map.copyOf(floorAnchors);
    }

    public DungeonCell primaryAnchor() {
        return floorAnchors.getOrDefault(primaryLevel(), new DungeonCell(0, 0, 0));
    }

    public int primaryLevel() {
        int result = 0;
        boolean found = false;
        for (Integer level : floorAnchors.keySet()) {
            if (level != null && (!found || level < result)) {
                result = level;
                found = true;
            }
        }
        return result;
    }

    public DungeonRoom withNarration(DungeonRoomNarration nextNarration) {
        return new DungeonRoom(
                roomId,
                mapId,
                clusterId,
                name,
                floorAnchors,
                nextNarration);
    }

    Room toCore() {
        Map<Integer, Cell> coreAnchors = new LinkedHashMap<>();
        for (Map.Entry<Integer, DungeonCell> entry : floorAnchors.entrySet()) {
            coreAnchors.put(entry.getKey(), entry.getValue().geometry());
        }
        return new Room(roomId, mapId, clusterId, name, coreAnchors);
    }

    static DungeonRoom fromCore(Room room, DungeonRoomNarration narration) {
        Map<Integer, DungeonCell> anchors = new LinkedHashMap<>();
        for (Map.Entry<Integer, Cell> entry : room.floorAnchors().entrySet()) {
            anchors.put(entry.getKey(), DungeonCell.fromGeometry(entry.getValue()));
        }
        return new DungeonRoom(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                anchors,
                narration);
    }

    private static Map<Integer, DungeonCell> copyFloorAnchors(Map<Integer, DungeonCell> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, DungeonCell> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, DungeonCell> entry : source.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(entry.getKey(), entry.getValue());
            }
        }
        return Map.copyOf(result);
    }
}
