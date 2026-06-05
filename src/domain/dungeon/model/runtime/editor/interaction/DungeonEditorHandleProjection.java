package src.domain.dungeon.model.runtime.editor.interaction;

import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public record DungeonEditorHandleProjection(
        DungeonEditorHandleProjectionKind kind,
        DungeonTopologyRef topologyRef,
        long ownerId,
        long clusterId,
        long corridorId,
        long roomId,
        int index,
        Cell cell,
        Direction direction,
        String label
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
        direction = direction == null ? Direction.NORTH : direction;
        label = label == null || label.isBlank() ? kind.name() : label.trim();
    }
}
