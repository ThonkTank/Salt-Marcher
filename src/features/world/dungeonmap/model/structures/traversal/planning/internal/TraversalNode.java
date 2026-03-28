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
        int levelZ,
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
        anchor = normalizeAnchor(anchor, levelZ, roomAnchor, anchorCells, fixedDoorBinding);
        Objects.requireNonNull(anchor, "anchor");
        levelZ = anchor.z();
        anchorCells = normalizeAnchorCells(anchorCells, anchor);
    }

    public static TraversalNode roomPortal(
            TraversalNodeId nodeId,
            TraversalRoomAnchor roomAnchor,
            int levelZ,
            Set<CubePoint> occupiedCells,
            ResolvedCorridorDoorBinding fixedDoorBinding
    ) {
        return new TraversalNode(
                nodeId,
                TraversalNodeKind.ROOM_PORTAL,
                null,
                occupiedCells,
                levelZ,
                roomAnchor,
                fixedDoorBinding);
    }

    public static TraversalNode waypoint(TraversalNodeId nodeId, CubePoint anchor) {
        return new TraversalNode(nodeId, TraversalNodeKind.WAYPOINT, anchor, Set.of(anchor), anchor == null ? 0 : anchor.z(), null, null);
    }

    public Long roomId() {
        return roomAnchor == null ? null : roomAnchor.roomId();
    }

    public Set<CubePoint> occupiedCells() {
        return anchorCells;
    }

    public CubePoint boundEntryCell() {
        if (!hasFixedDoorBinding()) {
            return null;
        }
        return CubePoint.at(fixedDoorBinding.absoluteCell().add(fixedDoorBinding.direction()), levelZ);
    }

    public boolean hasFixedDoorBinding() {
        return fixedDoorBinding != null
                && fixedDoorBinding.absoluteCell() != null
                && fixedDoorBinding.direction() != null;
    }

    private static CubePoint normalizeAnchor(
            CubePoint anchor,
            int levelZ,
            TraversalRoomAnchor roomAnchor,
            Set<CubePoint> anchorCells,
            ResolvedCorridorDoorBinding fixedDoorBinding
    ) {
        if (anchor != null) {
            return anchor;
        }
        CubePoint boundEntryCell = boundEntryCell(fixedDoorBinding, levelZ);
        if (boundEntryCell != null) {
            return boundEntryCell;
        }
        if (roomAnchor != null && roomAnchor.anchorCell() != null) {
            return CubePoint.at(roomAnchor.anchorCell(), levelZ);
        }
        return firstAnchorCell(anchorCells);
    }

    private static Set<CubePoint> normalizeAnchorCells(
            Set<CubePoint> anchorCells,
            CubePoint anchor
    ) {
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        addAll(result, anchorCells);
        if (result.isEmpty() && anchor != null) {
            result.add(anchor);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static CubePoint boundEntryCell(
            ResolvedCorridorDoorBinding fixedDoorBinding,
            int levelZ
    ) {
        if (fixedDoorBinding == null
                || fixedDoorBinding.absoluteCell() == null
                || fixedDoorBinding.direction() == null) {
            return null;
        }
        return CubePoint.at(fixedDoorBinding.absoluteCell().add(fixedDoorBinding.direction()), levelZ);
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
