package features.world.dungeon.dungeonmap.connections.input;

public record ConnectionEndpoint(ConnectionEndpointType type, Long id) {

    public ConnectionEndpoint {
        type = type == null ? ConnectionEndpointType.ROOM : type;
    }

    public static ConnectionEndpoint room(Long roomId) {
        return new ConnectionEndpoint(ConnectionEndpointType.ROOM, roomId);
    }

    public static ConnectionEndpoint corridor(Long corridorId) {
        return new ConnectionEndpoint(ConnectionEndpointType.CORRIDOR, corridorId);
    }

    public static ConnectionEndpoint transition(Long transitionId) {
        return new ConnectionEndpoint(ConnectionEndpointType.TRANSITION, transitionId);
    }
}
