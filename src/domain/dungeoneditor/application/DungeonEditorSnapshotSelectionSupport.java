package src.domain.dungeoneditor.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapSummary;

final class DungeonEditorSnapshotSelectionSupport {

    private DungeonEditorSnapshotSelectionSupport() {
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
                    .map(DungeonEditorWorkspaceMapBoundaryTranslator::toWorkspaceMapSummary)
                    .toList();
        }
        return List.of();
    }
}
