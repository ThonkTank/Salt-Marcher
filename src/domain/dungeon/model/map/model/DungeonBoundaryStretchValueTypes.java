package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

public final class DungeonBoundaryStretchValueTypes {

    public enum StretchOrientation {
        HORIZONTAL,
        VERTICAL;

        public static @Nullable StretchOrientation from(@Nullable DungeonEdge edge) {
            if (edge == null || edge.from() == null || edge.to() == null) {
                return null;
            }
            if (edge.from().q() == edge.to().q()) {
                return VERTICAL;
            }
            if (edge.from().r() == edge.to().r()) {
                return HORIZONTAL;
            }
            return null;
        }

        public static @Nullable StretchOrientation from(@Nullable DungeonBoundaryKey key) {
            if (key == null) {
                return null;
            }
            return key.lower().q() == key.upper().q() ? VERTICAL : HORIZONTAL;
        }

        public boolean perpendicularTo(@Nullable StretchOrientation other) {
            return other != null && this != other;
        }

        public int fixedCoordinate(DungeonEdge edge) {
            return this == VERTICAL ? edge.from().q() : edge.from().r();
        }

        public int variableCoordinate(DungeonEdge edge) {
            return this == VERTICAL
                    ? Math.min(edge.from().r(), edge.to().r())
                    : Math.min(edge.from().q(), edge.to().q());
        }

        public int movementAlongNormal(int deltaQ, int deltaR) {
            return switch (this) {
                case VERTICAL -> deltaR == 0 ? deltaQ : 0;
                case HORIZONTAL -> deltaQ == 0 ? deltaR : 0;
            };
        }

        public DungeonEdge move(DungeonEdge edge, int movement) {
            return switch (this) {
                case VERTICAL -> new DungeonEdge(
                        new DungeonCell(edge.from().q() + movement, edge.from().r(), edge.from().level()),
                        new DungeonCell(edge.to().q() + movement, edge.to().r(), edge.to().level()));
                case HORIZONTAL -> new DungeonEdge(
                        new DungeonCell(edge.from().q(), edge.from().r() + movement, edge.from().level()),
                        new DungeonCell(edge.to().q(), edge.to().r() + movement, edge.to().level()));
            };
        }
    }

    public enum BoundarySide {
        NORTH,
        SOUTH,
        EAST,
        WEST;

        public static BoundarySide resolve(
                StretchOrientation orientation,
                DungeonBoundaryTouch touch,
                int fixedCoordinate
        ) {
            if (orientation == StretchOrientation.VERTICAL) {
                return touch.insideCells().stream().anyMatch(cell -> cell.q() == fixedCoordinate - 1)
                        ? WEST
                        : EAST;
            }
            return touch.insideCells().stream().anyMatch(cell -> cell.r() == fixedCoordinate - 1)
                    ? NORTH
                    : SOUTH;
        }
    }

    public record ConnectorAction(boolean removesBoundaries, List<DungeonEdge> path) {

        public ConnectorAction {
            path = path == null ? List.of() : List.copyOf(path);
        }
    }

    public record StretchEdge(
            DungeonEdge edge,
            DungeonBoundaryKey key,
            @Nullable DungeonClusterBoundary existing
    ) {
        public DungeonClusterBoundaryKind kind() {
            return existing == null ? DungeonClusterBoundaryKind.WALL : existing.kind();
        }
    }

    public record StretchSeed(
            int level,
            StretchOrientation orientation,
            int fixedCoordinate,
            boolean outer,
            BoundarySide side,
            Set<DungeonCell> clusterCells
    ) {
        public StretchSeed {
            clusterCells = clusterCells == null ? Set.of() : Set.copyOf(clusterCells);
        }
    }

    public static final class BoundaryVertex {
        private final int q;
        private final int r;
        private final int level;

        public BoundaryVertex(int q, int r, int level) {
            this.q = q;
            this.r = r;
            this.level = level;
        }

        public int q() {
            return q;
        }

        public int r() {
            return r;
        }

        public int level() {
            return level;
        }
    }

    public record StretchSelection(
            int level,
            StretchOrientation orientation,
            boolean outer,
            int fixedCoordinate,
            int startVariable,
            int endVariable,
            int movement,
            BoundarySide side,
            List<StretchEdge> edges,
            Set<DungeonBoundaryKey> sourceKeys
    ) {
        public StretchSelection {
            edges = edges == null ? List.of() : List.copyOf(edges);
            sourceKeys = sourceKeys == null ? Set.of() : Set.copyOf(sourceKeys);
        }

        public boolean stationary() {
            return movement == 0;
        }

        public boolean movesOutward() {
            return switch (side) {
                case WEST -> movement > 0;
                case EAST -> movement < 0;
                case NORTH -> movement > 0;
                case SOUTH -> movement < 0;
            };
        }

        public List<BoundaryVertex> vertices() {
            List<BoundaryVertex> result = new ArrayList<>();
            if (orientation == StretchOrientation.VERTICAL) {
                for (int r = startVariable; r <= endVariable; r++) {
                    result.add(new BoundaryVertex(fixedCoordinate, r, level));
                }
            } else {
                for (int q = startVariable; q <= endVariable; q++) {
                    result.add(new BoundaryVertex(q, fixedCoordinate, level));
                }
            }
            return List.copyOf(result);
        }

        public List<DungeonEdge> connectorPath(BoundaryVertex vertex) {
            BoundaryVertex moved = orientation == StretchOrientation.VERTICAL
                    ? new BoundaryVertex(vertex.q() + movement, vertex.r(), vertex.level())
                    : new BoundaryVertex(vertex.q(), vertex.r() + movement, vertex.level());
            if (vertex.equals(moved)) {
                return List.of();
            }
            List<DungeonEdge> result = new ArrayList<>();
            if (vertex.q() == moved.q()) {
                int step = Integer.compare(moved.r(), vertex.r());
                for (int r = vertex.r(); r != moved.r(); r += step) {
                    result.add(new DungeonEdge(
                            new DungeonCell(vertex.q(), r, vertex.level()),
                            new DungeonCell(vertex.q(), r + step, vertex.level())));
                }
            } else {
                int step = Integer.compare(moved.q(), vertex.q());
                for (int q = vertex.q(); q != moved.q(); q += step) {
                    result.add(new DungeonEdge(
                            new DungeonCell(q, vertex.r(), vertex.level()),
                            new DungeonCell(q + step, vertex.r(), vertex.level())));
                }
            }
            return List.copyOf(result);
        }

        public Set<DungeonCell> stripCells() {
            Set<DungeonCell> result = new LinkedHashSet<>();
            if (orientation == StretchOrientation.VERTICAL) {
                int minQ = Math.min(fixedCoordinate, fixedCoordinate + movement);
                int maxQ = Math.max(fixedCoordinate, fixedCoordinate + movement);
                for (int q = minQ; q < maxQ; q++) {
                    for (int r = startVariable; r < endVariable; r++) {
                        result.add(new DungeonCell(q, r, level));
                    }
                }
            } else {
                int minR = Math.min(fixedCoordinate, fixedCoordinate + movement);
                int maxR = Math.max(fixedCoordinate, fixedCoordinate + movement);
                for (int r = minR; r < maxR; r++) {
                    for (int q = startVariable; q < endVariable; q++) {
                        result.add(new DungeonCell(q, r, level));
                    }
                }
            }
            return Set.copyOf(result);
        }
    }

    public record StretchMutationResult(
            Map<Integer, List<DungeonCell>> cellsByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        public StretchMutationResult {
            cellsByLevel = copyCellsByLevel(cellsByLevel);
            boundariesByLevel = copyBoundariesByLevel(boundariesByLevel);
        }

        private static Map<Integer, List<DungeonCell>> copyCellsByLevel(Map<Integer, List<DungeonCell>> source) {
            Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
            for (Map.Entry<Integer, List<DungeonCell>> entry : (source == null ? Map.<Integer, List<DungeonCell>>of() : source).entrySet()) {
                result.put(entry.getKey(), entry.getValue() == null ? List.of() : List.copyOf(entry.getValue()));
            }
            return Map.copyOf(result);
        }

        private static Map<Integer, List<DungeonClusterBoundary>> copyBoundariesByLevel(
                Map<Integer, List<DungeonClusterBoundary>> source
        ) {
            Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
            for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry
                    : (source == null ? Map.<Integer, List<DungeonClusterBoundary>>of() : source).entrySet()) {
                result.put(entry.getKey(), entry.getValue() == null ? List.of() : List.copyOf(entry.getValue()));
            }
            return Map.copyOf(result);
        }
    }
}
