package features.world.quarantine.dungeonmap.corridors.model.routing;

import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.List;

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
