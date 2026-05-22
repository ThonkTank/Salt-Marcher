package src.view.leftbartabs.dungeoneditor;

import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorControlsContentModel {

    private static final String DEFAULT_DUNGEON_NAME = "Dungeon";
    private static final String MODE_OFF = "OFF";
    private static final String MODE_NEARBY = "NEARBY";
    private static final String MODE_SELECTED = "SELECTED";

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
        mapEditor.set(synchronizeMapEditorUiState(mapEditor.get(), nextMapProjection.maps()));
        boolean hasMap = !nextMapProjection.selectedKey().isBlank();
        projection.set(new ProjectionState(
                projectionLevel,
                busy,
                hasMap && !safeLevels(reachableLevels).isEmpty(),
                overlaySettings,
                OverlayPanelState.from(overlaySettings, busy),
                busy,
                viewMode));
        toolProjection.set(new ToolProjection(selectedTool));
    }

    List<OverlayModeOption> overlayModeOptions() {
        return List.of(
                new OverlayModeOption(MODE_OFF, "Aus", false, false),
                new OverlayModeOption(MODE_NEARBY, "Nahe Ebenen", true, false),
                new OverlayModeOption(MODE_SELECTED, "Auswahl", false, true));
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

    private static List<Integer> safeLevels(List<Integer> levels) {
        return levels == null ? List.of() : List.copyOf(levels);
    }

    private static MapEditorUiState synchronizeMapEditorUiState(
            MapEditorUiState mapEditorUiState,
            List<MapItem> mapEntries
    ) {
        MapEditorUiState safeState = mapEditorUiState == null ? MapEditorUiState.hidden() : mapEditorUiState;
        if (!safeState.visible() || !safeState.targetsExistingMap()) {
            return safeState;
        }
        return findMapEntry(mapEntries, safeState.mapIdValue()) == null ? MapEditorUiState.hidden() : safeState;
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
            String selectedLevelsText,
            boolean rangeVisible,
            boolean selectedVisible,
            boolean controlsDisabled,
            String triggerText
    ) {
        static OverlayPanelState from(DungeonOverlaySettings settings, boolean disabled) {
            DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
            String safeModeKey = normalizedOverlayMode(safeSettings);
            return new OverlayPanelState(
                    safeModeKey,
                    safeOverlayRange(safeSettings),
                    safeOverlayOpacity(safeSettings) * 100.0,
                    selectedLevelList(safeSettings.selectedLevels()),
                    MODE_NEARBY.equals(safeModeKey),
                    MODE_SELECTED.equals(safeModeKey),
                    disabled,
                    triggerSummary(safeSettings));
        }
    }

    record ProjectionState(
            int activeLevel,
            boolean busy,
            boolean navigationEnabled,
            DungeonOverlaySettings overlaySettings,
            OverlayPanelState overlayPanelState,
            boolean overlayDisabled,
            String viewMode
    ) {
        ProjectionState {
            activeLevel = Math.max(0, activeLevel);
            overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
            overlayPanelState = overlayPanelState == null
                    ? OverlayPanelState.from(overlaySettings, overlayDisabled)
                    : overlayPanelState;
            viewMode = ToolCatalog.normalizeViewModeKey(viewMode);
        }

        static ProjectionState initial() {
            return new ProjectionState(
                    0,
                    false,
                    false,
                    DungeonOverlaySettings.defaults(),
                    OverlayPanelState.from(DungeonOverlaySettings.defaults(), false),
                    false,
                    ToolCatalog.GRID_VIEW_LABEL);
        }
    }

    record ToolProjection(String selectedTool) {
        ToolProjection {
            selectedTool = selectedTool == null || selectedTool.isBlank()
                    ? ToolCatalog.DEFAULT_TOOL_LABEL
                    : selectedTool;
        }

        static ToolProjection initial() {
            return new ToolProjection(ToolCatalog.DEFAULT_TOOL_LABEL);
        }
    }

    enum ToolFamily {
        NONE,
        ROOM,
        WALL,
        DOOR,
        CORRIDOR,
        STAIR,
        TRANSITION
    }

    static final class ToolCatalog {

        static final String DEFAULT_TOOL_LABEL = "Auswahl";
        static final String GRID_VIEW_LABEL = "Grid";
        static final String GRAPH_VIEW_LABEL = "Graph";
        static final String ROOM_PAINT_LABEL = "Raum malen";
        static final String ROOM_DELETE_LABEL = "Raum löschen";
        static final String SELECT_TOOL_KEY = "SELECT";
        static final String ROOM_PAINT_TOOL_KEY = "ROOM_PAINT";
        static final String ROOM_DELETE_TOOL_KEY = "ROOM_DELETE";
        static final String WALL_CREATE_TOOL_KEY = "WALL_CREATE";
        static final String WALL_DELETE_TOOL_KEY = "WALL_DELETE";
        static final String DOOR_CREATE_TOOL_KEY = "DOOR_CREATE";
        static final String DOOR_DELETE_TOOL_KEY = "DOOR_DELETE";
        static final String CORRIDOR_CREATE_TOOL_KEY = "CORRIDOR_CREATE";
        static final String CORRIDOR_DELETE_TOOL_KEY = "CORRIDOR_DELETE";
        private static final Map<DungeonEditorTool, String> TOOL_LABELS = createToolLabels();

        private ToolCatalog() {
        }

        static String labelOf(@Nullable DungeonEditorTool tool) {
            return TOOL_LABELS.getOrDefault(tool == null ? DungeonEditorTool.SELECT : tool, DEFAULT_TOOL_LABEL);
        }

        static String labelOf(@Nullable DungeonEditorViewMode viewMode) {
            return viewMode == DungeonEditorViewMode.GRAPH ? GRAPH_VIEW_LABEL : GRID_VIEW_LABEL;
        }

        static String normalizeViewModeKey(@Nullable String viewModeKey) {
            return GRAPH_VIEW_LABEL.equals(viewModeKey) ? GRAPH_VIEW_LABEL : GRID_VIEW_LABEL;
        }

        static DungeonEditorViewMode toPublishedViewMode(@Nullable String viewModeKey) {
            return GRAPH_VIEW_LABEL.equals(viewModeKey) ? DungeonEditorViewMode.GRAPH : DungeonEditorViewMode.GRID;
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

        static String roomRectangleLabel(boolean deleteMode) {
            return deleteMode ? ROOM_DELETE_LABEL : ROOM_PAINT_LABEL;
        }

        private static Map<DungeonEditorTool, String> createToolLabels() {
            Map<DungeonEditorTool, String> toolLabels = new EnumMap<>(DungeonEditorTool.class);
            toolLabels.put(DungeonEditorTool.SELECT, DEFAULT_TOOL_LABEL);
            toolLabels.put(DungeonEditorTool.ROOM_PAINT, ROOM_PAINT_LABEL);
            toolLabels.put(DungeonEditorTool.ROOM_DELETE, ROOM_DELETE_LABEL);
            toolLabels.put(DungeonEditorTool.WALL_CREATE, "Wand setzen");
            toolLabels.put(DungeonEditorTool.WALL_DELETE, "Wand löschen");
            toolLabels.put(DungeonEditorTool.DOOR_CREATE, "Tür setzen");
            toolLabels.put(DungeonEditorTool.DOOR_DELETE, "Tür löschen");
            toolLabels.put(DungeonEditorTool.CORRIDOR_CREATE, "Korridor erstellen");
            toolLabels.put(DungeonEditorTool.CORRIDOR_DELETE, "Korridor löschen");
            toolLabels.put(DungeonEditorTool.STAIR_CREATE, "Treppe erstellen");
            toolLabels.put(DungeonEditorTool.STAIR_DELETE, "Treppe löschen");
            toolLabels.put(DungeonEditorTool.TRANSITION_CREATE, "Übergang erstellen");
            toolLabels.put(DungeonEditorTool.TRANSITION_DELETE, "Übergang löschen");
            return Map.copyOf(toolLabels);
        }

    }

    private static String triggerSummary(DungeonOverlaySettings settings) {
        DungeonOverlaySettings resolvedSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
        String key = normalizedOverlayMode(resolvedSettings);
        if (MODE_NEARBY.equals(key)) {
            return "Overlay: Nachbarn +/-" + safeOverlayRange(resolvedSettings)
                    + " " + opacityText(safeOverlayOpacity(resolvedSettings));
        }
        if (MODE_SELECTED.equals(key)) {
            return "Overlay: Auswahl z=" + selectedLevelSummary(resolvedSettings.selectedLevels())
                    + " " + opacityText(safeOverlayOpacity(resolvedSettings));
        }
        return "Overlay: Aus";
    }

    private static String selectedLevelList(List<Integer> levels) {
        return (levels == null ? List.<Integer>of() : levels).stream()
                .map(String::valueOf)
                .sorted(Comparator.comparingInt(Integer::parseInt))
                .distinct()
                .collect(Collectors.joining(", "));
    }

    private static String selectedLevelSummary(List<Integer> levels) {
        String formatted = selectedLevelList(levels);
        return formatted.isBlank() ? "-" : formatted;
    }

    private static String opacityText(double opacity) {
        return Math.round(opacity * 100.0) + "%";
    }

    private static String normalizedOverlayMode(DungeonOverlaySettings settings) {
        return normalizeModeKey(settings == null ? null : settings.modeKey());
    }

    private static int safeOverlayRange(DungeonOverlaySettings settings) {
        DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
        return Math.max(1, safeSettings.levelRange());
    }

    private static double safeOverlayOpacity(DungeonOverlaySettings settings) {
        DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
        return Math.max(0.1, Math.min(0.9, safeSettings.opacity()));
    }

    private static String normalizeModeKey(@Nullable String modeKey) {
        if (MODE_NEARBY.equalsIgnoreCase(modeKey)) {
            return MODE_NEARBY;
        }
        if (MODE_SELECTED.equalsIgnoreCase(modeKey)) {
            return MODE_SELECTED;
        }
        return MODE_OFF;
    }
}
