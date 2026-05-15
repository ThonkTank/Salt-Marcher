package src.domain.dungeon.model.editor.helper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.model.editor.helper.DungeonEditorWorkspaceMapBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;

public final class DungeonEditorSnapshotSelectionProjectionHelper {

    private DungeonEditorSnapshotSelectionProjectionHelper() {
    }

    public static @Nullable MapId resolveSelectedMapId(@Nullable MapId requestedMapId, List<MapSummary> maps) {
        if (requestedMapId != null && maps.stream().anyMatch(summary -> requestedMapId.equals(summary.mapId()))) {
            return requestedMapId;
        }
        return maps.isEmpty() ? null : maps.getFirst().mapId();
    }

    public static List<MapSummary> mapSummaries(@Nullable DungeonMapCatalogResponse response) {
        if (response instanceof DungeonMapCatalogResponse.MapList mapList) {
            return mapList.maps().stream()
                     .map(DungeonEditorWorkspaceMapBoundaryTranslationHelper::toWorkspaceMapSummary)
                    .toList();
        }
        return List.of();
    }
}
