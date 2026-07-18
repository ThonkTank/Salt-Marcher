package features.dungeon.domain.core.structure.stair;

import features.dungeon.domain.core.geometry.Cell;
import java.util.List;
import java.util.Optional;

/** Canonical path and cross-level exit geometry for a corridor-owned stair. */
public record CorridorBoundStairGeometry(List<Cell> path, Cell upperExit) {

    public CorridorBoundStairGeometry {
        path = Stair.normalizedPath(path);
        if (path.isEmpty() || upperExit == null) {
            throw new IllegalArgumentException("corridor-bound stair geometry requires a path and upper exit");
        }
        if (path.getFirst().level() == upperExit.level()) {
            throw new IllegalArgumentException("corridor-bound stair geometry must span levels");
        }
    }

    @Override
    public List<Cell> path() {
        return List.copyOf(path);
    }

    public static Optional<CorridorBoundStairGeometry> fromRoute(
            List<Cell> routeCells,
            int targetLevel
    ) {
        List<Cell> path = Stair.normalizedPath(routeCells);
        if (path.isEmpty() || path.getFirst().level() == targetLevel) {
            return Optional.empty();
        }
        Cell terminus = path.getLast();
        return Optional.of(new CorridorBoundStairGeometry(
                path,
                new Cell(terminus.q(), terminus.r(), targetLevel)));
    }

    public Stair materialize(long stairId, long mapId, long corridorId) {
        return Stair.corridorBound(stairId, mapId, corridorId, path, upperExit);
    }
}
