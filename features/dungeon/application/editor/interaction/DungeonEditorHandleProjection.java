package features.dungeon.application.editor.interaction;

import java.util.List;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;

public record DungeonEditorHandleProjection(
        DungeonEditorHandleProjectionKind kind,
        DungeonTopologyRef topologyRef,
        long ownerId,
        long clusterId,
        long corridorId,
        long roomId,
        int index,
        Cell cell,
        double markerQ,
        double markerR,
        Direction direction,
        String label,
        Edge sourceEdge,
        List<Edge> sourceEdges
) {
    public DungeonEditorHandleProjection {
        kind = kind == null ? DungeonEditorHandleProjectionKind.defaultKind() : kind;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        ownerId = Math.max(0L, ownerId);
        clusterId = Math.max(0L, clusterId);
        corridorId = Math.max(0L, corridorId);
        roomId = Math.max(0L, roomId);
        index = Math.max(0, index);
        cell = cell == null ? new Cell(0, 0, 0) : cell;
        markerQ = Double.isFinite(markerQ) ? markerQ : cell.q();
        markerR = Double.isFinite(markerR) ? markerR : cell.r();
        direction = direction == null ? Direction.NORTH : direction;
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
    }
}
