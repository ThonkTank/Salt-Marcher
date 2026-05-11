package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonCorridor;
import src.domain.dungeon.model.map.model.DungeonStair;
import src.domain.dungeon.model.map.model.DungeonCorridorAnchorPruningRules;
import src.domain.dungeon.model.map.model.ConnectionCatalog;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonCorridorRoomEndpoint;

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
    private static final DungeonMapLookupLogic LOOKUP_SERVICE = new DungeonMapLookupLogic();
    private static final DungeonCorridorMutationRules MUTATION_RULES =
            new DungeonCorridorMutationRules();
    private static final DungeonCorridorAnchorPruningRules ANCHOR_PRUNING_POLICY =
            new DungeonCorridorAnchorPruningRules();

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
        DungeonCorridor updated = DungeonCorridorOps.mergeKeepingThis(kept, merged);
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            if (corridor.corridorId() == mergedCorridorId) {
                continue;
            }
            nextCorridors.add(corridor.corridorId() == corridorId ? updated : corridor);
        }
        List<DungeonStair> nextStairs = new ArrayList<>();
        for (DungeonStair stair : dungeonMap.connections().stairs()) {
            nextStairs.add(stair != null && stair.corridorId() != null && stair.corridorId() == mergedCorridorId
                    ? DungeonStairOps.withCorridorId(stair, corridorId)
                    : stair);
        }
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        List.copyOf(nextCorridors),
                        nextStairs,
                        dungeonMap.connections().transitions()));
    }

    public DungeonMap deleteCorridor(DungeonMap dungeonMap, long corridorId) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (MUTATION_RULES.invalidCorridorId(corridorId)) {
            return dungeonMap;
        }
        DungeonCorridor existing = LOOKUP_SERVICE.corridor(dungeonMap, corridorId);
        if (existing == null || ANCHOR_PRUNING_POLICY.ownedAnchorStillReferenced(dungeonMap.connections().corridors(), existing)) {
            return dungeonMap;
        }
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            if (corridor != null && corridor.corridorId() != corridorId) {
                nextCorridors.add(corridor);
            }
        }
        List<DungeonStair> nextStairs = new ArrayList<>();
        for (DungeonStair stair : dungeonMap.connections().stairs()) {
            if (stair != null && (stair.corridorId() == null || stair.corridorId() != corridorId)) {
                nextStairs.add(stair);
            }
        }
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        nextCorridors,
                        nextStairs,
                        dungeonMap.connections().transitions()));
    }

    public ConnectionCatalog normalizeConnections(DungeonMap dungeonMap, ConnectionCatalog source) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        return CONNECTION_NORMALIZATION_SERVICE.normalizeConnections(dungeonMap, source);
    }

}
