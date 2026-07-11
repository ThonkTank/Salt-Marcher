package src.view.leftbartabs.dungeoneditor;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorOverlaySettings;

@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.TooManyMethods"})
final class DungeonEditorControlsPanelModel {
    private final MapCatalogPanel mapCatalog = new MapCatalogPanel();
    private final ProjectionOverlayPanel projectionOverlay =
            new ProjectionOverlayPanel();
    private final ToolPalettePanel toolPalette =
            new ToolPalettePanel();

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

    void rememberToolSelection(
            String requestedFamilyKey,
            DungeonEditorTool selectedTool,
            String selectedOptionKey
    ) {
        toolPalette.rememberToolSelection(requestedFamilyKey, selectedTool, selectedOptionKey);
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
            DungeonEditorOverlaySettings.Mode mode,
            String label,
            boolean rangeVisible,
            boolean selectedLevelsVisible
    ) {
        OverlayModeOption {
            mode = mode == null ? defaultOverlayMode() : mode;
            label = label == null ? "" : label;
        }

        String key() {
            return mode.name();
        }

        @Override
        public String toString() {
            return label;
        }
    }

    private static DungeonEditorOverlaySettings.Mode defaultOverlayMode() {
        return DungeonEditorOverlaySettings.defaults().mode();
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
            return ProjectionOverlayPanel.overlayPanelState(settings, disabled);
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
                    ? ToolPalettePanel.defaultToolControls()
                    : toolControls;
        }

        static ToolProjection initial() {
            return new ToolProjection(
                    defaultToolLabel(),
                    ToolPalettePanel.defaultToolControls());
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

    record ToolButton(String label, String selectedLabel, String key, DungeonEditorTool tool, boolean enabled) {
        ToolButton {
            label = label == null ? "" : label;
            selectedLabel = selectedLabel == null ? "" : selectedLabel;
            key = key == null ? "" : key;
            tool = tool == null ? DungeonEditorTool.SELECT : tool;
        }

        ToolButton(String label, String selectedLabel, String key) {
            this(label, selectedLabel, key, DungeonEditorTool.SELECT, true);
        }

    }

    static String defaultToolLabel() {
        return ToolPalettePanel.defaultToolLabel();
    }

    static String gridViewLabel() {
        return ToolPalettePanel.gridViewLabel();
    }

    static String graphViewLabel() {
        return ToolPalettePanel.graphViewLabel();
    }

    boolean wallSingleClickModeSelected() {
        return toolPalette.wallSingleClickModeSelected();
    }

    static String normalizeViewModeKey(@Nullable String viewModeKey) {
        return ToolPalettePanel.normalizeViewModeKey(viewModeKey);
    }

    private static final class MapCatalogPanel {
    private final ReadOnlyObjectWrapper<DungeonEditorControlsPanelModel.MapProjection> mapProjection =
            new ReadOnlyObjectWrapper<>(DungeonEditorControlsPanelModel.MapProjection.empty());
    private final ReadOnlyObjectWrapper<DungeonEditorControlsPanelModel.MapEditorUiState> mapEditor =
            new ReadOnlyObjectWrapper<>(DungeonEditorControlsPanelModel.MapEditorUiState.hidden());

    ReadOnlyObjectProperty<DungeonEditorControlsPanelModel.MapEditorUiState> mapEditorProperty() {
        return mapEditor.getReadOnlyProperty();
    }

    DungeonEditorControlsPanelModel.MapProjection showMapCatalog(
            List<DungeonEditorControlsPanelModel.MapItem> maps,
            String selectedKey,
            boolean busy,
            String statusText
    ) {
        DungeonEditorControlsPanelModel.MapProjection nextMapProjection =
                new DungeonEditorControlsPanelModel.MapProjection(maps, selectedKey, busy, statusText);
        mapProjection.set(nextMapProjection);
        mapEditor.set(DungeonEditorControlsPanelModel.MapEditorUiState.resolve(mapEditor.get())
                .synchronizeWith(nextMapProjection.maps()));
        return nextMapProjection;
    }

    DungeonEditorControlsPanelModel.MapEditorUiState currentMapEditorUiState() {
        return DungeonEditorControlsPanelModel.MapEditorUiState.resolve(mapEditor.get());
    }

    void openCreateMapEditor() {
        mapEditor.set(DungeonEditorControlsPanelModel.MapEditorUiState.create("Dungeon"));
    }

    void openSelectedMapEditor(DungeonEditorControlsPanelModel.MapEditorMode mode, long mapIdValue) {
        DungeonEditorControlsPanelModel.MapItem mapItem = mapProjection.get().mapItem(mapIdValue);
        if (mapItem == null) {
            mapEditor.set(DungeonEditorControlsPanelModel.MapEditorUiState.hidden());
            return;
        }
        if (mode != null && mode.isRenameMode()) {
            mapEditor.set(DungeonEditorControlsPanelModel.MapEditorUiState.rename(
                    mapItem.mapId(),
                    mapItem.mapName()));
            return;
        }
        if (mode != null && mode.isDeleteMode()) {
            mapEditor.set(DungeonEditorControlsPanelModel.MapEditorUiState.delete(
                    mapItem.mapId(),
                    mapItem.mapName()));
        }
    }

    void updateMapEditorDraft(String draftName) {
        DungeonEditorControlsPanelModel.MapEditorUiState currentState = currentMapEditorUiState();
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
        DungeonEditorControlsPanelModel.MapEditorUiState currentState = currentMapEditorUiState();
        if (currentState.visible()) {
            mapEditor.set(currentState.withErrorText(errorText));
        }
    }

    void closeMapEditor() {
        mapEditor.set(DungeonEditorControlsPanelModel.MapEditorUiState.hidden());
    }
    }

    @SuppressWarnings("PMD.TooManyMethods")
    private static final class ProjectionOverlayPanel {
    private static final String OVERLAY_OFF_MODE = "OFF";
    private static final String OVERLAY_NEARBY_MODE = "NEARBY";
    private static final String OVERLAY_SELECTED_MODE = "SELECTED";

    private final ReadOnlyObjectWrapper<DungeonEditorControlsPanelModel.ProjectionState> projection =
            new ReadOnlyObjectWrapper<>(DungeonEditorControlsPanelModel.ProjectionState.initial());

    ReadOnlyObjectProperty<DungeonEditorControlsPanelModel.ProjectionState> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void showProjection(
            List<Integer> reachableLevels,
            boolean busy,
            boolean hasMap,
            DungeonOverlaySettings overlaySettings,
            int projectionLevel,
            String viewMode
    ) {
        projection.set(new DungeonEditorControlsPanelModel.ProjectionState(
                projectionLevel,
                busy,
                hasMap && !safeLevels(reachableLevels).isEmpty(),
                overlaySettings,
                DungeonEditorControlsPanelModel.OverlayPanelState.from(overlaySettings, busy),
                busy,
                viewMode,
                graphViewLabel().equals(normalizeViewModeKey(viewMode))));
    }

    List<DungeonEditorControlsPanelModel.OverlayModeOption> overlayModeOptions() {
        return List.of(
                new DungeonEditorControlsPanelModel.OverlayModeOption(
                        DungeonEditorOverlaySettings.Mode.OFF,
                        "Aus",
                        false,
                        false),
                new DungeonEditorControlsPanelModel.OverlayModeOption(
                        DungeonEditorOverlaySettings.Mode.NEARBY,
                        "Nahe Ebenen",
                        true,
                        false),
                new DungeonEditorControlsPanelModel.OverlayModeOption(
                        DungeonEditorOverlaySettings.Mode.SELECTED,
                        defaultToolLabel(),
                        false,
                        true));
    }

    static DungeonEditorControlsPanelModel.OverlayPanelState overlayPanelState(
            DungeonOverlaySettings settings,
            boolean disabled
    ) {
        DungeonOverlaySettings safeSettings = settings == null ? DungeonOverlaySettings.defaults() : settings;
        String modeKey = normalizeModeKey(safeSettings.modeKey());
        int levelRange = Math.max(1, safeSettings.levelRange());
        double opacity = Math.max(0.1, Math.min(0.9, safeSettings.opacity()));
        String opacityText = opacityText(opacity);
        String selectedLevelsText = selectedLevelList(safeSettings.selectedLevels());
        return new DungeonEditorControlsPanelModel.OverlayPanelState(
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

    static String normalizeModeKey(@Nullable String modeKey) {
        if (overlayNearbyMode().equalsIgnoreCase(modeKey)) {
            return overlayNearbyMode();
        }
        if (overlaySelectedMode().equalsIgnoreCase(modeKey)) {
            return overlaySelectedMode();
        }
        return overlayOffMode();
    }

    static String overlayOffMode() {
        return OVERLAY_OFF_MODE;
    }

    static String overlayNearbyMode() {
        return OVERLAY_NEARBY_MODE;
    }

    static String overlaySelectedMode() {
        return OVERLAY_SELECTED_MODE;
    }

    private static List<Integer> safeLevels(List<Integer> levels) {
        return levels == null ? List.of() : List.copyOf(levels);
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

    @SuppressWarnings("PMD.TooManyMethods")
    private static final class ToolPalettePanel {
    private static final DungeonEditorTool SELECT_TOOL = DungeonEditorTool.SELECT;
    private static final DungeonEditorTool ROOM_PAINT_TOOL = DungeonEditorTool.ROOM_PAINT;
    private static final DungeonEditorTool WALL_CREATE_TOOL = DungeonEditorTool.WALL_CREATE;
    private static final DungeonEditorTool DOOR_CREATE_TOOL = DungeonEditorTool.DOOR_CREATE;
    private static final DungeonEditorTool CORRIDOR_CREATE_TOOL = DungeonEditorTool.CORRIDOR_CREATE;
    private static final DungeonEditorTool STAIR_CREATE_TOOL = DungeonEditorTool.STAIR_CREATE;
    private static final DungeonEditorTool STAIR_CREATE_SQUARE_TOOL = DungeonEditorTool.STAIR_CREATE_SQUARE;
    private static final DungeonEditorTool STAIR_CREATE_CIRCULAR_TOOL = DungeonEditorTool.STAIR_CREATE_CIRCULAR;
    private static final DungeonEditorTool TRANSITION_CREATE_TOOL = DungeonEditorTool.TRANSITION_CREATE;
    private static final DungeonEditorTool FEATURE_POI_CREATE_TOOL = DungeonEditorTool.FEATURE_POI_CREATE;
    private static final DungeonEditorTool FEATURE_OBJECT_CREATE_TOOL = DungeonEditorTool.FEATURE_OBJECT_CREATE;
    private static final DungeonEditorTool FEATURE_ENCOUNTER_CREATE_TOOL = DungeonEditorTool.FEATURE_ENCOUNTER_CREATE;
    private static final String WALL_PATH_MODE_OPTION_KEY = "WALL_PATH";
    private static final String WALL_SINGLE_CLICK_MODE_OPTION_KEY = "WALL_SINGLE_CLICK";
    private static final String GRID_VIEW_LABEL = "Grid";
    private static final String GRAPH_VIEW_LABEL = "Graph";

    private final ReadOnlyObjectWrapper<DungeonEditorControlsPanelModel.ToolProjection> toolProjection =
            new ReadOnlyObjectWrapper<>(DungeonEditorControlsPanelModel.ToolProjection.initial());
    private final Map<ToolFamily, String> selectedFamilyOptionKeys = new EnumMap<>(ToolFamily.class);

    ReadOnlyObjectProperty<DungeonEditorControlsPanelModel.ToolProjection> toolProjectionProperty() {
        return toolProjection.getReadOnlyProperty();
    }

    DungeonEditorControlsPanelModel.ToolControls toolControls() {
        return currentToolControls(selectedFamilyOptionKeys);
    }

    void showSelectedTool(String selectedTool) {
        if (defaultToolLabel().equals(selectedTool)) {
            selectedFamilyOptionKeys.clear();
        }
        toolProjection.set(new DungeonEditorControlsPanelModel.ToolProjection(selectedTool, toolControls()));
    }

    void rememberToolSelection(
            String requestedFamilyKey,
            DungeonEditorTool selectedTool,
            String selectedOptionKey
    ) {
        ToolFamily requestedFamily = ToolFamily.fromKey(requestedFamilyKey);
        DungeonEditorTool safeSelectedTool = selectedTool == null ? SELECT_TOOL : selectedTool;
        ToolFamily selectedFamily = ToolFamily.fromTool(safeSelectedTool);
        ToolFamily family = selectedFamily == null ? requestedFamily : selectedFamily;
        String optionKey = selectedOptionKey == null || selectedOptionKey.isBlank()
                ? safeSelectedTool.name()
                : selectedOptionKey;
        if (family != null && family.containsOptionKey(optionKey)) {
            selectedFamilyOptionKeys.put(family, optionKey);
            toolProjection.set(new DungeonEditorControlsPanelModel.ToolProjection(
                    toolProjection.get().selectedTool(),
                    toolControls()));
        }
    }

    boolean wallSingleClickModeSelected() {
        return wallSingleClickModeOptionKey().equals(selectedFamilyOptionKeys.get(ToolFamily.WALL));
    }

    static DungeonEditorControlsPanelModel.ToolControls defaultToolControls() {
        return currentToolControls(Map.of());
    }

    static String defaultToolLabel() {
        return labelOf(SELECT_TOOL);
    }

    static String gridViewLabel() {
        return GRID_VIEW_LABEL;
    }

    static String graphViewLabel() {
        return GRAPH_VIEW_LABEL;
    }

    static String wallPathModeOptionKey() {
        return WALL_PATH_MODE_OPTION_KEY;
    }

    static String wallSingleClickModeOptionKey() {
        return WALL_SINGLE_CLICK_MODE_OPTION_KEY;
    }

    static String labelOf(@Nullable DungeonEditorTool tool) {
        return ToolPresentation.labelOf(tool);
    }

    static String normalizeViewModeKey(@Nullable String viewModeKey) {
        return ToolPresentation.normalizeViewModeKey(viewModeKey);
    }

    private static DungeonEditorControlsPanelModel.ToolControls currentToolControls(
            Map<ToolFamily, String> selectedFamilyOptionKeys
    ) {
        return new DungeonEditorControlsPanelModel.ToolControls(
                defaultToolLabel(),
                gridViewLabel(),
                graphViewLabel(),
                new DungeonEditorControlsPanelModel.ToolButton(
                        defaultToolLabel(),
                        defaultToolLabel(),
                        SELECT_TOOL.name(),
                        SELECT_TOOL,
                        true),
                ToolFamily.ROOM.toButton(selectedFamilyOptionKeys),
                ToolFamily.WALL.toButton(selectedFamilyOptionKeys),
                ToolFamily.DOOR.toButton(selectedFamilyOptionKeys),
                ToolFamily.CORRIDOR.toButton(selectedFamilyOptionKeys),
                ToolFamily.FEATURE.toButton(selectedFamilyOptionKeys),
                ToolFamily.STAIR.toButton(selectedFamilyOptionKeys),
                ToolFamily.TRANSITION.toButton(selectedFamilyOptionKeys));
    }

    private enum ToolFamily {
        ROOM("ROOM", "Raum", ROOM_PAINT_TOOL),
        WALL(
                "WALL",
                "Wand",
                WALL_CREATE_TOOL,
                new ToolOptionSpec(
                        wallPathModeOptionKey(),
                        "Pfad",
                        WALL_CREATE_TOOL,
                        true),
                new ToolOptionSpec(
                        wallSingleClickModeOptionKey(),
                        "Einzeln",
                        WALL_CREATE_TOOL,
                        true)),
        DOOR("DOOR", "Tür", DOOR_CREATE_TOOL),
        CORRIDOR("CORRIDOR", "Korridor", CORRIDOR_CREATE_TOOL),
        FEATURE(
                "FEATURE",
                "Feature",
                FEATURE_POI_CREATE_TOOL,
                new ToolOptionSpec(
                        "FEATURE_POI",
                        "POI",
                        FEATURE_POI_CREATE_TOOL,
                        true),
                new ToolOptionSpec(
                        "FEATURE_OBJECT",
                        "Objekt",
                        FEATURE_OBJECT_CREATE_TOOL,
                        true),
                new ToolOptionSpec(
                        "FEATURE_ENCOUNTER",
                        "Encounter",
                        FEATURE_ENCOUNTER_CREATE_TOOL,
                        true)),
        STAIR(
                "STAIR",
                "Treppe",
                STAIR_CREATE_TOOL,
                new ToolOptionSpec(
                        "STAIR_STRAIGHT",
                        "Gerade",
                        STAIR_CREATE_TOOL,
                        true),
                new ToolOptionSpec(
                        "STAIR_ANGULAR_SPIRAL",
                        "Eckspirale",
                        STAIR_CREATE_SQUARE_TOOL,
                        true),
                new ToolOptionSpec(
                        "STAIR_ROUND_SPIRAL",
                        "Rundspirale",
                        STAIR_CREATE_CIRCULAR_TOOL,
                        true)),
        TRANSITION("TRANSITION", "Übergang", TRANSITION_CREATE_TOOL);

        private final String key;
        private final String label;
        private final DungeonEditorTool primaryTool;
        private final List<ToolOptionSpec> optionSpecs;

        ToolFamily(String key, String label, DungeonEditorTool primaryTool, ToolOptionSpec... optionSpecs) {
            this.key = key;
            this.label = label;
            this.primaryTool = primaryTool;
            this.optionSpecs = List.copyOf(List.of(optionSpecs));
        }

        private DungeonEditorControlsPanelModel.ToolFamilyButton toButton(
                Map<ToolFamily, String> selectedFamilyOptionKeys
        ) {
            return new DungeonEditorControlsPanelModel.ToolFamilyButton(
                    key,
                    label,
                    selectedOptionKey(selectedFamilyOptionKeys),
                    toolOptions());
        }

        private String selectedOptionKey(Map<ToolFamily, String> selectedFamilyOptionKeys) {
            String rememberedKey = selectedFamilyOptionKeys.get(this);
            return containsOptionKey(rememberedKey) ? rememberedKey : toolOptions().getFirst().key();
        }

        private boolean containsTool(@Nullable DungeonEditorTool tool) {
            if (primaryTool == tool) {
                return true;
            }
            for (DungeonEditorControlsPanelModel.ToolButton option : toolOptions()) {
                if (option.tool() == tool) {
                    return true;
                }
            }
            return false;
        }

        private boolean containsOptionKey(@Nullable String optionKey) {
            if (optionKey == null || optionKey.isBlank()) {
                return false;
            }
            for (DungeonEditorControlsPanelModel.ToolButton option : toolOptions()) {
                if (option.enabled() && option.key().equals(optionKey)) {
                    return true;
                }
            }
            return false;
        }

        private List<DungeonEditorControlsPanelModel.ToolButton> toolOptions() {
            if (optionSpecs.isEmpty()) {
                return List.of(toToolButton(primaryTool));
            }
            return optionSpecs.stream()
                    .map(option -> new DungeonEditorControlsPanelModel.ToolButton(
                            option.label(),
                            labelOf(option.tool()),
                            option.key(),
                            option.tool(),
                            option.enabled()))
                    .toList();
        }

        private static DungeonEditorControlsPanelModel.ToolButton toToolButton(DungeonEditorTool tool) {
            String label = labelOf(tool);
            return new DungeonEditorControlsPanelModel.ToolButton(label, label, tool.name(), tool, true);
        }

        private static @Nullable ToolFamily fromKey(@Nullable String familyKey) {
            if (familyKey == null || familyKey.isBlank()) {
                return null;
            }
            for (ToolFamily family : values()) {
                if (family.key.equalsIgnoreCase(familyKey.strip())) {
                    return family;
                }
            }
            return null;
        }

        private static @Nullable ToolFamily fromTool(@Nullable DungeonEditorTool selectedTool) {
            if (selectedTool == null) {
                return null;
            }
            for (ToolFamily family : values()) {
                if (family.containsTool(selectedTool)) {
                    return family;
                }
            }
            return null;
        }
    }

    private record ToolOptionSpec(String key, String label, DungeonEditorTool tool, boolean enabled) {
        ToolOptionSpec {
            key = key == null ? "" : key;
            label = label == null ? "" : label;
            tool = tool == null ? SELECT_TOOL : tool;
        }
    }

    private interface ToolPresentation {

        static String labelOf(@Nullable DungeonEditorTool tool) {
            return DungeonEditorTool.labelFor(tool);
        }

        static String normalizeViewModeKey(@Nullable String viewModeKey) {
            return graphViewLabel().equals(viewModeKey) ? graphViewLabel() : gridViewLabel();
        }
    }
    }

}
