package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;

public final class RoomClusterBoundaryMaterialization {
    private static final int TOUCHING_CELL_COUNT = 2;
    private static final int MINIMUM_INSIDE_CELL_COUNT = 1;
    private static final int MAXIMUM_STANDARD_INSIDE_CELL_COUNT = 2;
    private static final int OPEN_INSIDE_CELL_COUNT = 1;

    private RoomClusterBoundaryMaterialization() {
    }

    public static @Nullable BoundaryRow forEdge(
            Iterable<Cell> clusterCells,
            @Nullable Cell center,
            long clusterId,
            @Nullable Edge edge,
            @Nullable BoundaryKind kind
    ) {
        if (center == null || edge == null || kind == null) {
            return null;
        }
        List<Cell> touchingCells = RoomClusterCells.sortedCells(edge.touchingCells());
        if (invalidTouchingCells(touchingCells)) {
            return null;
        }
        List<Cell> insideCells = insideCells(touchingCells, normalizedCells(clusterCells));
        if (unsupportedBoundaryKind(kind, insideCells.size())) {
            return null;
        }
        Cell baseCell = insideCells.getFirst();
        Direction direction = directionFrom(baseCell, edge);
        if (direction == null) {
            return null;
        }
        return new BoundaryRow(
                clusterId,
                baseCell.level(),
                new Cell(baseCell.q() - center.q(), baseCell.r() - center.r(), baseCell.level()),
                direction,
                kind);
    }

    public static @Nullable BoundaryRow openForEdge(
            Iterable<Cell> clusterCells,
            @Nullable Cell center,
            long clusterId,
            @Nullable Edge edge
    ) {
        return forEdge(clusterCells, center, clusterId, edge, BoundaryKind.OPEN);
    }

    private static boolean invalidTouchingCells(List<Cell> touchingCells) {
        return touchingCells.size() != TOUCHING_CELL_COUNT
                || touchingCells.getFirst().level() != touchingCells.get(1).level();
    }

    private static boolean unsupportedBoundaryKind(BoundaryKind kind, int insideCellCount) {
        return switch (kind) {
            case WALL, DOOR -> insideCellCount < MINIMUM_INSIDE_CELL_COUNT
                    || insideCellCount > MAXIMUM_STANDARD_INSIDE_CELL_COUNT;
            case OPEN -> insideCellCount != OPEN_INSIDE_CELL_COUNT;
        };
    }

    private static List<Cell> insideCells(List<Cell> touchingCells, Set<Cell> clusterCells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : touchingCells) {
            if (clusterCells.contains(cell)) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }

    private static Set<Cell> normalizedCells(Iterable<Cell> cells) {
        Set<Cell> result = new LinkedHashSet<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return Set.copyOf(result);
    }

    private static @Nullable Direction directionFrom(Cell cell, Edge edge) {
        BoundaryEdgeKey key = BoundaryEdgeKey.from(edge);
        for (Direction direction : Direction.values()) {
            if (BoundaryEdgeKey.from(Edge.sideOf(cell, direction)).equals(key)) {
                return direction;
            }
        }
        return null;
    }

    public enum BoundaryKind {
        WALL,
        DOOR,
        OPEN
    }

    public record BoundaryRow(
            long clusterId,
            int level,
            Cell relativeCell,
            Direction direction,
            BoundaryKind kind
    ) {
        public BoundaryRow {
            Objects.requireNonNull(relativeCell);
            Objects.requireNonNull(direction);
            Objects.requireNonNull(kind);
        }
    }

    private record BoundaryEdgeKey(Cell lower, Cell upper) {

        private static BoundaryEdgeKey from(Edge edge) {
            Cell from = edge.from();
            Cell to = edge.to();
            return CellOrdering.compareCells(from, to) <= 0
                    ? new BoundaryEdgeKey(from, to)
                    : new BoundaryEdgeKey(to, from);
        }
    }
}
