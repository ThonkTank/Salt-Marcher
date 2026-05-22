package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorControlsContentModel {

    private final ReadOnlyObjectWrapper<MapProjection> mapProjection =
            new ReadOnlyObjectWrapper<>(MapProjection.empty());
    private final ReadOnlyObjectWrapper<MapEditorUiState> mapEditor =
            new ReadOnlyObjectWrapper<>(MapEditorUiState.hidden());
    private final ReadOnlyObjectWrapper<ProjectionState> projection =
            new ReadOnlyObjectWrapper<>(ProjectionState.initial());
    private final ReadOnlyObjectWrapper<ToolProjection> toolProjection =
            new ReadOnlyObjectWrapper<>(ToolProjection.initial());

    ReadOnlyObjectProperty<MapProjection> mapProjectionProperty() {
        return mapProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<MapEditorUiState> mapEditorProperty() {
        return mapEditor.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<ProjectionState> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<ToolProjection> toolProjectionProperty() {
        return toolProjection.getReadOnlyProperty();
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
        MapProjection nextMapProjection = new MapProjection(maps, selectedKey, busy, statusText);
        mapProjection.set(nextMapProjection);
        mapEditor.set(MapEditorUiState.resolve(mapEditor.get()).synchronizeWith(nextMapProjection.maps()));
        boolean hasMap = !nextMapProjection.selectedKey().isBlank();
        projection.set(new ProjectionState(
                projectionLevel,
                busy,
                hasMap && !safeLevels(reachableLevels).isEmpty(),
                overlaySettings,
                OverlayPanelState.from(overlaySettings, busy),
                busy,
                viewMode,
                graphViewLabel().equals(normalizeViewModeKey(viewMode))));
        toolProjection.set(new ToolProjection(selectedTool));
    }

    List<OverlayModeOption> overlayModeOptions() {
        return List.of(
                new OverlayModeOption(overlayOffMode(), "Aus", false, false),
                new OverlayModeOption(overlayNearbyMode(), "Nahe Ebenen", true, false),
                new OverlayModeOption(overlaySelectedMode(), "Auswahl", false, true));
    }

    ToolControls toolControls() {
        return ToolControls.current();
    }

    MapEditorUiState currentMapEditorUiState() {
        return MapEditorUiState.resolve(mapEditor.get());
    }

    void openCreateMapEditor() {
        mapEditor.set(MapEditorUiState.create("Dungeon"));
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

    private static List<Integer> safeLevels(List<Integer> levels) {
        return levels == null ? List.of() : List.copyOf(levels);
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
            DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
            String modeKey = normalizeModeKey(safeSettings.modeKey());
            int levelRange = Math.max(1, safeSettings.levelRange());
            double opacity = Math.max(0.1, Math.min(0.9, safeSettings.opacity()));
            String opacityText = opacityText(opacity);
            String selectedLevelsText = selectedLevelList(safeSettings.selectedLevels());
            return new OverlayPanelState(
                    modeKey,
                    levelRange,
                    opacity * 100.0,
                    opacityText,
                    selectedLevelsText,
                    overlayNearbyMode().equals(modeKey),
                    overlaySelectedMode().equals(modeKey),
                    disabled,
                    triggerText(modeKey, levelRange, opacityText, selectedLevelsText));
        }

        private static String opacityText(double opacity) {
            return Math.round(opacity * 100.0) + "%";
        }

        private static String triggerText(
                String modeKey,
                int levelRange,
                String opacityText,
                String selectedLevelsText
        ) {
            if (overlayNearbyMode().equals(modeKey)) {
                return "Overlay: Nachbarn +/-" + levelRange + " " + opacityText;
            }
            if (overlaySelectedMode().equals(modeKey)) {
                return "Overlay: Auswahl z=" + selectedLevelSummary(selectedLevelsText) + " " + opacityText;
            }
            return "Overlay: Aus";
        }

        private static String selectedLevelSummary(String selectedLevelsText) {
            return selectedLevelsText.isBlank() ? "-" : selectedLevelsText;
        }

        private static String selectedLevelList(List<Integer> levels) {
            return (levels == null ? List.<Integer>of() : levels).stream()
                    .distinct()
                    .sorted()
                    .map(String::valueOf)
                    .collect(Collectors.joining(", "));
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
            activeLevel = Math.max(0, activeLevel);
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

    record ToolProjection(String selectedTool) {
        ToolProjection {
            selectedTool = selectedTool == null || selectedTool.isBlank()
                    ? defaultToolLabel()
                    : selectedTool;
        }

        static ToolProjection initial() {
            return new ToolProjection(defaultToolLabel());
        }
    }

    record ToolControls(
            String defaultTool,
            String gridView,
            String graphView,
            ToolButton select,
            ToolButton room,
            ToolButton roomDelete,
            ToolButton wall,
            ToolButton wallDelete,
            ToolButton door,
            ToolButton doorDelete,
            ToolButton corridor,
            ToolButton corridorDelete
    ) {
        private static ToolControls current() {
            return new ToolControls(
                    defaultToolLabel(),
                    gridViewLabel(),
                    graphViewLabel(),
                    new ToolButton(defaultToolLabel(), defaultToolLabel(), DungeonEditorTool.SELECT.name()),
                    new ToolButton("Raum", "Raum malen", DungeonEditorTool.ROOM_PAINT.name()),
                    new ToolButton("Raum löschen", "Raum löschen", DungeonEditorTool.ROOM_DELETE.name()),
                    new ToolButton("Wand", "Wand setzen", DungeonEditorTool.WALL_CREATE.name()),
                    new ToolButton("Wand löschen", "Wand löschen", DungeonEditorTool.WALL_DELETE.name()),
                    new ToolButton("Tür", "Tür setzen", DungeonEditorTool.DOOR_CREATE.name()),
                    new ToolButton("Tür löschen", "Tür löschen", DungeonEditorTool.DOOR_DELETE.name()),
                    new ToolButton("Korridor", "Korridor erstellen", DungeonEditorTool.CORRIDOR_CREATE.name()),
                    new ToolButton("Korridor löschen", "Korridor löschen", DungeonEditorTool.CORRIDOR_DELETE.name()));
        }
    }

    record ToolButton(String label, String selectedLabel, String key) { }

    static String defaultToolLabel() {
        return "Auswahl";
    }

    static String gridViewLabel() {
        return "Grid";
    }

    static String graphViewLabel() {
        return "Graph";
    }

    static String labelOf(@Nullable DungeonEditorTool tool) {
        return ToolPresentation.labelOf(tool);
    }

    static String labelOf(@Nullable DungeonEditorViewMode viewMode) {
        return ToolPresentation.labelOf(viewMode);
    }

    static String normalizeViewModeKey(@Nullable String viewModeKey) {
        return ToolPresentation.normalizeViewModeKey(viewModeKey);
    }

    static DungeonEditorViewMode toPublishedViewMode(@Nullable String viewModeKey) {
        return ToolPresentation.toPublishedViewMode(viewModeKey);
    }

    static DungeonEditorTool toPublishedToolKey(@Nullable String selectedToolKey) {
        return ToolPresentation.toPublishedToolKey(selectedToolKey);
    }

    private interface ToolPresentation {

        static String labelOf(@Nullable DungeonEditorTool tool) {
            if (tool == null || tool == DungeonEditorTool.SELECT) {
                return defaultToolLabel();
            }
            String paintLabel = paintToolLabel(tool);
            if (!paintLabel.isBlank()) {
                return paintLabel;
            }
            String structureLabel = structureToolLabel(tool);
            return structureLabel.isBlank() ? transitionToolLabel(tool) : structureLabel;
        }

        private static String paintToolLabel(DungeonEditorTool tool) {
            return switch (tool) {
                case ROOM_PAINT -> "Raum malen";
                case ROOM_DELETE -> "Raum löschen";
                case WALL_CREATE -> "Wand setzen";
                case WALL_DELETE -> "Wand löschen";
                default -> "";
            };
        }

        private static String structureToolLabel(DungeonEditorTool tool) {
            return switch (tool) {
                case DOOR_CREATE -> "Tür setzen";
                case DOOR_DELETE -> "Tür löschen";
                case CORRIDOR_CREATE -> "Korridor erstellen";
                case CORRIDOR_DELETE -> "Korridor löschen";
                default -> "";
            };
        }

        private static String transitionToolLabel(DungeonEditorTool tool) {
            return switch (tool) {
                case STAIR_CREATE -> "Treppe erstellen";
                case STAIR_DELETE -> "Treppe löschen";
                case TRANSITION_CREATE -> "Übergang erstellen";
                case TRANSITION_DELETE -> "Übergang löschen";
                default -> defaultToolLabel();
            };
        }

        static String labelOf(@Nullable DungeonEditorViewMode viewMode) {
            return viewMode == DungeonEditorViewMode.GRAPH ? graphViewLabel() : gridViewLabel();
        }

        static String normalizeViewModeKey(@Nullable String viewModeKey) {
            return graphViewLabel().equals(viewModeKey) ? graphViewLabel() : gridViewLabel();
        }

        static DungeonEditorViewMode toPublishedViewMode(@Nullable String viewModeKey) {
            return graphViewLabel().equals(viewModeKey) ? DungeonEditorViewMode.GRAPH : DungeonEditorViewMode.GRID;
        }

        static DungeonEditorTool toPublishedToolKey(@Nullable String selectedToolKey) {
            if (selectedToolKey == null || selectedToolKey.isBlank()) {
                return DungeonEditorTool.SELECT;
            }
            try {
                return DungeonEditorTool.valueOf(selectedToolKey.trim());
            } catch (IllegalArgumentException ignored) {
                return DungeonEditorTool.SELECT;
            }
        }
    }

    private static String normalizeModeKey(@Nullable String modeKey) {
        if (overlayNearbyMode().equalsIgnoreCase(modeKey)) {
            return overlayNearbyMode();
        }
        if (overlaySelectedMode().equalsIgnoreCase(modeKey)) {
            return overlaySelectedMode();
        }
        return overlayOffMode();
    }

    private static String overlayOffMode() {
        return "OFF";
    }

    private static String overlayNearbyMode() {
        return "NEARBY";
    }

    private static String overlaySelectedMode() {
        return "SELECTED";
    }
}
