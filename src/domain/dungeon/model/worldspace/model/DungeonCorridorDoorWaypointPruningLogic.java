package src.domain.dungeon.model.worldspace.model;

import java.util.List;

final class DungeonCorridorDoorWaypointPruningLogic {
    private static final int NOT_FOUND = -1;
    private static final DungeonMapLookupLogic LOOKUP_SERVICE = new DungeonMapLookupLogic();

    List<DungeonCorridorWaypoint> waypointsAfterDoorRemoval(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            DungeonCorridorDoorBinding removed
    ) {
        DungeonCell anchorCell = firstAnchorCell(corridor);
        DungeonCell remainingDoorCell = firstRemainingDoorCell(dungeonMap, corridor, removed);
        if (anchorCell == null || remainingDoorCell == null) {
            return corridor.bindings().waypoints();
        }
        int anchorIndex = waypointIndexAt(dungeonMap, corridor, anchorCell);
        int doorIndex = waypointIndexAt(dungeonMap, corridor, remainingDoorCell);
        if (anchorIndex < 0 || doorIndex < 0 || Math.abs(anchorIndex - doorIndex) <= 1) {
            return List.of();
        }
        int start = Math.min(anchorIndex, doorIndex) + 1;
        int end = Math.max(anchorIndex, doorIndex);
        return List.copyOf(corridor.bindings().waypoints().subList(start, end));
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
}
