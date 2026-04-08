package features.world.dungeon.dungeonmap.connections;

import java.util.List;
import java.util.Objects;

public record DungeonConnection(
        ConnectionKind kind,
        Long ownerId,
        long mapId,
        int levelZ,
        ConnectionCarrier carrier,
        List<ConnectionEndpoint> endpoints
) implements Connection {

    public DungeonConnection {
        kind = Objects.requireNonNull(kind, "kind");
        carrier = Objects.requireNonNull(carrier, "carrier");
        endpoints = endpoints == null ? List.of() : List.copyOf(endpoints);
    }
}
