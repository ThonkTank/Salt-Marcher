package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

final class DungeonEditorMapCatalogContentPartModel {
    private final ReadOnlyObjectWrapper<DungeonEditorControlsContentModel.MapProjection> mapProjection =
            new ReadOnlyObjectWrapper<>(DungeonEditorControlsContentModel.MapProjection.empty());
    private final ReadOnlyObjectWrapper<DungeonEditorControlsContentModel.MapEditorUiState> mapEditor =
            new ReadOnlyObjectWrapper<>(DungeonEditorControlsContentModel.MapEditorUiState.hidden());

    ReadOnlyObjectProperty<DungeonEditorControlsContentModel.MapEditorUiState> mapEditorProperty() {
        return mapEditor.getReadOnlyProperty();
    }

    DungeonEditorControlsContentModel.MapProjection showMapCatalog(
            List<DungeonEditorControlsContentModel.MapItem> maps,
            String selectedKey,
            boolean busy,
            String statusText
    ) {
        DungeonEditorControlsContentModel.MapProjection nextMapProjection =
                new DungeonEditorControlsContentModel.MapProjection(maps, selectedKey, busy, statusText);
        mapProjection.set(nextMapProjection);
        mapEditor.set(DungeonEditorControlsContentModel.MapEditorUiState.resolve(mapEditor.get())
                .synchronizeWith(nextMapProjection.maps()));
        return nextMapProjection;
    }

    DungeonEditorControlsContentModel.MapEditorUiState currentMapEditorUiState() {
        return DungeonEditorControlsContentModel.MapEditorUiState.resolve(mapEditor.get());
    }

    void openCreateMapEditor() {
        mapEditor.set(DungeonEditorControlsContentModel.MapEditorUiState.create("Dungeon"));
    }

    void openSelectedMapEditor(DungeonEditorControlsContentModel.MapEditorMode mode, long mapIdValue) {
        DungeonEditorControlsContentModel.MapItem mapItem = mapProjection.get().mapItem(mapIdValue);
        if (mapItem == null) {
            mapEditor.set(DungeonEditorControlsContentModel.MapEditorUiState.hidden());
            return;
        }
        if (mode != null && mode.isRenameMode()) {
            mapEditor.set(DungeonEditorControlsContentModel.MapEditorUiState.rename(
                    mapItem.mapId(),
                    mapItem.mapName()));
            return;
        }
        if (mode != null && mode.isDeleteMode()) {
            mapEditor.set(DungeonEditorControlsContentModel.MapEditorUiState.delete(
                    mapItem.mapId(),
                    mapItem.mapName()));
        }
    }

    void updateMapEditorDraft(String draftName) {
        DungeonEditorControlsContentModel.MapEditorUiState currentState = currentMapEditorUiState();
        if (!currentState.visible()) {
            return;
        }
        String safeDraftName = draftName == null ? "" : draftName;
        if (currentState.draftName().equals(safeDraftName) && currentState.errorText().isBlank()) {
            return;
        }
        mapEditor.set(currentState.withDraftName(safeDraftName).withErrorText(""));
    }

    void showMapEditorValidationError(String errorText) {
        DungeonEditorControlsContentModel.MapEditorUiState currentState = currentMapEditorUiState();
        if (currentState.visible()) {
            mapEditor.set(currentState.withErrorText(errorText));
        }
    }

    void closeMapEditor() {
        mapEditor.set(DungeonEditorControlsContentModel.MapEditorUiState.hidden());
    }
}
