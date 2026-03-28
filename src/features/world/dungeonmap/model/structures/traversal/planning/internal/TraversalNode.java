package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.traversal.TraversalRoomAnchor;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

public record TraversalNode(
        TraversalNodeId nodeId,
        TraversalNodeKind kind,
        CubePoint anchor,
        Set<CubePoint> anchorCells,
        TraversalRoomAnchor roomAnchor,
        ResolvedCorridorDoorBinding fixedDoorBinding
) {
    public TraversalNode {
        Objects.requireNonNull(nodeId, "nodeId");
        Objects.requireNonNull(kind, "kind");
        if (kind == TraversalNodeKind.ROOM_PORTAL) {
            Objects.requireNonNull(roomAnchor, "roomAnchor");
        } else {
            roomAnchor = null;
            fixedDoorBinding = null;
        }
        anchor = normalizeAnchor(anchor, roomAnchor, anchorCells);
        Objects.requireNonNull(anchor, "anchor");
        anchorCells = normalizeAnchorCells(anchorCells, roomAnchor, anchor);
    }

    public static TraversalNode roomPortal(
            TraversalNodeId nodeId,
            TraversalRoomAnchor roomAnchor,
            ResolvedCorridorDoorBinding fixedDoorBinding
    ) {
        return new TraversalNode(
                nodeId,
                TraversalNodeKind.ROOM_PORTAL,
                null,
                roomAnchor == null ? Set.of() : roomAnchor.occupiedCells(),
                roomAnchor,
                fixedDoorBinding);
    }

    public static TraversalNode waypoint(TraversalNodeId nodeId, CubePoint anchor) {
        return new TraversalNode(nodeId, TraversalNodeKind.WAYPOINT, anchor, Set.of(anchor), null, null);
    }

    public Long roomId() {
        return roomAnchor == null ? null : roomAnchor.roomId();
    }

    public Set<CubePoint> occupiedCells() {
        if (kind != TraversalNodeKind.ROOM_PORTAL) {
            return anchorCells;
        }
        if (roomAnchor != null && !roomAnchor.occupiedCells().isEmpty()) {
            return roomAnchor.occupiedCells();
        }
        return anchorCells;
    }

    public Set<Integer> levels() {
        if (roomAnchor != null && !roomAnchor.levels().isEmpty()) {
            return roomAnchor.levels();
        }
        return Set.of(anchor.z());
    }

    public boolean hasFixedDoorBinding() {
        return fixedDoorBinding != null
                && fixedDoorBinding.absoluteCell() != null
                && fixedDoorBinding.direction() != null;
    }

    private static CubePoint normalizeAnchor(
            CubePoint anchor,
            TraversalRoomAnchor roomAnchor,
            Set<CubePoint> anchorCells
    ) {
        if (anchor != null) {
            return anchor;
        }
        if (roomAnchor != null && roomAnchor.anchorCell() != null) {
            return CubePoint.at(roomAnchor.anchorCell(), roomAnchor.primaryLevel());
        }
        return firstAnchorCell(anchorCells);
    }

    private static Set<CubePoint> normalizeAnchorCells(
            Set<CubePoint> anchorCells,
            TraversalRoomAnchor roomAnchor,
            CubePoint anchor
    ) {
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        addAll(result, anchorCells);
        if (result.isEmpty() && roomAnchor != null) {
            addAll(result, roomAnchor.occupiedCells());
        }
        if (result.isEmpty() && anchor != null) {
            result.add(anchor);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static CubePoint firstAnchorCell(Set<CubePoint> anchorCells) {
        if (anchorCells == null || anchorCells.isEmpty()) {
            return null;
        }
        return anchorCells.stream()
                .filter(Objects::nonNull)
                .min(CubePoint.POINT_ORDER)
                .orElse(null);
    }

    private static void addAll(Set<CubePoint> target, Set<CubePoint> points) {
        if (target == null || points == null) {
            return;
        }
        for (CubePoint point : points) {
            if (point != null) {
                target.add(point);
            }
        }
    }

    public enum TraversalNodeKind {
        ROOM_PORTAL,
        WAYPOINT
    }
}
