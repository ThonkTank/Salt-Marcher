package src.domain.dungeon.model.editor.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceHandleBoundaryTranslationHelper {

    private DungeonEditorWorkspaceHandleBoundaryTranslationHelper() {
    }

    public static DungeonEditorHandleRef toDomainHandleRef(DungeonEditorWorkspaceValues.HandleRef ref) {
        DungeonEditorWorkspaceValues.HandleRef safeRef = ref == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : ref;
        return new DungeonEditorHandleRef(
                toDomainHandleKind(safeRef.kind()),
                DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toDomainTopologyRef(safeRef.topologyRef()),
                safeRef.ownerId(),
                safeRef.clusterId(),
                safeRef.corridorId(),
                safeRef.roomId(),
                safeRef.index(),
                 DungeonEditorWorkspaceCellBoundaryTranslationHelper.toDomainCell(safeRef.cell()),
                safeRef.direction());
    }

    static DungeonEditorWorkspaceValues.HandleRef toWorkspaceHandleRef(@Nullable DungeonEditorHandleRef ref) {
        return ref == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : new DungeonEditorWorkspaceValues.HandleRef(
                        toWorkspaceHandleKind(ref.kind()),
                        DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toWorkspaceTopologyRef(ref.topologyRef()),
                        ref.ownerId(),
                        ref.clusterId(),
                        ref.corridorId(),
                        ref.roomId(),
                        ref.index(),
                        DungeonEditorWorkspaceCellBoundaryTranslationHelper.toWorkspaceCell(ref.cell()),
                        ref.direction());
    }

    private static DungeonEditorHandleType toWorkspaceHandleKind(@Nullable DungeonEditorHandleKind kind) {
        if (kind == null) {
            return DungeonEditorHandleType.CLUSTER_LABEL;
        }
        return switch (kind) {
            case CLUSTER_LABEL -> DungeonEditorHandleType.CLUSTER_LABEL;
            case DOOR -> DungeonEditorHandleType.DOOR;
            case CORRIDOR_ANCHOR -> DungeonEditorHandleType.CORRIDOR_ANCHOR;
            case CORRIDOR_WAYPOINT -> DungeonEditorHandleType.CORRIDOR_WAYPOINT;
            case STAIR_ANCHOR -> DungeonEditorHandleType.STAIR_ANCHOR;
        };
    }

    private static DungeonEditorHandleKind toDomainHandleKind(DungeonEditorHandleType kind) {
        DungeonEditorHandleType safeKind = kind == null
                ? DungeonEditorHandleType.CLUSTER_LABEL
                : kind;
        return DungeonEditorHandleKind.valueOf(safeKind.name());
    }
}
