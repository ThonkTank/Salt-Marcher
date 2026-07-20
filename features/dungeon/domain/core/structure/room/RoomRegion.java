package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.CellOrdering;

/** Canonical authored room owner: identity, semantics, and exact floor cells. */
public record RoomRegion(
        long roomId,
        long mapId,
        long clusterId,
        String name,
        Set<Cell> floorCells,
        DungeonRoomNarration narration
) {
    public RoomRegion {
        roomId = Math.max(0L, roomId);
        mapId = Math.max(0L, mapId);
        clusterId = Math.max(0L, clusterId);
        name = name == null || name.isBlank() ? "Raum " + roomId : name.trim();
        floorCells = copyFloorCells(floorCells);
        narration = narration == null ? DungeonRoomNarration.empty() : narration;
    }

    @Override
    public Set<Cell> floorCells() {
        return floorCells;
    }

    public Map<Integer, List<Cell>> cellsByLevel() {
        Map<Integer, List<Cell>> mutable = new LinkedHashMap<>();
        for (Cell cell : floorCells) {
            mutable.computeIfAbsent(cell.level(), ignored -> new ArrayList<>()).add(cell);
        }
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        List<Integer> levels = new ArrayList<>(mutable.keySet());
        Collections.sort(levels);
        for (Integer level : levels) {
            result.put(level, CellOrdering.sortedCells(mutable.get(level)));
        }
        return Map.copyOf(result);
    }

    public List<Cell> cellsAt(int level) {
        return cellsByLevel().getOrDefault(level, List.of());
    }

    public Cell primaryAnchor() {
        List<Cell> sorted = CellOrdering.sortedCells(floorCells);
        return sorted.isEmpty() ? new Cell(0, 0, 0) : sorted.getFirst();
    }

    public int primaryLevel() {
        return primaryAnchor().level();
    }

    public RoomRegion withFloorCells(Iterable<Cell> nextFloorCells) {
        Set<Cell> cells = new LinkedHashSet<>();
        if (nextFloorCells != null) {
            nextFloorCells.forEach(cells::add);
        }
        return new RoomRegion(roomId, mapId, clusterId, name, cells, narration);
    }

    public RoomRegion withNarration(DungeonRoomNarration nextNarration) {
        return new RoomRegion(roomId, mapId, clusterId, name, floorCells, nextNarration);
    }

    public RoomRegion withName(String nextName) {
        return new RoomRegion(roomId, mapId, clusterId, nextName, floorCells, narration);
    }

    public RoomRegion inCluster(long nextClusterId) {
        return new RoomRegion(roomId, mapId, nextClusterId, name, floorCells, narration);
    }

    private static Set<Cell> copyFloorCells(Iterable<Cell> source) {
        List<Cell> cells = new ArrayList<>();
        if (source != null) {
            for (Cell cell : source) {
                if (cell != null) {
                    cells.add(cell);
                }
            }
        }
        return Collections.unmodifiableSet(new LinkedHashSet<>(CellOrdering.sortedCells(cells)));
    }
}
