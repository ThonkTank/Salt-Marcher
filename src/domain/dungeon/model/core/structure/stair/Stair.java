package src.domain.dungeon.model.core.structure.stair;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;

public record Stair(
        long stairId,
        long mapId,
        String name,
        StairShape shape,
        Direction direction,
        int dimension1,
        int dimension2,
        List<Cell> path,
        List<StairExit> exits,
        @Nullable Long corridorId
) {
    private static final String DEFAULT_NAME_PREFIX = "Treppe ";

    public Stair {
        stairId = Math.max(0L, stairId);
        mapId = Math.max(0L, mapId);
        name = name == null || name.isBlank() ? defaultName(stairId) : name.trim();
        shape = shape == null ? StairShape.defaultShape() : shape;
        direction = direction == null ? Direction.NORTH : direction;
        dimension1 = Math.max(0, dimension1);
        dimension2 = Math.max(0, dimension2);
        path = normalizedPath(path);
        exits = normalizedExits(exits);
        corridorId = positiveCorridorId(corridorId);
    }

    public static Stair authored(
            long stairId,
            long mapId,
            StairGeometrySpec spec
    ) {
        Objects.requireNonNull(spec);
        return new Stair(
                stairId,
                mapId,
                defaultName(stairId),
                spec.shape(),
                spec.direction(),
                spec.dimension1(),
                spec.dimension2(),
                spec.generatedPath(),
                spec.generatedExits(List.of()),
                null);
    }

    public static Stair corridorBound(
            long stairId,
            long mapId,
            long corridorId,
            List<Cell> path,
            Cell upperExit
    ) {
        if (path == null || path.isEmpty()) {
            return empty(stairId, mapId);
        }
        Cell startExit = path.getFirst();
        int levelSpan = Math.abs(upperExit.level() - startExit.level());
        return new Stair(
                stairId,
                mapId,
                defaultName(stairId),
                StairShape.STRAIGHT,
                directionForPath(startExit, path.getLast()),
                Math.max(1, path.size()),
                levelSpan,
                path,
                corridorBoundExits(startExit, upperExit),
                corridorId);
    }

    public static Stair empty(long stairId, long mapId) {
        return new Stair(
                stairId,
                mapId,
                defaultName(stairId),
                StairShape.defaultShape(),
                Direction.NORTH,
                0,
                0,
                List.of(),
                List.of(),
                null);
    }

    @Override
    public List<Cell> path() {
        return List.copyOf(path);
    }

    @Override
    public List<StairExit> exits() {
        return List.copyOf(exits);
    }

    public Set<Cell> occupiedCells() {
        Set<Cell> result = new LinkedHashSet<>(path);
        for (StairExit exit : exits) {
            result.add(exit.position());
        }
        return Set.copyOf(result);
    }

    public boolean isReadable() {
        return !path.isEmpty() && exitLevelCount() >= 2;
    }

    public Stair withRecomputedGeometry(StairGeometrySpec spec) {
        Objects.requireNonNull(spec);
        return new Stair(
                stairId,
                mapId,
                name,
                spec.shape(),
                spec.direction(),
                spec.dimension1(),
                spec.dimension2(),
                spec.generatedPath(),
                spec.generatedExits(exits),
                corridorId);
    }

    public Stair withMovedHandle(int handleIndex, int deltaQ, int deltaR, int deltaLevel) {
        if (handleIndex < 0) {
            return this;
        }
        if (handleIndex < path.size()) {
            List<Cell> movedPath = new ArrayList<>(path);
            movedPath.set(handleIndex, movedCell(path.get(handleIndex), deltaQ, deltaR, deltaLevel));
            return withPathAndExits(movedPath, exits);
        }
        int exitIndex = handleIndex - path.size();
        if (exitIndex < 0 || exitIndex >= exits.size()) {
            return this;
        }
        List<StairExit> movedExits = new ArrayList<>(exits);
        StairExit exit = exits.get(exitIndex);
        movedExits.set(exitIndex, new StairExit(
                exit.exitId(),
                movedCell(exit.position(), deltaQ, deltaR, deltaLevel),
                exit.label()));
        return withPathAndExits(path, movedExits);
    }

    private Stair withPathAndExits(List<Cell> nextPath, List<StairExit> nextExits) {
        return new Stair(
                stairId,
                mapId,
                name,
                shape,
                direction,
                dimension1,
                dimension2,
                nextPath,
                nextExits,
                corridorId);
    }

    private int exitLevelCount() {
        Set<Integer> levels = new LinkedHashSet<>();
        for (StairExit exit : exits) {
            levels.add(exit.position().level());
        }
        return levels.size();
    }

    public static List<Cell> normalizedPath(List<Cell> source) {
        Set<Cell> cells = new LinkedHashSet<>();
        for (Cell cell : source == null ? List.<Cell>of() : source) {
            if (cell != null) {
                cells.add(cell);
            }
        }
        return List.copyOf(cells);
    }

    public static List<StairExit> normalizedExits(List<StairExit> source) {
        List<StairExit> result = new ArrayList<>();
        for (StairExit exit : source == null ? List.<StairExit>of() : source) {
            if (exit != null) {
                result.add(exit);
            }
        }
        result.sort(Stair::compareStairExits);
        return List.copyOf(result);
    }

    private static int compareStairExits(StairExit left, StairExit right) {
        int levelComparison = Integer.compare(left.position().level(), right.position().level());
        if (levelComparison != 0) {
            return levelComparison;
        }
        int rowComparison = Integer.compare(left.position().r(), right.position().r());
        if (rowComparison != 0) {
            return rowComparison;
        }
        int columnComparison = Integer.compare(left.position().q(), right.position().q());
        if (columnComparison != 0) {
            return columnComparison;
        }
        return Long.compare(left.exitId(), right.exitId());
    }

    private static @Nullable Long positiveCorridorId(@Nullable Long candidate) {
        if (candidate == null || candidate <= 0L) {
            return null;
        }
        return candidate;
    }

    private static String defaultName(long stairId) {
        return DEFAULT_NAME_PREFIX + stairId;
    }

    private static Cell movedCell(Cell cell, int deltaQ, int deltaR, int deltaLevel) {
        return new Cell(cell.q() + deltaQ, cell.r() + deltaR, cell.level() + deltaLevel);
    }

    private static Direction directionForPath(Cell start, Cell end) {
        if (end.q() > start.q()) {
            return Direction.EAST;
        }
        if (end.q() < start.q()) {
            return Direction.WEST;
        }
        if (end.r() > start.r()) {
            return Direction.SOUTH;
        }
        return Direction.NORTH;
    }

    private static List<StairExit> corridorBoundExits(Cell startExit, Cell targetExit) {
        List<StairExit> result = new ArrayList<>();
        result.add(new StairExit(0L, startExit, ""));
        int levelStep = Integer.compare(targetExit.level(), startExit.level());
        for (int level = startExit.level() + levelStep; level != targetExit.level() + levelStep; level += levelStep) {
            result.add(new StairExit(
                    0L,
                    new Cell(targetExit.q(), targetExit.r(), level),
                    ""));
        }
        return List.copyOf(result);
    }
}
