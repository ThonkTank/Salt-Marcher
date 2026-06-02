package src.domain.dungeon.model.worldspace.model;

import src.domain.dungeon.model.core.model.structure.CorridorRoomSet;

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
        DungeonCorridorBindings nextBindings = corridor.bindings()
                .withoutDoorBindingForRoom(removed.roomId())
                .withWaypoints(WAYPOINT_PRUNING_SERVICE.waypointsAfterDoorRemoval(dungeonMap, corridor, removed));
        return new DungeonCorridor(
                corridor.corridorId(),
                corridor.mapId(),
                corridor.level(),
                new CorridorRoomSet(corridor.roomIds()).without(removed.roomId()).roomIds(),
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

}
