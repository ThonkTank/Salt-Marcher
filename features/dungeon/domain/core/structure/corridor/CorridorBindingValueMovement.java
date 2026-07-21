package features.dungeon.domain.core.structure.corridor;

import features.dungeon.domain.core.component.CorridorDoorBinding;
import java.util.ArrayList;
import java.util.List;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.geometry.Cell;

final class CorridorBindingValueMovement {
    private CorridorBindingValueMovement() {
    }

    static CorridorBindings moveDoorBinding(
            CorridorBindings source,
            int bindingIndex,
            long roomId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<CorridorDoorBinding> sourceDoorBindings = source.doorBindings();
        if (bindingIndex < 0 || bindingIndex >= sourceDoorBindings.size()) {
            return source;
        }
        List<CorridorDoorBinding> updated = new ArrayList<>();
        boolean changed = false;
        for (int index = 0; index < sourceDoorBindings.size(); index++) {
            CorridorDoorBinding binding = sourceDoorBindings.get(index);
            if (index == bindingIndex && binding.roomId() == roomId) {
                updated.add(new CorridorDoorBinding(
                        binding.roomId(),
                        binding.clusterId(),
                        movedCell(binding.roomCell(), deltaQ, deltaR, deltaLevel),
                        binding.direction(),
                        binding.topologyRef()));
                changed = true;
            } else {
                updated.add(binding);
            }
        }
        return changed
                ? new CorridorBindings(source.waypoints(), updated, source.anchorBindings(), source.anchorRefs())
                : source;
    }

    static CorridorBindings moveAnchorBinding(
            CorridorBindings source,
            int bindingIndex,
            long anchorId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<CorridorAnchor> sourceAnchorBindings = source.anchorBindings();
        List<CorridorAnchor> updated = new ArrayList<>();
        boolean changed = false;
        for (int index = 0; index < sourceAnchorBindings.size(); index++) {
            CorridorAnchor anchor = sourceAnchorBindings.get(index);
            if (index == bindingIndex || anchor.anchorId() == anchorId) {
                updated.add(anchor.withPosition(movedCell(anchor.position(), deltaQ, deltaR, deltaLevel)));
                changed = true;
            } else {
                updated.add(anchor);
            }
        }
        return changed ? source.replaceAnchorBindings(updated) : source;
    }

    static CorridorBindings moveWaypoint(
            CorridorBindings source,
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
                        movedCell(waypoint.cell(), deltaQ, deltaR, deltaLevel)));
                changed = true;
            } else {
                updated.add(waypoint);
            }
        }
        return changed
                ? new CorridorBindings(updated, source.doorBindings(), source.anchorBindings(), source.anchorRefs())
                : source;
    }

    private static Cell movedCell(Cell cell, int deltaQ, int deltaR, int deltaLevel) {
        Cell safeCell = cell == null ? new Cell(0, 0, 0) : cell;
        return new Cell(safeCell.q() + deltaQ, safeCell.r() + deltaR, safeCell.level() + deltaLevel);
    }
}
