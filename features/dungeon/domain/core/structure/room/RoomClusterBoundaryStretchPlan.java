package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

public final class RoomClusterBoundaryStretchPlan {

    private RoomClusterBoundaryStretchPlan() {
    }

    public static Optional<Selection> resolve(
            Iterable<Cell> clusterCells,
            List<Edge> sourceEdges,
            Map<EdgeKey, BoundaryRow> boundaries,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (deltaLevel != 0) {
            return Optional.empty();
        }
        Map<EdgeKey, BoundaryRow> safeBoundaries = boundaries == null ? Map.of() : boundaries;
        Optional<Seed> seed = seedForTarget(clusterCells, sourceEdges, safeBoundaries);
        if (seed.isEmpty()) {
            return Optional.empty();
        }
        List<StretchEdge> sortedEdges = sortedStretchEdges(seed.get(), sourceEdges, safeBoundaries);
        if (sortedEdges.isEmpty()) {
            return Optional.empty();
        }
        int movement = seed.get().orientation().movementAlongNormal(deltaQ, deltaR);
        if (movement == 0) {
            return Optional.empty();
        }
        int startVariable = seed.get().orientation().variableCoordinate(sortedEdges.getFirst().edge());
        Set<EdgeKey> sourceKeys = new LinkedHashSet<>();
        for (StretchEdge stretchEdge : sortedEdges) {
            sourceKeys.add(stretchEdge.key());
        }
        return Optional.of(new Selection(
                seed.get().level(),
                seed.get().orientation(),
                seed.get().outer(),
                seed.get().fixedCoordinate(),
                startVariable,
                startVariable + sortedEdges.size(),
                movement,
                seed.get().side(),
                sortedEdges,
                sourceKeys));
    }

    private static Optional<Seed> seedForTarget(
            Iterable<Cell> clusterCells,
            List<Edge> sourceEdges,
            Map<EdgeKey, BoundaryRow> boundaries
    ) {
        if (sourceEdges == null || sourceEdges.isEmpty()) {
            return Optional.empty();
        }
        Edge firstEdge = sourceEdges.getFirst();
        BoundaryStretchOrientation orientation = BoundaryStretchOrientation.from(firstEdge);
        if (orientation == null) {
            return Optional.empty();
        }
        Set<Cell> normalizedClusterCells = cellSet(clusterCells);
        if (normalizedClusterCells.isEmpty()) {
            return Optional.empty();
        }
        return stretchSeed(boundaries, firstEdge, normalizedClusterCells);
    }

    private static Optional<Seed> stretchSeed(
            Map<EdgeKey, BoundaryRow> boundaries,
            Edge edge,
            Set<Cell> clusterCells
    ) {
        BoundaryStretchOrientation orientation = BoundaryStretchOrientation.from(edge);
        if (orientation == null) {
            return Optional.empty();
        }
        int fixedCoordinate = orientation.fixedCoordinate(edge);
        BoundaryTouch touch = touch(edge, clusterCells);
        if (!touch.valid()) {
            return Optional.empty();
        }
        EdgeKey key = EdgeKey.from(edge);
        BoundaryRow existing = boundaries.get(key);
        boolean outer = touch.insideCount() == 1;
        if (!outer && existing == null) {
            return Optional.empty();
        }
        return Optional.of(new Seed(
                edge.from().level(),
                orientation,
                fixedCoordinate,
                outer,
                BoundarySide.resolve(orientation, touch, fixedCoordinate),
                clusterCells));
    }

    private static Optional<StretchEdge> matchingStretchEdge(
            Seed seed,
            Map<EdgeKey, BoundaryRow> boundaries,
            Edge edge
    ) {
        BoundaryStretchOrientation orientation = BoundaryStretchOrientation.from(edge);
        if (orientation == null || invalidEdgeForSeed(seed, edge, orientation)) {
            return Optional.empty();
        }
        BoundaryTouch touch = touch(edge, seed.clusterCells());
        if (!matchesSeedTouch(seed, orientation, touch)) {
            return Optional.empty();
        }
        EdgeKey key = EdgeKey.from(edge);
        BoundaryRow existing = boundaries.get(key);
        if (!boundaryPresenceMatches(seed, existing)) {
            return Optional.empty();
        }
        return Optional.of(new StretchEdge(edge, key, existing));
    }

    private static boolean invalidEdgeForSeed(
            Seed seed,
            Edge edge,
            BoundaryStretchOrientation orientation
    ) {
        return edge == null
                || edge.from().level() != seed.level()
                || orientation != seed.orientation()
                || orientation.fixedCoordinate(edge) != seed.fixedCoordinate();
    }

    private static boolean matchesSeedTouch(
            Seed seed,
            BoundaryStretchOrientation orientation,
            BoundaryTouch touch
    ) {
        return touch.valid()
                && seed.outer() == (touch.insideCount() == 1)
                && seed.side() == BoundarySide.resolve(orientation, touch, seed.fixedCoordinate());
    }

    private static boolean boundaryPresenceMatches(Seed seed, @Nullable BoundaryRow existing) {
        return seed.outer() || existing != null;
    }

    private static List<StretchEdge> sortedStretchEdges(
            Seed seed,
            List<Edge> sourceEdges,
            Map<EdgeKey, BoundaryRow> boundaries
    ) {
        List<StretchEdge> stretchEdges = new ArrayList<>();
        for (Edge edge : sourceEdges == null ? List.<Edge>of() : sourceEdges) {
            Optional<StretchEdge> stretchEdge = matchingStretchEdge(seed, boundaries, edge);
            if (stretchEdge.isEmpty()) {
                return List.of();
            }
            stretchEdges.add(stretchEdge.get());
        }
        List<StretchEdge> sortedEdges = new ArrayList<>(stretchEdges);
        sortedEdges.sort(Comparator.comparingInt(edge -> seed.orientation().variableCoordinate(edge.edge())));
        if (sortedEdges.isEmpty()) {
            return List.of();
        }
        int startVariable = seed.orientation().variableCoordinate(sortedEdges.getFirst().edge());
        for (int index = 0; index < sortedEdges.size(); index++) {
            if (seed.orientation().variableCoordinate(sortedEdges.get(index).edge()) != startVariable + index) {
                return List.of();
            }
        }
        return List.copyOf(sortedEdges);
    }

    private static BoundaryTouch touch(Edge edge, Set<Cell> clusterCells) {
        List<Cell> insideCells = new ArrayList<>();
        for (Cell cell : edge == null ? List.<Cell>of() : edge.touchingCells()) {
            if (clusterCells.contains(cell)) {
                insideCells.add(cell);
            }
        }
        return new BoundaryTouch(insideCells);
    }

    private static Set<Cell> cellSet(Iterable<Cell> cells) {
        Set<Cell> result = new LinkedHashSet<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return Set.copyOf(result);
    }

    public enum BoundarySide {
        NORTH,
        SOUTH,
        EAST,
        WEST;

        private static BoundarySide resolve(
                BoundaryStretchOrientation orientation,
                BoundaryTouch touch,
                int fixedCoordinate
        ) {
            if (orientation.vertical()) {
                return hasInsideCellWithColumn(touch, fixedCoordinate - 1)
                        ? WEST
                        : EAST;
            }
            return hasInsideCellWithRow(touch, fixedCoordinate - 1)
                    ? NORTH
                    : SOUTH;
        }

        private static boolean hasInsideCellWithColumn(BoundaryTouch touch, int column) {
            for (Cell cell : touch.insideCells()) {
                if (cell != null && cell.q() == column) {
                    return true;
                }
            }
            return false;
        }

        private static boolean hasInsideCellWithRow(BoundaryTouch touch, int row) {
            for (Cell cell : touch.insideCells()) {
                if (cell != null && cell.r() == row) {
                    return true;
                }
            }
            return false;
        }
    }

    public record StretchEdge(
            Edge edge,
            EdgeKey key,
            @Nullable BoundaryRow existing
    ) {
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

    public record Selection(
            int level,
            BoundaryStretchOrientation orientation,
            boolean outer,
            int fixedCoordinate,
            int startVariable,
            int endVariable,
            int movement,
            BoundarySide side,
            List<StretchEdge> edges,
            Set<EdgeKey> sourceKeys
    ) {
        public Selection {
            edges = edges == null ? List.of() : List.copyOf(edges);
            sourceKeys = sourceKeys == null
                    ? Set.of()
                    : Collections.unmodifiableSet(new LinkedHashSet<>(sourceKeys));
        }

        @Override
        public Set<EdgeKey> sourceKeys() {
            return Collections.unmodifiableSet(new LinkedHashSet<>(sourceKeys));
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
            if (orientation.vertical()) {
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

        public List<Edge> connectorPath(BoundaryVertex vertex) {
            BoundaryVertex moved = movedVertex(vertex);
            if (sameCoordinates(vertex, moved)) {
                return List.of();
            }
            List<Edge> result = new ArrayList<>();
            int step = orientation.vertical()
                    ? Integer.compare(moved.q(), vertex.q())
                    : Integer.compare(moved.r(), vertex.r());
            for (int offset = 0; offset != movement; offset += step) {
                result.add(connectorEdge(vertex, offset, step));
            }
            return List.copyOf(result);
        }

        public Set<Cell> stripCells() {
            Set<Cell> result = new LinkedHashSet<>();
            for (int fixed = firstMovedCoordinate(); fixed < lastMovedCoordinate(); fixed++) {
                for (int variable = startVariable; variable < endVariable; variable++) {
                    result.add(stripCell(fixed, variable));
                }
            }
            return Set.copyOf(result);
        }

        private BoundaryVertex movedVertex(BoundaryVertex vertex) {
            return orientation.vertical()
                    ? new BoundaryVertex(vertex.q() + movement, vertex.r(), vertex.level())
                    : new BoundaryVertex(vertex.q(), vertex.r() + movement, vertex.level());
        }

        private boolean sameCoordinates(BoundaryVertex left, BoundaryVertex right) {
            return left.q() == right.q()
                    && left.r() == right.r()
                    && left.level() == right.level();
        }

        private Edge connectorEdge(BoundaryVertex vertex, int offset, int step) {
            return orientation.vertical()
                    ? new Edge(
                    new Cell(vertex.q() + offset, vertex.r(), vertex.level()),
                    new Cell(vertex.q() + offset + step, vertex.r(), vertex.level()))
                    : new Edge(
                    new Cell(vertex.q(), vertex.r() + offset, vertex.level()),
                    new Cell(vertex.q(), vertex.r() + offset + step, vertex.level()));
        }

        private int firstMovedCoordinate() {
            return Math.min(fixedCoordinate, fixedCoordinate + movement);
        }

        private int lastMovedCoordinate() {
            return Math.max(fixedCoordinate, fixedCoordinate + movement);
        }

        private Cell stripCell(int fixed, int variable) {
            return orientation.vertical()
                    ? new Cell(fixed, variable, level)
                    : new Cell(variable, fixed, level);
        }
    }

    private record Seed(
            int level,
            BoundaryStretchOrientation orientation,
            int fixedCoordinate,
            boolean outer,
            BoundarySide side,
            Set<Cell> clusterCells
    ) {
        private Seed {
            clusterCells = clusterCells == null ? Set.of() : Set.copyOf(clusterCells);
        }
    }

    private record BoundaryTouch(List<Cell> insideCells) {

        private BoundaryTouch {
            insideCells = insideCells == null ? List.of() : List.copyOf(insideCells);
        }

        private boolean valid() {
            return insideCount() == 1 || insideCount() == 2;
        }

        private int insideCount() {
            return insideCells.size();
        }
    }
}
