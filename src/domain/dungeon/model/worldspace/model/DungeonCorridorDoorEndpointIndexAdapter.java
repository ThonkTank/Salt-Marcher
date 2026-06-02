package src.domain.dungeon.model.worldspace.model;

final class DungeonCorridorDoorEndpointIndexAdapter {
    private static final int NOT_FOUND = -1;
    private static final DungeonMapLookupLogic LOOKUP_SERVICE = new DungeonMapLookupLogic();

    EndpointIndexes afterDoorRemoval(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            DungeonCorridorDoorBinding removed
    ) {
        DungeonCell anchorCell = firstAnchorCell(corridor);
        DungeonCell remainingDoorCell = firstRemainingDoorCell(dungeonMap, corridor, removed);
        if (anchorCell == null || remainingDoorCell == null) {
            return EndpointIndexes.unpruned();
        }
        return EndpointIndexes.pruned(
                waypointIndexAt(dungeonMap, corridor, anchorCell),
                waypointIndexAt(dungeonMap, corridor, remainingDoorCell));
    }

    private DungeonCell firstAnchorCell(DungeonCorridor corridor) {
        for (DungeonCorridorAnchorBinding binding : corridor.bindings().anchorBindings()) {
            if (binding != null) {
                return binding.absoluteCell();
            }
        }
        return null;
    }

    private DungeonCell firstRemainingDoorCell(
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

    private DungeonCell absoluteDoorCorridorCell(DungeonMap dungeonMap, DungeonCorridorDoorBinding binding) {
        DungeonRoomCluster cluster = LOOKUP_SERVICE.cluster(dungeonMap, binding.clusterId());
        DungeonCell center = cluster == null ? new DungeonCell(0, 0, binding.relativeCell().level()) : cluster.center();
        return binding.direction().neighborOf(new DungeonCell(
                binding.relativeCell().q() + center.q(),
                binding.relativeCell().r() + center.r(),
                binding.relativeCell().level()));
    }

    private int waypointIndexAt(DungeonMap dungeonMap, DungeonCorridor corridor, DungeonCell cell) {
        for (int index = 0; index < corridor.bindings().waypoints().size(); index++) {
            DungeonCorridorWaypoint waypoint = corridor.bindings().waypoints().get(index);
            DungeonRoomCluster cluster = LOOKUP_SERVICE.cluster(dungeonMap, waypoint.clusterId());
            DungeonCell center = cluster == null ? new DungeonCell(0, 0, cell.level()) : cluster.center();
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
