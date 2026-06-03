package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;

public record CorridorRoutePlan(
        List<Cell> cells,
        long waypointClusterId,
        Cell waypointClusterCenter
) {
    private static final int MINIMUM_INTERIOR_SPLIT_ROUTE_CELLS = 3;
    private static final long MISSING_CLUSTER_ID = 0L;

    public CorridorRoutePlan {
        cells = cells == null ? List.of() : List.copyOf(cells);
        waypointClusterId = Math.max(MISSING_CLUSTER_ID, waypointClusterId);
        Objects.requireNonNull(waypointClusterCenter);
    }

    public CorridorBindings bindInteriorAnchors(CorridorBindings bindings, List<CorridorAnchor> routeAnchors) {
        Objects.requireNonNull(bindings);
        if (!canBindInteriorAnchors()) {
            return bindings;
        }
        CorridorBindings updated = bindings;
        List<CorridorWaypoint> waypoints = new ArrayList<>();
        Set<Long> attachedAnchorIds = new LinkedHashSet<>();
        for (int index = 1; index < cells.size() - 1; index++) {
            CorridorAnchor anchor = routeAnchorAt(cells.get(index), routeAnchors);
            if (anchor != null && attachedAnchorIds.add(anchor.anchorId())) {
                updated = updated.withAnchorRef(new CorridorAnchorRef(anchor.hostCorridorId(), anchor.anchorId()));
                waypoints.add(waypointFor(anchor.position()));
            }
        }
        return waypoints.isEmpty() ? updated : updated.withWaypoints(waypoints);
    }

    private boolean canBindInteriorAnchors() {
        return cells.size() >= MINIMUM_INTERIOR_SPLIT_ROUTE_CELLS && waypointClusterId > MISSING_CLUSTER_ID;
    }

    private CorridorWaypoint waypointFor(Cell absoluteCell) {
        return new CorridorWaypoint(
                waypointClusterId,
                new Cell(
                        absoluteCell.q() - waypointClusterCenter.q(),
                        absoluteCell.r() - waypointClusterCenter.r(),
                        absoluteCell.level()),
                absoluteCell.level());
    }

    private static CorridorAnchor routeAnchorAt(Cell cell, List<CorridorAnchor> routeAnchors) {
        CorridorAnchor result = null;
        for (CorridorAnchor anchor : routeAnchors == null ? List.<CorridorAnchor>of() : routeAnchors) {
            if (anchor != null && anchor.matchesPosition(cell) && betterAnchor(anchor, result)) {
                result = anchor;
            }
        }
        return result;
    }

    private static boolean betterAnchor(CorridorAnchor candidate, CorridorAnchor current) {
        if (current == null) {
            return true;
        }
        int hostComparison = Long.compare(candidate.hostCorridorId(), current.hostCorridorId());
        if (hostComparison != 0) {
            return hostComparison < 0;
        }
        return candidate.anchorId() < current.anchorId();
    }
}
