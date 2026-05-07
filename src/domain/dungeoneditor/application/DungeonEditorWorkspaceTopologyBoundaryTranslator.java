package src.domain.dungeoneditor.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

final class DungeonEditorWorkspaceTopologyBoundaryTranslator {

    private DungeonEditorWorkspaceTopologyBoundaryTranslator() {
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
        if (kind == null) {
            return DungeonEditorWorkspaceValues.TopologyElementKind.EMPTY;
        }
        return switch (kind) {
            case ROOM -> DungeonEditorWorkspaceValues.TopologyElementKind.ROOM;
            case CORRIDOR -> DungeonEditorWorkspaceValues.TopologyElementKind.CORRIDOR;
            case CORRIDOR_ANCHOR -> DungeonEditorWorkspaceValues.TopologyElementKind.CORRIDOR_ANCHOR;
            case DOOR -> DungeonEditorWorkspaceValues.TopologyElementKind.DOOR;
            case WALL -> DungeonEditorWorkspaceValues.TopologyElementKind.WALL;
            case STAIR -> DungeonEditorWorkspaceValues.TopologyElementKind.STAIR;
            case TRANSITION -> DungeonEditorWorkspaceValues.TopologyElementKind.TRANSITION;
            case EMPTY -> DungeonEditorWorkspaceValues.TopologyElementKind.EMPTY;
        };
    }

    private static DungeonTopologyElementKind toDomainTopologyKind(
            DungeonEditorWorkspaceValues.TopologyElementKind kind
    ) {
        DungeonEditorWorkspaceValues.TopologyElementKind safeKind = kind == null
                ? DungeonEditorWorkspaceValues.TopologyElementKind.EMPTY
                : kind;
        return switch (safeKind) {
            case ROOM -> DungeonTopologyElementKind.ROOM;
            case CORRIDOR -> DungeonTopologyElementKind.CORRIDOR;
            case CORRIDOR_ANCHOR -> DungeonTopologyElementKind.CORRIDOR_ANCHOR;
            case DOOR -> DungeonTopologyElementKind.DOOR;
            case WALL -> DungeonTopologyElementKind.WALL;
            case STAIR -> DungeonTopologyElementKind.STAIR;
            case TRANSITION -> DungeonTopologyElementKind.TRANSITION;
            case EMPTY -> DungeonTopologyElementKind.EMPTY;
        };
    }
}
