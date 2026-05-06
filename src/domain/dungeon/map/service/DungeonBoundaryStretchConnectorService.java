package src.domain.dungeon.map.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.BoundaryVertex;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.ConnectorAction;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.StretchSelection;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonRoomTopologyClusterWork;

final class DungeonBoundaryStretchConnectorService {

    private static final DungeonCorridorBindingLookupService CORRIDOR_BINDING_LOOKUP_SERVICE =
            new DungeonCorridorBindingLookupService();
    private static final DungeonClusterBoundaryGeometryService GEOMETRY_SERVICE =
            new DungeonClusterBoundaryGeometryService();
    private static final DungeonBoundaryStretchBoundaryLookupService BOUNDARY_LOOKUP_SERVICE =
            new DungeonBoundaryStretchBoundaryLookupService();

    boolean applyStretchConnectors(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> clusterCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            boolean requireTouch
    ) {
        for (BoundaryVertex endpoint : List.of(stretch.vertices().getFirst(), stretch.vertices().getLast())) {
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
        List<DungeonEdge> connectorPath = stretch.connectorPath(endpoint);
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
        List<DungeonBoundaryKey> keys = path.stream().map(DungeonBoundaryKey::from).toList();
        long presentCount = keys.stream()
                .filter(key -> !sourceKeys.contains(key) && boundaries.containsKey(key))
                .count();
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
