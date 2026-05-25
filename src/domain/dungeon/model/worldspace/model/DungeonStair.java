package src.domain.dungeon.model.worldspace.model;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;

public record DungeonStair(
        long stairId,
        long mapId,
        String name,
        Geometry geometry
) {
    public DungeonStair {
        name = name == null || name.isBlank() ? "Treppe " + stairId : name.trim();
        geometry = geometry == null ? Geometry.empty() : geometry;
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

    public boolean isReadable() {
        return !occupiedCells().isEmpty();
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
            path = DungeonStairGeometryValues.sortedUniquePath(path);
            exits = DungeonStairGeometryValues.sortedExits(exits);
            corridorId = DungeonStairGeometryValues.positiveCorridorId(corridorId);
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
    }
}
