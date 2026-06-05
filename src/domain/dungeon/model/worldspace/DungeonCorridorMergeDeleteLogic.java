package src.domain.dungeon.model.worldspace;

import java.util.Objects;
import src.domain.dungeon.model.core.structure.DungeonMapLookupAdapter;
import src.domain.dungeon.model.core.structure.corridor.CorridorNetwork;
import src.domain.dungeon.model.core.structure.stair.StairCollection;

final class DungeonCorridorMergeDeleteLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonCorridorMutationRules MUTATION_RULES =
            new DungeonCorridorMutationRules();
    private static final DungeonMapLookupAdapter LOOKUP_ADAPTER = new DungeonMapLookupAdapter();
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
        DungeonCorridor existing = LOOKUP_ADAPTER.corridor(dungeonMap, corridorId);
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
        CorridorNetwork network = DungeonCorridor.coreNetwork(dungeonMap.connections().corridors());
        if (!network.canDeleteCorridor(corridorId)) {
            return dungeonMap;
        }
        StairCollection withoutCorridorStairs =
                DungeonStair.withoutCorridorBound(dungeonMap.connections().stairCollection(), corridorId);
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        DungeonCorridor.fromCoreNetwork(
                                dungeonMap.connections().corridors(),
                                network.withoutCorridor(corridorId)),
                        withoutCorridorStairs,
                        dungeonMap.connections().transitionCatalog()));
    }
}
