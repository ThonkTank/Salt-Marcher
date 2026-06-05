package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;

final class ConnectionCatalogStairOperations {
    private static final long NO_STAIR_ID = 0L;
    private static final DungeonStairRoomCellProjection STAIR_ROOM_CELLS =
            new DungeonStairRoomCellProjection();
    private final List<DungeonCorridor> corridors;
    private final StairCollection stairCollection;
    private final TransitionCatalog transitionCatalog;

    ConnectionCatalogStairOperations(
            List<DungeonCorridor> corridors,
            StairCollection stairCollection,
            TransitionCatalog transitionCatalog
    ) {
        this.corridors = corridors;
        this.stairCollection = stairCollection;
        this.transitionCatalog = transitionCatalog;
    }

    boolean canDeleteUnboundStair(long stairId) {
        return stairCollection.canDeleteUnboundStair(stairId);
    }

    ConnectionCatalog withoutStair(long stairId) {
        return withStairCollection(stairCollection.withoutUnboundStair(stairId));
    }

    ConnectionCatalog withoutCorridorBoundStairs(long corridorId) {
        return withStairCollection(stairCollection.withoutCorridorBoundStairs(corridorId));
    }

    boolean canCreateStair(
            DungeonCell anchor,
            String shapeName,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        DungeonStairShape shape = DungeonStairGeometryValues.supportedShape(shapeName);
        StairGeometrySpec spec = DungeonStairGeometryValues.geometrySpec(shape, anchor, DungeonEdgeDirection.NORTH,
                shape == null ? 0 : shape.defaultEditorDimension1(),
                shape == null ? 0 : shape.defaultEditorDimension2());
        if (topology == null || rooms == null || spec == null) {
            return false;
        }
        return stairCollection.canCreateAuthoredStairGeometry(spec, roomCells(topology, rooms));
    }

    ConnectionCatalog withStair(
            long stairId,
            long mapId,
            DungeonCell anchor,
            String shapeName,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        DungeonStairShape shape = DungeonStairGeometryValues.supportedShape(shapeName);
        StairGeometrySpec spec = DungeonStairGeometryValues.geometrySpec(shape, anchor, DungeonEdgeDirection.NORTH,
                shape == null ? 0 : shape.defaultEditorDimension1(),
                shape == null ? 0 : shape.defaultEditorDimension2());
        if (topology == null || rooms == null || spec == null) {
            return new ConnectionCatalog(corridors, stairCollection, transitionCatalog);
        }
        return withStairCollection(stairCollection.withAuthoredStair(
                stairId,
                mapId,
                spec,
                roomCells(topology, rooms)));
    }

    ConnectionCatalog withCorridorBoundStair(
            long stairId,
            long mapId,
            long corridorId,
            List<DungeonCell> path,
            DungeonCell upperExit
    ) {
        return withStairCollection(stairCollection.withCorridorBoundStair(
                stairId,
                mapId,
                corridorId,
                DungeonStairGeometryValues.coreCells(path),
                upperExit == null ? null : upperExit.geometry()));
    }

    boolean canRecomputeStair(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        DungeonStairShape shape = DungeonStairGeometryValues.supportedShape(shapeName);
        DungeonEdgeDirection direction = DungeonStairGeometryValues.supportedCardinalDirection(directionName);
        Cell anchor = stairCollection.anchorOf(stairId);
        StairGeometrySpec spec = DungeonStairGeometryValues.geometrySpec(
                shape,
                DungeonStairGeometryValues.worldspaceCell(anchor),
                direction,
                dimension1,
                dimension2);
        return stairId > NO_STAIR_ID
                && topology != null
                && rooms != null
                && spec != null
                && stairCollection.canRecomputeStair(stairId, spec, roomCells(topology, rooms));
    }

    ConnectionCatalog withRecomputedStair(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        DungeonStairShape shape = DungeonStairGeometryValues.supportedShape(shapeName);
        DungeonEdgeDirection direction = DungeonStairGeometryValues.supportedCardinalDirection(directionName);
        Cell anchor = stairCollection.anchorOf(stairId);
        StairGeometrySpec spec = DungeonStairGeometryValues.geometrySpec(
                shape,
                DungeonStairGeometryValues.worldspaceCell(anchor),
                direction,
                dimension1,
                dimension2);
        if (topology == null || rooms == null || spec == null) {
            return new ConnectionCatalog(corridors, stairCollection, transitionCatalog);
        }
        return withStairCollection(stairCollection.withRecomputedStair(stairId, spec, roomCells(topology, rooms)));
    }

    private ConnectionCatalog withStairCollection(StairCollection nextStairs) {
        return nextStairs.equals(stairCollection)
                ? new ConnectionCatalog(corridors, stairCollection, transitionCatalog)
                : new ConnectionCatalog(corridors, nextStairs, transitionCatalog);
    }

    private static Set<Cell> roomCells(SpatialTopology topology, RoomCatalog rooms) {
        return STAIR_ROOM_CELLS.roomCells(topology, rooms);
    }
}
