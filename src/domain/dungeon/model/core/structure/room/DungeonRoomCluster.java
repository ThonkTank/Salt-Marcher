package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;

@SuppressWarnings({"PMD.GodClass", "PMD.TooManyMethods"})
public final class DungeonRoomCluster {
    private final long clusterId;
    private final long mapId;
    private final String name;
    private final Cell center;
    private final RoomClusterFloorMap floorMap;
    private final Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel;

    private DungeonRoomCluster(
            long clusterId,
            long mapId,
            String name,
            Cell center,
            RoomClusterFloorMap floorMap,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        this.clusterId = clusterId;
        this.mapId = mapId;
        this.name = defaultName(clusterId, name);
        this.center = center == null ? new Cell(0, 0, 0) : center;
        this.floorMap = floorMap == null
                ? new RoomClusterFloorMap(Map.of())
                : new RoomClusterFloorMap(floorMap.cellsByLevel());
        this.boundariesByLevel = copyNestedLists(boundariesByLevel);
    }

    public static DungeonRoomCluster fromPersistenceState(
            long clusterId,
            long mapId,
            String name,
            Cell center,
            RoomClusterFloorMap floorMap,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return new DungeonRoomCluster(
                clusterId,
                mapId,
                name,
                center,
                floorMap,
                boundariesByLevel);
    }

    public long clusterId() {
        return clusterId;
    }

    public long mapId() {
        return mapId;
    }

    public String name() {
        return name;
    }

    public Cell center() {
        return center;
    }

    public RoomClusterFloorMap floorMap() {
        return new RoomClusterFloorMap(floorMap.cellsByLevel());
    }

    public Map<Integer, List<Cell>> cellsByLevel() {
        return floorMap().cellsByLevel();
    }

    public Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap() {
        return boundarySnapshot().boundaryMap();
    }

    public List<DungeonClusterBoundary> orderedAuthoredBoundaries() {
        return boundarySnapshot().orderedBoundaries();
    }

    public DungeonClusterBoundary boundaryAt(Edge edge) {
        if (edge == null) {
            return null;
        }
        for (DungeonClusterBoundary boundary : boundarySnapshot().orderedBoundaries()) {
            if (boundary.matchesAbsoluteEdge(center, edge)) {
                return boundary;
            }
        }
        return null;
    }

    public Set<Integer> boundaryLevels() {
        return boundarySnapshot().boundaryLevels();
    }

    public Map<Integer, List<Edge>> closedBoundaryEdgesByLevel() {
        return boundarySnapshot().closedBoundaryEdgesByLevel();
    }

    public RoomCluster toCore(Map<Integer, List<Cell>> cellsByLevel) {
        Map<Integer, List<Cell>> copiedCellsByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : cellsByLevel.entrySet()) {
            copiedCellsByLevel.put(entry.getKey(), copiedCells(entry.getValue()));
        }
        return new RoomCluster(clusterId, mapId, center, new RoomClusterFloorMap(copiedCellsByLevel));
    }

    public List<Cell> authoredBoundaryVertices(int level) {
        return boundarySnapshot().authoredBoundaryVertices(level);
    }

    public List<RoomClusterWallRun> authoredWallRuns(int level) {
        return boundarySnapshot().authoredWallRuns(level);
    }

    public List<DungeonClusterBoundary> orderedBoundariesForWriteback() {
        return boundarySnapshot().orderedBoundaries();
    }

    Map<Integer, List<DungeonClusterBoundary>> preservedBoundariesForTopologyWork(
            Map<Integer, List<Cell>> nextCellsByLevel
    ) {
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        Map<Integer, List<Cell>> oldCellsByLevel = cellsByLevel();
        Map<Integer, List<Cell>> copiedNextCellsByLevel = copyNestedLists(nextCellsByLevel);
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : boundariesByLevel.entrySet()) {
            Set<Cell> oldCells = Set.copyOf(oldCellsByLevel.getOrDefault(entry.getKey(), List.of()));
            Set<Cell> nextCells = Set.copyOf(copiedNextCellsByLevel.getOrDefault(entry.getKey(), List.of()));
            List<DungeonClusterBoundary> preserved = new ArrayList<>();
            for (DungeonClusterBoundary boundary : entry.getValue()) {
                if (boundary != null && keepBoundaryForTopologyWork(boundary, oldCells, nextCells)) {
                    preserved.add(boundary);
                }
            }
            if (!preserved.isEmpty()) {
                result.put(entry.getKey(), List.copyOf(preserved));
            }
        }
        return Map.copyOf(result);
    }

    DungeonRoomCluster rebuiltForTopologyWork(
            Map<Integer, List<Cell>> nextCellsByLevel,
            Map<Integer, List<DungeonClusterBoundary>> nextBoundariesByLevel
    ) {
        return new DungeonRoomCluster(
                clusterId,
                mapId,
                name,
                center,
                new RoomClusterFloorMap(nextCellsByLevel),
                nextBoundariesByLevel);
    }

    DungeonRoomCluster withAuthoredBoundaries(
            Map<Integer, List<DungeonClusterBoundary>> nextBoundariesByLevel
    ) {
        return new DungeonRoomCluster(
                clusterId,
                mapId,
                name,
                center,
                floorMap,
                nextBoundariesByLevel);
    }

    static DungeonRoomCluster fromCore(
            RoomCluster cluster,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return new DungeonRoomCluster(
                cluster.clusterId(),
                cluster.mapId(),
                "",
                cluster.center(),
                cluster.floorMap(),
                boundariesByLevel);
    }

    public DungeonRoomCluster withName(String nextName) {
        return new DungeonRoomCluster(
                clusterId,
                mapId,
                nextName,
                center,
                floorMap,
                boundariesByLevel);
    }

    public DungeonRoomCluster withMovedDoorBoundary(RoomClusterDoorBoundaryMove move) {
        return new RoomClusterDoorBoundaryMovement().moved(this, move);
    }

    DungeonRoomCluster movedBy(int deltaQ, int deltaR, int deltaLevel) {
        return new DungeonRoomCluster(
                clusterId,
                mapId,
                name,
                new Cell(center.q() + deltaQ, center.r() + deltaR, center.level() + deltaLevel),
                movedFloorMap(deltaQ, deltaR, deltaLevel),
                movedBoundariesByLevel(deltaLevel));
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonRoomCluster that
                && clusterId == that.clusterId
                && mapId == that.mapId
                && Objects.equals(name, that.name)
                && Objects.equals(center, that.center)
                && Objects.equals(floorMap, that.floorMap)
                && Objects.equals(boundariesByLevel, that.boundariesByLevel);
    }

    @Override
    public int hashCode() {
        return Objects.hash(
                clusterId,
                mapId,
                name,
                center,
                floorMap,
                boundariesByLevel);
    }

    private static List<Cell> copiedCells(List<Cell> cells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }

    private boolean keepBoundaryForTopologyWork(
            DungeonClusterBoundary boundary,
            Set<Cell> oldCells,
            Set<Cell> nextCells
    ) {
        Cell cell = boundary.absoluteCell(center);
        if (!nextCells.contains(cell)) {
            return false;
        }
        Cell neighbor = boundary.direction().neighborOf(cell);
        if (!nextCells.contains(neighbor)) {
            return true;
        }
        return boundary.isDoor() || oldCells.contains(cell) && oldCells.contains(neighbor);
    }

    private static <T> Map<Integer, List<T>> copyNestedLists(Map<Integer, List<T>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<T>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<T>> entry : source.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(entry.getKey(), List.copyOf(entry.getValue()));
            }
        }
        return Map.copyOf(result);
    }

    private Map<Integer, List<Cell>> movedCellsByLevel(
            Map<Integer, List<Cell>> cellsByLevel,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if ((deltaQ == 0 && deltaR == 0 && deltaLevel == 0) || cellsByLevel == null || cellsByLevel.isEmpty()) {
            return cellsByLevel == null ? Map.of() : cellsByLevel;
        }
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : cellsByLevel.entrySet()) {
            List<Cell> movedCells = entry.getValue().stream()
                    .filter(cell -> cell != null)
                    .map(cell -> new Cell(cell.q() + deltaQ, cell.r() + deltaR, cell.level() + deltaLevel))
                    .toList();
            result.put(entry.getKey() + deltaLevel, movedCells);
        }
        return Map.copyOf(result);
    }

    private RoomClusterFloorMap movedFloorMap(int deltaQ, int deltaR, int deltaLevel) {
        if (deltaQ == 0 && deltaR == 0 && deltaLevel == 0) {
            return floorMap;
        }
        return new RoomClusterFloorMap(movedCellsByLevel(floorMap.cellsByLevel(), deltaQ, deltaR, deltaLevel));
    }

    private Map<Integer, List<DungeonClusterBoundary>> movedBoundariesByLevel(int deltaLevel) {
        if (deltaLevel == 0 || boundariesByLevel.isEmpty()) {
            return boundariesByLevel;
        }
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : boundariesByLevel.entrySet()) {
            List<DungeonClusterBoundary> movedBoundaries = new ArrayList<>();
            for (DungeonClusterBoundary boundary : entry.getValue()) {
                if (boundary != null) {
                    movedBoundaries.add(new DungeonClusterBoundary(
                            boundary.clusterId(),
                            boundary.level() + deltaLevel,
                            new Cell(
                                    boundary.relativeCell().q(),
                                    boundary.relativeCell().r(),
                                    boundary.relativeCell().level() + deltaLevel),
                            boundary.direction(),
                            boundary.kind(),
                            boundary.topologyRef()));
                }
            }
            result.put(entry.getKey() + deltaLevel, List.copyOf(movedBoundaries));
        }
        return Map.copyOf(result);
    }

    RoomClusterBoundarySnapshot boundarySnapshot() {
        return new RoomClusterBoundarySnapshot(center, boundariesByLevel);
    }

    private static String defaultName(long clusterId, String name) {
        return name == null || name.isBlank() ? "Cluster " + clusterId : name.trim();
    }
}
