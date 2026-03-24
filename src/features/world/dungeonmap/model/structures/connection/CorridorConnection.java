package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.objects.Door;

import java.util.List;

public record CorridorConnection(
        Long corridorId,
        long mapId,
        Door door,
        List<ConnectionEndpoint> endpoints
) implements Connection {

    public CorridorConnection {
        endpoints = endpoints == null ? List.of() : List.copyOf(endpoints);
    }

    @Override
    public Long connectionId() {
        return corridorId;
    }

    @Override
    public ConnectionKind kind() {
        return ConnectionKind.CORRIDOR;
    }

    @Override
    public boolean isTraversable() {
        return door != null && !door.blocksTraversal();
    }
}
