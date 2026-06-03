package src.domain.dungeon.model.worldspace;

import java.util.Objects;
import src.domain.dungeon.model.core.structure.corridor.CorridorNetwork;

final class DungeonCorridorMergeDeleteLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonCorridorMutationRules MUTATION_RULES =
            new DungeonCorridorMutationRules();
    private static final DungeonMapLookupLogic LOOKUP_SERVICE = new DungeonMapLookupLogic();
    private static final DungeonCorridorTargetDeleteLogic TARGET_DELETE_SERVICE =
            new DungeonCorridorTargetDeleteLogic();

    DungeonMap deleteCorridor(
            DungeonMap dungeonMap,
            long corridorId,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (MUTATION_RULES.invalidCorridorId(corridorId)) {
            return dungeonMap;
        }
        DungeonCorridor existing = LOOKUP_SERVICE.corridor(dungeonMap, corridorId);
        if (existing == null) {
            return dungeonMap;
        }
        String safeKind = targetKind == null ? "CORRIDOR" : targetKind;
        if (!"CORRIDOR".equals(safeKind)) {
            return TARGET_DELETE_SERVICE.deleteTarget(
                    dungeonMap,
                    existing,
                    safeKind,
                    topologyRefId,
                    roomId,
                    waypointIndex);
        }
        CorridorNetwork network = DungeonCorridorTopologyIdentityAdapter.toCoreNetwork(dungeonMap.connections().corridors());
        if (!network.canDeleteCorridor(corridorId)) {
            return dungeonMap;
        }
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        DungeonCorridorTopologyIdentityAdapter.fromCoreNetwork(
                                dungeonMap.connections().corridors(),
                                network.withoutCorridor(corridorId)),
                        dungeonMap.connections().withoutCorridorBoundStairs(corridorId).stairs(),
                        dungeonMap.connections().transitions()));
    }
}
