package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

public record CorridorEndpointPlan(
        CorridorTerminal terminal,
        Long roomId,
        CubePoint roomCell,
        CubePoint adjacentCell
) {
    public static CorridorEndpointPlan fromOccupiedCells(
            CorridorTerminal terminal,
            Long roomId,
            Collection<CubePoint> occupiedCells,
            CubePoint adjacentCell
    ) {
        if (terminal == null || roomId == null || adjacentCell == null) {
            return null;
        }
        for (CubePoint occupiedCell : occupiedCells == null ? Set.<CubePoint>of() : new LinkedHashSet<>(occupiedCells)) {
            if (occupiedCell == null || occupiedCell.z() != adjacentCell.z()) {
                continue;
            }
            int deltaX = adjacentCell.x() - occupiedCell.x();
            int deltaY = adjacentCell.y() - occupiedCell.y();
            if (Math.abs(deltaX) + Math.abs(deltaY) == 1) {
                return new CorridorEndpointPlan(terminal, roomId, occupiedCell, adjacentCell);
            }
        }
        return null;
    }

    public CorridorEndpointPlan {
        terminal = Objects.requireNonNull(terminal, "terminal");
        roomId = Objects.requireNonNull(roomId, "roomId");
        roomCell = Objects.requireNonNull(roomCell, "roomCell");
        adjacentCell = Objects.requireNonNull(adjacentCell, "adjacentCell");
        boundaryEdge();
    }

    public VertexEdge boundaryEdge() {
        if (roomCell.z() != adjacentCell.z()) {
            throw new IllegalArgumentException("Corridor endpoint plan cells must share the same level");
        }
        Point2i step = new Point2i(adjacentCell.x() - roomCell.x(), adjacentCell.y() - roomCell.y());
        if (Math.abs(step.x()) + Math.abs(step.y()) != 1) {
            throw new IllegalArgumentException("Corridor endpoint plan cells must be cardinally adjacent");
        }
        return VertexEdge.betweenCellAndStep(roomCell.projectedCell(), step);
    }
}
