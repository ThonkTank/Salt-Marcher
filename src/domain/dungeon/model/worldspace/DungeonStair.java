package src.domain.dungeon.model.worldspace;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairShape;

public record DungeonStair(
        long stairId,
        long mapId,
        String name,
        Geometry geometry
) {
    private static final String DEFAULT_STAIR_NAME_PREFIX = "Treppe ";

    public DungeonStair {
        name = name == null || name.isBlank() ? defaultName(stairId) : name.trim();
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
        Set<DungeonCell> result = new LinkedHashSet<>();
        for (Cell cell : core().occupiedCells()) {
            result.add(DungeonCell.fromGeometry(cell));
        }
        return Set.copyOf(result);
    }

    public boolean isReadable() {
        return core().isReadable();
    }

    DungeonStair withMovedHandle(int handleIndex, int deltaQ, int deltaR, int deltaLevel) {
        return fromCore(core().withMovedHandle(handleIndex, deltaQ, deltaR, deltaLevel));
    }

    Stair core() {
        return new Stair(
                stairId,
                mapId,
                name,
                coreShape(shape()),
                direction().geometry(),
                dimension1(),
                dimension2(),
                DungeonStairGeometryValues.coreCells(path()),
                DungeonStairGeometryValues.coreExits(exits()),
                corridorId());
    }

    static DungeonStair fromCore(Stair stair) {
        return new DungeonStair(
                stair.stairId(),
                stair.mapId(),
                stair.name(),
                new Geometry(
                        worldspaceShape(stair.shape()),
                        worldspaceDirection(stair.direction()),
                        stair.dimension1(),
                        stair.dimension2(),
                        DungeonStairGeometryValues.worldspaceCells(stair.path()),
                        DungeonStairGeometryValues.worldspaceExits(stair.exits()),
                        stair.corridorId()));
    }

    private static StairShape coreShape(DungeonStairShape shape) {
        return StairShape.parse(shape == null ? "" : shape.name());
    }

    private static DungeonStairShape worldspaceShape(StairShape shape) {
        return DungeonStairShape.parse(shape == null ? "" : shape.name());
    }

    private static DungeonEdgeDirection worldspaceDirection(Direction direction) {
        return DungeonEdgeDirection.parse(direction == null ? "" : direction.name());
    }

    private static String defaultName(long stairId) {
        return DEFAULT_STAIR_NAME_PREFIX + stairId;
    }

    private static @Nullable Long positiveCorridorId(@Nullable Long corridorId) {
        if (corridorId == null || corridorId <= 0L) {
            return null;
        }
        return corridorId;
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
            path = DungeonStairGeometryValues.uniquePath(path);
            exits = DungeonStairGeometryValues.sortedExits(exits);
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
    }
}
