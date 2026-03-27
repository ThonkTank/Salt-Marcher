package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.traversal.TraversalRoomAnchor;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public record TraversalTopology(
        Long corridorId,
        long mapId,
        List<RoomPortal> roomPortals,
        List<WaypointNode> waypointNodes,
        Set<CubePoint> obstacles
) {
    public TraversalTopology {
        roomPortals = normalizeRoomPortals(roomPortals);
        waypointNodes = normalizeWaypointNodes(waypointNodes);
        obstacles = normalizeObstacles(obstacles);
    }

    public static TraversalTopology empty() {
        return new TraversalTopology(null, 0L, List.of(), List.of(), Set.of());
    }

    public boolean hasWaypoints() {
        return !waypointNodes.isEmpty();
    }

    private static List<RoomPortal> normalizeRoomPortals(List<RoomPortal> roomPortals) {
        if (roomPortals == null || roomPortals.isEmpty()) {
            return List.of();
        }
        ArrayList<RoomPortal> result = new ArrayList<>();
        for (RoomPortal roomPortal : roomPortals) {
            if (roomPortal != null && roomPortal.roomAnchor() != null) {
                result.add(roomPortal);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<WaypointNode> normalizeWaypointNodes(List<WaypointNode> waypointNodes) {
        if (waypointNodes == null || waypointNodes.isEmpty()) {
            return List.of();
        }
        ArrayList<WaypointNode> result = new ArrayList<>();
        for (WaypointNode waypointNode : waypointNodes) {
            if (waypointNode != null && waypointNode.cell() != null) {
                result.add(waypointNode);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Set<CubePoint> normalizeObstacles(Set<CubePoint> obstacles) {
        if (obstacles == null || obstacles.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (CubePoint obstacle : obstacles) {
            if (obstacle != null) {
                result.add(obstacle);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public record RoomPortal(
            TraversalRoomAnchor roomAnchor,
            ResolvedCorridorDoorBinding fixedDoorBinding
    ) {
        public RoomPortal {
            Objects.requireNonNull(roomAnchor, "roomAnchor");
        }

        public Long roomId() {
            return roomAnchor.roomId();
        }

        public Point2i guideCell() {
            return roomAnchor.anchorCell();
        }

        public int primaryLevel() {
            return roomAnchor.primaryLevel();
        }

        public Set<Integer> levels() {
            return roomAnchor.levels();
        }

        public Set<CubePoint> occupiedCells() {
            return roomAnchor.occupiedCells();
        }

        public boolean hasFixedDoorBinding() {
            return fixedDoorBinding != null
                    && fixedDoorBinding.absoluteCell() != null
                    && fixedDoorBinding.direction() != null;
        }
    }

    public record WaypointNode(
            int index,
            CubePoint cell
    ) {
        public WaypointNode {
            if (index < 0) {
                index = 0;
            }
            Objects.requireNonNull(cell, "cell");
        }

        public Point2i guideCell() {
            return cell.projectedCell();
        }

        public int levelZ() {
            return cell.z();
        }
    }
}
