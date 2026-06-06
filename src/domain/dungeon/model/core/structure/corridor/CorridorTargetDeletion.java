package src.domain.dungeon.model.core.structure.corridor;

import java.util.List;
import src.domain.dungeon.model.core.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;

public final class CorridorTargetDeletion {
    private static final long NO_ID = 0L;
    private static final int NOT_FOUND = -1;

    public Corridor deleteTarget(
            Corridor current,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex,
            List<DoorBindingTarget> doorTargets,
            List<AnchorTarget> anchorTargets,
            List<WaypointTarget> waypointTargets
    ) {
        Corridor updatedCore = switch (targetKind) {
            case "DOOR" -> deleteDoor(
                    current,
                    topologyRefId,
                    roomId,
                    doorTargets,
                    anchorTargets,
                    waypointTargets);
            case "CORRIDOR_ANCHOR" -> current.withoutAnchorTarget(topologyRefId);
            case "CORRIDOR_WAYPOINT" -> current.withoutWaypointTarget(waypointIndex);
            default -> current;
        };
        if (updatedCore.equals(current) || updatedCore.endpointCount() < 2) {
            return current;
        }
        return updatedCore;
    }

    private Corridor deleteDoor(
            Corridor current,
            long topologyRefId,
            long roomId,
            List<DoorBindingTarget> doorTargets,
            List<AnchorTarget> anchorTargets,
            List<WaypointTarget> waypointTargets
    ) {
        DoorBindingTarget removed = removedDoorBinding(doorTargets, topologyRefId, roomId);
        if (removed == null) {
            return current;
        }
        EndpointIndexes endpointIndexes = endpointIndexesAfterDoorRemoval(
                doorTargets,
                anchorTargets,
                waypointTargets,
                removed);
        return current.withoutDoorTarget(
                removed.binding(),
                endpointIndexes.pruneWaypoints(),
                endpointIndexes.firstEndpointIndex(),
                endpointIndexes.secondEndpointIndex());
    }

    private DoorBindingTarget removedDoorBinding(List<DoorBindingTarget> doorTargets, long topologyRefId, long roomId) {
        for (DoorBindingTarget binding : doorTargets == null ? List.<DoorBindingTarget>of() : doorTargets) {
            if (binding != null && matchesDoorBinding(binding, topologyRefId, roomId)) {
                return binding;
            }
        }
        return null;
    }

    private boolean matchesDoorBinding(DoorBindingTarget binding, long topologyRefId, long roomId) {
        return (topologyRefId > NO_ID && binding.topologyRefId() == topologyRefId)
                || (roomId > NO_ID && binding.roomId() == roomId);
    }

    private EndpointIndexes endpointIndexesAfterDoorRemoval(
            List<DoorBindingTarget> doorTargets,
            List<AnchorTarget> anchorTargets,
            List<WaypointTarget> waypointTargets,
            DoorBindingTarget removed
    ) {
        Cell anchorCell = firstAnchorCell(anchorTargets);
        Cell remainingDoorCell = firstRemainingDoorCell(doorTargets, removed);
        if (anchorCell == null || remainingDoorCell == null) {
            return EndpointIndexes.unpruned();
        }
        return EndpointIndexes.pruned(
                waypointIndexAt(waypointTargets, anchorCell),
                waypointIndexAt(waypointTargets, remainingDoorCell));
    }

    private Cell firstAnchorCell(List<AnchorTarget> anchorTargets) {
        for (AnchorTarget target : anchorTargets == null ? List.<AnchorTarget>of() : anchorTargets) {
            if (target != null) {
                return target.absoluteCell();
            }
        }
        return null;
    }

    private Cell firstRemainingDoorCell(
            List<DoorBindingTarget> doorTargets,
            DoorBindingTarget removed
    ) {
        for (DoorBindingTarget binding : doorTargets == null ? List.<DoorBindingTarget>of() : doorTargets) {
            if (binding != null && !binding.equals(removed)) {
                return binding.corridorCell();
            }
        }
        return null;
    }

    private int waypointIndexAt(List<WaypointTarget> waypointTargets, Cell cell) {
        List<WaypointTarget> safeTargets = waypointTargets == null ? List.of() : waypointTargets;
        for (int index = 0; index < safeTargets.size(); index++) {
            WaypointTarget waypoint = safeTargets.get(index);
            if (waypoint.absoluteCell().equals(cell)) {
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

    public record DoorBindingTarget(
            CorridorDoorBinding binding,
            long topologyRefId,
            Cell corridorCell
    ) {
        public DoorBindingTarget {
            binding = binding == null
                    ? new CorridorDoorBinding(NO_ID, NO_ID, new Cell(0, 0, 0), Direction.NORTH)
                    : binding;
            corridorCell = corridorCell == null ? new Cell(0, 0, 0) : corridorCell;
        }

        long roomId() {
            return binding.roomId();
        }
    }

    public record AnchorTarget(Cell absoluteCell) {
        public AnchorTarget {
            absoluteCell = absoluteCell == null ? new Cell(0, 0, 0) : absoluteCell;
        }
    }

    public record WaypointTarget(Cell absoluteCell) {
        public WaypointTarget {
            absoluteCell = absoluteCell == null ? new Cell(0, 0, 0) : absoluteCell;
        }

        public static WaypointTarget from(CorridorWaypoint waypoint, Cell clusterCenter) {
            Cell center = clusterCenter == null ? new Cell(0, 0, 0) : clusterCenter;
            return new WaypointTarget(waypoint.absoluteCell(center));
        }
    }
}
