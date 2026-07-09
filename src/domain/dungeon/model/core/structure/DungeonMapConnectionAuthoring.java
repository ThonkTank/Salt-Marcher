package src.domain.dungeon.model.core.structure;

import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindingMovement;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindingMovement.DoorBindingMoveResult;
import src.domain.dungeon.model.core.structure.corridor.CorridorMapAuthoring;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.door.DoorBoundaryRelocation;
import src.domain.dungeon.model.core.structure.door.DoorBoundaryRelocation.DoorBoundaryMovePlan;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

final class DungeonMapConnectionAuthoring {
    private final CorridorMapAuthoring corridorAuthoring = new CorridorMapAuthoring();
    private final CorridorBindingMovement corridorBindingMovement = new CorridorBindingMovement();
    private final DoorBoundaryRelocation doorBoundaryRelocation = new DoorBoundaryRelocation();

    DungeonMap moveDoorBinding(
            DungeonMap dungeonMap,
            long corridorId,
            int bindingIndex,
            long roomId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        DoorBindingMoveResult movement = corridorBindingMovement.moveDoorBindingWithResult(
                dungeonMap,
                corridorId,
                bindingIndex,
                roomId,
                deltaQ,
                deltaR,
                deltaLevel);
        if (!movement.hasDoorBindingDelta()) {
            return dungeonMap;
        }
        DoorBoundaryMovePlan plan = doorBoundaryRelocation.planMovedDoorBinding(
                movement.sourceMap(),
                movement.oldBinding(),
                movement.newBinding());
        if (plan == null) {
            return dungeonMap;
        }
        DungeonMap movedMap = movement.movedMapOrSource();
        if (movedMap.equals(movement.sourceMap())) {
            return dungeonMap;
        }
        return withRelocatedDoorBoundary(movedMap, movement.sourceMap(), plan, movedMap.revision());
    }

    DungeonMap moveDoorBoundary(
            DungeonMap dungeonMap,
            DungeonTopologyRef topologyRef,
            long clusterId,
            long roomId,
            Edge sourceEdge,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        DoorBoundaryMovePlan plan = doorBoundaryRelocation.planMovedStandaloneDoorBoundary(
                dungeonMap,
                topologyRef,
                clusterId,
                roomId,
                sourceEdge,
                deltaQ,
                deltaR,
                deltaLevel);
        return plan == null
                ? dungeonMap
                : withRelocatedDoorBoundary(dungeonMap, dungeonMap, plan, dungeonMap.revision() + 1L);
    }

    DungeonMap moveCorridorAnchor(
            DungeonMap dungeonMap,
            long corridorId,
            int bindingIndex,
            DungeonTopologyRef topologyRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return corridorBindingMovement.moveAnchorBinding(
                dungeonMap,
                corridorId,
                bindingIndex,
                topologyRef,
                deltaQ,
                deltaR,
                deltaLevel);
    }

    DungeonMap moveCorridorWaypoint(
            DungeonMap dungeonMap,
            long corridorId,
            int waypointIndex,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return corridorBindingMovement.moveWaypoint(dungeonMap, corridorId, waypointIndex, deltaQ, deltaR, deltaLevel);
    }

    DungeonMap createCorridor(
            DungeonMap dungeonMap,
            long stairId,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        return corridorAuthoring.createCorridor(dungeonMap, stairId, start, end);
    }

    private DungeonMap withRelocatedDoorBoundary(
            DungeonMap baseMap,
            DungeonMap relocationSourceMap,
            DoorBoundaryMovePlan plan,
            long revision
    ) {
        SpatialTopology nextTopology = doorBoundaryRelocation.relocateMovedDoorBinding(relocationSourceMap, plan);
        return new DungeonMap(
                baseMap.metadata(),
                nextTopology,
                baseMap.topologyIndex(),
                baseMap.rooms(),
                baseMap.corridors(),
                baseMap.stairs(),
                baseMap.transitionCatalog(),
                baseMap.featureMarkers(),
                revision);
    }
}
