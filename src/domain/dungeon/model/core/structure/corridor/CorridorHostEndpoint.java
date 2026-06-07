package src.domain.dungeon.model.core.structure.corridor;

import src.domain.dungeon.model.core.geometry.Cell;

record CorridorHostEndpoint(
        boolean door,
        long roomId,
        long hostCorridorId,
        Cell corridorCell
) {
}
