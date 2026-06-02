package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;

final class DungeonCorridorTargetDeleteLogic {
    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonCorridorDoorTargetDeleteLogic DOOR_TARGET_DELETE_SERVICE =
            new DungeonCorridorDoorTargetDeleteLogic();

    DungeonMap deleteTarget(
            DungeonMap dungeonMap,
            DungeonCorridor existing,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        DungeonCorridor updated = switch (targetKind) {
            case "DOOR" -> DOOR_TARGET_DELETE_SERVICE.deleteDoor(dungeonMap, existing, topologyRefId, roomId);
            case "CORRIDOR_ANCHOR" -> withoutAnchor(existing, topologyRefId);
            case "CORRIDOR_WAYPOINT" -> withoutWaypoint(existing, waypointIndex);
            default -> existing;
        };
        if (updated.equals(existing) || updated.endpointCount() < 2) {
            return dungeonMap;
        }
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        withUpdatedCorridor(dungeonMap, updated),
                        dungeonMap.connections().stairs(),
                        dungeonMap.connections().transitions()));
    }

    private DungeonCorridor withoutAnchor(DungeonCorridor corridor, long topologyRefId) {
        return corridor.withBindings(corridor.bindings().withoutAnchorRefAndRouteWaypoints(topologyRefId));
    }

    private DungeonCorridor withoutWaypoint(DungeonCorridor corridor, int waypointIndex) {
        return corridor.withBindings(corridor.bindings().withoutWaypoint(waypointIndex));
    }

    private List<DungeonCorridor> withUpdatedCorridor(DungeonMap dungeonMap, DungeonCorridor updated) {
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            nextCorridors.add(corridor.corridorId() == updated.corridorId() ? updated : corridor);
        }
        return List.copyOf(nextCorridors);
    }
}
