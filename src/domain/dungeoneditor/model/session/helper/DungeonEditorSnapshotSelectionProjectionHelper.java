package src.domain.dungeoneditor.model.session.helper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;

final class DungeonEditorSnapshotSelectionProjectionHelper {

    private DungeonEditorSnapshotSelectionProjectionHelper() {
    }

    static @Nullable MapId resolveSelectedMapId(@Nullable MapId requestedMapId, List<MapSummary> maps) {
        if (requestedMapId != null && maps.stream().anyMatch(summary -> requestedMapId.equals(summary.mapId()))) {
            return requestedMapId;
        }
        return maps.isEmpty() ? null : maps.getFirst().mapId();
    }

    static List<MapSummary> mapSummaries(@Nullable DungeonMapCatalogResponse response) {
        if (response instanceof DungeonMapCatalogResponse.MapList mapList) {
            return mapList.maps().stream()
                    .map(DungeonEditorWorkspaceMapBoundaryTranslationHelper::toWorkspaceMapSummary)
                    .toList();
        }
        return List.of();
    }
}
