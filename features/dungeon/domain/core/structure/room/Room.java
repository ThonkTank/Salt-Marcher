package features.dungeon.domain.core.structure.room;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Cell;

public record Room(
        long roomId,
        long mapId,
        long clusterId,
        String name,
        Map<Integer, Cell> floorAnchors
) {
    public Room {
        roomId = Math.max(0L, roomId);
        mapId = Math.max(0L, mapId);
        clusterId = Math.max(0L, clusterId);
        name = name == null || name.isBlank() ? "Raum " + roomId : name.trim();
        floorAnchors = copyFloorAnchors(floorAnchors);
    }

    @Override
    public Map<Integer, Cell> floorAnchors() {
        return Map.copyOf(floorAnchors);
    }

    public static Map<Integer, Cell> anchorsByLevel(Map<Integer, ? extends Iterable<Cell>> cellsByLevel) {
        Map<Integer, Cell> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, ? extends Iterable<Cell>> entry : cellsByLevel.entrySet()) {
            Cell anchor = firstSortedCell(entry.getValue());
            if (entry.getKey() != null && anchor != null) {
                result.put(entry.getKey(), anchor);
            }
        }
        return Map.copyOf(result);
    }

    private static Cell firstSortedCell(Iterable<Cell> cells) {
        List<Cell> sortedCells = RoomClusterCells.sortedCells(cells);
        return sortedCells.isEmpty() ? null : sortedCells.getFirst();
    }

    private static Map<Integer, Cell> copyFloorAnchors(Map<Integer, Cell> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Cell> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Cell> entry : source.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(entry.getKey(), entry.getValue());
            }
        }
        return Map.copyOf(result);
    }
}
