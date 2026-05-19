package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

final class DungeonCorridorMergeDeleteLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonMapLookupLogic LOOKUP_SERVICE = new DungeonMapLookupLogic();
    private static final DungeonCorridorMutationRules MUTATION_RULES =
            new DungeonCorridorMutationRules();
    private static final DungeonCorridorAnchorPruningRules ANCHOR_PRUNING_POLICY =
            new DungeonCorridorAnchorPruningRules();

    DungeonMap mergeCorridors(DungeonMap dungeonMap, long corridorId, long mergedCorridorId) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (MUTATION_RULES.invalidCorridorId(corridorId)
                || MUTATION_RULES.invalidCorridorId(mergedCorridorId)
                || corridorId == mergedCorridorId) {
            return dungeonMap;
        }
        DungeonCorridor kept = LOOKUP_SERVICE.corridor(dungeonMap, corridorId);
        DungeonCorridor merged = LOOKUP_SERVICE.corridor(dungeonMap, mergedCorridorId);
        if (kept == null || merged == null) {
            return dungeonMap;
        }
        DungeonCorridor updated = kept.mergeKeepingThis(merged);
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        mergedCorridors(dungeonMap, corridorId, mergedCorridorId, updated),
                        movedStairCorridors(dungeonMap, corridorId, mergedCorridorId),
                        dungeonMap.connections().transitions()));
    }

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

    private List<DungeonCorridor> mergedCorridors(
            DungeonMap dungeonMap,
            long corridorId,
            long mergedCorridorId,
            DungeonCorridor updated
    ) {
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            appendMergedCorridor(nextCorridors, corridor, corridorId, mergedCorridorId, updated);
        }
        return nextCorridors;
    }

    private void appendMergedCorridor(
            List<DungeonCorridor> nextCorridors,
            DungeonCorridor corridor,
            long corridorId,
            long mergedCorridorId,
            DungeonCorridor updated
    ) {
        if (corridor.corridorId() == mergedCorridorId) {
            return;
        }
        nextCorridors.add(corridor.corridorId() == corridorId ? updated : corridor);
    }

    private List<DungeonStair> movedStairCorridors(DungeonMap dungeonMap, long corridorId, long mergedCorridorId) {
        List<DungeonStair> nextStairs = new ArrayList<>();
        for (DungeonStair stair : dungeonMap.connections().stairs()) {
            nextStairs.add(stairMovedFromMergedCorridor(stair, mergedCorridorId)
                    ? stair.withCorridorId(corridorId)
                    : stair);
        }
        return nextStairs;
    }

    private boolean stairMovedFromMergedCorridor(DungeonStair stair, long mergedCorridorId) {
        return stair != null && stair.corridorId() != null && stair.corridorId() == mergedCorridorId;
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
