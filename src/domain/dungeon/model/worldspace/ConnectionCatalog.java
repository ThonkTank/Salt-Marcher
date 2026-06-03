package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;

/**
 * Authored map connections loaded from dungeon write-model truth.
 */
public record ConnectionCatalog(
        List<DungeonCorridor> corridors,
        List<DungeonStair> stairs,
        List<DungeonTransition> transitions
) {
    private static final long NO_STAIR_ID = 0L;
    private static final long NO_CORRIDOR_ID = 0L;
    private static final long NO_TRANSITION_ID = 0L;
    private static final DungeonStairRoomInteriorValidationLogic STAIR_ROOM_INTERIOR_VALIDATION =
            new DungeonStairRoomInteriorValidationLogic();

    public ConnectionCatalog {
        corridors = corridors == null ? List.of() : List.copyOf(corridors);
        stairs = stairs == null ? List.of() : List.copyOf(stairs);
        transitions = transitions == null ? List.of() : List.copyOf(transitions);
    }

    public static ConnectionCatalog empty() {
        return new ConnectionCatalog(List.of(), List.of(), List.of());
    }

    public boolean canDeleteUnboundStair(long stairId) {
        if (stairId <= NO_STAIR_ID) {
            return false;
        }
        for (DungeonStair stair : stairs) {
            if (stair.stairId() == stairId) {
                return stair.corridorId() == null;
            }
        }
        return false;
    }

    public ConnectionCatalog withoutStair(long stairId) {
        if (!canDeleteUnboundStair(stairId)) {
            return this;
        }
        List<DungeonStair> nextStairs = new ArrayList<>();
        for (DungeonStair stair : stairs) {
            if (stair.stairId() != stairId) {
                nextStairs.add(stair);
            }
        }
        return new ConnectionCatalog(corridors, nextStairs, transitions);
    }

    public ConnectionCatalog withoutCorridorBoundStairs(long corridorId) {
        if (corridorId <= NO_CORRIDOR_ID) {
            return this;
        }
        List<DungeonStair> nextStairs = new ArrayList<>();
        for (DungeonStair stair : stairs) {
            if (stair != null && (stair.corridorId() == null || stair.corridorId() != corridorId)) {
                nextStairs.add(stair);
            }
        }
        return new ConnectionCatalog(corridors, nextStairs, transitions);
    }

    public boolean canCreateStair(
            DungeonCell anchor,
            String shapeName,
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        DungeonStairShape shape = DungeonStairGeometryValues.supportedShape(shapeName);
        if (anchor == null || shape == null) {
            return false;
        }
        return STAIR_ROOM_INTERIOR_VALIDATION.avoidsRoomInteriors(
                topology,
                rooms,
                shape,
                anchor,
                DungeonEdgeDirection.NORTH,
                shape.defaultEditorDimension1(),
                shape.defaultEditorDimension2());
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
        if (!canCreateStair(anchor, shapeName, topology, rooms) || shape == null) {
            return this;
        }
        List<DungeonStair> nextStairs = new ArrayList<>(stairs);
        nextStairs.add(DungeonStair.authored(stairId, mapId, shape, anchor));
        return new ConnectionCatalog(corridors, nextStairs, transitions);
    }

    ConnectionCatalog withCorridorBoundStair(
            long stairId,
            long mapId,
            long corridorId,
            List<DungeonCell> path,
            DungeonCell upperExit
    ) {
        if (stairId <= NO_STAIR_ID
                || mapId <= 0L
                || corridorId <= 0L
                || path == null
                || path.isEmpty()
                || upperExit == null) {
            return this;
        }
        if (Math.abs(upperExit.level() - path.getFirst().level()) <= 0 || corridorBoundStairExists(corridorId)) {
            return this;
        }
        List<DungeonStair> nextStairs = new ArrayList<>(stairs);
        nextStairs.add(DungeonStair.corridorBound(stairId, mapId, corridorId, path, upperExit));
        return new ConnectionCatalog(corridors, nextStairs, transitions);
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
        DungeonStair selected = stairById(stairId);
        DungeonCell anchor = anchorOf(selected);
        return stairId > NO_STAIR_ID
                && shape != null
                && direction != null
                && shape.supportsEditorDimensions(dimension1, dimension2)
                && selected != null
                && anchor != null
                && STAIR_ROOM_INTERIOR_VALIDATION.avoidsRoomInteriors(
                        topology,
                        rooms,
                        shape,
                        anchor,
                        direction,
                        shape.normalizedEditorDimension1(dimension1),
                        dimension2);
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
        DungeonStair selected = stairById(stairId);
        DungeonCell anchor = anchorOf(selected);
        if (!canRecomputeStair(stairId, shapeName, directionName, dimension1, dimension2, topology, rooms)
                || selected == null
                || anchor == null
                || shape == null
                || direction == null) {
            return this;
        }
        List<DungeonStair> nextStairs = new ArrayList<>();
        for (DungeonStair stair : stairs) {
            if (stair.stairId() == stairId) {
                nextStairs.add(stair.withRecomputedGeometry(shape, anchor, direction, dimension1, dimension2));
            } else {
                nextStairs.add(stair);
            }
        }
        return new ConnectionCatalog(corridors, nextStairs, transitions);
    }

    public boolean canCreateTransition(
            DungeonCell anchor,
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        return DungeonTransitionCatalogCoreAdapter.canCreate(
                anchor,
                transitionDestination(dungeonMapDestination, destinationMapId, destinationTileId, destinationTransitionId));
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
        List<DungeonTransition> nextTransitions = DungeonTransitionCatalogCoreAdapter.withCreated(
                transitions,
                transitionId,
                mapId,
                anchor,
                transitionDestination(dungeonMapDestination, destinationMapId, destinationTileId, destinationTransitionId));
        return new ConnectionCatalog(corridors, stairs, nextTransitions);
    }

    private boolean corridorBoundStairExists(long corridorId) {
        for (DungeonStair stair : stairs) {
            if (stair != null && stair.corridorId() != null && stair.corridorId() == corridorId) {
                return true;
            }
        }
        return false;
    }

    private DungeonStair stairById(long stairId) {
        if (stairId <= NO_STAIR_ID) {
            return null;
        }
        for (DungeonStair stair : stairs) {
            if (stair != null && stair.stairId() == stairId) {
                return stair;
            }
        }
        return null;
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

    private static @Nullable DungeonCell anchorOf(@Nullable DungeonStair stair) {
        if (stair == null) {
            return null;
        }
        DungeonCell result = null;
        for (DungeonStairExit exit : stair.exits()) {
            DungeonCell position = exit.position();
            if (result == null || position.level() < result.level()) {
                result = position;
            }
        }
        if (result != null) {
            return result;
        }
        return stair.path().isEmpty() ? null : stair.path().getFirst();
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
}
