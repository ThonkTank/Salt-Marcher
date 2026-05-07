package src.domain.dungeoneditor.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeoneditor.published.DungeonEditorHandleRef;
import src.domain.dungeoneditor.published.DungeonEditorTopologyElementRef;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionPublishedBoundaryTranslator {

    private DungeonEditorProjectionPublishedBoundaryTranslator() {
    }

    public static DungeonTopologyKind topology(DungeonEditorWorkspaceValues.TopologyKind topology) {
        return topology != null && topology.isHex()
                ? DungeonTopologyKind.HEX
                : DungeonTopologyKind.SQUARE;
    }

    public static DungeonEditorTopologyElementRef safeTopologyRef(
            DungeonEditorWorkspaceValues.@Nullable TopologyElementRef ref
    ) {
        return DungeonEditorPublishedValueProjector.toPublishedTopologyRef(
                ref == null ? DungeonEditorWorkspaceValues.TopologyElementRef.empty() : ref);
    }

    public static DungeonEditorHandleRef emptyHandleRef(long ownerId, long clusterId) {
        return DungeonEditorPublishedValueProjector.toPublishedHandleRefOrEmpty(emptyWorkspaceHandleRef(ownerId, clusterId));
    }

    public static DungeonEditorWorkspaceValues.HandleRef emptyWorkspaceHandleRef(long ownerId, long clusterId) {
        return new DungeonEditorWorkspaceValues.HandleRef(
                DungeonEditorWorkspaceValues.HandleKind.fromName(null),
                DungeonEditorWorkspaceValues.TopologyElementRef.empty(),
                ownerId,
                clusterId,
                0L,
                0L,
                0,
                DungeonEditorWorkspaceValues.Cell.empty(),
                "");
    }
}
