package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.BoundaryVertex;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.ConnectorAction;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchSelection;

final class DungeonBoundaryStretchConnectorLogic {

    private static final DungeonCorridorBindingLookupLogic CORRIDOR_BINDING_LOOKUP_SERVICE =
            new DungeonCorridorBindingLookupLogic();
    private static final DungeonClusterBoundaryGeometryLogic GEOMETRY_SERVICE =
            new DungeonClusterBoundaryGeometryLogic();
    private static final DungeonBoundaryStretchBoundaryLookupLogic BOUNDARY_LOOKUP_SERVICE =
            new DungeonBoundaryStretchBoundaryLookupLogic();

    boolean applyStretchConnectors(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> clusterCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            boolean requireTouch
    ) {
        List<BoundaryVertex> vertices = DungeonBoundaryStretchSelectionGeometry.vertices(stretch);
        for (BoundaryVertex endpoint : List.of(vertices.getFirst(), vertices.getLast())) {
            boolean touchesOuter = BOUNDARY_LOOKUP_SERVICE.touchesOuterBoundary(clusterCells, endpoint);
            boolean hasAttachment = BOUNDARY_LOOKUP_SERVICE.hasPerpendicularBoundary(
                    boundaries,
                    stretch.sourceKeys(),
                    endpoint,
                    stretch.orientation());
            if (requireTouch && !touchesOuter && !hasAttachment) {
                continue;
            }
            if (!applyConnectorPath(dungeonMap, target, stretch, clusterCells, boundaries, endpoint)) {
                return false;
            }
        }
        return true;
    }

    boolean applyConnectorPath(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> clusterCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            BoundaryVertex endpoint
    ) {
        List<DungeonEdge> connectorPath = DungeonBoundaryStretchSelectionGeometry.connectorPath(stretch, endpoint);
        if (connectorPath.isEmpty()) {
            return true;
        }
        if (CORRIDOR_BINDING_LOOKUP_SERVICE.touchesCorridorBinding(
                dungeonMap,
                target.cluster().center(),
                target.cluster().clusterId(),
                stretch.level(),
                connectorPath)) {
            return false;
        }
        Optional<ConnectorAction> connectorAction = connectorAction(boundaries, stretch.sourceKeys(), connectorPath);
        if (connectorAction.isEmpty()) {
            return false;
        }
        applyConnectorAction(boundaries, connectorAction.get(), target.cluster().center(), clusterCells, target.cluster().clusterId());
        return true;
    }

    private Optional<ConnectorAction> connectorAction(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Set<DungeonBoundaryKey> sourceKeys,
            List<DungeonEdge> path
    ) {
        if (path.isEmpty()) {
            return Optional.empty();
        }
        List<DungeonBoundaryKey> keys = boundaryKeys(path);
        long presentCount = presentBoundaryCount(boundaries, sourceKeys, keys);
        if (hasNoPresentBoundaries(presentCount)) {
            return Optional.of(new ConnectorAction(false, path));
        }
        if (presentCount != keys.size()) {
            return Optional.empty();
        }
        for (DungeonBoundaryKey key : keys) {
            DungeonClusterBoundary boundary = boundaries.get(key);
            if (boundary == null || sourceKeys.contains(key) || boundary.kind() == DungeonClusterBoundaryKind.DOOR) {
                return Optional.empty();
            }
        }
        return Optional.of(new ConnectorAction(true, path));
    }

    private List<DungeonBoundaryKey> boundaryKeys(List<DungeonEdge> path) {
        List<DungeonBoundaryKey> keys = new java.util.ArrayList<>();
        for (DungeonEdge edge : path) {
            keys.add(DungeonBoundaryKey.from(edge));
        }
        return keys;
    }

    private long presentBoundaryCount(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Set<DungeonBoundaryKey> sourceKeys,
            List<DungeonBoundaryKey> keys
    ) {
        long presentCount = 0L;
        for (DungeonBoundaryKey key : keys) {
            if (!sourceKeys.contains(key) && boundaries.containsKey(key)) {
                presentCount++;
            }
        }
        return presentCount;
    }

    private void applyConnectorAction(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            ConnectorAction action,
            DungeonCell center,
            Set<DungeonCell> clusterCells,
            long clusterId
    ) {
        if (action.removesBoundaries()) {
            for (DungeonEdge edge : action.path()) {
                boundaries.remove(DungeonBoundaryKey.from(edge));
            }
            return;
        }
        for (DungeonEdge edge : action.path()) {
            DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
            if (boundaries.containsKey(key)) {
                continue;
            }
            DungeonClusterBoundary connector = GEOMETRY_SERVICE.boundaryForEdge(
                    clusterCells,
                    center,
                    clusterId,
                    edge,
                    DungeonClusterBoundaryKind.WALL,
                    null);
            if (connector != null) {
                boundaries.put(key, connector);
            }
        }
    }

    private boolean hasNoPresentBoundaries(long presentCount) {
        return presentCount == 0L;
    }
}
