package src.view.leftbartabs.dungeoneditor;

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

    private final ReadOnlyObjectWrapper<MapProjection> mapProjection =
            new ReadOnlyObjectWrapper<>(MapProjection.empty());
    private final ReadOnlyObjectWrapper<MapEditorUiState> mapEditor =
            new ReadOnlyObjectWrapper<>(MapEditorUiState.hidden());
    private final ReadOnlyObjectWrapper<ProjectionState> projection =
            new ReadOnlyObjectWrapper<>(ProjectionState.initial());
    private final ReadOnlyObjectWrapper<ToolProjection> toolProjection =
            new ReadOnlyObjectWrapper<>(ToolProjection.initial());
    private final Map<ToolFamily, String> selectedFamilyOptionKeys = new EnumMap<>(ToolFamily.class);

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
        if (defaultToolLabel().equals(selectedTool)) {
            selectedFamilyOptionKeys.clear();
        }
        toolProjection.set(new ToolProjection(selectedTool, toolControls()));
    }

    List<OverlayModeOption> overlayModeOptions() {
        return List.of(
                new OverlayModeOption(overlayOffMode(), "Aus", false, false),
                new OverlayModeOption(overlayNearbyMode(), "Nahe Ebenen", true, false),
                new OverlayModeOption(overlaySelectedMode(), "Auswahl", false, true));
    }

    ToolControls toolControls() {
        return ToolControls.current(selectedFamilyOptionKeys);
    }

    void rememberToolSelection(String requestedFamilyKey, String selectedToolKey, String selectedOptionKey) {
        ToolFamily requestedFamily = ToolFamily.fromKey(requestedFamilyKey);
        ToolFamily selectedFamily = ToolFamily.fromToolKey(selectedToolKey);
        ToolFamily family = selectedFamily == null ? requestedFamily : selectedFamily;
        String optionKey = selectedOptionKey == null || selectedOptionKey.isBlank()
                ? selectedToolKey
                : selectedOptionKey;
        if (family != null && family.containsOptionKey(optionKey)) {
            selectedFamilyOptionKeys.put(family, optionKey);
            toolProjection.set(new ToolProjection(toolProjection.get().selectedTool(), toolControls()));
        }
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

    record ToolProjection(String selectedTool, ToolControls toolControls) {
        ToolProjection {
            selectedTool = selectedTool == null || selectedTool.isBlank()
                    ? defaultToolLabel()
                    : selectedTool;
            toolControls = toolControls == null ? ToolControls.current(Map.of()) : toolControls;
        }

        static ToolProjection initial() {
            return new ToolProjection(defaultToolLabel(), ToolControls.current(Map.of()));
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
        private static ToolControls current(Map<ToolFamily, String> selectedFamilyOptionKeys) {
            return new ToolControls(
                    defaultToolLabel(),
                    gridViewLabel(),
                    graphViewLabel(),
                    new ToolButton(defaultToolLabel(), defaultToolLabel(), DungeonEditorTool.SELECT.name()),
                    ToolFamily.ROOM.toButton(selectedFamilyOptionKeys),
                    ToolFamily.WALL.toButton(selectedFamilyOptionKeys),
                    ToolFamily.DOOR.toButton(selectedFamilyOptionKeys),
                    ToolFamily.CORRIDOR.toButton(selectedFamilyOptionKeys),
                    ToolFamily.FEATURE.toButton(selectedFamilyOptionKeys),
                    ToolFamily.STAIR.toButton(selectedFamilyOptionKeys),
                    ToolFamily.TRANSITION.toButton(selectedFamilyOptionKeys));
        }
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

    enum ToolFamily {
        ROOM("ROOM", "Raum", DungeonEditorTool.ROOM_PAINT),
        WALL(
                "WALL",
                "Wand",
                DungeonEditorTool.WALL_CREATE,
                new ToolOptionSpec(
                        wallPathModeOptionKey(),
                        "Pfad",
                        DungeonEditorTool.WALL_CREATE,
                        true),
                new ToolOptionSpec(
                        wallSingleClickModeOptionKey(),
                        "Einzeln",
                        DungeonEditorTool.WALL_CREATE,
                        true)),
        DOOR("DOOR", "Tür", DungeonEditorTool.DOOR_CREATE),
        CORRIDOR("CORRIDOR", "Korridor", DungeonEditorTool.CORRIDOR_CREATE),
        FEATURE(
                "FEATURE",
                "Feature",
                DungeonEditorTool.FEATURE_POI_CREATE,
                new ToolOptionSpec(
                        "FEATURE_POI",
                        "POI",
                        DungeonEditorTool.FEATURE_POI_CREATE,
                        true),
                new ToolOptionSpec(
                        "FEATURE_OBJECT",
                        "Objekt",
                        DungeonEditorTool.FEATURE_OBJECT_CREATE,
                        true),
                new ToolOptionSpec(
                        "FEATURE_ENCOUNTER",
                        "Encounter",
                        DungeonEditorTool.FEATURE_ENCOUNTER_CREATE,
                        true)),
        STAIR(
                "STAIR",
                "Treppe",
                DungeonEditorTool.STAIR_CREATE,
                new ToolOptionSpec(
                        "STAIR_STRAIGHT",
                        "Gerade",
                        DungeonEditorTool.STAIR_CREATE,
                        true),
                new ToolOptionSpec(
                        "STAIR_ANGULAR_SPIRAL",
                        "Eckspirale",
                        DungeonEditorTool.STAIR_CREATE_SQUARE,
                        true),
                new ToolOptionSpec(
                        "STAIR_ROUND_SPIRAL",
                        "Rundspirale",
                        DungeonEditorTool.STAIR_CREATE_CIRCULAR,
                        true)),
        TRANSITION("TRANSITION", "Übergang", DungeonEditorTool.TRANSITION_CREATE);

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

        private ToolFamilyButton toButton(Map<ToolFamily, String> selectedFamilyOptionKeys) {
            return new ToolFamilyButton(
                    key,
                    label,
                    selectedOptionKey(selectedFamilyOptionKeys),
                    toolOptions());
        }

        private String selectedOptionKey(Map<ToolFamily, String> selectedFamilyOptionKeys) {
            String rememberedKey = selectedFamilyOptionKeys.get(this);
            return containsOptionKey(rememberedKey) ? rememberedKey : toolOptions().getFirst().key();
        }

        private boolean containsToolKey(@Nullable String toolKey) {
            if (primaryTool.name().equals(toolKey)) {
                return true;
            }
            for (ToolButton option : toolOptions()) {
                if (option.toolKey().equals(toolKey)) {
                    return true;
                }
            }
            return false;
        }

        private boolean containsOptionKey(@Nullable String optionKey) {
            if (optionKey == null || optionKey.isBlank()) {
                return false;
            }
            for (ToolButton option : toolOptions()) {
                if (option.enabled() && option.key().equals(optionKey)) {
                    return true;
                }
            }
            return false;
        }

        private List<ToolButton> toolOptions() {
            if (optionSpecs.isEmpty()) {
                return List.of(toToolButton(primaryTool));
            }
            return optionSpecs.stream()
                    .map(option -> new ToolButton(
                            option.label(),
                            labelOf(DungeonEditorTool.valueOf(option.toolKey())),
                            option.key(),
                            option.toolKey(),
                            option.enabled()))
                    .toList();
        }

        private static ToolButton toToolButton(DungeonEditorTool tool) {
            String label = labelOf(tool);
            return new ToolButton(label, label, tool.name());
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

        private static @Nullable ToolFamily fromToolKey(@Nullable String selectedToolKey) {
            if (selectedToolKey == null || selectedToolKey.isBlank()) {
                return null;
            }
            for (ToolFamily family : values()) {
                if (family.containsToolKey(selectedToolKey.strip())) {
                    return family;
                }
            }
            return null;
        }
    }

    private record ToolOptionSpec(String key, String label, String toolKey, boolean enabled) {
        ToolOptionSpec(String key, String label, DungeonEditorTool tool, boolean enabled) {
            this(key, label, tool == null ? "" : tool.name(), enabled);
        }

        ToolOptionSpec {
            key = key == null ? "" : key;
            label = label == null ? "" : label;
            toolKey = toolKey == null ? "" : toolKey;
        }

    }

    static String defaultToolLabel() {
        return "Auswahl";
    }

    static String gridViewLabel() {
        return "Grid";
    }

    static String graphViewLabel() {
        return "Graph";
    }

    static String wallPathModeOptionKey() {
        return "WALL_PATH";
    }

    static String wallSingleClickModeOptionKey() {
        return "WALL_SINGLE_CLICK";
    }

    boolean wallSingleClickModeSelected() {
        return wallSingleClickModeOptionKey().equals(selectedFamilyOptionKeys.get(ToolFamily.WALL));
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
                case FEATURE_POI_CREATE -> "POI erstellen";
                case FEATURE_OBJECT_CREATE -> "Objekt erstellen";
                case FEATURE_ENCOUNTER_CREATE -> "Encounter erstellen";
                case FEATURE_DELETE -> "Feature löschen";
                default -> "";
            };
        }

        private static String transitionToolLabel(DungeonEditorTool tool) {
            return switch (tool) {
                case STAIR_CREATE, STAIR_CREATE_SQUARE, STAIR_CREATE_CIRCULAR -> "Treppe erstellen";
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
