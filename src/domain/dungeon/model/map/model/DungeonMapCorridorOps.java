package src.domain.dungeon.model.map.model;

public final class DungeonMapCorridorOps {

    private static final DungeonCorridorMutationLogic CORRIDOR_MUTATION_SERVICE = new DungeonCorridorMutationLogic();

    private DungeonMapCorridorOps() {
    }

    public static DungeonMap createCorridor(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        return CORRIDOR_MUTATION_SERVICE.createCorridor(dungeonMap, start, end);
    }

    public static DungeonMap extendCorridor(
            DungeonMap dungeonMap,
            long corridorId,
            DungeonCorridorRoomEndpoint endpoint
    ) {
        return CORRIDOR_MUTATION_SERVICE.extendCorridor(dungeonMap, corridorId, endpoint);
    }

    public static DungeonMap mergeCorridors(DungeonMap dungeonMap, long corridorId, long mergedCorridorId) {
        return CORRIDOR_MUTATION_SERVICE.mergeCorridors(dungeonMap, corridorId, mergedCorridorId);
    }

    public static DungeonMap deleteCorridor(DungeonMap dungeonMap, long corridorId) {
        return CORRIDOR_MUTATION_SERVICE.deleteCorridor(dungeonMap, corridorId);
    }
}
