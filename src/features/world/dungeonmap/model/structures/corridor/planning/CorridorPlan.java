package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;

import java.util.List;

public record CorridorPlan(
        CorridorPath path,
        List<CorridorConnection> connections
) {
    public CorridorPlan {
        path = path == null ? CorridorPath.empty() : path;
        connections = connections == null ? List.of() : List.copyOf(connections);
    }
}
