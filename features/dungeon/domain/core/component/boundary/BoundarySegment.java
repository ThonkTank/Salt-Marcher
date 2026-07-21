package features.dungeon.domain.core.component.boundary;

import java.util.Objects;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record BoundarySegment(
        EdgeKey edgeKey,
        BoundaryKind kind,
        DungeonTopologyRef topologyRef
) {
    public BoundarySegment(EdgeKey edgeKey, BoundaryKind kind) {
        this(edgeKey, kind, DungeonTopologyRef.empty());
    }

    public BoundarySegment {
        Objects.requireNonNull(edgeKey);
        kind = kind == null ? BoundaryKind.WALL : kind;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public static BoundarySegment fromEdge(
            Edge edge,
            BoundaryKind kind,
            DungeonTopologyRef topologyRef
    ) {
        return new BoundarySegment(EdgeKey.from(Objects.requireNonNull(edge)), kind, topologyRef);
    }

    public Edge edge() {
        return new Edge(edgeKey.lower(), edgeKey.upper());
    }

    public int level() {
        return edgeKey.lower().level();
    }

    public boolean isDoor() {
        return kind == BoundaryKind.DOOR;
    }

    public boolean isOpen() {
        return kind == BoundaryKind.OPEN;
    }

    public boolean matches(Edge candidate) {
        return candidate != null && DungeonBoundaryKey.from(edge()).equals(DungeonBoundaryKey.from(candidate));
    }

    public DungeonTopologyRef resolvedTopologyRef() {
        if (isOpen()) {
            return DungeonTopologyRef.empty();
        }
        if (topologyRef.present()) {
            return topologyRef;
        }
        long boundaryId = edgeKey.stableId();
        return isDoor() ? DungeonTopologyRef.door(boundaryId) : DungeonTopologyRef.wall(boundaryId);
    }

    public BoundarySegment movedBy(int deltaQ, int deltaR, int deltaLevel) {
        return new BoundarySegment(
                new EdgeKey(
                        moved(edgeKey.lower(), deltaQ, deltaR, deltaLevel),
                        moved(edgeKey.upper(), deltaQ, deltaR, deltaLevel)),
                kind,
                topologyRef);
    }

    public static Map<Integer, List<BoundarySegment>> orderedByLevel(Iterable<BoundarySegment> boundaries) {
        Map<Integer, List<BoundarySegment>> mutable = new LinkedHashMap<>();
        for (BoundarySegment boundary : new BoundaryMap(boundaries).segments()) {
            mutable.computeIfAbsent(boundary.level(), ignored -> new ArrayList<>()).add(boundary);
        }
        Map<Integer, List<BoundarySegment>> result = new LinkedHashMap<>();
        mutable.forEach((level, levelBoundaries) -> result.put(level, List.copyOf(levelBoundaries)));
        return Map.copyOf(result);
    }

    private static Cell moved(Cell cell, int deltaQ, int deltaR, int deltaLevel) {
        return new Cell(cell.q() + deltaQ, cell.r() + deltaR, cell.level() + deltaLevel);
    }
}
