package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.corridor.CorridorTargetDeletion.AnchorTarget;
import src.domain.dungeon.model.core.structure.corridor.CorridorTargetDeletion.DoorBindingTarget;
import src.domain.dungeon.model.core.structure.corridor.CorridorTargetDeletion.WaypointTarget;
import src.domain.dungeon.model.core.structure.topology.DungeonMapTopology.DungeonTopologyBinding;
import src.domain.dungeon.model.core.structure.stair.StairCollection;

final class CorridorDeletion {
    private static final long NO_ID = 0L;

    private static final CorridorConnectionNormalization CONNECTION_NORMALIZATION =
            new CorridorConnectionNormalization();
    private static final CorridorTargetDeletion TARGET_DELETION =
            new CorridorTargetDeletion();
    private static final CorridorReplacementRouteValidation REPLACEMENT_ROUTE_VALIDATION =
            new CorridorReplacementRouteValidation();

    DungeonMap deleteCorridor(
            DungeonMap dungeonMap,
            CorridorDeletionTarget target
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (target == null || !target.hasCorridor()) {
            return dungeonMap;
        }
        long corridorId = target.corridorId();
        Corridor existing = CorridorMapLookup.corridor(dungeonMap, corridorId);
        if (existing == null) {
            return dungeonMap;
        }
        if (!target.wholeCorridor()) {
            return deleteTarget(dungeonMap, existing, target);
        }
        CorridorNetwork network = new CorridorNetwork(dungeonMap.corridors());
        if (!network.canDeleteCorridor(corridorId)) {
            return dungeonMap;
        }
        StairCollection withoutCorridorStairs =
                dungeonMap.stairs().withoutCorridorBoundStairs(corridorId);
        return CONNECTION_NORMALIZATION.copyWithConnections(
                dungeonMap,
                network.withoutCorridor(corridorId).corridors(),
                withoutCorridorStairs,
                dungeonMap.transitionCatalog());
    }

    private DungeonMap deleteTarget(
            DungeonMap dungeonMap,
            Corridor existing,
            CorridorDeletionTarget target
    ) {
        CorridorDeletionTarget resolvedTarget = resolvedTopologyTarget(dungeonMap, existing, target);
        Corridor updatedCore = TARGET_DELETION.deleteTarget(
                existing,
                resolvedTarget,
                doorTargets(dungeonMap, existing),
                anchorTargets(existing),
                waypointTargets(dungeonMap, existing));
        if (updatedCore.equals(existing)) {
            return dungeonMap;
        }
        Corridor updated = Corridor.fromCore(existing, updatedCore, null);
        List<Corridor> candidateCorridors = withUpdatedCorridor(dungeonMap, updated);
        if (!REPLACEMENT_ROUTE_VALIDATION.hasValidReplacementRoute(dungeonMap, updated, candidateCorridors)) {
            return dungeonMap;
        }
        return CONNECTION_NORMALIZATION.copyWithConnections(
                dungeonMap,
                candidateCorridors,
                dungeonMap.stairs(),
                dungeonMap.transitionCatalog());
    }

    private static CorridorDeletionTarget resolvedTopologyTarget(
            DungeonMap dungeonMap,
            Corridor corridor,
            CorridorDeletionTarget target
    ) {
        if (!target.corridorAnchor() || target.topologyRefId() <= NO_ID) {
            return target;
        }
        DungeonTopologyBinding binding = dungeonMap.topologyIndex().binding(
                new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR_ANCHOR, target.topologyRefId()));
        if (binding != null && binding.corridorId() == corridor.corridorId() && binding.localElementId() > NO_ID) {
            return CorridorDeletionTarget.corridorAnchor(target.corridorId(), binding.localElementId());
        }
        return target;
    }

    private static List<Corridor> withUpdatedCorridor(DungeonMap dungeonMap, Corridor updated) {
        List<Corridor> nextCorridors = new ArrayList<>();
        for (Corridor corridor : dungeonMap.corridors()) {
            nextCorridors.add(corridor.corridorId() == updated.corridorId() ? updated : corridor);
        }
        return List.copyOf(nextCorridors);
    }

    private static List<DoorBindingTarget> doorTargets(DungeonMap dungeonMap, Corridor corridor) {
        List<DoorBindingTarget> result = new ArrayList<>();
        for (CorridorDoorBindingState binding : corridor.stateBindings().doorBindings()) {
            if (binding != null) {
                result.add(new DoorBindingTarget(
                        binding.toCore(),
                        binding.topologyRef().id(),
                        absoluteDoorCorridorCell(dungeonMap, binding)));
            }
        }
        return List.copyOf(result);
    }

    private static List<AnchorTarget> anchorTargets(Corridor corridor) {
        List<AnchorTarget> result = new ArrayList<>();
        for (var anchor : corridor.stateBindings().anchorBindings()) {
            if (anchor != null) {
                result.add(new AnchorTarget(anchor.position()));
            }
        }
        return List.copyOf(result);
    }

    private static List<WaypointTarget> waypointTargets(DungeonMap dungeonMap, Corridor corridor) {
        List<WaypointTarget> result = new ArrayList<>();
        for (CorridorWaypoint waypoint : corridor.stateBindings().waypoints()) {
            Cell center = CorridorMapLookup.clusterCenterOrOrigin(
                    dungeonMap,
                    waypoint.clusterId(),
                    waypoint.relativeCell().level());
            result.add(WaypointTarget.from(waypoint, center));
        }
        return List.copyOf(result);
    }

    private static Cell absoluteDoorCorridorCell(DungeonMap dungeonMap, CorridorDoorBindingState binding) {
        Cell center = CorridorMapLookup.clusterCenterOrOrigin(
                dungeonMap,
                binding.clusterId(),
                binding.relativeCell().level());
        return binding.direction().neighborOf(new Cell(
                binding.relativeCell().q() + center.q(),
                binding.relativeCell().r() + center.r(),
                binding.relativeCell().level()));
    }
}
