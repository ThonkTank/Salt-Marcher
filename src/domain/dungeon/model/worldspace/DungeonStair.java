package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;
import src.domain.dungeon.model.core.structure.stair.StairShape;

public record DungeonStair(
        long stairId,
        long mapId,
        String name,
        Geometry geometry
) {
    private static final String DEFAULT_STAIR_NAME_PREFIX = "Treppe ";
    private static final long NO_STAIR_ID = 0L;
    private static final DungeonStairRoomCellProjection STAIR_ROOM_CELLS =
            new DungeonStairRoomCellProjection();

    public DungeonStair {
        name = name == null || name.isBlank() ? defaultName(stairId) : name.trim();
        geometry = geometry == null ? Geometry.empty() : geometry;
    }

    public DungeonStairShape shape() {
        return geometry.shape();
    }

    public Direction direction() {
        return geometry.direction();
    }

    public int dimension1() {
        return geometry.dimension1();
    }

    public int dimension2() {
        return geometry.dimension2();
    }

    public List<Cell> path() {
        return geometry.path();
    }

    public List<DungeonStairExit> exits() {
        return geometry.exits();
    }

    public @Nullable Long corridorId() {
        return geometry.corridorId();
    }

    public Set<Cell> occupiedCells() {
        Set<Cell> result = new LinkedHashSet<>();
        for (Cell cell : core().occupiedCells()) {
            result.add(cell);
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
                direction(),
                dimension1(),
                dimension2(),
                DungeonStairGeometryValues.cells(path()),
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
                        direction(stair.direction()),
                        stair.dimension1(),
                        stair.dimension2(),
                        DungeonStairGeometryValues.cells(stair.path()),
                        DungeonStairGeometryValues.worldspaceExits(stair.exits()),
                        stair.corridorId()));
    }

    static StairCollection coreCollection(List<DungeonStair> stairs) {
        List<Stair> result = new ArrayList<>();
        for (DungeonStair stair : stairs == null ? List.<DungeonStair>of() : stairs) {
            if (stair != null) {
                result.add(stair.core());
            }
        }
        return new StairCollection(result);
    }

    static List<DungeonStair> fromCoreCollection(StairCollection source) {
        List<DungeonStair> result = new ArrayList<>();
        for (Stair stair : source == null ? List.<Stair>of() : source.stairs()) {
            if (stair != null) {
                result.add(fromCore(stair));
            }
        }
        return List.copyOf(result);
    }

    static boolean canDeleteUnbound(StairCollection stairs, long stairId) {
        return normalizedCollection(stairs).canDeleteUnboundStair(stairId);
    }

    static StairCollection withoutUnbound(StairCollection stairs, long stairId) {
        return normalizedCollection(stairs).withoutUnboundStair(stairId);
    }

    static StairCollection withoutCorridorBound(StairCollection stairs, long corridorId) {
        return normalizedCollection(stairs).withoutCorridorBoundStairs(corridorId);
    }

    static boolean canCreate(
            StairCollection stairs,
            Cell anchor,
            String shapeName,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        StairGeometrySpec spec = geometrySpec(shapeName, Direction.NORTH, anchor, 0, 0, true);
        if (topology == null || rooms == null || spec == null) {
            return false;
        }
        return normalizedCollection(stairs).canCreateAuthoredStairGeometry(spec, roomCells(topology, rooms));
    }

    static StairCollection withCreated(
            StairCollection stairs,
            long stairId,
            long mapId,
            Cell anchor,
            String shapeName,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        StairGeometrySpec spec = geometrySpec(shapeName, Direction.NORTH, anchor, 0, 0, true);
        if (topology == null || rooms == null || spec == null) {
            return normalizedCollection(stairs);
        }
        return normalizedCollection(stairs).withAuthoredStair(
                stairId,
                mapId,
                spec,
                roomCells(topology, rooms));
    }

    static StairCollection withCorridorBound(
            StairCollection stairs,
            long stairId,
            long mapId,
            long corridorId,
            List<Cell> path,
            Cell upperExit
    ) {
        return normalizedCollection(stairs).withCorridorBoundStair(
                stairId,
                mapId,
                corridorId,
                DungeonStairGeometryValues.cells(path),
                upperExit == null ? null : upperExit);
    }

    static boolean canRecompute(
            StairCollection stairs,
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        Direction direction = DungeonStairGeometryValues.supportedCardinalDirection(directionName);
        Cell anchor = normalizedCollection(stairs).anchorOf(stairId);
        StairGeometrySpec spec = geometrySpec(shapeName, direction, anchor, dimension1, dimension2, false);
        return stairId > NO_STAIR_ID
                && topology != null
                && rooms != null
                && spec != null
                && normalizedCollection(stairs).canRecomputeStair(stairId, spec, roomCells(topology, rooms));
    }

    static StairCollection withRecomputed(
            StairCollection stairs,
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        Direction direction = DungeonStairGeometryValues.supportedCardinalDirection(directionName);
        Cell anchor = normalizedCollection(stairs).anchorOf(stairId);
        StairGeometrySpec spec = geometrySpec(shapeName, direction, anchor, dimension1, dimension2, false);
        if (topology == null || rooms == null || spec == null) {
            return normalizedCollection(stairs);
        }
        return normalizedCollection(stairs).withRecomputedStair(stairId, spec, roomCells(topology, rooms));
    }

    private static StairCollection normalizedCollection(StairCollection stairs) {
        return stairs == null ? new StairCollection(List.of()) : stairs;
    }

    private static StairGeometrySpec geometrySpec(
            String shapeName,
            Direction direction,
            Cell anchor,
            int dimension1,
            int dimension2,
            boolean useEditorDefaults
    ) {
        DungeonStairShape shape = DungeonStairGeometryValues.supportedShape(shapeName);
        return DungeonStairGeometryValues.geometrySpec(
                shape,
                anchor,
                direction,
                useEditorDefaults && shape != null ? shape.defaultEditorDimension1() : dimension1,
                useEditorDefaults && shape != null ? shape.defaultEditorDimension2() : dimension2);
    }

    private static Set<Cell> roomCells(SpatialTopology topology, RoomCatalog rooms) {
        return STAIR_ROOM_CELLS.roomCells(topology, rooms);
    }

    private static StairShape coreShape(DungeonStairShape shape) {
        return StairShape.parse(shape == null ? "" : shape.name());
    }

    private static DungeonStairShape worldspaceShape(StairShape shape) {
        return DungeonStairShape.parse(shape == null ? "" : shape.name());
    }

    private static Direction direction(Direction direction) {
        return direction == null ? Direction.NORTH : direction;
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
            Direction direction,
            int dimension1,
            int dimension2,
            List<Cell> path,
            List<DungeonStairExit> exits,
            @Nullable Long corridorId
    ) {
        public Geometry {
            shape = shape == null ? DungeonStairShape.defaultShape() : shape;
            direction = direction == null ? Direction.NORTH : direction;
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
            path = DungeonStairGeometryValues.uniquePath(path);
            exits = DungeonStairGeometryValues.sortedExits(exits);
            corridorId = positiveCorridorId(corridorId);
        }

        @Override
        public List<Cell> path() {
            return List.copyOf(path);
        }

        @Override
        public List<DungeonStairExit> exits() {
            return List.copyOf(exits);
        }

        static Geometry empty() {
            return new Geometry(
                    DungeonStairShape.defaultShape(),
                    Direction.NORTH,
                    0,
                    0,
                    List.of(),
                    List.of(),
                    null);
        }
    }
}
