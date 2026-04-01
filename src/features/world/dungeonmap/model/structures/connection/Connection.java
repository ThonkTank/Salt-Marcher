package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.objects.Door;

import java.util.List;

/**
 * Shared connectivity contract for dungeon structures that join exactly two endpoints.
 *
 * <p>Doors are boundary objects on a connection. The connection itself owns the semantic connectivity between
 * its endpoints.</p>
 */
public interface Connection {

    Long connectionId();

    long mapId();

    int levelZ();

    Door door();

    List<ConnectionEndpoint> endpoints();

    ConnectionKind kind();

    boolean isTraversable();

    default boolean touchesEndpoint(ConnectionEndpoint endpoint) {
        return endpoint != null && endpoints().contains(endpoint);
    }

    default ConnectionEndpoint oppositeOf(ConnectionEndpoint endpoint) {
        if (endpoint == null) {
            return null;
        }
        List<ConnectionEndpoint> endpoints = endpoints();
        if (endpoints == null || endpoints.size() != 2 || !endpoints.contains(endpoint)) {
            return null;
        }
        return endpoints.get(0).equals(endpoint) ? endpoints.get(1) : endpoints.get(0);
    }
}
