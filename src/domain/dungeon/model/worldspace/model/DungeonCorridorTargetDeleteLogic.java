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
        DungeonTopologyRef removedRef = DungeonTopologyRef.corridorAnchor(topologyRefId);
        DungeonCorridorBindings nextBindings = new DungeonCorridorBindings(
                List.of(),
                corridor.bindings().doorBindings(),
                corridor.bindings().anchorBindings(),
                anchorRefsWithout(corridor, removedRef));
        return corridor.withBindings(nextBindings);
    }

    private DungeonCorridor withoutWaypoint(DungeonCorridor corridor, int waypointIndex) {
        List<DungeonCorridorWaypoint> nextWaypoints = new ArrayList<>();
        for (int index = 0; index < corridor.bindings().waypoints().size(); index++) {
            if (index != waypointIndex) {
                nextWaypoints.add(corridor.bindings().waypoints().get(index));
            }
        }
        return corridor.withBindings(corridor.bindings().withWaypoints(nextWaypoints));
    }

    private List<DungeonCorridorAnchorRef> anchorRefsWithout(DungeonCorridor corridor, DungeonTopologyRef removedRef) {
        List<DungeonCorridorAnchorRef> nextRefs = new ArrayList<>();
        for (DungeonCorridorAnchorRef ref : corridor.bindings().anchorRefs()) {
            if (ref != null && !ref.topologyRef().equals(removedRef)) {
                nextRefs.add(ref);
            }
        }
        return List.copyOf(nextRefs);
    }

    private List<DungeonCorridor> withUpdatedCorridor(DungeonMap dungeonMap, DungeonCorridor updated) {
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            nextCorridors.add(corridor.corridorId() == updated.corridorId() ? updated : corridor);
        }
        return List.copyOf(nextCorridors);
    }
}
