package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

final class DungeonEditorMapControlsContentModel {

    private static final String DEFAULT_DUNGEON_NAME = "Dungeon";

    private final ReadOnlyObjectWrapper<MapProjection> mapProjection =
            new ReadOnlyObjectWrapper<>(MapProjection.empty());
    private final ReadOnlyObjectWrapper<MapEditorUiState> mapEditor =
            new ReadOnlyObjectWrapper<>(MapEditorUiState.hidden());

    ReadOnlyObjectProperty<MapProjection> mapProjectionProperty() {
        return mapProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<MapEditorUiState> mapEditorProperty() {
        return mapEditor.getReadOnlyProperty();
    }

    void showMaps(
            List<MapItem> maps,
            String selectedKey,
            boolean busy,
            String statusText
    ) {
        MapProjection nextProjection = new MapProjection(maps, selectedKey, busy, statusText);
        mapProjection.set(nextProjection);
        mapEditor.set(synchronizeMapEditorUiState(mapEditor.get(), nextProjection.maps()));
    }

    MapEditorUiState currentMapEditorUiState() {
        MapEditorUiState current = mapEditor.get();
        return current == null ? MapEditorUiState.hidden() : current;
    }

    void openCreateMapEditor() {
        mapEditor.set(MapEditorUiState.create(DEFAULT_DUNGEON_NAME));
    }

    void openSelectedMapEditor(MapEditorMode mode, long mapIdValue) {
        MapItem mapItem = mapProjection.get().mapItem(mapIdValue);
        if (mapItem == null) {
            mapEditor.set(MapEditorUiState.hidden());
            return;
        }
        if (mode != null && mode.isRenameMode()) {
            mapEditor.set(MapEditorUiState.rename(mapItem.mapId(), mapItem.mapName()));
            return;
        }
        if (mode != null && mode.isDeleteMode()) {
            mapEditor.set(MapEditorUiState.delete(mapItem.mapId(), mapItem.mapName()));
        }
    }

    void updateMapEditorDraft(String draftName) {
        MapEditorUiState currentState = currentMapEditorUiState();
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
        MapEditorUiState currentState = currentMapEditorUiState();
        if (currentState.visible()) {
            mapEditor.set(currentState.withErrorText(errorText));
        }
    }

    void closeMapEditor() {
        mapEditor.set(MapEditorUiState.hidden());
    }

    private static MapEditorUiState synchronizeMapEditorUiState(
            MapEditorUiState mapEditorUiState,
            List<MapItem> mapEntries
    ) {
        MapEditorUiState safeState =
                mapEditorUiState == null ? MapEditorUiState.hidden() : mapEditorUiState;
        if (!safeState.visible() || !safeState.targetsExistingMap()) {
            return safeState;
        }
        return findMapEntry(mapEntries, safeState.mapIdValue()) == null
                ? MapEditorUiState.hidden()
                : safeState;
    }

    private static MapItem findMapEntry(List<MapItem> mapEntries, long mapIdValue) {
        return mapIdValue <= 0L || mapEntries == null
                ? null
                : mapEntries.stream().filter(entry -> entry.matchesId(mapIdValue)).findFirst().orElse(null);
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

        MapItem mapItem(long mapIdValue) {
            return findMapEntry(maps, mapIdValue);
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

        boolean matchesId(long selectedMapIdValue) {
            return mapId == selectedMapIdValue;
        }
    }

    enum MapEditorMode {
        HIDDEN,
        CREATE,
        RENAME,
        DELETE;

        static MapEditorMode hiddenMode() {
            return HIDDEN;
        }

        boolean isRenameMode() {
            return this == RENAME;
        }

        boolean isDeleteMode() {
            return this == DELETE;
        }
    }

    record MapEditorUiState(
            boolean visible,
            MapEditorMode mode,
            long mapIdValue,
            String title,
            String draftName,
            String errorText,
            boolean draftFieldVisible,
            boolean actionRowVisible,
            boolean submitVisible,
            String submitLabel,
            boolean deleteConfirmationVisible
    ) {
        MapEditorUiState {
            mode = mode == null ? MapEditorMode.hiddenMode() : mode;
            mapIdValue = Math.max(0L, mapIdValue);
            title = title == null ? "" : title;
            draftName = draftName == null ? "" : draftName;
            errorText = errorText == null ? "" : errorText;
            submitLabel = submitLabel == null ? "" : submitLabel;
        }

        static MapEditorUiState hidden() {
            return new MapEditorUiState(false, MapEditorMode.hiddenMode(), 0L, "", "", "", false, false, false, "", false);
        }

        static MapEditorUiState create(String draftName) {
            return new MapEditorUiState(
                    true,
                    MapEditorMode.CREATE,
                    0L,
                    "Neuen Dungeon anlegen",
                    draftName,
                    "",
                    true,
                    true,
                    true,
                    "Erstellen",
                    false);
        }

        static MapEditorUiState rename(long mapIdValue, String draftName) {
            return new MapEditorUiState(
                    true,
                    MapEditorMode.RENAME,
                    mapIdValue,
                    "Dungeon bearbeiten",
                    draftName,
                    "",
                    true,
                    true,
                    true,
                    "Speichern",
                    false);
        }

        static MapEditorUiState delete(long mapIdValue, String mapName) {
            return new MapEditorUiState(
                    true,
                    MapEditorMode.DELETE,
                    mapIdValue,
                    "Dungeon löschen: " + (mapName == null ? "" : mapName),
                    "",
                    "",
                    false,
                    false,
                    false,
                    "",
                    true);
        }

        MapEditorUiState withDraftName(String nextDraftName) {
            return new MapEditorUiState(
                    visible,
                    mode,
                    mapIdValue,
                    title,
                    nextDraftName,
                    errorText,
                    draftFieldVisible,
                    actionRowVisible,
                    submitVisible,
                    submitLabel,
                    deleteConfirmationVisible);
        }

        MapEditorUiState withErrorText(String nextErrorText) {
            return new MapEditorUiState(
                    visible,
                    mode,
                    mapIdValue,
                    title,
                    draftName,
                    nextErrorText,
                    draftFieldVisible,
                    actionRowVisible,
                    submitVisible,
                    submitLabel,
                    deleteConfirmationVisible);
        }

        boolean isCreateMode() {
            return mode == MapEditorMode.CREATE;
        }

        boolean isRenameMode() {
            return mode == MapEditorMode.RENAME;
        }

        boolean isDeleteMode() {
            return mode == MapEditorMode.DELETE;
        }

        boolean targetsExistingMap() {
            return isRenameMode() || isDeleteMode();
        }
    }
}
