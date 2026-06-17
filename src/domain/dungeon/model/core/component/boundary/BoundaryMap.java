package src.domain.dungeon.model.core.component.boundary;

import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;

public final class BoundaryMap {
    private final Map<EdgeKey, BoundarySegment> segmentsByKey;

    public BoundaryMap(Iterable<BoundarySegment> segments) {
        this.segmentsByKey = BoundaryMaps.copySegmentsByKey(normalizedSegments(segments));
    }

    public List<WallRun> wallRunsAt(int level) {
        return WallRunDerivation.wallRunsAt(segmentsByKey, level);
    }

    public List<BoundaryCorner> boundaryCornersAt(int level) {
        return BoundaryCornerDerivation.boundaryCornersAt(segmentsByKey, level);
    }

    public List<EdgeKey> adjacentWallRunEdgeKeys(Cell corner, boolean vertical) {
        return AdjacentWallRunEdgeKeyDerivation.adjacentWallRunEdgeKeys(segmentsByKey, corner, vertical);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof BoundaryMap that
                && segmentsByKey.equals(that.segmentsByKey);
    }

    @Override
    public int hashCode() {
        return Objects.hash(segmentsByKey);
    }

    private static Map<EdgeKey, BoundarySegment> normalizedSegments(Iterable<BoundarySegment> segments) {
        Map<EdgeKey, BoundarySegment> result = new LinkedHashMap<>();
        for (BoundarySegment segment : BoundaryMaps.sortedSegments(segments)) {
            result.putIfAbsent(segment.edgeKey(), segment);
        }
        return result;
    }

    static int compareSegments(BoundarySegment left, BoundarySegment right) {
        int edgeComparison = CellOrdering.compareCells(left.edgeKey().lower(), right.edgeKey().lower());
        if (edgeComparison != 0) {
            return edgeComparison;
        }
        edgeComparison = CellOrdering.compareCells(left.edgeKey().upper(), right.edgeKey().upper());
        if (edgeComparison != 0) {
            return edgeComparison;
        }
        return Integer.compare(
                switch (left.kind()) {
                    case DOOR -> 0;
                    case OPEN -> 1;
                    case WALL -> 2;
                },
                switch (right.kind()) {
                    case DOOR -> 0;
                    case OPEN -> 1;
                    case WALL -> 2;
                });
    }

    private static final class WallRunDerivation {
        private static final int MINIMUM_WALL_RUN_LENGTH = 2;

        private static List<WallRun> wallRunsAt(Map<EdgeKey, BoundarySegment> segmentsByKey, int level) {
            Map<RunKey, List<WallSegment>> segmentsByRunLine = new LinkedHashMap<>();
            for (BoundarySegment segment : segmentsByKey.values()) {
                addWallSegment(segmentsByRunLine, segment, level);
            }
            Set<Cell> splitVertices = splitVertices(segmentsByKey, level);
            List<WallRun> result = new ArrayList<>();
            for (List<WallSegment> runLine : segmentsByRunLine.values()) {
                runLine.sort(Comparator.comparingInt(WallSegment::start));
                appendRunLine(result, runLine, splitVertices);
            }
            return List.copyOf(result);
        }

        private static void addWallSegment(
                Map<RunKey, List<WallSegment>> segmentsByRunLine,
                BoundarySegment segment,
                int level
        ) {
            if (segment == null || !BoundaryKind.wall().equals(segment.kind())) {
                return;
            }
            EdgeKey key = segment.edgeKey();
            Cell lower = key.lower();
            Cell upper = key.upper();
            if (lower == null || upper == null || lower.level() != level || upper.level() != level) {
                return;
            }
            if (lower.r() == upper.r()) {
                appendSegment(
                        segmentsByRunLine,
                        new WallSegment(
                                key,
                                new RunKey(level, true, lower.r()),
                                Math.min(lower.q(), upper.q()),
                                Math.max(lower.q(), upper.q())));
            } else if (lower.q() == upper.q()) {
                appendSegment(
                        segmentsByRunLine,
                        new WallSegment(
                                key,
                                new RunKey(level, false, lower.q()),
                                Math.min(lower.r(), upper.r()),
                                Math.max(lower.r(), upper.r())));
            }
        }

        private static void appendSegment(
                Map<RunKey, List<WallSegment>> segmentsByRunLine,
                WallSegment segment
        ) {
            segmentsByRunLine.computeIfAbsent(segment.runKey(), ignored -> new ArrayList<>()).add(segment);
        }

        private static void appendRunLine(
                List<WallRun> result,
                List<WallSegment> runLine,
                Set<Cell> splitVertices
        ) {
            int start = runLine.getFirst().start();
            int end = runLine.getFirst().end();
            RunKey key = runLine.getFirst().runKey();
            List<EdgeKey> edgeKeys = new ArrayList<>(List.of(runLine.getFirst().edgeKey()));
            for (int segmentIndex = 1; segmentIndex < runLine.size(); segmentIndex++) {
                WallSegment segment = runLine.get(segmentIndex);
                if (segment.start() == end && !splitVertices.contains(vertexAt(key, end))) {
                    end = segment.end();
                    edgeKeys.add(segment.edgeKey());
                } else {
                    addWallRun(result, key, start, end, edgeKeys);
                    start = segment.start();
                    end = segment.end();
                    edgeKeys = new ArrayList<>(List.of(segment.edgeKey()));
                }
            }
            addWallRun(result, key, start, end, edgeKeys);
        }

        private static Set<Cell> splitVertices(Map<EdgeKey, BoundarySegment> segmentsByKey, int level) {
            return BoundaryCornerDerivation.cornerSetAt(segmentsByKey, level);
        }

        private static Cell vertexAt(RunKey key, int variable) {
            return key.horizontal()
                    ? new Cell(variable, key.fixed(), key.level())
                    : new Cell(key.fixed(), variable, key.level());
        }

        private static void addWallRun(List<WallRun> result, RunKey key, int start, int end, List<EdgeKey> edgeKeys) {
            if (end - start < MINIMUM_WALL_RUN_LENGTH) {
                return;
            }
            double variableMidpoint = (start + end) / 2.0;
            double midpointQ = key.horizontal() ? variableMidpoint : key.fixed();
            double midpointR = key.horizontal() ? key.fixed() : variableMidpoint;
            int midpoint = (int) Math.floor(variableMidpoint);
            Cell anchorCell = key.horizontal()
                    ? new Cell(midpoint, key.fixed(), key.level())
                    : new Cell(key.fixed(), midpoint, key.level());
            result.add(new WallRun(anchorCell, midpointQ, midpointR, edgeKeys));
        }

        private record RunKey(int level, boolean horizontal, int fixed) {
        }

        private record WallSegment(EdgeKey edgeKey, RunKey runKey, int start, int end) {
        }
    }

    private static final class BoundaryCornerDerivation {
        private static List<BoundaryCorner> boundaryCornersAt(Map<EdgeKey, BoundarySegment> segmentsByKey, int level) {
            return cornerSetAt(segmentsByKey, level).stream()
                    .sorted(CellOrdering::compareCells)
                    .map(BoundaryCorner::new)
                    .toList();
        }

        private static Set<Cell> cornerSetAt(Map<EdgeKey, BoundarySegment> segmentsByKey, int level) {
            Set<Cell> corners = new LinkedHashSet<>();
            Map<Cell, EndpointFacts> endpointFacts = new LinkedHashMap<>();
            for (BoundarySegment segment : segmentsByKey.values()) {
                recordSegmentEndpoints(endpointFacts, segment, level);
            }
            for (Map.Entry<Cell, EndpointFacts> entry : endpointFacts.entrySet()) {
                if (entry.getValue().corner()) {
                    corners.add(entry.getKey());
                }
            }
            return Set.copyOf(corners);
        }

        private static void recordSegmentEndpoints(
                Map<Cell, EndpointFacts> endpointFacts,
                BoundarySegment segment,
                int level
        ) {
            if (segment == null || !BoundaryKind.wall().equals(segment.kind())) {
                return;
            }
            EdgeKey key = segment.edgeKey();
            if (key.lower() == null || key.upper() == null || key.lower().level() != level || key.upper().level() != level) {
                return;
            }
            recordEndpoint(endpointFacts, key.lower(), key);
            recordEndpoint(endpointFacts, key.upper(), key);
        }

        private static void recordEndpoint(Map<Cell, EndpointFacts> endpointFacts, Cell endpoint, EdgeKey key) {
            EndpointFacts facts = endpointFacts.get(endpoint);
            if (facts == null) {
                facts = new EndpointFacts();
                endpointFacts.put(endpoint, facts);
            }
            facts.record(key);
        }

        private static final class EndpointFacts {
            private int edgeCount;
            private boolean horizontal;
            private boolean vertical;

            private void record(EdgeKey key) {
                edgeCount++;
                horizontal = horizontal || key.lower().r() == key.upper().r();
                vertical = vertical || key.lower().q() == key.upper().q();
            }

            private boolean corner() {
                return edgeCount != 2 || (horizontal && vertical);
            }
        }
    }

    private static final class AdjacentWallRunEdgeKeyDerivation {
        private static List<EdgeKey> adjacentWallRunEdgeKeys(
                Map<EdgeKey, BoundarySegment> segmentsByKey,
                Cell corner,
                boolean vertical
        ) {
            if (corner == null) {
                return List.of();
            }
            Map<EdgeKey, Edge> wallEdges = wallEdgesByKey(segmentsByKey, corner.level(), vertical);
            Set<Cell> splitVertices = BoundaryCornerDerivation.cornerSetAt(segmentsByKey, corner.level());
            List<Edge> adjacent = new ArrayList<>(adjacentEdges(wallEdges, corner));
            if (adjacent.isEmpty()) {
                return List.of();
            }
            adjacent.sort(Comparator.comparing(edge -> endpointCoordinate(otherEndpoint(edge, corner), vertical)));
            Set<EdgeKey> result = new LinkedHashSet<>();
            for (Edge edge : adjacent) {
                Optional<Cell> next = otherEndpoint(edge, corner);
                if (next.isEmpty()) {
                    continue;
                }
                int step = vertical
                        ? Integer.compare(next.orElseThrow().r(), corner.r())
                        : Integer.compare(next.orElseThrow().q(), corner.q());
                if (step != 0) {
                    result.addAll(contiguousEdges(wallEdges, corner, vertical, step, splitVertices));
                }
            }
            return List.copyOf(result);
        }

        private static Map<EdgeKey, Edge> wallEdgesByKey(
                Map<EdgeKey, BoundarySegment> segmentsByKey,
                int level,
                boolean vertical
        ) {
            Map<EdgeKey, Edge> result = new LinkedHashMap<>();
            for (BoundarySegment segment : segmentsByKey.values()) {
                if (segment == null || !BoundaryKind.wall().equals(segment.kind())) {
                    continue;
                }
                EdgeKey key = segment.edgeKey();
                if (key.lower() != null
                        && key.upper() != null
                        && key.lower().level() == level
                        && key.upper().level() == level
                        && vertical == (key.lower().q() == key.upper().q())) {
                    result.put(key, new Edge(key.lower(), key.upper()));
                }
            }
            return Map.copyOf(result);
        }

        private static List<Edge> adjacentEdges(Map<EdgeKey, Edge> wallEdges, Cell corner) {
            List<Edge> result = new ArrayList<>();
            for (Edge edge : wallEdges.values()) {
                if (edge.from().equals(corner) || edge.to().equals(corner)) {
                    result.add(edge);
                }
            }
            return List.copyOf(result);
        }

        private static List<EdgeKey> contiguousEdges(
                Map<EdgeKey, Edge> wallEdges,
                Cell corner,
                boolean vertical,
                int step,
                Set<Cell> splitVertices
        ) {
            List<EdgeKey> result = new ArrayList<>();
            Cell start = corner;
            while (true) {
                Cell end = vertical
                        ? new Cell(corner.q(), start.r() + step, corner.level())
                        : new Cell(start.q() + step, corner.r(), corner.level());
                EdgeKey key = new EdgeKey(start, end);
                if (!wallEdges.containsKey(key)) {
                    return List.copyOf(result);
                }
                result.add(key);
                start = end;
                if (splitVertices.contains(start)) {
                    return List.copyOf(result);
                }
            }
        }

        private static int endpointCoordinate(Optional<Cell> cell, boolean vertical) {
            Cell resolved = cell.orElseThrow();
            return vertical ? resolved.r() : resolved.q();
        }

        private static Optional<Cell> otherEndpoint(Edge edge, Cell corner) {
            if (edge.from().equals(corner)) {
                return Optional.of(edge.to());
            }
            if (edge.to().equals(corner)) {
                return Optional.of(edge.from());
            }
            return Optional.empty();
        }
    }
}
