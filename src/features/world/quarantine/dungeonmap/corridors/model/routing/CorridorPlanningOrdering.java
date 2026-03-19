package features.world.quarantine.dungeonmap.corridors.model.routing;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.Comparator;
import java.util.List;

final class CorridorPlanningOrdering {

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

    static ConnectionCandidate betterCandidate(ConnectionCandidate current, ConnectionCandidate candidate) {
        return better(current, candidate, connectionCandidateComparator());
    }

    static ConnectionCandidate betterScoredCandidate(ConnectionCandidate current, ConnectionCandidate candidate) {
        return better(current, candidate,
                Comparator.comparing(ConnectionCandidate::networkScore).thenComparing(connectionCandidateComparator()));
    }

    private static <T> T better(T current, T candidate, Comparator<T> comparator) {
        if (candidate == null) {
            return current;
        }
        if (current == null || comparator.compare(candidate, current) < 0) {
            return candidate;
        }
        return current;
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
