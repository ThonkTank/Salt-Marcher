package src.domain.dungeon.model.map.model;

import java.util.Objects;

/**
 * Owns corridor mutation mechanics while the aggregate remains the public
 * mutation boundary.
 */
public final class DungeonCorridorMutationLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonCorridorCreationLogic CREATION_SERVICE =
            new DungeonCorridorCreationLogic();
    private static final DungeonCorridorExtensionLogic EXTENSION_SERVICE =
            new DungeonCorridorExtensionLogic();
    private static final DungeonCorridorMergeDeleteLogic MERGE_DELETE_SERVICE =
            new DungeonCorridorMergeDeleteLogic();

    public DungeonMap createCorridor(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        return CREATION_SERVICE.createCorridor(dungeonMap, start, end);
    }

    public DungeonMap extendCorridor(
            DungeonMap dungeonMap,
            long corridorId,
            DungeonCorridorRoomEndpoint endpoint
    ) {
        return EXTENSION_SERVICE.extendCorridor(dungeonMap, corridorId, endpoint);
    }

    public DungeonMap mergeCorridors(DungeonMap dungeonMap, long corridorId, long mergedCorridorId) {
        return MERGE_DELETE_SERVICE.mergeCorridors(dungeonMap, corridorId, mergedCorridorId);
    }

    public DungeonMap deleteCorridor(DungeonMap dungeonMap, long corridorId) {
        return MERGE_DELETE_SERVICE.deleteCorridor(dungeonMap, corridorId);
    }

    public ConnectionCatalog normalizeConnections(DungeonMap dungeonMap, ConnectionCatalog source) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        return CONNECTION_NORMALIZATION_SERVICE.normalizeConnections(dungeonMap, source);
    }

}
