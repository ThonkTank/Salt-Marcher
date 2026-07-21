package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundaryMap;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Canonical authored cluster owner: stable identity, name, and absolute boundaries. */
public final class RoomCluster {
    private final long clusterId;
    private final long mapId;
    private final String name;
    private final BoundaryMap boundaries;

    private RoomCluster(
            long clusterId,
            long mapId,
            String name,
            BoundaryMap boundaries
    ) {
        this.clusterId = Math.max(0L, clusterId);
        this.mapId = Math.max(0L, mapId);
        this.name = defaultName(clusterId, name);
        this.boundaries = boundaries == null ? new BoundaryMap(List.of()) : boundaries;
    }

    public static RoomCluster authored(
            long clusterId,
            long mapId,
            String name,
            Iterable<BoundarySegment> boundaries
    ) {
        return new RoomCluster(clusterId, mapId, name, new BoundaryMap(boundaries));
    }

    public static RoomCluster authored(
            long clusterId,
            long mapId,
            String name,
            BoundaryMap boundaries
    ) {
        return new RoomCluster(clusterId, mapId, name, boundaries);
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

    public BoundaryMap authoredBoundaries() {
        return boundaries;
    }

    public Map<DungeonBoundaryKey, BoundarySegment> boundaryMap() {
        Map<DungeonBoundaryKey, BoundarySegment> result = new LinkedHashMap<>();
        for (BoundarySegment boundary : boundaries.segments()) {
            result.putIfAbsent(DungeonBoundaryKey.from(boundary.edge()), boundary);
        }
        return Map.copyOf(result);
    }

    public List<BoundarySegment> orderedAuthoredBoundaries() {
        return boundaries.segments();
    }

    public BoundarySegment boundaryAt(Edge edge) {
        return boundaries.segmentAt(edge).orElse(null);
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
                RoomClusterCells.primaryAnchor(cellsByLevel),
                new RoomClusterFloorMap(cellsByLevel));
    }

    public List<Cell> authoredBoundaryVertices(int level) {
        return boundarySnapshot().authoredBoundaryVertices(level);
    }

    public List<RoomClusterWallRun> authoredWallRuns(int level, Iterable<Cell> memberCells) {
        return boundarySnapshot().authoredWallRuns(level, memberCells);
    }

    public List<BoundarySegment> orderedBoundariesForWriteback() {
        return boundaries.segments();
    }

    Map<Integer, List<BoundarySegment>> preservedBoundariesForTopologyWork(
            Map<Integer, List<Cell>> oldCellsByLevel,
            Map<Integer, List<Cell>> nextCellsByLevel
    ) {
        Map<Integer, List<BoundarySegment>> result = new LinkedHashMap<>();
        for (BoundarySegment boundary : boundaries.segments()) {
            int level = boundary.level();
            Set<Cell> oldCells = Set.copyOf(oldCellsByLevel.getOrDefault(level, List.of()));
            Set<Cell> nextCells = Set.copyOf(nextCellsByLevel.getOrDefault(level, List.of()));
            if (keepBoundaryForTopologyWork(boundary, oldCells, nextCells)) {
                result.computeIfAbsent(level, ignored -> new ArrayList<>()).add(boundary);
            }
        }
        Map<Integer, List<BoundarySegment>> immutable = new LinkedHashMap<>();
        result.forEach((level, levelBoundaries) -> immutable.put(level, List.copyOf(levelBoundaries)));
        return Map.copyOf(immutable);
    }

    RoomCluster rebuiltForTopologyWork(
            Map<Integer, List<Cell>> ignoredCellsByLevel,
            Map<Integer, List<BoundarySegment>> nextBoundariesByLevel
    ) {
        return withAuthoredBoundaries(flatten(nextBoundariesByLevel));
    }

    RoomCluster withAuthoredBoundaries(Map<Integer, List<BoundarySegment>> nextBoundariesByLevel) {
        return withAuthoredBoundaries(flatten(nextBoundariesByLevel));
    }

    RoomCluster withAuthoredBoundaries(Iterable<BoundarySegment> nextBoundaries) {
        return new RoomCluster(clusterId, mapId, name, new BoundaryMap(nextBoundaries));
    }

    public RoomCluster withName(String nextName) {
        return new RoomCluster(clusterId, mapId, nextName, boundaries);
    }

    public RoomCluster withMovedDoorBoundary(RoomClusterDoorBoundaryMove move) {
        return new RoomClusterDoorBoundaryMovement().moved(this, move);
    }

    /** Materializes stable topology refs for newly authored non-open boundaries. */
    public RoomCluster withResolvedBoundaryTopologyRefs() {
        List<BoundarySegment> resolved = boundaries.segments().stream()
                .map(boundary -> new BoundarySegment(
                        boundary.edgeKey(),
                        boundary.kind(),
                        boundary.resolvedTopologyRef()))
                .toList();
        RoomCluster result = withAuthoredBoundaries(resolved);
        return result.equals(this) ? this : result;
    }

    RoomCluster movedBy(int deltaQ, int deltaR, int deltaLevel) {
        return new RoomCluster(clusterId, mapId, name, boundaries.movedBy(deltaQ, deltaR, deltaLevel));
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof RoomCluster that
                && clusterId == that.clusterId
                && mapId == that.mapId
                && Objects.equals(name, that.name)
                && Objects.equals(boundaries, that.boundaries);
    }

    @Override
    public int hashCode() {
        return Objects.hash(clusterId, mapId, name, boundaries);
    }

    private static boolean keepBoundaryForTopologyWork(
            BoundarySegment boundary,
            Set<Cell> oldCells,
            Set<Cell> nextCells
    ) {
        List<Cell> touching = boundary.edge().touchingCells();
        boolean touchesNext = touching.stream().anyMatch(nextCells::contains);
        if (!touchesNext) {
            return false;
        }
        boolean insideNext = touching.stream().allMatch(nextCells::contains);
        return !insideNext || boundary.isDoor() || touching.stream().allMatch(oldCells::contains);
    }

    private RoomClusterBoundarySnapshot boundarySnapshot() {
        return new RoomClusterBoundarySnapshot(boundaries);
    }

    private static List<BoundarySegment> flatten(Map<Integer, List<BoundarySegment>> boundariesByLevel) {
        if (boundariesByLevel == null || boundariesByLevel.isEmpty()) {
            return List.of();
        }
        return boundariesByLevel.values().stream()
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .filter(Objects::nonNull)
                .toList();
    }

    private static String defaultName(long clusterId, String name) {
        return name == null || name.isBlank() ? "Cluster " + clusterId : name.trim();
    }
}
