package features.world.dungeonmap.corridors.model;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class CorridorPlanningResolver {

    private CorridorPlanningResolver() {
        throw new AssertionError("No instances");
    }

    static ResolvedDoorOverride resolveDoorOverride(DungeonLayout layout, DungeonCorridor corridor, DungeonRoom room) {
        if (layout == null || corridor == null || room == null || room.roomId() == null) {
            return null;
        }
        return corridor.doorOverrides().stream()
                .filter(override -> override.roomId() == room.roomId())
                .filter(override -> override.clusterId() == room.clusterId())
                .map(override -> {
                    DungeonRoomCluster cluster = layout.clusterById(override.clusterId());
                    if (cluster == null) {
                        return null;
                    }
                    return new ResolvedDoorOverride(override.absoluteCell(cluster.center()), override.edgeDirection());
                })
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    static boolean matchesOverride(DoorSegment door, ResolvedDoorOverride override) {
        if (override == null || door == null) {
            return true;
        }
        return door.roomCell().equals(override.absoluteCell())
                && CorridorRouteGeometry.directionForDoor(door).equals(override.edgeDirection().delta());
    }

    static List<Point2i> resolveWaypointCells(DungeonLayout layout, DungeonCorridor corridor) {
        if (layout == null || corridor == null || corridor.waypoints().isEmpty()) {
            return List.of();
        }
        List<Point2i> result = new ArrayList<>();
        for (CorridorWaypoint waypoint : corridor.waypoints()) {
            DungeonRoomCluster cluster = layout.clusterById(waypoint.clusterId());
            if (cluster == null) {
                continue;
            }
            result.add(waypoint.absoluteCell(cluster.center()));
        }
        return List.copyOf(result);
    }

    // --- Types from CorridorPlanningTypes ---

    record ExitCandidate(
            Point2i roomCell,
            Point2i outsideCell,
            Point2i direction,
            DoorSegment door
    ) {
    }

    record ConnectionCandidate(
            long roomId,
            List<Point2i> path,
            List<DoorSegment> doors,
            boolean joinedExistingCorridor,
            int routeScore,
            int anchorTieBreaker,
            CorridorNetworkScore networkScore
    ) {
        ConnectionCandidate withNetworkScore(CorridorNetworkScore score) {
            return new ConnectionCandidate(roomId, path, doors, joinedExistingCorridor, routeScore, anchorTieBreaker, score);
        }
    }

    record ResolvedDoorOverride(
            Point2i absoluteCell,
            DungeonRoomCluster.EdgeDirection edgeDirection
    ) {
    }

    record CorridorBuildState(
            Set<Point2i> corridorCells,
            Set<GridSegment> segments,
            Set<DoorSegment> doors,
            boolean directlyAdjacentOnly,
            Set<Long> connectedRoomIds,
            CorridorNetworkScore networkScore
    ) {
        int connectedRoomCount() {
            return connectedRoomIds.size();
        }
    }

    // --- CorridorPlanningContext ---

    record CorridorPlanningContext(
            DungeonLayout layout,
            DungeonCorridor corridor,
            List<DungeonRoom> rooms,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, Set<Point2i>> cellsByRoomId,
            Map<Point2i, Long> roomOccupancy,
            List<Point2i> waypointCells
    ) {

        static CorridorPlanningContext create(
                DungeonLayout layout,
                DungeonCorridor corridor,
                List<DungeonRoom> rooms,
                Map<Long, Set<Point2i>> roomCellsById,
                Map<Point2i, Long> roomOccupancy
        ) {
            Map<Long, DungeonRoom> roomsById = new LinkedHashMap<>();
            Map<Long, Set<Point2i>> cellsByRoomId = new LinkedHashMap<>();
            for (DungeonRoom room : rooms) {
                Long roomId = room.roomId();
                if (roomId == null) {
                    continue;
                }
                Set<Point2i> roomCells = roomCellsById.getOrDefault(roomId, Set.of());
                if (roomCells.isEmpty()) {
                    throw new IllegalStateException("Raum " + roomId + " hat keine abgeleiteten Zellen fuer Korridor-Geometrie");
                }
                roomsById.put(roomId, room);
                cellsByRoomId.put(roomId, roomCells);
            }
            return new CorridorPlanningContext(
                    layout,
                    corridor,
                    List.copyOf(rooms),
                    Map.copyOf(roomsById),
                    Map.copyOf(cellsByRoomId),
                    Map.copyOf(roomOccupancy),
                    CorridorPlanningResolver.resolveWaypointCells(layout, corridor));
        }

        Set<Point2i> roomCells(long roomId) {
            return cellsByRoomId.getOrDefault(roomId, Set.of());
        }

        ResolvedDoorOverride doorOverride(DungeonRoom room) {
            return CorridorPlanningResolver.resolveDoorOverride(layout, corridor, room);
        }

        int totalRoomCount() {
            return rooms.size();
        }
    }

    // --- CorridorPlanningOrdering ---

    static final class CorridorPlanningOrdering {

        private CorridorPlanningOrdering() {
            throw new AssertionError("No instances");
        }

        static Comparator<CorridorBuildState> buildStateComparator() {
            return Comparator
                    .comparingInt(CorridorBuildState::connectedRoomCount).reversed()
                    .thenComparing(CorridorBuildState::networkScore)
                    .thenComparingInt(state -> state.corridorCells().size())
                    .thenComparingInt(state -> state.doors().size())
                    .thenComparingInt(state -> state.segments().size());
        }

        static ConnectionCandidate betterCandidate(ConnectionCandidate currentBest, ConnectionCandidate candidate) {
            if (candidate == null) {
                return currentBest;
            }
            if (currentBest == null || connectionCandidateComparator().compare(candidate, currentBest) < 0) {
                return candidate;
            }
            return currentBest;
        }

        static ConnectionCandidate betterScoredCandidate(ConnectionCandidate currentBest, ConnectionCandidate candidate) {
            if (candidate == null) {
                return currentBest;
            }
            if (currentBest == null) {
                return candidate;
            }
            int networkComparison = candidate.networkScore().compareTo(currentBest.networkScore());
            if (networkComparison < 0) {
                return candidate;
            }
            if (networkComparison > 0) {
                return currentBest;
            }
            return betterCandidate(currentBest, candidate);
        }

        private static Comparator<ConnectionCandidate> connectionCandidateComparator() {
            return Comparator
                    .comparingInt(ConnectionCandidate::routeScore)
                    .thenComparing(CorridorPlanningOrdering::pathPreference)
                    .thenComparing((ConnectionCandidate candidate) -> candidate.joinedExistingCorridor() ? 0 : 1)
                    .thenComparingInt(candidate -> candidate.doors().size())
                    .thenComparingInt(ConnectionCandidate::anchorTieBreaker)
                    .thenComparingLong(ConnectionCandidate::roomId);
        }

        private static PathPreference pathPreference(ConnectionCandidate candidate) {
            List<Point2i> path = candidate == null ? List.of() : candidate.path();
            return new PathPreference(path.size(), CorridorPathfinder.cornerCount(path));
        }

        private record PathPreference(
                int length,
                int corners
        ) implements Comparable<PathPreference> {
            @Override
            public int compareTo(PathPreference other) {
                int shorter = Math.min(length, other.length);
                int toleratedDifference = CorridorPathfinder.toleratedExtraDistance(shorter);
                if (Math.abs(length - other.length) <= toleratedDifference && corners != other.corners) {
                    return Integer.compare(corners, other.corners);
                }
                int lengthComparison = Integer.compare(length, other.length);
                if (lengthComparison != 0) {
                    return lengthComparison;
                }
                return Integer.compare(corners, other.corners);
            }
        }
    }
}
