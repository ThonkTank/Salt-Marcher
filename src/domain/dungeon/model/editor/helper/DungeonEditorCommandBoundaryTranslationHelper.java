package src.domain.dungeon.model.editor.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonEditorMapId;
import src.domain.dungeon.published.LoadDungeonEditorQuery;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorCommandBoundaryTranslationHelper {

    private DungeonEditorCommandBoundaryTranslationHelper() {
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
