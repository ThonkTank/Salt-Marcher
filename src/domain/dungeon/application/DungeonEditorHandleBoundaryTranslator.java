package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonEditorHandle;
import src.domain.dungeon.map.value.DungeonEditorHandleFacts;
import src.domain.dungeon.map.value.DungeonEditorHandleType;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;

public final class DungeonEditorHandleBoundaryTranslator {

    private DungeonEditorHandleBoundaryTranslator() {
    }

    public static DungeonEditorHandleSnapshot snapshot(DungeonEditorHandleFacts handle) {
        return new DungeonEditorHandleSnapshot(
                ref(handle.handle()),
                handle.label(),
                DungeonCellEdgeBoundaryTranslator.cell(handle.handle().cell()));
    }

    public static DungeonEditorHandleRef ref(DungeonEditorHandle handle) {
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.valueOf(handle.type().name()),
                DungeonTopologyBoundaryTranslator.topologyRef(handle.topologyRef()),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                DungeonCellEdgeBoundaryTranslator.cell(handle.cell()),
                handle.direction().name());
    }

    public static DungeonEditorHandle domainHandle(@Nullable DungeonEditorHandleRef ref) {
        if (ref == null) {
            return new DungeonEditorHandle(
                    DungeonEditorHandleType.CLUSTER_LABEL,
                    DungeonTopologyRef.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    DungeonCellEdgeBoundaryTranslator.emptyCell(),
                    DungeonEdgeDirection.NORTH);
        }
        return new DungeonEditorHandle(
                DungeonEditorHandleType.valueOf(ref.kind().name()),
                DungeonTopologyBoundaryTranslator.domainTopologyRef(ref.topologyRef()),
                ref.ownerId(),
                ref.clusterId(),
                ref.corridorId(),
                ref.roomId(),
                ref.index(),
                DungeonCellEdgeBoundaryTranslator.domainCell(ref.cell()),
                DungeonCellEdgeBoundaryTranslator.direction(ref.direction()));
    }
}
