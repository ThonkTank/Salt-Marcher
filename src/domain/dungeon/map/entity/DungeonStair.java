package src.domain.dungeon.map.entity;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonStairExit;
import src.domain.dungeon.map.value.DungeonStairShape;

import java.util.List;

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
            shape = shape == null ? DungeonStairShape.LADDER : shape;
            direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
            path = (path == null ? List.<DungeonCell>of() : path).stream()
                    .filter(cell -> cell != null)
                    .distinct()
                    .sorted(java.util.Comparator
                            .comparingInt(DungeonCell::level)
                            .thenComparingInt(DungeonCell::r)
                            .thenComparingInt(DungeonCell::q))
                    .toList();
            exits = (exits == null ? List.<DungeonStairExit>of() : exits).stream()
                    .filter(exit -> exit != null)
                    .sorted(java.util.Comparator
                            .comparingInt((DungeonStairExit exit) -> exit.position().level())
                            .thenComparingInt(exit -> exit.position().r())
                            .thenComparingInt(exit -> exit.position().q())
                            .thenComparingLong(DungeonStairExit::exitId))
                    .toList();
            corridorId = positiveCorridorId(corridorId);
        }

        static Geometry empty() {
            return new Geometry(
                    DungeonStairShape.LADDER,
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
    }
}
