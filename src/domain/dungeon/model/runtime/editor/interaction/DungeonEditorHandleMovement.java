package src.domain.dungeon.model.runtime.editor.interaction;

import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonEdgeDirection;

public record DungeonEditorHandleMovement(
        DungeonEditorHandleMovementKind kind,
        DungeonTopologyRef topologyRef,
        long ownerId,
        long clusterId,
        long corridorId,
        long roomId,
        int index,
        DungeonCell cell,
        DungeonEdgeDirection direction
) {
    public DungeonEditorHandleMovement {
        kind = kind == null ? DungeonEditorHandleMovementKind.defaultKind() : kind;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        ownerId = Math.max(0L, ownerId);
        clusterId = Math.max(0L, clusterId);
        corridorId = Math.max(0L, corridorId);
        roomId = Math.max(0L, roomId);
        index = Math.max(0, index);
        cell = cell == null ? new DungeonCell(0, 0, 0) : cell;
        direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
    }
}
