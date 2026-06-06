package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;

/**
 * Owns corridor mutation mechanics while the aggregate remains the public
 * mutation boundary.
 */
public final class DungeonCorridorMutationLogic {

    private static final DungeonCorridorCreationLogic CREATION_SERVICE =
            new DungeonCorridorCreationLogic();
    private static final DungeonCorridorMergeDeleteLogic MERGE_DELETE_SERVICE =
            new DungeonCorridorMergeDeleteLogic();

    public DungeonMap createCorridor(
            DungeonMap dungeonMap,
            long stairId,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        return CREATION_SERVICE.createCorridor(dungeonMap, stairId, start, end);
    }

    public DungeonMap deleteCorridor(
            DungeonMap dungeonMap,
            long corridorId,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        return MERGE_DELETE_SERVICE.deleteCorridor(
                dungeonMap,
                corridorId,
                targetKind,
                topologyRefId,
                roomId,
                waypointIndex);
    }

}
