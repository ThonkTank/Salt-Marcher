package features.world.dungeonmap.model.structures.traversal.routing.internal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

public record TraversalNode(
        String nodeKey,
        TraversalNodeKind kind,
        CubePoint anchor,
        Set<CubePoint> anchorCells,
        int levelZ,
        Room room,
        FixedDoorBinding fixedDoorBinding
) {
    public TraversalNode {
        Objects.requireNonNull(nodeKey, "nodeKey");
        nodeKey = nodeKey.trim();
        if (nodeKey.isEmpty()) {
            throw new IllegalArgumentException("nodeKey must not be blank");
        }
        Objects.requireNonNull(kind, "kind");
        if (kind == TraversalNodeKind.ROOM_PORTAL) {
            Objects.requireNonNull(room, "room");
        } else {
            room = null;
            fixedDoorBinding = null;
        }
        anchor = normalizeAnchor(anchor, levelZ, room, anchorCells, fixedDoorBinding);
        Objects.requireNonNull(anchor, "anchor");
        levelZ = anchor.z();
        anchorCells = normalizeAnchorCells(kind, anchorCells, room, levelZ, anchor);
    }

    public static TraversalNode roomPortal(
            String nodeKey,
            Room room,
            int levelZ,
            Set<CubePoint> occupiedCells,
            FixedDoorBinding fixedDoorBinding
    ) {
        return new TraversalNode(
                nodeKey,
                TraversalNodeKind.ROOM_PORTAL,
                null,
                occupiedCells,
                levelZ,
                room,
                fixedDoorBinding);
    }

    public static TraversalNode waypoint(String nodeKey, CubePoint anchor) {
        return new TraversalNode(nodeKey, TraversalNodeKind.WAYPOINT, anchor, Set.of(anchor), anchor == null ? 0 : anchor.z(), null, null);
    }

    public Long roomId() {
        return room == null ? null : room.roomId();
    }

    public Set<CubePoint> occupiedCells() {
        return kind == TraversalNodeKind.ROOM_PORTAL
                ? roomOccupiedCells(room, levelZ)
                : anchorCells;
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
            Room room,
            Set<CubePoint> anchorCells,
            FixedDoorBinding fixedDoorBinding
    ) {
        if (anchor != null) {
            return anchor;
        }
        CubePoint boundEntryCell = boundEntryCell(fixedDoorBinding, levelZ);
        if (boundEntryCell != null) {
            return boundEntryCell;
        }
        CubePoint roomAnchor = roomAnchor(room, levelZ);
        if (roomAnchor != null) {
            return roomAnchor;
        }
        return firstAnchorCell(anchorCells);
    }

    private static Set<CubePoint> normalizeAnchorCells(
            TraversalNodeKind kind,
            Set<CubePoint> anchorCells,
            Room room,
            int levelZ,
            CubePoint anchor
    ) {
        if (kind == TraversalNodeKind.ROOM_PORTAL) {
            Set<CubePoint> roomCells = roomOccupiedCells(room, levelZ);
            if (!roomCells.isEmpty()) {
                return roomCells;
            }
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        addAll(result, anchorCells);
        if (result.isEmpty() && anchor != null) {
            result.add(anchor);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static CubePoint boundEntryCell(
            FixedDoorBinding fixedDoorBinding,
            int levelZ
    ) {
        if (fixedDoorBinding == null
                || fixedDoorBinding.absoluteCell() == null
                || fixedDoorBinding.direction() == null) {
            return null;
        }
        return CubePoint.at(fixedDoorBinding.absoluteCell().add(fixedDoorBinding.direction()), levelZ);
    }

    private static CubePoint roomAnchor(Room room, int levelZ) {
        if (room == null) {
            return null;
        }
        if (room.floorAtLevel(levelZ) != null) {
            return CubePoint.at(room.floorAtLevel(levelZ).shape().centerCell(), levelZ);
        }
        return firstAnchorCell(roomOccupiedCells(room, levelZ));
    }

    private static Set<CubePoint> roomOccupiedCells(Room room, int levelZ) {
        if (room == null) {
            return Set.of();
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (CubePoint occupiedCell : room.cubePoints()) {
            if (occupiedCell != null && occupiedCell.z() == levelZ) {
                result.add(occupiedCell);
            }
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

    public record FixedDoorBinding(Point2i absoluteCell, Point2i direction) {
    }
}
