package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMapLookupAdapter;
import src.domain.dungeon.model.core.structure.corridor.Corridor;

final class DungeonCorridorDoorTargetDeleteLogic {
    private static final long NO_ID = 0L;
    private static final int NOT_FOUND = -1;
    private static final DungeonMapLookupAdapter LOOKUP_ADAPTER = new DungeonMapLookupAdapter();

    Corridor deleteDoor(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            Corridor current,
            long topologyRefId,
            long roomId
    ) {
        DungeonCorridorDoorBinding removed = removedDoorBinding(corridor, topologyRefId, roomId);
        if (removed == null) {
            return current;
        }
        EndpointIndexes endpointIndexes = endpointIndexesAfterDoorRemoval(dungeonMap, corridor, removed);
        return current.withoutDoorTarget(
                removed.toCore(),
                endpointIndexes.pruneWaypoints(),
                endpointIndexes.firstEndpointIndex(),
                endpointIndexes.secondEndpointIndex());
    }

    private DungeonCorridorDoorBinding removedDoorBinding(DungeonCorridor corridor, long topologyRefId, long roomId) {
        for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
            if (binding != null && matchesDoorBinding(binding, topologyRefId, roomId)) {
                return binding;
            }
        }
        return null;
    }

    private boolean matchesDoorBinding(DungeonCorridorDoorBinding binding, long topologyRefId, long roomId) {
        return (topologyRefId > NO_ID && binding.topologyRef().id() == topologyRefId)
                || (roomId > NO_ID && binding.roomId() == roomId);
    }

    private EndpointIndexes endpointIndexesAfterDoorRemoval(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            DungeonCorridorDoorBinding removed
    ) {
        Cell anchorCell = firstAnchorCell(corridor);
        Cell remainingDoorCell = firstRemainingDoorCell(dungeonMap, corridor, removed);
        if (anchorCell == null || remainingDoorCell == null) {
            return EndpointIndexes.unpruned();
        }
        return EndpointIndexes.pruned(
                waypointIndexAt(dungeonMap, corridor, anchorCell),
                waypointIndexAt(dungeonMap, corridor, remainingDoorCell));
    }

    private Cell firstAnchorCell(DungeonCorridor corridor) {
        for (DungeonCorridorAnchorBinding binding : corridor.bindings().anchorBindings()) {
            if (binding != null) {
                return binding.absoluteCell();
            }
        }
        return null;
    }

    private Cell firstRemainingDoorCell(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            DungeonCorridorDoorBinding removed
    ) {
        for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
            if (binding != null && !binding.equals(removed)) {
                return absoluteDoorCorridorCell(dungeonMap, binding);
            }
        }
        return null;
    }

    private Cell absoluteDoorCorridorCell(DungeonMap dungeonMap, DungeonCorridorDoorBinding binding) {
        DungeonRoomCluster cluster = LOOKUP_ADAPTER.cluster(dungeonMap, binding.clusterId());
        Cell center = cluster == null ? new Cell(0, 0, binding.relativeCell().level()) : cluster.center();
        return binding.direction().neighborOf(new Cell(
                binding.relativeCell().q() + center.q(),
                binding.relativeCell().r() + center.r(),
                binding.relativeCell().level()));
    }

    private int waypointIndexAt(DungeonMap dungeonMap, DungeonCorridor corridor, Cell cell) {
        for (int index = 0; index < corridor.bindings().waypoints().size(); index++) {
            CorridorWaypoint waypoint = corridor.bindings().waypoints().get(index);
            DungeonRoomCluster cluster = LOOKUP_ADAPTER.cluster(dungeonMap, waypoint.clusterId());
            Cell center = cluster == null ? new Cell(0, 0, cell.level()) : cluster.center();
            if (waypoint.absoluteCell(center).equals(cell)) {
                return index;
            }
        }
        return NOT_FOUND;
    }

    record EndpointIndexes(
            boolean pruneWaypoints,
            int firstEndpointIndex,
            int secondEndpointIndex
    ) {
        static EndpointIndexes unpruned() {
            return new EndpointIndexes(false, 0, 0);
        }

        static EndpointIndexes pruned(int firstEndpointIndex, int secondEndpointIndex) {
            return new EndpointIndexes(true, firstEndpointIndex, secondEndpointIndex);
        }
    }
}
