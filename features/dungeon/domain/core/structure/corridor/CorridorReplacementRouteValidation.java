package features.dungeon.domain.core.structure.corridor;

import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;

final class CorridorReplacementRouteValidation {
    private static final CorridorHostRoomCells ROOM_CELLS = new CorridorHostRoomCells();
    private static final CorridorHostEndpointQuery ENDPOINTS = new CorridorHostEndpointQuery();
    private static final CorridorHostBackboneCells BACKBONE_CELLS = new CorridorHostBackboneCells();
    private final CorridorRoutingPolicy routingPolicy;

    CorridorReplacementRouteValidation(CorridorRoutingPolicy routingPolicy) {
        this.routingPolicy = java.util.Objects.requireNonNull(routingPolicy, "routingPolicy");
    }

    boolean hasValidReplacementRoute(
            DungeonMap dungeonMap,
            Corridor corridor,
            List<Corridor> candidateCorridors
    ) {
        return ValidationContext.from(dungeonMap, candidateCorridors, routingPolicy)
                .hasValidReplacementRoute(corridor);
    }

    ValidationContext validationContext(
            DungeonMap dungeonMap,
            List<Corridor> candidateCorridors
    ) {
        return ValidationContext.from(dungeonMap, candidateCorridors, routingPolicy);
    }

    private static boolean hasUnblockedBackbone(
            List<Cell> backbone,
            Set<Cell> roomCells,
            CorridorRoutingPolicy routingPolicy
    ) {
        if (backbone == null || backbone.size() < 2) {
            return false;
        }
        for (int index = 1; index < backbone.size(); index++) {
            CorridorRoute segment = routingPolicy.route(backbone.get(index - 1), backbone.get(index), roomCells);
            if (!segment.present()) {
                return false;
            }
        }
        return true;
    }

    record ValidationContext(
            boolean valid,
            Map<Long, RoomCluster> clustersById,
            Map<Long, RoomRegion> roomsById,
            Map<Long, List<Cell>> roomCellsByRoom,
            Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey,
            Set<Cell> allRoomCells,
            CorridorRoutingPolicy routingPolicy
    ) {
        static ValidationContext from(
                DungeonMap dungeonMap,
                List<Corridor> candidateCorridors,
            CorridorRoutingPolicy routingPolicy
        ) {
            if (dungeonMap == null) {
                return invalid(routingPolicy);
            }
            Map<Long, List<Cell>> roomCellsByRoom = ROOM_CELLS.roomCellsByRoom(dungeonMap);
            return new ValidationContext(
                    true,
                    ROOM_CELLS.clustersById(dungeonMap),
                    ROOM_CELLS.roomsById(dungeonMap),
                    roomCellsByRoom,
                    ENDPOINTS.anchorsByKey(candidateCorridors),
                    ROOM_CELLS.allRoomCells(roomCellsByRoom),
                    routingPolicy);
        }

        static ValidationContext invalid(CorridorRoutingPolicy routingPolicy) {
            return new ValidationContext(
                    false,
                    Map.of(),
                    Map.of(),
                    Map.of(),
                    Map.of(),
                    Set.of(),
                    routingPolicy);
        }

        boolean hasValidReplacementRoute(Corridor corridor) {
            if (!valid || corridor == null || corridor.endpointCount() < 2) {
                return false;
            }
            List<CorridorHostEndpoint> endpoints = ENDPOINTS.endpoints(
                    corridor,
                    clustersById,
                    roomsById,
                    roomCellsByRoom,
                    anchorsByKey);
            List<Cell> backbone = corridor.bindings().waypoints().isEmpty()
                    ? BACKBONE_CELLS.endpointBackbone(endpoints)
                    : BACKBONE_CELLS.authoredBackbone(corridor.bindings().waypoints(), endpoints);
            return hasUnblockedBackbone(backbone, allRoomCells, routingPolicy);
        }
    }
}
