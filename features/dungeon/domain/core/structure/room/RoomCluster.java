package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;

/** Canonical authored cluster owner: identity, name, boundaries, and their legacy-relative origin. */
public final class RoomCluster {
    private final long clusterId;
    private final long mapId;
    private final String name;
    private final Cell center;
    private final Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel;

    private RoomCluster(
            long clusterId,
            long mapId,
            String name,
            Cell center,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        this.clusterId = Math.max(0L, clusterId);
        this.mapId = Math.max(0L, mapId);
        this.name = defaultName(clusterId, name);
        this.center = center == null ? new Cell(0, 0, 0) : center;
        this.boundariesByLevel = copyNestedLists(boundariesByLevel);
    }

    public static RoomCluster authored(
            long clusterId,
            long mapId,
            String name,
            Cell center,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return new RoomCluster(clusterId, mapId, name, center, boundariesByLevel);
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

    public RoomClusterGeometry geometry(Map<Integer, List<Cell>> cellsByLevel) {
        return new RoomClusterGeometry(
                clusterId,
                mapId,
                center,
                new RoomClusterFloorMap(cellsByLevel));
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
            Map<Integer, List<Cell>> oldCellsByLevel,
            Map<Integer, List<Cell>> nextCellsByLevel
    ) {
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        Map<Integer, List<Cell>> copiedOldCellsByLevel = copyNestedLists(oldCellsByLevel);
        Map<Integer, List<Cell>> copiedNextCellsByLevel = copyNestedLists(nextCellsByLevel);
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : boundariesByLevel.entrySet()) {
            Set<Cell> oldCells = Set.copyOf(copiedOldCellsByLevel.getOrDefault(entry.getKey(), List.of()));
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

    RoomCluster rebuiltForTopologyWork(
            Map<Integer, List<Cell>> ignoredCellsByLevel,
            Map<Integer, List<DungeonClusterBoundary>> nextBoundariesByLevel
    ) {
        return new RoomCluster(clusterId, mapId, name, center, nextBoundariesByLevel);
    }

    RoomCluster withAuthoredBoundaries(
            Map<Integer, List<DungeonClusterBoundary>> nextBoundariesByLevel
    ) {
        return new RoomCluster(clusterId, mapId, name, center, nextBoundariesByLevel);
    }

    public RoomCluster withName(String nextName) {
        return new RoomCluster(clusterId, mapId, nextName, center, boundariesByLevel);
    }

    public RoomCluster withMovedDoorBoundary(RoomClusterDoorBoundaryMove move) {
        return new RoomClusterDoorBoundaryMovement().moved(this, move);
    }

    /** Materializes stable topology refs for newly authored non-open boundaries. */
    public RoomCluster withResolvedBoundaryTopologyRefs() {
        Map<Integer, List<DungeonClusterBoundary>> resolved = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : boundariesByLevel.entrySet()) {
            List<DungeonClusterBoundary> boundaries = new ArrayList<>();
            for (DungeonClusterBoundary boundary : entry.getValue()) {
                boundaries.add(new DungeonClusterBoundary(
                        boundary.clusterId(),
                        boundary.level(),
                        boundary.relativeCell(),
                        boundary.direction(),
                        boundary.kind(),
                        boundary.resolvedTopologyRef(center)));
            }
            resolved.put(entry.getKey(), List.copyOf(boundaries));
        }
        RoomCluster result = new RoomCluster(clusterId, mapId, name, center, resolved);
        return result.equals(this) ? this : result;
    }

    RoomCluster movedBy(int deltaQ, int deltaR, int deltaLevel) {
        return new RoomCluster(
                clusterId,
                mapId,
                name,
                new Cell(center.q() + deltaQ, center.r() + deltaR, center.level() + deltaLevel),
                movedBoundariesByLevel(deltaLevel));
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof RoomCluster that
                && clusterId == that.clusterId
                && mapId == that.mapId
                && Objects.equals(name, that.name)
                && Objects.equals(center, that.center)
                && Objects.equals(boundariesByLevel, that.boundariesByLevel);
    }

    @Override
    public int hashCode() {
        return Objects.hash(clusterId, mapId, name, center, boundariesByLevel);
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
