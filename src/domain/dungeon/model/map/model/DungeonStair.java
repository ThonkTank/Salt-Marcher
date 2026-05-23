package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;

public final class DungeonStair {

    private final long stairId;
    private final long mapId;
    private final String name;
    private final Geometry geometry;

    public DungeonStair(
            long stairId,
            long mapId,
            String name,
            Geometry geometry
    ) {
        this.stairId = stairId;
        this.mapId = mapId;
        this.name = name == null || name.isBlank() ? "Treppe " + stairId : name.trim();
        this.geometry = geometry == null ? Geometry.empty() : geometry;
    }

    public long stairId() {
        return stairId;
    }

    public long mapId() {
        return mapId;
    }

    public String name() {
        return name;
    }

    public DungeonStairShape shape() {
        return geometry.shape();
    }

    public DungeonEdgeDirection direction() {
        return geometry.direction();
    }

    public int dimension1() {
        return geometry.dimension1();
    }

    public int dimension2() {
        return geometry.dimension2();
    }

    public List<DungeonCell> path() {
        return geometry.path();
    }

    public List<DungeonStairExit> exits() {
        return geometry.exits();
    }

    public @Nullable Long corridorId() {
        return geometry.corridorId();
    }

    public Set<DungeonCell> occupiedCells() {
        Set<DungeonCell> result = new LinkedHashSet<>(path());
        for (DungeonStairExit exit : exits()) {
            result.add(exit.position());
        }
        return Set.copyOf(result);
    }

    public Set<Integer> reachableLevels() {
        Set<Integer> result = new LinkedHashSet<>();
        for (DungeonCell cell : occupiedCells()) {
            if (cell != null) {
                result.add(cell.level());
            }
        }
        return Set.copyOf(result);
    }

    public List<DungeonStairExit> exitsAtLevel(int level) {
        List<DungeonStairExit> result = new ArrayList<>();
        for (DungeonStairExit exit : exits()) {
            if (exit != null && exit.position().level() == level) {
                result.add(exit);
            }
        }
        return List.copyOf(result);
    }

    public boolean isReadable() {
        return !occupiedCells().isEmpty();
    }

    public DungeonStair withCorridorId(@Nullable Long nextCorridorId) {
        return new DungeonStair(
                stairId,
                mapId,
                name,
                new Geometry(
                        shape(),
                        direction(),
                        dimension1(),
                        dimension2(),
                        path(),
                        exits(),
                        nextCorridorId));
    }

    public record Geometry(
            DungeonStairShape shape,
            DungeonEdgeDirection direction,
            int dimension1,
            int dimension2,
            List<DungeonCell> path,
            List<DungeonStairExit> exits,
            @Nullable Long corridorId
    ) {
        public Geometry {
            shape = shape == null ? DungeonStairShape.defaultShape() : shape;
            direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
            path = sortedUniquePath(path);
            exits = sortedExits(exits);
            corridorId = positiveCorridorId(corridorId);
        }

        @Override
        public List<DungeonCell> path() {
            return List.copyOf(path);
        }

        @Override
        public List<DungeonStairExit> exits() {
            return List.copyOf(exits);
        }

        static Geometry empty() {
            return new Geometry(
                    DungeonStairShape.defaultShape(),
                    DungeonEdgeDirection.NORTH,
                    0,
                    0,
                    List.of(),
                    List.of(),
                    null);
        }

        private static @Nullable Long positiveCorridorId(@Nullable Long corridorId) {
            if (corridorId == null || corridorId <= 0L) {
                return null;
            }
            return corridorId;
        }

        private static List<DungeonCell> sortedUniquePath(List<DungeonCell> source) {
            return DungeonCellOrdering.sortedCells(source);
        }

        private static List<DungeonStairExit> sortedExits(List<DungeonStairExit> source) {
            List<DungeonStairExit> result = new ArrayList<>();
            for (DungeonStairExit exit : source == null ? List.<DungeonStairExit>of() : source) {
                if (exit != null) {
                    result.add(exit);
                }
            }
            result.sort(Geometry::compareStairExits);
            return List.copyOf(result);
        }

        private static int compareStairExits(DungeonStairExit left, DungeonStairExit right) {
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
    }
}
