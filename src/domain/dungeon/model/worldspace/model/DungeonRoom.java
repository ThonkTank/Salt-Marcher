package src.domain.dungeon.model.worldspace.model;


import java.util.LinkedHashMap;
import java.util.Map;

public final class DungeonRoom {

    private final long roomId;
    private final long mapId;
    private final long clusterId;
    private final String name;
    private final Map<Integer, DungeonCell> floorAnchors;
    private final DungeonRoomNarration narration;

    public DungeonRoom(
            long roomId,
            long mapId,
            long clusterId,
            String name,
            Map<Integer, DungeonCell> floorAnchors,
            DungeonRoomNarration narration
    ) {
        this.roomId = roomId;
        this.mapId = mapId;
        this.clusterId = clusterId;
        this.name = name == null || name.isBlank() ? "Raum " + roomId : name.trim();
        this.floorAnchors = copyFloorAnchors(floorAnchors);
        this.narration = narration == null ? DungeonRoomNarration.empty() : narration;
    }

    public long roomId() {
        return roomId;
    }

    public long mapId() {
        return mapId;
    }

    public long clusterId() {
        return clusterId;
    }

    public String name() {
        return name;
    }

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

    public DungeonRoomNarration narration() {
        return narration;
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
