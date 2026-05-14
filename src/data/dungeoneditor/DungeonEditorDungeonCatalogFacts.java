package src.data.dungeoneditor;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorWorkspaceMapBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;

final class DungeonEditorDungeonCatalogFacts {

    private DungeonEditorDungeonCatalogFacts() {
        throw new AssertionError("No instances.");
    }

    static List<MapSummary> mapSummaries(@Nullable DungeonMapCatalogResponse response) {
        if (response instanceof DungeonMapCatalogResponse.MapList mapList) {
            return mapList.maps().stream()
                    .map(DungeonEditorWorkspaceMapBoundaryTranslationHelper::toWorkspaceMapSummary)
                    .toList();
        }
        return List.of();
    }

    static @Nullable MapId mutationMapId(@Nullable DungeonMapCatalogResponse response) {
        if (response instanceof DungeonMapCatalogResponse.MapMutation mutation) {
            return DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspaceMapId(mutation.mapId());
        }
        return null;
    }
}
