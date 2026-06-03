package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;

/**
 * Authored map connections loaded from dungeon write-model truth.
 */
public record ConnectionCatalog(
        List<DungeonCorridor> corridors,
        List<DungeonStair> stairs,
        TransitionCatalog transitionCatalog
) {
    private static final long NO_STAIR_ID = 0L;
    private static final DungeonStairRoomCellProjection STAIR_ROOM_CELLS =
            new DungeonStairRoomCellProjection();

    public ConnectionCatalog(
            List<DungeonCorridor> corridors,
            List<DungeonStair> stairs,
            List<DungeonTransition> transitions
    ) {
        this(corridors, stairs, DungeonTransitionCatalogCoreAdapter.toCoreCatalog(transitions));
    }

    public ConnectionCatalog {
        corridors = corridors == null ? List.of() : List.copyOf(corridors);
        stairs = stairs == null ? List.of() : List.copyOf(stairs);
        transitionCatalog = transitionCatalog == null ? new TransitionCatalog(List.of()) : transitionCatalog;
    }

    public static ConnectionCatalog empty() {
        return new ConnectionCatalog(List.of(), List.of(), List.of());
    }

    public List<DungeonTransition> transitions() {
        return DungeonTransitionCatalogCoreAdapter.fromCoreCatalog(transitionCatalog);
    }

    public boolean canDeleteUnboundStair(long stairId) {
        return stairCollection().canDeleteUnboundStair(stairId);
    }

    public ConnectionCatalog withoutStair(long stairId) {
        return withStairCollection(stairCollection().withoutUnboundStair(stairId));
    }

    public ConnectionCatalog withoutCorridorBoundStairs(long corridorId) {
        return withStairCollection(stairCollection().withoutCorridorBoundStairs(corridorId));
    }

    public boolean canCreateStair(
            DungeonCell anchor,
            String shapeName,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        DungeonStairShape shape = DungeonStairGeometryValues.supportedShape(shapeName);
        StairGeometrySpec spec = stairSpec(shape, anchor, DungeonEdgeDirection.NORTH,
                shape == null ? 0 : shape.defaultEditorDimension1(),
                shape == null ? 0 : shape.defaultEditorDimension2());
        if (topology == null || rooms == null || spec == null) {
            return false;
        }
        return stairCollection().canCreateAuthoredStairGeometry(spec, roomCells(topology, rooms));
    }

    public ConnectionCatalog withStair(
            long stairId,
            long mapId,
            DungeonCell anchor,
            String shapeName,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        DungeonStairShape shape = DungeonStairGeometryValues.supportedShape(shapeName);
        StairGeometrySpec spec = stairSpec(shape, anchor, DungeonEdgeDirection.NORTH,
                shape == null ? 0 : shape.defaultEditorDimension1(),
                shape == null ? 0 : shape.defaultEditorDimension2());
        if (topology == null || rooms == null || spec == null) {
            return this;
        }
        return withStairCollection(stairCollection().withAuthoredStair(
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
        return withStairCollection(stairCollection().withCorridorBoundStair(
                stairId,
                mapId,
                corridorId,
                DungeonStairGeometryValues.coreCells(path),
                upperExit == null ? null : upperExit.geometry()));
    }

    public boolean canRecomputeStair(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        DungeonStairShape shape = DungeonStairGeometryValues.supportedShape(shapeName);
        DungeonEdgeDirection direction = parseCardinalDirection(directionName);
        Cell anchor = stairCollection().anchorOf(stairId);
        StairGeometrySpec spec = stairSpec(shape, worldspaceCell(anchor), direction, dimension1, dimension2);
        return stairId > NO_STAIR_ID
                && topology != null
                && rooms != null
                && spec != null
                && stairCollection().canRecomputeStair(stairId, spec, roomCells(topology, rooms));
    }

    public ConnectionCatalog withRecomputedStair(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        DungeonStairShape shape = DungeonStairGeometryValues.supportedShape(shapeName);
        DungeonEdgeDirection direction = parseCardinalDirection(directionName);
        Cell anchor = stairCollection().anchorOf(stairId);
        StairGeometrySpec spec = stairSpec(shape, worldspaceCell(anchor), direction, dimension1, dimension2);
        if (topology == null || rooms == null || spec == null) {
            return this;
        }
        return withStairCollection(stairCollection().withRecomputedStair(stairId, spec, roomCells(topology, rooms)));
    }

    public boolean canCreateTransition(
            DungeonCell anchor,
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        DungeonTransitionDestination destination = transitionDestination(
                dungeonMapDestination,
                destinationMapId,
                destinationTileId,
                destinationTransitionId);
        return transitionCatalog.canCreate(
                anchor == null ? null : anchor.geometry(),
                destination.coreDestination());
    }

    public ConnectionCatalog withTransition(
            long transitionId,
            long mapId,
            DungeonCell anchor,
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        if (!canCreateTransition(
                anchor,
                dungeonMapDestination,
                destinationMapId,
                destinationTileId,
                destinationTransitionId)) {
            return this;
        }
        TransitionCatalog nextTransitions = transitionCatalog.withCreated(
                transitionId,
                mapId,
                anchor.geometry(),
                transitionDestination(
                        dungeonMapDestination,
                        destinationMapId,
                        destinationTileId,
                        destinationTransitionId).coreDestination());
        return withTransitionCatalog(nextTransitions);
    }

    public ConnectionCatalog withMapLocalAuthoredTransitionLink(AuthoredTransitionLink link) {
        return withTransitionCatalog(transitionCatalog.withMapLocalAuthoredTransitionLink(link));
    }

    public boolean canDeleteTransition(long transitionId) {
        return transitionCatalog.canDelete(transitionId);
    }

    public ConnectionCatalog withoutTransition(long transitionId) {
        return withTransitionCatalog(transitionCatalog.withoutTransition(transitionId));
    }

    public ConnectionCatalog withTransitionDescription(long transitionId, String description) {
        return withTransitionCatalog(transitionCatalog.withDescription(transitionId, description));
    }

    private static @Nullable DungeonEdgeDirection parseCardinalDirection(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "NORTH" -> DungeonEdgeDirection.NORTH;
            case "EAST" -> DungeonEdgeDirection.EAST;
            case "SOUTH" -> DungeonEdgeDirection.SOUTH;
            case "WEST" -> DungeonEdgeDirection.WEST;
            default -> null;
        };
    }

    private static DungeonTransitionDestination transitionDestination(
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        if (dungeonMapDestination) {
            return DungeonTransitionDestination.dungeonMapDestination(destinationMapId, destinationTransitionId);
        }
        return DungeonTransitionDestination.overworldTileDestination(destinationMapId, destinationTileId);
    }

    private ConnectionCatalog withStairCollection(StairCollection nextStairs) {
        return nextStairs.equals(stairCollection())
                ? this
                : new ConnectionCatalog(corridors, worldspaceStairs(nextStairs.stairs()), transitionCatalog);
    }

    private ConnectionCatalog withTransitionCatalog(TransitionCatalog nextTransitions) {
        return nextTransitions.equals(transitionCatalog)
                ? this
                : new ConnectionCatalog(corridors, stairs, nextTransitions);
    }

    private StairCollection stairCollection() {
        List<Stair> result = new ArrayList<>();
        for (DungeonStair stair : stairs) {
            if (stair != null) {
                result.add(stair.core());
            }
        }
        return new StairCollection(result);
    }

    private static List<DungeonStair> worldspaceStairs(List<Stair> source) {
        List<DungeonStair> result = new ArrayList<>();
        for (Stair stair : source == null ? List.<Stair>of() : source) {
            if (stair != null) {
                result.add(DungeonStair.fromCore(stair));
            }
        }
        return List.copyOf(result);
    }

    private static @Nullable StairGeometrySpec stairSpec(
            @Nullable DungeonStairShape shape,
            @Nullable DungeonCell anchor,
            @Nullable DungeonEdgeDirection direction,
            int dimension1,
            int dimension2
    ) {
        return anchor == null
                ? null
                : DungeonStairGeometryValues.geometrySpec(shape, anchor, direction, dimension1, dimension2);
    }

    private static Set<Cell> roomCells(SpatialTopology topology, RoomCatalog rooms) {
        return STAIR_ROOM_CELLS.roomCells(topology, rooms);
    }

    private static @Nullable DungeonCell worldspaceCell(@Nullable Cell cell) {
        return cell == null ? null : DungeonCell.fromGeometry(cell);
    }
}
