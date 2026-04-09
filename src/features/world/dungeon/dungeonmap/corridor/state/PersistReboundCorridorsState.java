package features.world.dungeon.dungeonmap.corridor.state;

import java.util.ArrayList;
import java.util.List;

/**
 * Passive corridor-owned rebound staging state. This successor slice carries the authored corridor input network and
 * persisted ids needed for a future canonical rebound persistence boundary, without exposing room-map or JDBC scope.
 */
@SuppressWarnings("unused")
public record PersistReboundCorridorsState(
        long mapId,
        List<CorridorState> corridors
) {

    public PersistReboundCorridorsState {
        if (mapId <= 0) {
            throw new IllegalArgumentException("mapId");
        }
        corridors = normalizedCorridors(corridors);
    }

    public static PersistReboundCorridorsState persistReboundCorridors(PersistReboundCorridorsState state) {
        if (state == null) {
            throw new IllegalArgumentException("state");
        }
        return new PersistReboundCorridorsState(state.mapId(), state.corridors());
    }

    public record CorridorState(
            Long corridorId,
            Long structureObjectId,
            int levelZ,
            List<NodeState> nodes,
            List<SegmentState> segments
    ) {

        public CorridorState {
            if (structureObjectId != null && structureObjectId <= 0) {
                throw new IllegalArgumentException("structureObjectId");
            }
            nodes = normalizedNodes(nodes);
            segments = normalizedSegments(segments);
        }
    }

    public record NodeState(
            Long nodeId,
            Long doorId,
            Integer pointX2,
            Integer pointY2
    ) {
    }

    public record SegmentState(
            Long segmentId,
            Long startNodeId,
            Long endNodeId
    ) {
    }

    private static List<CorridorState> normalizedCorridors(List<CorridorState> corridors) {
        if (corridors == null || corridors.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorState> normalizedCorridors = new ArrayList<>();
        for (CorridorState corridor : corridors) {
            if (corridor != null) {
                normalizedCorridors.add(corridor);
            }
        }
        return normalizedCorridors.isEmpty() ? List.of() : List.copyOf(normalizedCorridors);
    }

    private static List<NodeState> normalizedNodes(List<NodeState> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return List.of();
        }
        ArrayList<NodeState> normalizedNodes = new ArrayList<>();
        for (NodeState node : nodes) {
            if (node != null) {
                normalizedNodes.add(node);
            }
        }
        return normalizedNodes.isEmpty() ? List.of() : List.copyOf(normalizedNodes);
    }

    private static List<SegmentState> normalizedSegments(List<SegmentState> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        ArrayList<SegmentState> normalizedSegments = new ArrayList<>();
        for (SegmentState segment : segments) {
            if (segment != null) {
                normalizedSegments.add(segment);
            }
        }
        return normalizedSegments.isEmpty() ? List.of() : List.copyOf(normalizedSegments);
    }
}
