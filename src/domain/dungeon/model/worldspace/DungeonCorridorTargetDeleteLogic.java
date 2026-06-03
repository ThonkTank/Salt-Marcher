package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.structure.corridor.Corridor;

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
        Corridor current = DungeonCorridorCoreAdapter.toCore(existing);
        Corridor updatedCore = switch (targetKind) {
            case "DOOR" -> DOOR_TARGET_DELETE_SERVICE.deleteDoor(
                    dungeonMap,
                    existing,
                    current,
                    topologyRefId,
                    roomId);
            case "CORRIDOR_ANCHOR" -> current.withoutAnchorTarget(topologyRefId);
            case "CORRIDOR_WAYPOINT" -> current.withoutWaypointTarget(waypointIndex);
            default -> current;
        };
        if (updatedCore.equals(current) || updatedCore.endpointCount() < 2) {
            return dungeonMap;
        }
        DungeonCorridor updated = DungeonCorridorCoreAdapter.fromCore(existing, updatedCore, null);
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        withUpdatedCorridor(dungeonMap, updated),
                        dungeonMap.connections().stairs(),
                        dungeonMap.connections().transitions()));
    }

    private List<DungeonCorridor> withUpdatedCorridor(DungeonMap dungeonMap, DungeonCorridor updated) {
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            nextCorridors.add(corridor.corridorId() == updated.corridorId() ? updated : corridor);
        }
        return List.copyOf(nextCorridors);
    }
}
