package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

final class CorridorBindingStateMovement {
    private CorridorBindingStateMovement() {
    }

    static CorridorBindingState moveDoorBinding(
            CorridorBindingState source,
            int bindingIndex,
            long roomId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<CorridorDoorBindingState> sourceDoorBindings = source.doorBindings();
        if (bindingIndex < 0 || bindingIndex >= sourceDoorBindings.size()) {
            return source;
        }
        List<CorridorDoorBindingState> updated = new ArrayList<>();
        boolean changed = false;
        for (int index = 0; index < sourceDoorBindings.size(); index++) {
            CorridorDoorBindingState binding = sourceDoorBindings.get(index);
            if (index == bindingIndex && binding.roomId() == roomId) {
                updated.add(new CorridorDoorBindingState(
                        binding.roomId(),
                        binding.clusterId(),
                        movedCell(binding.relativeCell(), deltaQ, deltaR, deltaLevel),
                        binding.direction(),
                        binding.topologyRef()));
                changed = true;
            } else {
                updated.add(binding);
            }
        }
        return changed
                ? new CorridorBindingState(source.waypoints(), updated, source.anchorBindings(), source.anchorRefs())
                : source;
    }

    static CorridorBindingState moveAnchorBinding(
            CorridorBindingState source,
            int bindingIndex,
            DungeonTopologyRef topologyRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        DungeonTopologyRef safeTopologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        List<CorridorAnchorBinding> sourceAnchorBindings = source.anchorBindings();
        List<CorridorAnchorBinding> updated = new ArrayList<>();
        boolean changed = false;
        for (int index = 0; index < sourceAnchorBindings.size(); index++) {
            CorridorAnchorBinding binding = sourceAnchorBindings.get(index);
            if (index == bindingIndex || binding.topologyRef().equals(safeTopologyRef)) {
                updated.add(binding.withAbsoluteCell(movedCell(binding.absoluteCell(), deltaQ, deltaR, deltaLevel)));
                changed = true;
            } else {
                updated.add(binding);
            }
        }
        return changed ? source.replaceAnchorBindings(updated) : source;
    }

    static CorridorBindingState moveWaypoint(
            CorridorBindingState source,
            int waypointIndex,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<CorridorWaypoint> sourceWaypoints = source.waypoints();
        if (waypointIndex < 0 || waypointIndex >= sourceWaypoints.size()) {
            return source;
        }
        List<CorridorWaypoint> updated = new ArrayList<>();
        boolean changed = false;
        for (int index = 0; index < sourceWaypoints.size(); index++) {
            CorridorWaypoint waypoint = sourceWaypoints.get(index);
            if (index == waypointIndex) {
                updated.add(new CorridorWaypoint(
                        waypoint.clusterId(),
                        movedCell(waypoint.relativeCell(), deltaQ, deltaR, deltaLevel),
                        waypoint.level() + deltaLevel));
                changed = true;
            } else {
                updated.add(waypoint);
            }
        }
        return changed
                ? new CorridorBindingState(updated, source.doorBindings(), source.anchorBindings(), source.anchorRefs())
                : source;
    }

    private static Cell movedCell(Cell cell, int deltaQ, int deltaR, int deltaLevel) {
        Cell safeCell = cell == null ? new Cell(0, 0, 0) : cell;
        return new Cell(safeCell.q() + deltaQ, safeCell.r() + deltaR, safeCell.level() + deltaLevel);
    }
}
