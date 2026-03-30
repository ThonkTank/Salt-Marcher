package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.Objects;

public record CorridorEndpointPlan(
        CorridorTerminal terminal,
        Long roomId,
        CubePoint roomCell,
        CubePoint adjacentCell
) {
    public CorridorEndpointPlan {
        terminal = Objects.requireNonNull(terminal, "terminal");
        roomId = Objects.requireNonNull(roomId, "roomId");
        roomCell = Objects.requireNonNull(roomCell, "roomCell");
        adjacentCell = Objects.requireNonNull(adjacentCell, "adjacentCell");
        if (roomCell.z() != adjacentCell.z()) {
            throw new IllegalArgumentException("Corridor endpoint plan cells must share the same level");
        }
        int distance = Math.abs(roomCell.x() - adjacentCell.x()) + Math.abs(roomCell.y() - adjacentCell.y());
        if (distance != 1) {
            throw new IllegalArgumentException("Corridor endpoint plan cells must be cardinally adjacent");
        }
    }
}
