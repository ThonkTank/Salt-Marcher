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
            if (this == VERTICAL) {
                return deltaR == 0 ? deltaQ : 0;
            }
            return deltaQ == 0 ? deltaR : 0;
        }

        public DungeonEdge move(DungeonEdge edge, int movement) {
            if (this == VERTICAL) {
                return new DungeonEdge(
                        new DungeonCell(edge.from().q() + movement, edge.from().r(), edge.from().level()),
                        new DungeonCell(edge.to().q() + movement, edge.to().r(), edge.to().level()));
            }
            return new DungeonEdge(
                    new DungeonCell(edge.from().q(), edge.from().r() + movement, edge.from().level()),
                    new DungeonCell(edge.to().q(), edge.to().r() + movement, edge.to().level()));
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
                return hasInsideCellWithColumn(touch, fixedCoordinate - 1)
                        ? WEST
                        : EAST;
            }
            return hasInsideCellWithRow(touch, fixedCoordinate - 1)
                    ? NORTH
                    : SOUTH;
        }

        private static boolean hasInsideCellWithColumn(DungeonBoundaryTouch touch, int column) {
            for (DungeonCell cell : touch.insideCells()) {
                if (cell != null && cell.q() == column) {
                    return true;
                }
            }
            return false;
        }

        private static boolean hasInsideCellWithRow(DungeonBoundaryTouch touch, int row) {
            for (DungeonCell cell : touch.insideCells()) {
                if (cell != null && cell.r() == row) {
                    return true;
                }
            }
            return false;
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
            BoundaryVertex moved = movedVertex(vertex);
            if (sameCoordinates(vertex, moved)) {
                return List.of();
            }
            List<DungeonEdge> result = new ArrayList<>();
            int step = orientation == StretchOrientation.VERTICAL
                    ? Integer.compare(moved.q(), vertex.q())
                    : Integer.compare(moved.r(), vertex.r());
            for (int offset = 0; offset != movement; offset += step) {
                result.add(connectorEdge(vertex, offset, step));
            }
            return List.copyOf(result);
        }

        private BoundaryVertex movedVertex(BoundaryVertex vertex) {
            return orientation == StretchOrientation.VERTICAL
                    ? new BoundaryVertex(vertex.q() + movement, vertex.r(), vertex.level())
                    : new BoundaryVertex(vertex.q(), vertex.r() + movement, vertex.level());
        }

        private boolean sameCoordinates(BoundaryVertex left, BoundaryVertex right) {
            return left.q() == right.q()
                    && left.r() == right.r()
                    && left.level() == right.level();
        }

        private DungeonEdge connectorEdge(BoundaryVertex vertex, int offset, int step) {
            return orientation == StretchOrientation.VERTICAL
                    ? new DungeonEdge(
                            new DungeonCell(vertex.q() + offset, vertex.r(), vertex.level()),
                            new DungeonCell(vertex.q() + offset + step, vertex.r(), vertex.level()))
                    : new DungeonEdge(
                            new DungeonCell(vertex.q(), vertex.r() + offset, vertex.level()),
                            new DungeonCell(vertex.q(), vertex.r() + offset + step, vertex.level()));
        }

        public Set<DungeonCell> stripCells() {
            Set<DungeonCell> result = new LinkedHashSet<>();
            for (int fixed = firstMovedCoordinate(); fixed < lastMovedCoordinate(); fixed++) {
                for (int variable = startVariable; variable < endVariable; variable++) {
                    result.add(stripCell(fixed, variable));
                }
            }
            return Set.copyOf(result);
        }

        private int firstMovedCoordinate() {
            return Math.min(fixedCoordinate, fixedCoordinate + movement);
        }

        private int lastMovedCoordinate() {
            return Math.max(fixedCoordinate, fixedCoordinate + movement);
        }

        private DungeonCell stripCell(int fixed, int variable) {
            return orientation == StretchOrientation.VERTICAL
                    ? new DungeonCell(fixed, variable, level)
                    : new DungeonCell(variable, fixed, level);
        }
    }

    public record StretchMutationResult(
            Map<Integer, List<DungeonCell>> cellsByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        public StretchMutationResult {
            cellsByLevel = copyListsByLevel(cellsByLevel);
            boundariesByLevel = copyListsByLevel(boundariesByLevel);
        }

        private static <T> Map<Integer, List<T>> copyListsByLevel(Map<Integer, List<T>> source) {
            Map<Integer, List<T>> result = new LinkedHashMap<>();
            for (Map.Entry<Integer, List<T>> entry
                    : (source == null ? Map.<Integer, List<T>>of() : source).entrySet()) {
                result.put(entry.getKey(), entry.getValue() == null ? List.of() : List.copyOf(entry.getValue()));
            }
            return Map.copyOf(result);
        }
    }
}
