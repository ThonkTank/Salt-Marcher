package src.domain.dungeon.model.core.structure.room;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingGeometry;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryStretchPlan.BoundaryVertex;
import src.domain.dungeon.model.core.structure.room.RoomBoundaryStretchValues.ConnectorAction;
import src.domain.dungeon.model.core.structure.room.RoomBoundaryStretchValues.StretchSelection;

final class RoomBoundaryStretchConnectors {

    private static final RoomClusterBoundaryGeometry GEOMETRY =
            new RoomClusterBoundaryGeometry();
    private static final RoomBoundaryStretchBoundaryLookup BOUNDARY_LOOKUP =
            new RoomBoundaryStretchBoundaryLookup();

    boolean applyStretchConnectors(
            List<Corridor> corridors,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Set<Cell> clusterCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        List<BoundaryVertex> vertices = stretch.vertices();
        for (int index = 0; index < vertices.size(); index++) {
            BoundaryVertex vertex = vertices.get(index);
            boolean endpoint = index == 0 || index == vertices.size() - 1;
            boolean touchesOuter = endpoint && BOUNDARY_LOOKUP.touchesOuterBoundary(clusterCells, vertex);
            boolean hasAttachment = BOUNDARY_LOOKUP.hasPerpendicularBoundary(
                    boundaries,
                    stretch.sourceKeys(),
                    vertex,
                    stretch.orientation());
            if (!touchesOuter && !hasAttachment) {
                continue;
            }
            if (!applyConnectorPath(corridors, target, stretch, clusterCells, boundaries, vertex)) {
                return false;
            }
        }
        return true;
    }

    boolean applyConnectorPath(
            List<Corridor> corridors,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Set<Cell> clusterCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            BoundaryVertex endpoint
    ) {
        List<Edge> connectorPath = stretch.connectorPath(endpoint);
        if (connectorPath.isEmpty()) {
            return true;
        }
        if (CorridorDoorBindingGeometry.touchesDoorBindingPath(
                corridors,
                target.cluster().center(),
                target.cluster().clusterId(),
                stretch.level(),
                connectorPath)) {
            return false;
        }
        List<DungeonBoundaryKey> pathKeys = boundaryKeys(connectorPath);
        boolean preserveExistingPath = BOUNDARY_LOOKUP.hasPerpendicularBoundaryOutsidePath(
                boundaries,
                stretch.sourceKeys(),
                new LinkedHashSet<>(pathKeys),
                endpoint,
                stretch.orientation());
        Optional<ConnectorAction> connectorAction =
                connectorAction(boundaries, stretch.sourceKeys(), connectorPath, pathKeys, preserveExistingPath);
        if (connectorAction.isEmpty()) {
            return false;
        }
        applyConnectorAction(boundaries, connectorAction.get(), target.cluster().center(), clusterCells, target.cluster().clusterId());
        return true;
    }

    private Optional<ConnectorAction> connectorAction(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Set<DungeonBoundaryKey> sourceKeys,
            List<Edge> path,
            List<DungeonBoundaryKey> keys,
            boolean preserveExistingPath
    ) {
        if (path.isEmpty()) {
            return Optional.empty();
        }
        long presentCount = presentBoundaryCount(boundaries, sourceKeys, keys);
        if (hasNoPresentBoundaries(presentCount)) {
            return Optional.of(new ConnectorAction(false, path));
        }
        if (presentCount != keys.size()) {
            return Optional.empty();
        }
        for (DungeonBoundaryKey key : keys) {
            DungeonClusterBoundary boundary = boundaries.get(key);
            if (boundary == null || sourceKeys.contains(key) || boundary.kind() == BoundaryKind.DOOR) {
                return Optional.empty();
            }
        }
        return Optional.of(new ConnectorAction(!preserveExistingPath, path));
    }

    private List<DungeonBoundaryKey> boundaryKeys(List<Edge> path) {
        List<DungeonBoundaryKey> keys = new java.util.ArrayList<>();
        for (Edge edge : path) {
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
            Cell center,
            Set<Cell> clusterCells,
            long clusterId
    ) {
        if (action.removesBoundaries()) {
            for (Edge edge : action.path()) {
                boundaries.remove(DungeonBoundaryKey.from(edge));
            }
            return;
        }
        for (Edge edge : action.path()) {
            DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
            if (boundaries.containsKey(key)) {
                continue;
            }
            DungeonClusterBoundary connector = GEOMETRY.boundaryForEdge(
                    clusterCells,
                    center,
                    clusterId,
                    edge,
                    BoundaryKind.WALL,
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
