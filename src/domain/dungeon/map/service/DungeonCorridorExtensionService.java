package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.policy.DungeonCorridorSemanticsPolicy;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonCorridorRoomEndpoint;

final class DungeonCorridorExtensionService {

    private static final DungeonCorridorConnectionNormalizationService CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationService();
    private static final DungeonCorridorSemanticsPolicy CORRIDOR_SEMANTICS_POLICY =
            new DungeonCorridorSemanticsPolicy();
    private static final DungeonMapLookupService LOOKUP_SERVICE = new DungeonMapLookupService();
    private static final DungeonCorridorMutationRules MUTATION_RULES = new DungeonCorridorMutationRules();

    DungeonMap extendCorridor(
            DungeonMap dungeonMap,
            long corridorId,
            DungeonCorridorRoomEndpoint endpoint
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (MUTATION_RULES.invalidCorridorId(corridorId) || endpoint == null || !endpoint.present()) {
            return dungeonMap;
        }
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        boolean changed = false;
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            if (!matchesTargetCorridor(corridor, corridorId, endpoint)) {
                nextCorridors.add(corridor);
                continue;
            }
            DungeonCorridor updated = applyEndpointBinding(dungeonMap, corridor, endpoint);
            if (unchangedCorridor(dungeonMap, corridor, updated)) {
                nextCorridors.add(corridor);
                continue;
            }
            nextCorridors.add(updated);
            changed = true;
        }
        return changed
                ? CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        List.copyOf(nextCorridors),
                        dungeonMap.connections().stairs(),
                        dungeonMap.connections().transitions()))
                : dungeonMap;
    }

    private boolean matchesTargetCorridor(
            DungeonCorridor corridor,
            long corridorId,
            DungeonCorridorRoomEndpoint endpoint
    ) {
        return corridor.corridorId() == corridorId
                && corridor.level() == endpoint.roomCell().level();
    }

    private boolean unchangedCorridor(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            DungeonCorridor updated
    ) {
        return MUTATION_RULES.sameClusterOnly(dungeonMap, updated.roomIds())
                || CORRIDOR_SEMANTICS_POLICY.equivalent(corridor, updated);
    }

    private DungeonCorridor applyEndpointBinding(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            DungeonCorridorRoomEndpoint endpoint
    ) {
        DungeonCorridor updated = corridor.withAddedRoom(endpoint.roomId());
        if (!endpoint.fixedDoor()) {
            return updated;
        }
        DungeonRoomCluster cluster = LOOKUP_SERVICE.cluster(dungeonMap, endpoint.clusterId());
        return cluster == null ? updated : updated.withDoorBinding(endpoint.toDoorBinding(cluster.center()));
    }
}
