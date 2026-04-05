package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.objects.Door;

import java.util.List;

public record TransitionConnection(
        Long transitionId,
        long mapId,
        Door door,
        List<ConnectionEndpoint> endpoints,
        int levelZ
) implements Connection {

    public TransitionConnection {
        endpoints = endpoints == null ? List.of() : List.copyOf(endpoints);
    }

    @Override
    public Long connectionId() {
        return transitionId;
    }

    @Override
    public ConnectionKind kind() {
        return ConnectionKind.TRANSITION;
    }

    @Override
    public boolean isTraversable() {
        return door != null && !door.blocksPassage();
    }
}
