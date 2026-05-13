package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

final class DungeonEditorMapControlsContentModel {

    private final ReadOnlyObjectWrapper<MapProjection> mapProjection =
            new ReadOnlyObjectWrapper<>(MapProjection.empty());
    private final ReadOnlyObjectWrapper<DungeonEditorContributionModel.MapEditorUiState> mapEditor =
            new ReadOnlyObjectWrapper<>(DungeonEditorContributionModel.MapEditorUiState.hidden());

    ReadOnlyObjectProperty<MapProjection> mapProjectionProperty() {
        return mapProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<DungeonEditorContributionModel.MapEditorUiState> mapEditorProperty() {
        return mapEditor.getReadOnlyProperty();
    }

    void showMaps(
            List<MapItem> maps,
            String selectedKey,
            boolean busy,
            String statusText
    ) {
        mapProjection.set(new MapProjection(maps, selectedKey, busy, statusText));
    }

    void showMapEditor(DungeonEditorContributionModel.MapEditorUiState mapEditorUiState) {
        mapEditor.set(mapEditorUiState == null
                ? DungeonEditorContributionModel.MapEditorUiState.hidden()
                : mapEditorUiState);
    }

    record MapProjection(
            List<MapItem> maps,
            String selectedKey,
            boolean busy,
            String statusText
    ) {
        MapProjection {
            maps = maps == null ? List.of() : List.copyOf(maps);
            selectedKey = selectedKey == null ? "" : selectedKey;
            statusText = statusText == null ? "" : statusText;
        }

        static MapProjection empty() {
            return new MapProjection(List.of(), "", false, "");
        }
    }

    record MapItem(
            String key,
            long mapId,
            String mapName,
            long revision
    ) {
        MapItem {
            key = key == null ? "" : key;
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0L, revision);
        }

        static MapItem from(DungeonEditorContributionModel.MapListEntry selection) {
            return new MapItem(
                    selection.key(),
                    selection.mapIdValue(),
                    selection.mapName(),
                    selection.revision());
        }
    }
}
