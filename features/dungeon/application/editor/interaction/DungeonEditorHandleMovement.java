package features.dungeon.application.editor.interaction;

import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;

public record DungeonEditorHandleMovement(
        DungeonEditorHandleMovementKind kind,
        DungeonTopologyRef topologyRef,
        long ownerId,
        long clusterId,
        long corridorId,
        long roomId,
        int index,
        Cell cell,
        Direction direction,
        Edge sourceEdge
) {
    public DungeonEditorHandleMovement {
        kind = kind == null ? DungeonEditorHandleMovementKind.defaultKind() : kind;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        ownerId = Math.max(0L, ownerId);
        clusterId = Math.max(0L, clusterId);
        corridorId = Math.max(0L, corridorId);
        roomId = Math.max(0L, roomId);
        index = Math.max(0, index);
        cell = cell == null ? new Cell(0, 0, 0) : cell;
        direction = direction == null ? Direction.NORTH : direction;
    }
}
