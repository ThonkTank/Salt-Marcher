package src.domain.dungeon.model.editor.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionPublishedBoundaryTranslationHelper {

    private DungeonEditorProjectionPublishedBoundaryTranslationHelper() {
    }

    public static DungeonTopologyKind topology(DungeonTopology topology) {
        return topology != null && topology.isHex()
                ? DungeonTopologyKind.HEX
                : DungeonTopologyKind.SQUARE;
    }

    public static DungeonEditorTopologyElementRef safeTopologyRef(
            @Nullable DungeonTopologyRef ref
    ) {
        return DungeonEditorPublishedValueProjectionHelper.toPublishedTopologyRef(
                ref == null ? DungeonTopologyRef.empty() : ref);
    }

    public static DungeonEditorTopologyElementRef safeTopologyRef(
            @Nullable DungeonTopologyElementRef ref
    ) {
        return ref == null
                ? DungeonEditorTopologyElementRef.empty()
                : new DungeonEditorTopologyElementRef(ref.kind().name(), ref.id());
    }

    public static DungeonEditorHandleRef emptyHandleRef(long ownerId, long clusterId) {
        return DungeonEditorPublishedValueProjectionHelper.toPublishedHandleRefOrEmpty(emptyWorkspaceHandleRef(ownerId, clusterId));
    }

    public static DungeonEditorWorkspaceValues.HandleRef emptyWorkspaceHandleRef(long ownerId, long clusterId) {
        return new DungeonEditorWorkspaceValues.HandleRef(
                DungeonEditorHandleType.CLUSTER_LABEL,
                DungeonTopologyRef.empty(),
                ownerId,
                clusterId,
                0L,
                0L,
                0,
                DungeonEditorWorkspaceValues.Cell.empty(),
                "");
    }
}
