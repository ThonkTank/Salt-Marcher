package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.dungeonmap.connections.ConnectionEndpoint;

import java.util.Objects;

public record ConnectionSurfaceDescription(
        ConnectionEndpoint endpoint,
        GridPoint localCell,
        CardinalDirection outwardDirection
) {
    public ConnectionSurfaceDescription {
        endpoint = Objects.requireNonNull(endpoint, "endpoint");
        localCell = Objects.requireNonNull(localCell, "localCell");
        outwardDirection = Objects.requireNonNull(outwardDirection, "outwardDirection");
    }
}
