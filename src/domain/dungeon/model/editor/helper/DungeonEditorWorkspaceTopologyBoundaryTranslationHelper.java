package src.domain.dungeon.model.editor.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceTopologyBoundaryTranslationHelper {

    private DungeonEditorWorkspaceTopologyBoundaryTranslationHelper() {
    }

    public static DungeonTopologyElementRef toDomainTopologyRef(DungeonTopologyRef ref) {
        DungeonTopologyRef safeRef = ref == null
                ? DungeonTopologyRef.empty()
                : ref;
        return new DungeonTopologyElementRef(toDomainTopologyKind(safeRef.kind()), safeRef.id());
    }

    public static DungeonTopologyElementRef toDomainTopologyRef(DungeonTopologyElementRef ref) {
        return ref == null ? DungeonTopologyElementRef.empty() : ref;
    }

    static DungeonTopologyRef toWorkspaceTopologyRef(
            @Nullable DungeonTopologyElementRef ref
    ) {
        return ref == null
                ? DungeonTopologyRef.empty()
                : new DungeonTopologyRef(
                        toWorkspaceTopologyKind(ref.kind()),
                        ref.id());
    }

    public static DungeonBoundaryKind toDomainBoundaryKind(DungeonEditorWorkspaceValues.BoundaryKind boundaryKind) {
        return boundaryKind != null && boundaryKind.isDoor()
                ? DungeonBoundaryKind.DOOR
                : DungeonBoundaryKind.WALL;
    }

    private static src.domain.dungeon.model.map.model.DungeonTopologyElementKind toWorkspaceTopologyKind(
            src.domain.dungeon.published.@Nullable DungeonTopologyElementKind kind
    ) {
        return src.domain.dungeon.model.map.model.DungeonTopologyElementKind.valueOf(
                kind == null ? null : kind.name());
    }

    private static src.domain.dungeon.published.DungeonTopologyElementKind toDomainTopologyKind(
            src.domain.dungeon.model.map.model.DungeonTopologyElementKind kind
    ) {
        src.domain.dungeon.model.map.model.DungeonTopologyElementKind safeKind = kind == null
                ? src.domain.dungeon.model.map.model.DungeonTopologyElementKind.EMPTY
                : kind;
        return src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(safeKind.name());
    }
}
