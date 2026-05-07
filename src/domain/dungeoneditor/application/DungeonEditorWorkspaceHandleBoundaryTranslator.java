package src.domain.dungeoneditor.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

final class DungeonEditorWorkspaceHandleBoundaryTranslator {

    private DungeonEditorWorkspaceHandleBoundaryTranslator() {
    }

    static DungeonEditorHandleRef toDomainHandleRef(DungeonEditorWorkspaceValues.HandleRef ref) {
        DungeonEditorWorkspaceValues.HandleRef safeRef = ref == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : ref;
        return new DungeonEditorHandleRef(
                toDomainHandleKind(safeRef.kind()),
                DungeonEditorWorkspaceTopologyBoundaryTranslator.toDomainTopologyRef(safeRef.topologyRef()),
                safeRef.ownerId(),
                safeRef.clusterId(),
                safeRef.corridorId(),
                safeRef.roomId(),
                safeRef.index(),
                DungeonEditorWorkspaceCellBoundaryTranslator.toDomainCell(safeRef.cell()),
                safeRef.direction());
    }

    static DungeonEditorWorkspaceValues.HandleRef toWorkspaceHandleRef(@Nullable DungeonEditorHandleRef ref) {
        return ref == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : new DungeonEditorWorkspaceValues.HandleRef(
                        toWorkspaceHandleKind(ref.kind()),
                        DungeonEditorWorkspaceTopologyBoundaryTranslator.toWorkspaceTopologyRef(ref.topologyRef()),
                        ref.ownerId(),
                        ref.clusterId(),
                        ref.corridorId(),
                        ref.roomId(),
                        ref.index(),
                        DungeonEditorWorkspaceCellBoundaryTranslator.toWorkspaceCell(ref.cell()),
                        ref.direction());
    }

    private static DungeonEditorWorkspaceValues.HandleKind toWorkspaceHandleKind(@Nullable DungeonEditorHandleKind kind) {
        if (kind == null) {
            return DungeonEditorWorkspaceValues.HandleKind.CLUSTER_LABEL;
        }
        return switch (kind) {
            case CLUSTER_LABEL -> DungeonEditorWorkspaceValues.HandleKind.CLUSTER_LABEL;
            case DOOR -> DungeonEditorWorkspaceValues.HandleKind.DOOR;
            case CORRIDOR_ANCHOR -> DungeonEditorWorkspaceValues.HandleKind.CORRIDOR_ANCHOR;
            case CORRIDOR_WAYPOINT -> DungeonEditorWorkspaceValues.HandleKind.CORRIDOR_WAYPOINT;
            case STAIR_ANCHOR -> DungeonEditorWorkspaceValues.HandleKind.STAIR_ANCHOR;
        };
    }

    private static DungeonEditorHandleKind toDomainHandleKind(DungeonEditorWorkspaceValues.HandleKind kind) {
        DungeonEditorWorkspaceValues.HandleKind safeKind = kind == null
                ? DungeonEditorWorkspaceValues.HandleKind.CLUSTER_LABEL
                : kind;
        return switch (safeKind) {
            case CLUSTER_LABEL -> DungeonEditorHandleKind.CLUSTER_LABEL;
            case DOOR -> DungeonEditorHandleKind.DOOR;
            case CORRIDOR_ANCHOR -> DungeonEditorHandleKind.CORRIDOR_ANCHOR;
            case CORRIDOR_WAYPOINT -> DungeonEditorHandleKind.CORRIDOR_WAYPOINT;
            case STAIR_ANCHOR -> DungeonEditorHandleKind.STAIR_ANCHOR;
        };
    }
}
