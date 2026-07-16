package features.dungeon.domain.core.structure.corridor;

import features.dungeon.domain.core.geometry.Cell;

record CorridorHostEndpoint(
        boolean door,
        long roomId,
        long hostCorridorId,
        Cell corridorCell
) {
}
