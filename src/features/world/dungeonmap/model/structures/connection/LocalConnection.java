package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.objects.Door;

import java.util.List;

public record LocalConnection(
        Long connectionId,
        long mapId,
        long clusterId,
        Door door,
        List<ConnectionEndpoint> endpoints
) implements Connection {

    public LocalConnection {
        endpoints = endpoints == null ? List.of() : List.copyOf(endpoints);
    }

    @Override
    public ConnectionKind kind() {
        return ConnectionKind.LOCAL;
    }

    @Override
    public boolean isTraversable() {
        return door != null && !door.blocksPassage();
    }

    @Override
    public boolean touchesEndpoint(ConnectionEndpoint endpoint) {
        return endpoint != null && endpoints.contains(endpoint);
    }

    @Override
    public ConnectionEndpoint oppositeOf(ConnectionEndpoint endpoint) {
        if (endpoint == null || endpoints.size() != 2 || !endpoints.contains(endpoint)) {
            return null;
        }
        return endpoints.get(0).equals(endpoint) ? endpoints.get(1) : endpoints.get(0);
    }
}
