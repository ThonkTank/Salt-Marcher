package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMapLookupAdapter;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorBinding;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingState;
import src.domain.dungeon.model.core.structure.corridor.CorridorTargetDeletion;
import src.domain.dungeon.model.core.structure.corridor.CorridorTargetDeletion.AnchorTarget;
import src.domain.dungeon.model.core.structure.corridor.CorridorTargetDeletion.DoorBindingTarget;
import src.domain.dungeon.model.core.structure.corridor.CorridorTargetDeletion.WaypointTarget;
import src.domain.dungeon.model.core.structure.corridor.CorridorNetwork;
import src.domain.dungeon.model.core.structure.stair.StairCollection;

final class DungeonCorridorMergeDeleteLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonMapLookupAdapter LOOKUP_ADAPTER = new DungeonMapLookupAdapter();
    private static final CorridorTargetDeletion TARGET_DELETION =
            new CorridorTargetDeletion();

    DungeonMap deleteCorridor(
            DungeonMap dungeonMap,
            long corridorId,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (invalidCorridorId(corridorId)) {
            return dungeonMap;
        }
        DungeonCorridor existing = LOOKUP_ADAPTER.corridor(dungeonMap, corridorId);
        if (existing == null) {
            return dungeonMap;
        }
        String safeKind = targetKind == null ? "CORRIDOR" : targetKind;
        if (!"CORRIDOR".equals(safeKind)) {
            return deleteTarget(
                    dungeonMap,
                    existing,
                    safeKind,
                    topologyRefId,
                    roomId,
                    waypointIndex);
        }
        CorridorNetwork network = DungeonCorridor.coreNetwork(dungeonMap.corridors());
        if (!network.canDeleteCorridor(corridorId)) {
            return dungeonMap;
        }
        StairCollection withoutCorridorStairs =
                dungeonMap.stairs().withoutCorridorBoundStairs(corridorId);
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                DungeonCorridor.fromCoreNetwork(
                        dungeonMap.corridors(),
                        network.withoutCorridor(corridorId)),
                withoutCorridorStairs,
                dungeonMap.transitionCatalog());
    }

    private static boolean invalidCorridorId(long corridorId) {
        return corridorId <= 0L;
    }

    private DungeonMap deleteTarget(
            DungeonMap dungeonMap,
            DungeonCorridor existing,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        Corridor current = existing.toCore();
        Corridor updatedCore = TARGET_DELETION.deleteTarget(
                current,
                targetKind,
                topologyRefId,
                roomId,
                waypointIndex,
                doorTargets(dungeonMap, existing),
                anchorTargets(existing),
                waypointTargets(dungeonMap, existing));
        if (updatedCore.equals(current)) {
            return dungeonMap;
        }
        DungeonCorridor updated = DungeonCorridor.fromCore(existing, updatedCore, null);
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                withUpdatedCorridor(dungeonMap, updated),
                dungeonMap.stairs(),
                dungeonMap.transitionCatalog());
    }

    private List<DungeonCorridor> withUpdatedCorridor(DungeonMap dungeonMap, DungeonCorridor updated) {
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.corridors()) {
            nextCorridors.add(corridor.corridorId() == updated.corridorId() ? updated : corridor);
        }
        return List.copyOf(nextCorridors);
    }

    private List<DoorBindingTarget> doorTargets(DungeonMap dungeonMap, DungeonCorridor corridor) {
        List<DoorBindingTarget> result = new ArrayList<>();
        for (CorridorDoorBindingState binding : corridor.bindings().doorBindings()) {
            if (binding != null) {
                result.add(new DoorBindingTarget(
                        binding.toCore(),
                        binding.topologyRef().id(),
                        absoluteDoorCorridorCell(dungeonMap, binding)));
            }
        }
        return List.copyOf(result);
    }

    private List<AnchorTarget> anchorTargets(DungeonCorridor corridor) {
        List<AnchorTarget> result = new ArrayList<>();
        for (CorridorAnchorBinding binding : corridor.bindings().anchorBindings()) {
            if (binding != null) {
                result.add(new AnchorTarget(binding.absoluteCell()));
            }
        }
        return List.copyOf(result);
    }

    private List<WaypointTarget> waypointTargets(DungeonMap dungeonMap, DungeonCorridor corridor) {
        List<WaypointTarget> result = new ArrayList<>();
        for (CorridorWaypoint waypoint : corridor.bindings().waypoints()) {
            DungeonRoomCluster cluster = LOOKUP_ADAPTER.cluster(dungeonMap, waypoint.clusterId());
            Cell center = cluster == null ? new Cell(0, 0, waypoint.relativeCell().level()) : cluster.center();
            result.add(WaypointTarget.from(waypoint, center));
        }
        return List.copyOf(result);
    }

    private Cell absoluteDoorCorridorCell(DungeonMap dungeonMap, CorridorDoorBindingState binding) {
        DungeonRoomCluster cluster = LOOKUP_ADAPTER.cluster(dungeonMap, binding.clusterId());
        Cell center = cluster == null ? new Cell(0, 0, binding.relativeCell().level()) : cluster.center();
        return binding.direction().neighborOf(new Cell(
                binding.relativeCell().q() + center.q(),
                binding.relativeCell().r() + center.r(),
                binding.relativeCell().level()));
    }
}
