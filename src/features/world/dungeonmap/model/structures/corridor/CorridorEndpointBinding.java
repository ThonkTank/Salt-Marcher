package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

public record CorridorEndpointBinding(
        CorridorTerminal terminal,
        VertexEdge boundaryEdge,
        List<ConnectionEndpoint> endpoints
) {
    public CorridorEndpointBinding {
        terminal = terminal == null ? CorridorTerminal.START : terminal;
        boundaryEdge = Objects.requireNonNull(boundaryEdge, "boundaryEdge");
        endpoints = normalizeEndpoints(endpoints);
    }

    public CorridorConnection materialize(Long corridorId, long mapId, int levelZ) {
        ArrayList<ConnectionEndpoint> materializedEndpoints = new ArrayList<>(endpoints);
        materializedEndpoints.add(ConnectionEndpoint.corridor(corridorId));
        return new CorridorConnection(
                corridorId,
                mapId,
                new Door(List.of(boundaryEdge), Door.TraversalState.CLOSED),
                List.copyOf(materializedEndpoints),
                levelZ);
    }

    private static List<ConnectionEndpoint> normalizeEndpoints(List<ConnectionEndpoint> endpoints) {
        if (endpoints == null || endpoints.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<ConnectionEndpoint> result = new LinkedHashSet<>();
        for (ConnectionEndpoint endpoint : endpoints) {
            if (endpoint != null && endpoint.type() != null && endpoint.id() != null) {
                result.add(endpoint);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }
}
