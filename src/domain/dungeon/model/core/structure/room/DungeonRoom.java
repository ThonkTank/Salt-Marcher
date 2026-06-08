package src.domain.dungeon.model.core.structure.room;

import java.util.LinkedHashMap;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;

public record DungeonRoom(
        long roomId,
        long mapId,
        long clusterId,
        String name,
        Map<Integer, Cell> floorAnchors,
        DungeonRoomNarration narration
) {
    public DungeonRoom {
        name = name == null || name.isBlank() ? "Raum " + roomId : name.trim();
        floorAnchors = copyFloorAnchors(floorAnchors);
        narration = narration == null ? DungeonRoomNarration.empty() : narration;
    }

    @Override
    public Map<Integer, Cell> floorAnchors() {
        return Map.copyOf(floorAnchors);
    }

    public Cell primaryAnchor() {
        return floorAnchors.getOrDefault(primaryLevel(), new Cell(0, 0, 0));
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

    public DungeonRoom withName(String nextName) {
        return new DungeonRoom(
                roomId,
                mapId,
                clusterId,
                nextName,
                floorAnchors,
                narration);
    }

    public Room toCore() {
        Map<Integer, Cell> coreAnchors = new LinkedHashMap<>();
        for (Map.Entry<Integer, Cell> entry : floorAnchors.entrySet()) {
            coreAnchors.put(entry.getKey(), entry.getValue());
        }
        return new Room(roomId, mapId, clusterId, name, coreAnchors);
    }

    public static DungeonRoom fromCore(Room room, DungeonRoomNarration narration) {
        Map<Integer, Cell> anchors = new LinkedHashMap<>();
        for (Map.Entry<Integer, Cell> entry : room.floorAnchors().entrySet()) {
            anchors.put(entry.getKey(), entry.getValue());
        }
        return new DungeonRoom(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                anchors,
                narration);
    }

    private static Map<Integer, Cell> copyFloorAnchors(Map<Integer, Cell> source) {
        Map<Integer, Cell> result = new LinkedHashMap<>();
        if (source != null) {
            for (Map.Entry<Integer, Cell> entry : source.entrySet()) {
                if (entry.getKey() != null && entry.getValue() != null) {
                    result.put(entry.getKey(), entry.getValue());
                }
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }
}
