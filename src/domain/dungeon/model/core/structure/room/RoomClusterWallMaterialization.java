package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

final class RoomClusterWallMaterialization {
    private static final int TOUCHING_CELL_COUNT = 2;
    private static final int MINIMUM_INSIDE_CELL_COUNT = 1;
    private static final int MAXIMUM_STANDARD_INSIDE_CELL_COUNT = 2;
    private static final int OPEN_INSIDE_CELL_COUNT = 1;

    private RoomClusterWallMaterialization() {
    }

    static @Nullable BoundaryRow materializeRow(
            Iterable<Cell> clusterCells,
            @Nullable Cell center,
            long clusterId,
            @Nullable Edge edge,
            @Nullable BoundaryKind kind
    ) {
        return materializeRowFromCells(normalizedCells(clusterCells), center, clusterId, edge, kind);
    }

    static @Nullable BoundaryRow materializeRowFromCells(
            Set<Cell> clusterCells,
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

    private static Set<Cell> normalizedCells(Set<Cell> cells) {
        return cells == null ? Set.of() : cells;
    }

    private static @Nullable Direction directionFrom(Cell cell, Edge edge) {
        EdgeKey key = EdgeKey.from(edge);
        for (Direction direction : Direction.values()) {
            if (EdgeKey.from(Edge.sideOf(cell, direction)).equals(key)) {
                return direction;
            }
        }
        return null;
    }
}
