package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;

public record InternalBoundaryEdge(
        CellCoord cell,
        CardinalDirection direction,
        InternalBoundaryType type
) {
}
