package features.world.dungeonmap.corridors.model;

import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.ConnectionCandidate;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.CorridorBuildState;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.CorridorPlanningContext;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.CorridorPlanningOrdering;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class CorridorNetworkBuilder {

    private CorridorNetworkBuilder() {
        throw new AssertionError("No instances");
    }

    static CorridorBuildState buildSeedState(
            CorridorPlanningContext context,
            DungeonRoom seedRoom,
            List<Long> targetRoomIds
    ) {
        MutableCorridorNetwork network = new MutableCorridorNetwork(seedRoom.roomId());
        attachSeedWaypointPath(context, seedRoom, network);

        while (network.connectedRoomCount() < context.totalRoomCount()) {
            ConnectionCandidate nextCandidate = bestNextCandidate(context, network);
            if (nextCandidate == null) {
                break;
            }
            network.apply(nextCandidate);
        }

        return network.toBuildState(targetRoomIds);
    }

    private static void attachSeedWaypointPath(
            CorridorPlanningContext context,
            DungeonRoom seedRoom,
            MutableCorridorNetwork network
    ) {
        if (context.waypointCells().isEmpty()) {
            return;
        }
        ConnectionCandidate seedCandidate = CorridorConnectionCandidateFactory.bestPathFromRoomToTargets(
                context,
                seedRoom,
                context.waypointCells(),
                false);
        if (seedCandidate != null) {
            network.apply(seedCandidate);
        }
    }

    private static ConnectionCandidate bestNextCandidate(
            CorridorPlanningContext context,
            MutableCorridorNetwork network
    ) {
        ConnectionCandidate bestCandidate = null;
        CorridorConnectionScorer.GraphSnapshot baseGraph = CorridorConnectionScorer.graphSnapshot(network.segments(), network.doors());
        for (DungeonRoom room : context.rooms()) {
            if (network.connectedRoomIds().contains(room.roomId())) {
                continue;
            }
            for (ConnectionCandidate candidate : CorridorConnectionCandidateFactory.connectionCandidates(
                    context,
                    room,
                    network.connectedRoomIds(),
                    network.corridorCells())) {
                CorridorNetworkScore candidateStepScore = CorridorConnectionScorer.scoreConnection(
                        baseGraph,
                        network.connectedRoomIds(),
                        candidate.roomId(),
                        candidate.path(),
                        candidate.doors());
                if (candidateStepScore.corridorComponentCount() > 1) {
                    continue;
                }
                bestCandidate = CorridorPlanningOrdering.betterScoredCandidate(
                        bestCandidate,
                        candidate.withNetworkScore(candidateStepScore));
            }
        }
        return bestCandidate;
    }

    private static final class MutableCorridorNetwork {
        private final Set<Long> connectedRoomIds = new LinkedHashSet<>();
        private final Set<Point2i> corridorCells = new LinkedHashSet<>();
        private final Set<GridSegment> segments = new LinkedHashSet<>();
        private final Set<DoorSegment> doors = new LinkedHashSet<>();
        private boolean directlyAdjacentOnly = true;

        private MutableCorridorNetwork(long seedRoomId) {
            connectedRoomIds.add(seedRoomId);
        }

        private Set<Long> connectedRoomIds() {
            return connectedRoomIds;
        }

        private Set<Point2i> corridorCells() {
            return corridorCells;
        }

        private Set<GridSegment> segments() {
            return segments;
        }

        private Set<DoorSegment> doors() {
            return doors;
        }

        private int connectedRoomCount() {
            return connectedRoomIds.size();
        }

        private void apply(ConnectionCandidate candidate) {
            connectedRoomIds.add(candidate.roomId());
            corridorCells.addAll(candidate.path());
            segments.addAll(CorridorRouteGeometry.segmentsForPath(candidate.path()));
            doors.addAll(candidate.doors());
            directlyAdjacentOnly = directlyAdjacentOnly && candidate.path().isEmpty();
        }

        private CorridorBuildState toBuildState(List<Long> targetRoomIds) {
            return new CorridorBuildState(
                    Set.copyOf(corridorCells),
                    Set.copyOf(segments),
                    Set.copyOf(doors),
                    directlyAdjacentOnly,
                    Set.copyOf(connectedRoomIds),
                    CorridorConnectionScorer.scoreNetwork(targetRoomIds, segments, doors));
        }
    }
}
