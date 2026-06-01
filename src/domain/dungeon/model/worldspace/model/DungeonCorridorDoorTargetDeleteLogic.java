package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;

final class DungeonCorridorDoorTargetDeleteLogic {
    private static final long NO_ID = 0L;
    private static final DungeonCorridorDoorWaypointPruningLogic WAYPOINT_PRUNING_SERVICE =
            new DungeonCorridorDoorWaypointPruningLogic();

    DungeonCorridor deleteDoor(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            long topologyRefId,
            long roomId
    ) {
        DungeonCorridorDoorBinding removed = removedDoorBinding(corridor, topologyRefId, roomId);
        if (removed == null) {
            return corridor;
        }
        DungeonCorridorBindings nextBindings = new DungeonCorridorBindings(
                WAYPOINT_PRUNING_SERVICE.waypointsAfterDoorRemoval(dungeonMap, corridor, removed),
                doorBindingsWithout(corridor, removed),
                corridor.bindings().anchorBindings(),
                corridor.bindings().anchorRefs());
        return new DungeonCorridor(
                corridor.corridorId(),
                corridor.mapId(),
                corridor.level(),
                roomIdsWithout(corridor, removed.roomId()),
                nextBindings);
    }

    private DungeonCorridorDoorBinding removedDoorBinding(DungeonCorridor corridor, long topologyRefId, long roomId) {
        for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
            if (binding != null && matchesDoorBinding(binding, topologyRefId, roomId)) {
                return binding;
            }
        }
        return null;
    }

    private boolean matchesDoorBinding(DungeonCorridorDoorBinding binding, long topologyRefId, long roomId) {
        return (topologyRefId > NO_ID && binding.topologyRef().id() == topologyRefId)
                || (roomId > NO_ID && binding.roomId() == roomId);
    }

    private List<DungeonCorridorDoorBinding> doorBindingsWithout(
            DungeonCorridor corridor,
            DungeonCorridorDoorBinding removed
    ) {
        List<DungeonCorridorDoorBinding> nextBindings = new ArrayList<>();
        for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
            if (binding != null && !binding.equals(removed)) {
                nextBindings.add(binding);
            }
        }
        return List.copyOf(nextBindings);
    }

    private List<Long> roomIdsWithout(DungeonCorridor corridor, long roomId) {
        List<Long> nextRoomIds = new ArrayList<>();
        for (Long existingRoomId : corridor.roomIds()) {
            if (existingRoomId != null && existingRoomId != roomId) {
                nextRoomIds.add(existingRoomId);
            }
        }
        return List.copyOf(nextRoomIds);
    }
}
