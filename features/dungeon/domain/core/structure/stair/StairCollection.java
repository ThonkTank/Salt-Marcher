package features.dungeon.domain.core.structure.stair;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;

public record StairCollection(List<Stair> stairs) {
    private static final long NO_CORRIDOR_ID = 0L;
    private static final long NO_STAIR_ID = 0L;

    public StairCollection {
        stairs = nonNullStairs(stairs);
    }

    @Override
    public List<Stair> stairs() {
        return List.copyOf(stairs);
    }

    public boolean canDeleteUnboundStair(long stairId) {
        Stair stair = stairById(stairId);
        return stair != null && stair.corridorId() == null;
    }

    public StairCollection withoutUnboundStair(long stairId) {
        if (!canDeleteUnboundStair(stairId)) {
            return this;
        }
        List<Stair> result = new ArrayList<>();
        for (Stair stair : stairs) {
            if (stair.stairId() != stairId) {
                result.add(stair);
            }
        }
        return new StairCollection(result);
    }

    public StairCollection withoutCorridorBoundStairs(long corridorId) {
        if (corridorId <= NO_CORRIDOR_ID) {
            return this;
        }
        List<Stair> result = new ArrayList<>();
        for (Stair stair : stairs) {
            if (stair.corridorId() == null || stair.corridorId() != corridorId) {
                result.add(stair);
            }
        }
        return new StairCollection(result);
    }

    public boolean corridorBoundStairExists(long corridorId) {
        if (corridorId <= NO_CORRIDOR_ID) {
            return false;
        }
        for (Stair stair : stairs) {
            if (stair.corridorId() != null && stair.corridorId() == corridorId) {
                return true;
            }
        }
        return false;
    }

    public boolean canCreateCorridorBoundStair(
            long stairId,
            long mapId,
            long corridorId,
            @Nullable List<Cell> path,
            @Nullable Cell upperExit
    ) {
        return stairId > NO_STAIR_ID
                && mapId > 0L
                && corridorId > NO_CORRIDOR_ID
                && upperExit != null
                && hasValidCorridorPath(path, upperExit)
                && !corridorBoundStairExists(corridorId);
    }

    public StairCollection withCorridorBoundStair(
            long stairId,
            long mapId,
            long corridorId,
            @Nullable List<Cell> path,
            @Nullable Cell upperExit
    ) {
        if (!canCreateCorridorBoundStair(stairId, mapId, corridorId, path, upperExit) || path == null) {
            return this;
        }
        List<Stair> result = new ArrayList<>(stairs);
        result.add(Stair.corridorBound(stairId, mapId, corridorId, path, upperExit));
        return new StairCollection(result);
    }

    public boolean canCreateAuthoredStair(
            long stairId,
            long mapId,
            @Nullable StairGeometrySpec spec,
            @Nullable Set<Cell> roomCells
    ) {
        return stairId > NO_STAIR_ID
                && mapId > 0L
                && canCreateAuthoredStairGeometry(spec, roomCells);
    }

    public boolean canCreateAuthoredStairGeometry(
            @Nullable StairGeometrySpec spec,
            @Nullable Set<Cell> roomCells
    ) {
        return supportedAuthoredSpec(spec) && spec.avoidsRoomInteriors(roomCells);
    }

    public StairCollection withAuthoredStair(
            long stairId,
            long mapId,
            @Nullable StairGeometrySpec spec,
            @Nullable Set<Cell> roomCells
    ) {
        if (!canCreateAuthoredStair(stairId, mapId, spec, roomCells)) {
            return this;
        }
        List<Stair> result = new ArrayList<>(stairs);
        result.add(Stair.authored(stairId, mapId, spec));
        return new StairCollection(result);
    }

    public boolean canRecomputeStair(
            long stairId,
            @Nullable StairGeometrySpec spec,
            @Nullable Set<Cell> roomCells
    ) {
        return stairId > NO_STAIR_ID
                && supportedAuthoredSpec(spec)
                && canRecompute(stairById(stairId))
                && spec.avoidsRoomInteriors(roomCells);
    }

    public boolean canRecomputeAuthoredStair(
            long stairId,
            @Nullable StairGeometrySpec spec,
            @Nullable Set<Cell> roomCells
    ) {
        return canRecomputeStair(stairId, spec, roomCells);
    }

    public StairCollection withRecomputedStair(
            long stairId,
            @Nullable StairGeometrySpec spec,
            @Nullable Set<Cell> roomCells
    ) {
        if (!canRecomputeStair(stairId, spec, roomCells)) {
            return this;
        }
        List<Stair> result = new ArrayList<>();
        for (Stair stair : stairs) {
            result.add(stair.stairId() == stairId ? stair.withRecomputedGeometry(spec) : stair);
        }
        return new StairCollection(result);
    }

    public StairCollection withRecomputedAuthoredStair(
            long stairId,
            @Nullable StairGeometrySpec spec,
            @Nullable Set<Cell> roomCells
    ) {
        return withRecomputedStair(stairId, spec, roomCells);
    }

    public StairCollection withMovedHandle(long stairId, int handleIndex, int deltaQ, int deltaR, int deltaLevel) {
        if (stairId <= NO_STAIR_ID) {
            return this;
        }
        List<Stair> movedStairs = new ArrayList<>();
        boolean changed = false;
        for (Stair stair : stairs) {
            if (stair.stairId() != stairId) {
                movedStairs.add(stair);
                continue;
            }
            Stair movedStair = stair.withMovedHandle(handleIndex, deltaQ, deltaR, deltaLevel);
            changed = changed || !movedStair.equals(stair);
            movedStairs.add(movedStair);
        }
        return changed ? new StairCollection(movedStairs) : this;
    }

    public @Nullable Cell anchorOf(long stairId) {
        return anchorOf(stairById(stairId));
    }

    private @Nullable Stair stairById(long stairId) {
        if (stairId <= NO_STAIR_ID) {
            return null;
        }
        for (Stair stair : stairs) {
            if (stair.stairId() == stairId) {
                return stair;
            }
        }
        return null;
    }

    private static boolean supportedAuthoredSpec(@Nullable StairGeometrySpec spec) {
        return spec != null && spec.shape().supportsEditorDimensions(spec.dimension1(), spec.dimension2());
    }

    private static boolean canRecompute(@Nullable Stair stair) {
        return stair != null && stair.corridorId() == null && anchorOf(stair) != null;
    }

    private static @Nullable Cell anchorOf(@Nullable Stair stair) {
        if (stair == null) {
            return null;
        }
        Cell result = lowestExit(stair.exits());
        return result == null && !stair.path().isEmpty() ? stair.path().getFirst() : result;
    }

    private static @Nullable Cell lowestExit(List<StairExit> exits) {
        Cell result = null;
        for (StairExit exit : exits) {
            Cell position = exit.position();
            if (result == null || position.level() < result.level()) {
                result = position;
            }
        }
        return result;
    }

    private static boolean hasValidCorridorPath(@Nullable List<Cell> path, Cell upperExit) {
        if (path == null || path.isEmpty()) {
            return false;
        }
        for (Cell cell : path) {
            if (cell == null) {
                return false;
            }
        }
        return Math.abs(upperExit.level() - path.getFirst().level()) > 0;
    }

    private static List<Stair> nonNullStairs(List<Stair> source) {
        List<Stair> result = new ArrayList<>();
        for (Stair stair : source == null ? List.<Stair>of() : source) {
            if (stair != null) {
                result.add(stair);
            }
        }
        return List.copyOf(result);
    }
}
