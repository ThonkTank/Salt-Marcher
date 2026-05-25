package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

final class DungeonCorridorMergeDeleteLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonCorridorMutationRules MUTATION_RULES =
            new DungeonCorridorMutationRules();
    private static final DungeonCorridorAnchorPruningRules ANCHOR_PRUNING_POLICY =
            new DungeonCorridorAnchorPruningRules();
    private static final DungeonMapLookupLogic LOOKUP_SERVICE = new DungeonMapLookupLogic();

    DungeonMap deleteCorridor(DungeonMap dungeonMap, long corridorId) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (MUTATION_RULES.invalidCorridorId(corridorId)) {
            return dungeonMap;
        }
        DungeonCorridor existing = LOOKUP_SERVICE.corridor(dungeonMap, corridorId);
        if (existing == null || ANCHOR_PRUNING_POLICY.ownedAnchorStillReferenced(dungeonMap.connections().corridors(), existing)) {
            return dungeonMap;
        }
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        corridorsWithout(dungeonMap, corridorId),
                        stairsWithoutCorridor(dungeonMap, corridorId),
                        dungeonMap.connections().transitions()));
    }

    private List<DungeonCorridor> corridorsWithout(DungeonMap dungeonMap, long corridorId) {
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            if (keepsCorridor(corridor, corridorId)) {
                nextCorridors.add(corridor);
            }
        }
        return nextCorridors;
    }

    private boolean keepsCorridor(DungeonCorridor corridor, long corridorId) {
        return corridor != null && corridor.corridorId() != corridorId;
    }

    private List<DungeonStair> stairsWithoutCorridor(DungeonMap dungeonMap, long corridorId) {
        List<DungeonStair> nextStairs = new ArrayList<>();
        for (DungeonStair stair : dungeonMap.connections().stairs()) {
            if (keepsStair(stair, corridorId)) {
                nextStairs.add(stair);
            }
        }
        return nextStairs;
    }

    private boolean keepsStair(DungeonStair stair, long corridorId) {
        return stair != null && (stair.corridorId() == null || stair.corridorId() != corridorId);
    }
}
