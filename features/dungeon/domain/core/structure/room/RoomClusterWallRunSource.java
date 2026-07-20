package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

public record RoomClusterWallRunSource(
        Edge sourceEdge,
        List<Edge> sourceEdges
) {
    public RoomClusterWallRunSource {
        sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        sourceEdge = representativeSourceEdge(sourceEdge, sourceEdges);
    }

    static RoomClusterWallRunSource empty() {
        return new RoomClusterWallRunSource(null, List.of());
    }

    static RoomClusterWallRunSource fromDirectionalRun(
            List<EdgeKey> edgeKeys,
            Map<EdgeKey, BoundaryRow> rowsByKey
    ) {
        List<Edge> sourceEdges = edges(edgeKeys);
        Edge sourceEdge = sourceEdge(edgeKeys, rowsByKey);
        return new RoomClusterWallRunSource(sourceEdge, sourceEdges);
    }

    private static List<Edge> edges(List<EdgeKey> edgeKeys) {
        List<Edge> result = new ArrayList<>();
        for (EdgeKey key : edgeKeys == null ? List.<EdgeKey>of() : edgeKeys) {
            if (key != null && key.lower() != null && key.upper() != null) {
                result.add(new Edge(key.lower(), key.upper()));
            }
        }
        return List.copyOf(result);
    }

    private static Edge sourceEdge(List<EdgeKey> edgeKeys, Map<EdgeKey, BoundaryRow> rowsByKey) {
        List<EdgeKey> safeEdgeKeys = edgeKeys == null ? List.of() : edgeKeys;
        if (safeEdgeKeys.isEmpty()) {
            return null;
        }
        int midpointIndex = safeEdgeKeys.size() / 2;
        for (int offset = 0; offset < safeEdgeKeys.size(); offset++) {
            int before = midpointIndex - offset;
            if (before >= 0 && !doorRow(safeEdgeKeys.get(before), rowsByKey)) {
                return edge(safeEdgeKeys.get(before));
            }
            int after = midpointIndex + offset;
            if (after < safeEdgeKeys.size() && !doorRow(safeEdgeKeys.get(after), rowsByKey)) {
                return edge(safeEdgeKeys.get(after));
            }
        }
        return edge(safeEdgeKeys.get(midpointIndex));
    }

    private static Edge edge(EdgeKey key) {
        return key == null || key.lower() == null || key.upper() == null
                ? null
                : new Edge(key.lower(), key.upper());
    }

    private static boolean doorRow(EdgeKey edgeKey, Map<EdgeKey, BoundaryRow> rowsByKey) {
        BoundaryRow row = rowsByKey == null ? null : rowsByKey.get(edgeKey);
        return row != null && row.kind() == BoundaryKind.DOOR;
    }

    private static Edge representativeSourceEdge(Edge sourceEdge, List<Edge> sourceEdges) {
        if (sourceEdges.isEmpty() || sourceEdges.contains(sourceEdge)) {
            return sourceEdge;
        }
        return sourceEdges.get(sourceEdges.size() / 2);
    }
}
