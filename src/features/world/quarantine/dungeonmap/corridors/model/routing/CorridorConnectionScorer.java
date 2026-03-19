package features.world.quarantine.dungeonmap.corridors.model.routing;

import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.primitives.GridSegment;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

final class CorridorConnectionScorer {

    private CorridorConnectionScorer() {
        throw new AssertionError("No instances");
    }

    static CorridorNetworkScore scoreNetwork(
            Collection<Long> roomIds,
            Collection<GridSegment> segments,
            Collection<DoorSegment> doors
    ) {
        return scoreNetwork(CorridorNetworkGraph.graphSnapshot(segments, doors), CorridorNetworkGraph.emptyGraphSnapshot(), roomIds);
    }

    static CorridorNetworkScore scoreConnection(
            CorridorNetworkGraph.GraphSnapshot baseGraph,
            Collection<Long> connectedRoomIds,
            long candidateRoomId,
            List<Point2i> candidatePath,
            List<DoorSegment> candidateDoors
    ) {
        LinkedHashSet<Long> roomIds = new LinkedHashSet<>(connectedRoomIds);
        roomIds.add(candidateRoomId);
        CorridorNetworkGraph.GraphSnapshot candidateGraph = CorridorNetworkGraph.graphSnapshot(
                CorridorRouteGeometry.segmentsForPath(candidatePath), candidateDoors);
        return scoreNetwork(baseGraph, candidateGraph, roomIds);
    }

    private static CorridorNetworkScore scoreNetwork(
            CorridorNetworkGraph.GraphSnapshot baseGraph,
            CorridorNetworkGraph.GraphSnapshot candidateGraph,
            Collection<Long> roomIds
    ) {
        List<Long> orderedRoomIds = roomIds == null
                ? List.of()
                : roomIds.stream()
                        .filter(java.util.Objects::nonNull)
                        .distinct()
                        .sorted()
                        .toList();
        int unreachablePairCount = 0;
        int distanceSum = 0;
        int maxDistance = 0;
        for (int index = 0; index < orderedRoomIds.size(); index++) {
            long sourceRoomId = orderedRoomIds.get(index);
            Map<CorridorNetworkGraph.NetworkNode, Integer> distances = CorridorGraphTraversal.bfsDistances(
                    CorridorNetworkGraph.NetworkNode.room(sourceRoomId),
                    baseGraph.adjacency(),
                    candidateGraph.adjacency());
            for (int otherIndex = index + 1; otherIndex < orderedRoomIds.size(); otherIndex++) {
                long targetRoomId = orderedRoomIds.get(otherIndex);
                Integer distance = distances.get(CorridorNetworkGraph.NetworkNode.room(targetRoomId));
                if (distance == null) {
                    unreachablePairCount++;
                    continue;
                }
                distanceSum += distance;
                maxDistance = Math.max(maxDistance, distance);
            }
        }
        return new CorridorNetworkScore(
                CorridorGraphTraversal.componentCount(baseGraph.corridorAdjacency(), candidateGraph.corridorAdjacency()),
                unreachablePairCount,
                distanceSum,
                maxDistance);
    }
}

record CorridorNetworkScore(
        int corridorComponentCount,
        int unreachablePairCount,
        int distanceSum,
        int maxDistance
) implements Comparable<CorridorNetworkScore> {
    @Override
    public int compareTo(CorridorNetworkScore other) {
        int componentComparison = Integer.compare(corridorComponentCount, other.corridorComponentCount);
        if (componentComparison != 0) {
            return componentComparison;
        }
        int unreachableComparison = Integer.compare(unreachablePairCount, other.unreachablePairCount);
        if (unreachableComparison != 0) {
            return unreachableComparison;
        }
        int distanceComparison = Integer.compare(distanceSum, other.distanceSum);
        if (distanceComparison != 0) {
            return distanceComparison;
        }
        return Integer.compare(maxDistance, other.maxDistance);
    }
}
