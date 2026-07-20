package features.dungeon.adapter.javafx.editor;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolOptions;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.adapter.javafx.DungeonEditorToolPresentation;
import features.dungeon.adapter.javafx.editor.DungeonEditorControlsInput.OverlayMode;

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
            DungeonEditorToolSelection toolSelection
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
        toolPalette.showSelectedTool(toolSelection);
    }

    List<OverlayModeOption> overlayModeOptions() {
        return projectionOverlay.overlayModeOptions();
    }

    ToolControls toolControls() {
        return toolPalette.toolControls();
    }

    void rememberToolSelection(DungeonEditorToolSelection selection) {
        toolPalette.rememberToolSelection(selection);
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
            OverlayMode mode,
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

    private static OverlayMode defaultOverlayMode() {
        return OverlayMode.OFF;
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

    record ToolProjection(DungeonEditorToolSelection selection, ToolControls toolControls) {
        ToolProjection {
            selection = selection == null ? DungeonEditorToolSelection.select() : selection;
            toolControls = toolControls == null
                    ? ToolPalettePanel.defaultToolControls()
                    : toolControls;
        }

        static ToolProjection initial() {
            return new ToolProjection(
                    DungeonEditorToolSelection.select(),
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
            DungeonEditorToolFamily family,
            String label,
            DungeonEditorToolSelection selectedOption,
            List<ToolButton> options
    ) {
        ToolFamilyButton {
            family = family == null ? DungeonEditorToolFamily.SELECT : family;
            label = label == null ? "" : label;
            selectedOption = selectedOption == null ? DungeonEditorToolSelection.family(family) : selectedOption;
            options = options == null ? List.of() : List.copyOf(options);
        }

        ToolButton selectedButton() {
            for (ToolButton option : options) {
                if (option.selection().equals(selectedOption)) {
                    return option;
                }
            }
            return options.isEmpty() ? new ToolButton(label, label, selectedOption, true) : options.getFirst();
        }

        boolean hasSecondaryOptions() {
            return options.size() > 1;
        }

        boolean selectedBy(DungeonEditorToolSelection selection) {
            return selection != null && family == selection.family();
        }
    }

    record ToolButton(
            String label,
            String selectedLabel,
            DungeonEditorToolSelection selection,
            boolean enabled
    ) {
        ToolButton {
            label = label == null ? "" : label;
            selectedLabel = selectedLabel == null ? "" : selectedLabel;
            selection = selection == null ? DungeonEditorToolSelection.select() : selection;
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

    static String labelOf(DungeonEditorToolSelection selection) {
        return ToolPalettePanel.labelOf(selection);
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
                        OverlayMode.OFF,
                        "Aus",
                        false,
                        false),
                new DungeonEditorControlsPanelModel.OverlayModeOption(
                        OverlayMode.NEARBY,
                        "Nahe Ebenen",
                        true,
                        false),
                new DungeonEditorControlsPanelModel.OverlayModeOption(
                        OverlayMode.SELECTED,
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

    private static final class ToolPalettePanel {
        private static final String GRID_VIEW_LABEL = "Grid";
        private static final String GRAPH_VIEW_LABEL = "Graph";

        private final ReadOnlyObjectWrapper<DungeonEditorControlsPanelModel.ToolProjection> toolProjection =
                new ReadOnlyObjectWrapper<>(DungeonEditorControlsPanelModel.ToolProjection.initial());
        private final Map<DungeonEditorToolFamily, DungeonEditorToolOptions> selectedFamilyOptions =
                new EnumMap<>(DungeonEditorToolFamily.class);

        ReadOnlyObjectProperty<DungeonEditorControlsPanelModel.ToolProjection> toolProjectionProperty() {
            return toolProjection.getReadOnlyProperty();
        }

        DungeonEditorControlsPanelModel.ToolControls toolControls() {
            return currentToolControls(selectedFamilyOptions);
        }

        void showSelectedTool(DungeonEditorToolSelection selection) {
            DungeonEditorToolSelection safeSelection = selection == null
                    ? DungeonEditorToolSelection.select()
                    : selection;
            if (safeSelection.family() == DungeonEditorToolFamily.SELECT) {
                selectedFamilyOptions.clear();
            } else {
                selectedFamilyOptions.put(safeSelection.family(), safeSelection.options());
            }
            toolProjection.set(new DungeonEditorControlsPanelModel.ToolProjection(safeSelection, toolControls()));
        }

        void rememberToolSelection(DungeonEditorToolSelection selection) {
            if (selection == null || selection.family() == DungeonEditorToolFamily.SELECT) {
                return;
            }
            selectedFamilyOptions.put(selection.family(), selection.options());
            toolProjection.set(new DungeonEditorControlsPanelModel.ToolProjection(
                    toolProjection.get().selection(),
                    toolControls()));
        }

        static DungeonEditorControlsPanelModel.ToolControls defaultToolControls() {
            return currentToolControls(Map.of());
        }

        static String defaultToolLabel() {
            return labelOf(DungeonEditorToolSelection.select());
        }

        static String gridViewLabel() {
            return GRID_VIEW_LABEL;
        }

        static String graphViewLabel() {
            return GRAPH_VIEW_LABEL;
        }

        static String labelOf(DungeonEditorToolSelection selection) {
            return DungeonEditorToolPresentation.label(selection);
        }

        static String normalizeViewModeKey(@Nullable String viewModeKey) {
            return graphViewLabel().equals(viewModeKey) ? graphViewLabel() : gridViewLabel();
        }

        private static DungeonEditorControlsPanelModel.ToolControls currentToolControls(
                Map<DungeonEditorToolFamily, DungeonEditorToolOptions> selectedFamilyOptions
        ) {
            return new DungeonEditorControlsPanelModel.ToolControls(
                    defaultToolLabel(),
                    gridViewLabel(),
                    graphViewLabel(),
                    toolButton(DungeonEditorToolSelection.select()),
                    familyButton(DungeonEditorToolFamily.ROOM, selectedFamilyOptions),
                    familyButton(DungeonEditorToolFamily.WALL, selectedFamilyOptions),
                    familyButton(DungeonEditorToolFamily.DOOR, selectedFamilyOptions),
                    familyButton(DungeonEditorToolFamily.CORRIDOR, selectedFamilyOptions),
                    familyButton(DungeonEditorToolFamily.FEATURE, selectedFamilyOptions),
                    familyButton(DungeonEditorToolFamily.STAIR, selectedFamilyOptions),
                    familyButton(DungeonEditorToolFamily.TRANSITION, selectedFamilyOptions));
        }

        private static DungeonEditorControlsPanelModel.ToolFamilyButton familyButton(
                DungeonEditorToolFamily family,
                Map<DungeonEditorToolFamily, DungeonEditorToolOptions> selectedFamilyOptions
        ) {
            List<DungeonEditorToolSelection> selections = selections(family);
            DungeonEditorToolSelection selected = new DungeonEditorToolSelection(
                    family,
                    selectedFamilyOptions.get(family));
            if (!selections.contains(selected)) {
                selected = selections.getFirst();
            }
            return new DungeonEditorControlsPanelModel.ToolFamilyButton(
                    family,
                    DungeonEditorToolPresentation.familyLabel(family),
                    selected,
                    selections.stream().map(ToolPalettePanel::toolButton).toList());
        }

        private static DungeonEditorControlsPanelModel.ToolButton toolButton(
                DungeonEditorToolSelection selection
        ) {
            return new DungeonEditorControlsPanelModel.ToolButton(
                    DungeonEditorToolPresentation.optionLabel(selection),
                    labelOf(selection),
                    selection,
                    true);
        }

        private static List<DungeonEditorToolSelection> selections(DungeonEditorToolFamily family) {
            return switch (family) {
                case WALL -> List.of(
                        new DungeonEditorToolSelection(family, new DungeonEditorToolOptions.Wall(
                                DungeonEditorToolOptions.Wall.Mode.PATH)),
                        new DungeonEditorToolSelection(family, new DungeonEditorToolOptions.Wall(
                                DungeonEditorToolOptions.Wall.Mode.SINGLE)));
                case STAIR -> List.of(
                        new DungeonEditorToolSelection(family, new DungeonEditorToolOptions.Stair(
                                DungeonEditorToolOptions.Stair.Shape.STRAIGHT)),
                        new DungeonEditorToolSelection(family, new DungeonEditorToolOptions.Stair(
                                DungeonEditorToolOptions.Stair.Shape.SQUARE)),
                        new DungeonEditorToolSelection(family, new DungeonEditorToolOptions.Stair(
                                DungeonEditorToolOptions.Stair.Shape.CIRCULAR)));
                case FEATURE -> List.of(
                        new DungeonEditorToolSelection(family, new DungeonEditorToolOptions.Feature(
                                DungeonEditorToolOptions.Feature.Kind.POINT_OF_INTEREST)),
                        new DungeonEditorToolSelection(family, new DungeonEditorToolOptions.Feature(
                                DungeonEditorToolOptions.Feature.Kind.OBJECT)),
                        new DungeonEditorToolSelection(family, new DungeonEditorToolOptions.Feature(
                                DungeonEditorToolOptions.Feature.Kind.ENCOUNTER)));
                default -> List.of(DungeonEditorToolSelection.family(family));
            };
        }
    }

}
