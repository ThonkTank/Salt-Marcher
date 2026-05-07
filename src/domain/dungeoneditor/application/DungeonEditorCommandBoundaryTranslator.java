package src.domain.dungeoneditor.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeoneditor.published.DungeonEditorMapId;
import src.domain.dungeoneditor.published.LoadDungeonEditorQuery;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorCommandBoundaryTranslator {

    private DungeonEditorCommandBoundaryTranslator() {
    }

    public static @Nullable DungeonMapId requestedDomainMapId(@Nullable LoadDungeonEditorQuery query) {
        LoadDungeonEditorQuery effectiveQuery = query == null ? new LoadDungeonEditorQuery(null) : query;
        DungeonEditorMapId mapId = effectiveQuery.mapId();
        DungeonEditorWorkspaceValues.MapId workspaceMapId = toWorkspaceMapId(mapId);
        return workspaceMapId == null ? null : new DungeonMapId(workspaceMapId.value());
    }

    private static DungeonEditorWorkspaceValues.@Nullable MapId toWorkspaceMapId(@Nullable DungeonEditorMapId mapId) {
        return mapId == null ? null : new DungeonEditorWorkspaceValues.MapId(mapId.value());
    }
}
