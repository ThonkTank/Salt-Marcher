package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.corridor.CorridorEndpointBinding;
import features.world.dungeonmap.model.structures.corridor.CorridorTerminal;

import java.util.List;

public final class DungeonCorridorPersistenceCodec {

    private DungeonCorridorPersistenceCodec() {
    }

    public static PersistedGridAnchor encodeGridAnchor(GridAnchor anchor) {
        if (anchor == null) {
            return null;
        }
        Point2i doubledPoint = anchor.doubledGridPoint();
        return new PersistedGridAnchor(anchor.kind().name(), doubledPoint.x(), doubledPoint.y());
    }

    public static GridAnchor decodeGridAnchor(String anchorKind, int gridX2, int gridY2) {
        if (anchorKind == null || anchorKind.isBlank()) {
            return null;
        }
        try {
            GridAnchor.Kind kind = GridAnchor.Kind.valueOf(anchorKind.trim().toUpperCase(java.util.Locale.ROOT));
            return switch (kind) {
                case TILE_CENTER -> decodeTileAnchor(gridX2, gridY2);
                case VERTEX -> decodeVertexAnchor(gridX2, gridY2);
                case EDGE_CENTER -> decodeEdgeAnchor(gridX2, gridY2);
            };
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    public static PersistedEndpointBinding encodeEndpointBinding(CorridorEndpointBinding binding) {
        if (binding == null || binding.boundaryEdge() == null) {
            return null;
        }
        Point2i anchorCell = binding.boundaryEdge().touchingCells().stream()
                .min(Point2i.POINT_ORDER)
                .orElse(null);
        if (anchorCell == null) {
            return null;
        }
        Point2i direction = binding.boundaryEdge().directionFrom(anchorCell);
        if (direction == null) {
            return null;
        }
        return new PersistedEndpointBinding(
                binding.terminal().name(),
                anchorCell.x(),
                anchorCell.y(),
                DungeonPersistenceDirections.toPersistedEdgeDirection(direction));
    }

    public static CorridorEndpointBinding decodeEndpointBinding(
            String terminalKind,
            int cellX,
            int cellY,
            String edgeDirection,
            List<ConnectionEndpoint> endpoints
    ) {
        try {
            Point2i direction = DungeonPersistenceDirections.fromPersistedEdgeDirection(edgeDirection);
            VertexEdge edge = VertexEdge.betweenCellAndStep(new Point2i(cellX, cellY), direction);
            return new CorridorEndpointBinding(
                    decodeTerminal(terminalKind),
                    edge,
                    endpoints == null ? List.of() : List.copyOf(endpoints));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    public static PersistedConnectionEndpoint encodeConnectionEndpoint(ConnectionEndpoint endpoint) {
        if (endpoint == null || endpoint.type() == null || endpoint.id() == null) {
            return null;
        }
        return new PersistedConnectionEndpoint(endpoint.type().name(), endpoint.id());
    }

    public static ConnectionEndpoint decodeConnectionEndpoint(String endpointType, Long endpointId) {
        if (endpointType == null || endpointId == null) {
            return null;
        }
        try {
            ConnectionEndpointType type = ConnectionEndpointType.valueOf(endpointType.trim().toUpperCase(java.util.Locale.ROOT));
            return switch (type) {
                case ROOM -> ConnectionEndpoint.room(endpointId);
                case CLUSTER -> ConnectionEndpoint.cluster(endpointId);
                case CORRIDOR -> ConnectionEndpoint.corridor(endpointId);
                case STAIR -> ConnectionEndpoint.stair(endpointId);
                case TRANSITION -> ConnectionEndpoint.transition(endpointId);
            };
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private static GridAnchor decodeTileAnchor(int gridX2, int gridY2) {
        if ((gridX2 & 1) == 0 || (gridY2 & 1) == 0) {
            return null;
        }
        return GridAnchor.atTile(new Point2i((gridX2 - 1) / 2, (gridY2 - 1) / 2));
    }

    private static GridAnchor decodeVertexAnchor(int gridX2, int gridY2) {
        if ((gridX2 & 1) != 0 || (gridY2 & 1) != 0) {
            return null;
        }
        return GridAnchor.atVertex(new Point2i(gridX2 / 2, gridY2 / 2));
    }

    private static GridAnchor decodeEdgeAnchor(int gridX2, int gridY2) {
        if ((gridX2 & 1) == (gridY2 & 1)) {
            return null;
        }
        if ((gridX2 & 1) == 1) {
            int cellX = (gridX2 - 1) / 2;
            int vertexY = gridY2 / 2;
            return GridAnchor.atEdge(new VertexEdge(new Point2i(cellX, vertexY), new Point2i(cellX + 1, vertexY)));
        }
        int vertexX = gridX2 / 2;
        int cellY = (gridY2 - 1) / 2;
        return GridAnchor.atEdge(new VertexEdge(new Point2i(vertexX, cellY), new Point2i(vertexX, cellY + 1)));
    }

    private static CorridorTerminal decodeTerminal(String rawTerminalKind) {
        if (rawTerminalKind == null || rawTerminalKind.isBlank()) {
            return CorridorTerminal.START;
        }
        try {
            return CorridorTerminal.valueOf(rawTerminalKind.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return CorridorTerminal.START;
        }
    }

    public record PersistedGridAnchor(
            String anchorKind,
            int gridX2,
            int gridY2
    ) {
    }

    public record PersistedEndpointBinding(
            String terminalKind,
            int cellX,
            int cellY,
            String edgeDirection
    ) {
    }

    public record PersistedConnectionEndpoint(
            String endpointType,
            long endpointId
    ) {
    }
}
