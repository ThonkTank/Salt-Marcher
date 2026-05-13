package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;

final class DungeonEditorOperationHandlesUseCase {

    private DungeonEditorOperationHandlesUseCase() {
    }

    static DungeonEditorHandle handle(@Nullable DungeonEditorHandleRef ref) {
        if (ref == null) {
            return new DungeonEditorHandle(
                    DungeonEditorHandleType.CLUSTER_LABEL,
                    DungeonTopologyRef.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    DungeonEditorOperationRefsUseCase.originCell(),
                    DungeonEdgeDirection.NORTH);
        }
        return new DungeonEditorHandle(
                DungeonEditorHandleType.valueOf(ref.kind().name()),
                DungeonEditorOperationRefsUseCase.topologyRef(ref.topologyRef()),
                ref.ownerId(),
                ref.clusterId(),
                ref.corridorId(),
                ref.roomId(),
                ref.index(),
                DungeonEditorOperationRefsUseCase.cell(ref.cell()),
                DungeonEditorOperationDirectionUseCase.direction(ref.direction()));
    }
}
