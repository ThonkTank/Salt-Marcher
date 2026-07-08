package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorControlsContentModel {
    private final DungeonEditorMapCatalogContentPartModel mapCatalog = new DungeonEditorMapCatalogContentPartModel();
    private final DungeonEditorProjectionOverlayContentPartModel projectionOverlay =
            new DungeonEditorProjectionOverlayContentPartModel();
    private final DungeonEditorToolPaletteContentPartModel toolPalette =
            new DungeonEditorToolPaletteContentPartModel();

    ReadOnlyObjectProperty<MapEditorUiState> mapEditorProperty() {
        return mapCatalog.mapEditorProperty();
    }

    ReadOnlyObjectProperty<ProjectionState> projectionProperty() {
        return projectionOverlay.projectionProperty();
    }

    ReadOnlyObjectProperty<ToolProjection> toolProjectionProperty() {
        return toolPalette.toolProjectionProperty();
    }

    void showControls(
            List<MapItem> maps,
            String selectedKey,
            List<Integer> reachableLevels,
            boolean busy,
            String statusText,
            String viewMode,
            DungeonOverlaySettings overlaySettings,
            int projectionLevel,
            String selectedTool
    ) {
        MapProjection nextMapProjection = mapCatalog.showMapCatalog(maps, selectedKey, busy, statusText);
        boolean hasMap = !nextMapProjection.selectedKey().isBlank();
        projectionOverlay.showProjection(
                reachableLevels,
                busy,
                hasMap,
                overlaySettings,
                projectionLevel,
                viewMode);
        toolPalette.showSelectedTool(selectedTool);
    }

    List<OverlayModeOption> overlayModeOptions() {
        return projectionOverlay.overlayModeOptions();
    }

    ToolControls toolControls() {
        return toolPalette.toolControls();
    }

    void rememberToolSelection(String requestedFamilyKey, String selectedToolKey, String selectedOptionKey) {
        toolPalette.rememberToolSelection(requestedFamilyKey, selectedToolKey, selectedOptionKey);
    }

    MapEditorUiState currentMapEditorUiState() {
        return mapCatalog.currentMapEditorUiState();
    }

    void openCreateMapEditor() {
        mapCatalog.openCreateMapEditor();
    }

    void openSelectedMapEditor(MapEditorMode mode, long mapIdValue) {
        mapCatalog.openSelectedMapEditor(mode, mapIdValue);
    }

    void updateMapEditorDraft(String draftName) {
        mapCatalog.updateMapEditorDraft(draftName);
    }

    void showMapEditorValidationError(String errorText) {
        mapCatalog.showMapEditorValidationError(errorText);
    }

    void closeMapEditor() {
        mapCatalog.closeMapEditor();
    }

    private static @Nullable MapItem findMapEntry(List<MapItem> mapEntries, long mapIdValue) {
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

        @Nullable MapItem mapItem(long mapIdValue) {
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

        static MapEditorUiState resolve(@Nullable MapEditorUiState state) {
            return state == null ? hidden() : state;
        }

        static MapEditorUiState create(String draftName) {
            return new MapEditorUiState(true, MapEditorMode.CREATE, 0L, "Neuen Dungeon anlegen",
                    draftName, "", true, true, true, "Erstellen", false);
        }

        static MapEditorUiState rename(long mapIdValue, String draftName) {
            return new MapEditorUiState(true, MapEditorMode.RENAME, mapIdValue, "Dungeon bearbeiten",
                    draftName, "", true, true, true, "Speichern", false);
        }

        static MapEditorUiState delete(long mapIdValue, String mapName) {
            return new MapEditorUiState(true, MapEditorMode.DELETE, mapIdValue,
                    "Dungeon löschen: " + (mapName == null ? "" : mapName),
                    "", "", false, false, false, "", true);
        }

        MapEditorUiState withDraftName(String nextDraftName) {
            return new MapEditorUiState(visible, mode, mapIdValue, title, nextDraftName, errorText,
                    draftFieldVisible, actionRowVisible, submitVisible, submitLabel, deleteConfirmationVisible);
        }

        MapEditorUiState withErrorText(String nextErrorText) {
            return new MapEditorUiState(visible, mode, mapIdValue, title, draftName, nextErrorText,
                    draftFieldVisible, actionRowVisible, submitVisible, submitLabel, deleteConfirmationVisible);
        }

        MapEditorUiState synchronizeWith(List<MapItem> mapEntries) {
            if (!visible() || !targetsExistingMap()) {
                return this;
            }
            return findMapEntry(mapEntries, mapIdValue()) == null ? hidden() : this;
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
            return mode == MapEditorMode.RENAME || mode == MapEditorMode.DELETE;
        }
    }

    record OverlayModeOption(
            String key,
            String label,
            boolean rangeVisible,
            boolean selectedLevelsVisible
    ) {
        OverlayModeOption {
            key = normalizeModeKey(key);
            label = label == null ? "" : label;
        }

        @Override
        public String toString() {
            return label;
        }
    }

    record OverlayPanelState(
            String modeKey,
            int levelRange,
            double opacityPercent,
            String opacityText,
            String selectedLevelsText,
            boolean rangeVisible,
            boolean selectedVisible,
            boolean controlsDisabled,
            String triggerText
    ) {
        static OverlayPanelState from(DungeonOverlaySettings settings, boolean disabled) {
            return DungeonEditorProjectionOverlayContentPartModel.overlayPanelState(settings, disabled);
        }
    }

    record ProjectionState(
            int activeLevel,
            boolean busy,
            boolean navigationEnabled,
            DungeonOverlaySettings overlaySettings,
            OverlayPanelState overlayPanelState,
            boolean overlayDisabled,
            String viewMode,
            boolean graphViewSelected
    ) {
        ProjectionState {
            overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
            overlayPanelState = overlayPanelState == null
                    ? OverlayPanelState.from(overlaySettings, overlayDisabled)
                    : overlayPanelState;
            viewMode = normalizeViewModeKey(viewMode);
        }

        static ProjectionState initial() {
            return new ProjectionState(
                    0,
                    false,
                    false,
                    DungeonOverlaySettings.defaults(),
                    OverlayPanelState.from(DungeonOverlaySettings.defaults(), false),
                    false,
                    gridViewLabel(),
                    false);
        }
    }

    record ToolProjection(String selectedTool, ToolControls toolControls) {
        ToolProjection {
            selectedTool = selectedTool == null || selectedTool.isBlank()
                    ? defaultToolLabel()
                    : selectedTool;
            toolControls = toolControls == null
                    ? DungeonEditorToolPaletteContentPartModel.defaultToolControls()
                    : toolControls;
        }

        static ToolProjection initial() {
            return new ToolProjection(
                    defaultToolLabel(),
                    DungeonEditorToolPaletteContentPartModel.defaultToolControls());
        }
    }

    record ToolControls(
            String defaultTool,
            String gridView,
            String graphView,
            ToolButton select,
            ToolFamilyButton room,
            ToolFamilyButton wall,
            ToolFamilyButton door,
            ToolFamilyButton corridor,
            ToolFamilyButton feature,
            ToolFamilyButton stair,
            ToolFamilyButton transition
    ) {
    }

    record ToolFamilyButton(
            String familyKey,
            String label,
            String selectedOptionKey,
            List<ToolButton> options
    ) {
        ToolFamilyButton {
            familyKey = familyKey == null ? "" : familyKey;
            label = label == null ? "" : label;
            selectedOptionKey = selectedOptionKey == null ? "" : selectedOptionKey;
            options = options == null ? List.of() : List.copyOf(options);
        }

        ToolButton selectedOption() {
            for (ToolButton option : options) {
                if (option.key().equals(selectedOptionKey)) {
                    return option;
                }
            }
            return options.isEmpty() ? new ToolButton(label, label, selectedOptionKey) : options.getFirst();
        }

        boolean hasSecondaryOptions() {
            return options.size() > 1;
        }

        boolean selectedByLabel(String selectedToolLabel) {
            for (ToolButton option : options) {
                if (option.selectedLabel().equals(selectedToolLabel)) {
                    return true;
                }
            }
            return false;
        }
    }

    record ToolButton(String label, String selectedLabel, String key, String toolKey, boolean enabled) {
        ToolButton(String label, String selectedLabel, String key) {
            this(label, selectedLabel, key, key, true);
        }
    }

    static String defaultToolLabel() {
        return DungeonEditorToolPaletteContentPartModel.defaultToolLabel();
    }

    static String gridViewLabel() {
        return DungeonEditorToolPaletteContentPartModel.gridViewLabel();
    }

    static String graphViewLabel() {
        return DungeonEditorToolPaletteContentPartModel.graphViewLabel();
    }

    static String wallPathModeOptionKey() {
        return DungeonEditorToolPaletteContentPartModel.wallPathModeOptionKey();
    }

    static String wallSingleClickModeOptionKey() {
        return DungeonEditorToolPaletteContentPartModel.wallSingleClickModeOptionKey();
    }

    boolean wallSingleClickModeSelected() {
        return toolPalette.wallSingleClickModeSelected();
    }

    static String labelOf(@Nullable String tool) {
        return DungeonEditorToolPaletteContentPartModel.labelOf(tool);
    }

    static String normalizeViewModeKey(@Nullable String viewModeKey) {
        return DungeonEditorToolPaletteContentPartModel.normalizeViewModeKey(viewModeKey);
    }

    static String normalizedToolKey(@Nullable String selectedToolKey) {
        return DungeonEditorToolPaletteContentPartModel.normalizedToolKey(selectedToolKey);
    }

    private static String normalizeModeKey(@Nullable String modeKey) {
        return DungeonEditorProjectionOverlayContentPartModel.normalizeModeKey(modeKey);
    }

    private static String overlayOffMode() {
        return DungeonEditorProjectionOverlayContentPartModel.overlayOffMode();
    }

    private static String overlayNearbyMode() {
        return DungeonEditorProjectionOverlayContentPartModel.overlayNearbyMode();
    }

    private static String overlaySelectedMode() {
        return DungeonEditorProjectionOverlayContentPartModel.overlaySelectedMode();
    }
}
