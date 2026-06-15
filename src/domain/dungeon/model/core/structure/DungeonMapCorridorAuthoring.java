package src.domain.dungeon.model.core.structure;

import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindingMovement;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindingMovement.DoorBindingMoveResult;
import src.domain.dungeon.model.core.structure.corridor.CorridorMapAuthoring;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.door.DoorBoundaryRelocation;

final class DungeonMapCorridorAuthoring {
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
        return doorBoundaryRelocation.relocateMovedDoorBinding(
                movement.sourceMap(),
                movement.movedMap(),
                movement.oldBinding(),
                movement.newBinding());
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

    DungeonMap createCorridor(DungeonMap dungeonMap, long stairId, DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        return corridorAuthoring.createCorridor(dungeonMap, stairId, start, end);
    }

    DungeonMap deleteCorridor(
            DungeonMap dungeonMap,
            long corridorId,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        return corridorAuthoring.deleteCorridor(
                dungeonMap,
                corridorId,
                targetKind,
                topologyRefId,
                roomId,
                waypointIndex);
    }

}
