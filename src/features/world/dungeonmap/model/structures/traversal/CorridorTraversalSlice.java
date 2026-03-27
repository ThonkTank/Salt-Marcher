package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;

import java.util.List;

public record CorridorTraversalSlice(
        Long corridorId,
        CorridorPath path,
        List<CorridorConnection> connections
) {
    public CorridorTraversalSlice {
        path = path == null ? CorridorPath.empty() : path;
        connections = connections == null ? List.of() : List.copyOf(connections);
    }
}
