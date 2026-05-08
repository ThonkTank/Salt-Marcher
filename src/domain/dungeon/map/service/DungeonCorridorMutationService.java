package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.policy.DungeonCorridorAnchorPruningPolicy;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonCorridorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorRoomEndpoint;

/**
 * Owns corridor mutation mechanics while the aggregate remains the public
 * mutation boundary.
 */
public final class DungeonCorridorMutationService {

    private static final DungeonCorridorConnectionNormalizationService CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationService();
    private static final DungeonCorridorCreationService CREATION_SERVICE =
            new DungeonCorridorCreationService();
    private static final DungeonCorridorExtensionService EXTENSION_SERVICE =
            new DungeonCorridorExtensionService();
    private static final DungeonMapLookupService LOOKUP_SERVICE = new DungeonMapLookupService();
    private static final DungeonCorridorMutationRules MUTATION_RULES =
            new DungeonCorridorMutationRules();
    private static final DungeonCorridorAnchorPruningPolicy ANCHOR_PRUNING_POLICY =
            new DungeonCorridorAnchorPruningPolicy();

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
        DungeonCorridor updated = kept.mergeKeepingThis(merged);
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            if (corridor.corridorId() == mergedCorridorId) {
                continue;
            }
            nextCorridors.add(corridor.corridorId() == corridorId ? updated : corridor);
        }
        List<DungeonStair> nextStairs = dungeonMap.connections().stairs().stream()
                .map(stair -> stair.corridorId() != null && stair.corridorId() == mergedCorridorId
                        ? stair.withCorridorId(corridorId)
                        : stair)
                .toList();
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
        List<DungeonCorridor> nextCorridors = dungeonMap.connections().corridors().stream()
                .filter(corridor -> corridor.corridorId() != corridorId)
                .toList();
        List<DungeonStair> nextStairs = dungeonMap.connections().stairs().stream()
                .filter(stair -> stair.corridorId() == null || stair.corridorId() != corridorId)
                .toList();
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
