package features.world.dungeon.model.structures.room;

import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.geometry.GridPoint;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Room metadata is persisted directly. Physical room topology is derived from the owning cluster structure.
 */
public record Room(
        Long roomId,
        long mapId,
        long clusterId,
        String name,
        Map<Integer, GridPoint> anchorsByLevel,
        RoomNarration narration
) {
    public static Room metadata(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Map<Integer, GridPoint> anchorsByLevel,
            RoomNarration narration
    ) {
        return new Room(roomId, mapId, clusterId, name, anchorsByLevel, narration);
    }

    public Room {
        anchorsByLevel = normalizeAnchors(anchorsByLevel);
        narration = narration == null ? RoomNarration.empty() : narration;
    }

    public Room withNarration(RoomNarration narration) {
        return new Room(roomId, mapId, clusterId, name, anchorsByLevel, narration);
    }

    public Room withName(String name) {
        return new Room(roomId, mapId, clusterId, name, anchorsByLevel, narration);
    }

    public Room withClusterId(long clusterId) {
        return new Room(roomId, mapId, clusterId, name, anchorsByLevel, narration);
    }

    public Room withAnchorsByLevel(Map<Integer, GridPoint> anchorsByLevel) {
        return new Room(roomId, mapId, clusterId, name, anchorsByLevel, narration);
    }

    public Set<Integer> levels() {
        return anchorsByLevel.keySet();
    }

    public int primaryLevel() {
        return anchorsByLevel.keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public GridPoint anchorAtLevel(int levelZ) {
        return anchorsByLevel.get(levelZ);
    }

    public Room movedBy(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        Map<Integer, GridPoint> movedAnchors = new LinkedHashMap<>();
        for (Map.Entry<Integer, GridPoint> entry : anchorsByLevel.entrySet()) {
            movedAnchors.put(entry.getKey() + resolvedTranslation.dzLevels(), entry.getValue().translated(resolvedTranslation));
        }
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                movedAnchors,
                narration);
    }

    public Room movedToLevel(int targetPrimaryLevel) {
        return movedBy(GridTranslation.cells(0, 0, targetPrimaryLevel - primaryLevel()));
    }

    public Room movedByLevel(int levelDelta) {
        return movedBy(GridTranslation.cells(0, 0, levelDelta));
    }

    private static Map<Integer, GridPoint> normalizeAnchors(Map<Integer, GridPoint> anchorsByLevel) {
        Map<Integer, GridPoint> resolved = new LinkedHashMap<>();
        if (anchorsByLevel != null) {
            anchorsByLevel.entrySet().stream()
                    .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> resolved.put(entry.getKey(), entry.getValue()));
        }
        return resolved.isEmpty() ? Map.of() : Map.copyOf(resolved);
    }
}
