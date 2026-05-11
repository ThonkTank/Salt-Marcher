package src.domain.dungeoneditor.model.workspace.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

final class DungeonEditorWorkspaceTopologyBoundaryTranslationHelper {

    private DungeonEditorWorkspaceTopologyBoundaryTranslationHelper() {
    }

    static DungeonTopologyElementRef toDomainTopologyRef(DungeonEditorWorkspaceValues.TopologyElementRef ref) {
        DungeonEditorWorkspaceValues.TopologyElementRef safeRef = ref == null
                ? DungeonEditorWorkspaceValues.TopologyElementRef.empty()
                : ref;
        return new DungeonTopologyElementRef(toDomainTopologyKind(safeRef.kind()), safeRef.id());
    }

    static DungeonEditorWorkspaceValues.TopologyElementRef toWorkspaceTopologyRef(
            @Nullable DungeonTopologyElementRef ref
    ) {
        return ref == null
                ? DungeonEditorWorkspaceValues.TopologyElementRef.empty()
                : new DungeonEditorWorkspaceValues.TopologyElementRef(
                        toWorkspaceTopologyKind(ref.kind()),
                        ref.id());
    }

    static DungeonBoundaryKind toDomainBoundaryKind(DungeonEditorWorkspaceValues.BoundaryKind boundaryKind) {
        return boundaryKind != null && boundaryKind.isDoor()
                ? DungeonBoundaryKind.DOOR
                : DungeonBoundaryKind.WALL;
    }

    private static DungeonEditorWorkspaceValues.TopologyElementKind toWorkspaceTopologyKind(
            @Nullable DungeonTopologyElementKind kind
    ) {
        return DungeonEditorWorkspaceValues.TopologyElementKind.fromName(kind == null ? null : kind.name());
    }

    private static DungeonTopologyElementKind toDomainTopologyKind(
            DungeonEditorWorkspaceValues.TopologyElementKind kind
    ) {
        DungeonEditorWorkspaceValues.TopologyElementKind safeKind = kind == null
                ? DungeonEditorWorkspaceValues.TopologyElementKind.EMPTY
                : kind;
        return DungeonTopologyElementKind.valueOf(safeKind.name());
    }
}
