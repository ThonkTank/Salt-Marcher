package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;

import java.util.List;

public record CorridorTraversalSlice(
        String segmentKey,
        Long corridorId,
        CorridorPath path,
        List<CorridorConnection> connections
) {
    public CorridorTraversalSlice {
        segmentKey = segmentKey == null ? "" : segmentKey.trim();
        if (segmentKey.isEmpty()) {
            throw new IllegalArgumentException("segmentKey must not be blank");
        }
        path = path == null ? CorridorPath.empty() : path;
        connections = connections == null ? List.of() : List.copyOf(connections);
    }
}
