package src.view.leftbartabs.dungeoneditor;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;

final class DungeonEditorToolPaletteContentPartModel {
    private static final String SELECT_TOOL = "SELECT";
    private static final String ROOM_PAINT_TOOL = "ROOM_PAINT";
    private static final String WALL_CREATE_TOOL = "WALL_CREATE";
    private static final String DOOR_CREATE_TOOL = "DOOR_CREATE";
    private static final String CORRIDOR_CREATE_TOOL = "CORRIDOR_CREATE";
    private static final String STAIR_CREATE_TOOL = "STAIR_CREATE";
    private static final String STAIR_CREATE_SQUARE_TOOL = "STAIR_CREATE_SQUARE";
    private static final String STAIR_CREATE_CIRCULAR_TOOL = "STAIR_CREATE_CIRCULAR";
    private static final String TRANSITION_CREATE_TOOL = "TRANSITION_CREATE";
    private static final String FEATURE_POI_CREATE_TOOL = "FEATURE_POI_CREATE";
    private static final String FEATURE_OBJECT_CREATE_TOOL = "FEATURE_OBJECT_CREATE";
    private static final String FEATURE_ENCOUNTER_CREATE_TOOL = "FEATURE_ENCOUNTER_CREATE";
    private static final String WALL_PATH_MODE_OPTION_KEY = "WALL_PATH";
    private static final String WALL_SINGLE_CLICK_MODE_OPTION_KEY = "WALL_SINGLE_CLICK";
    private static final String GRID_VIEW_LABEL = "Grid";
    private static final String GRAPH_VIEW_LABEL = "Graph";

    private static final Map<String, String> TOOL_LABELS = Map.ofEntries(
            Map.entry(SELECT_TOOL, "Auswahl"),
            Map.entry(ROOM_PAINT_TOOL, "Raum malen"),
            Map.entry(WALL_CREATE_TOOL, "Wand setzen"),
            Map.entry(DOOR_CREATE_TOOL, "Tür setzen"),
            Map.entry(CORRIDOR_CREATE_TOOL, "Korridor erstellen"),
            Map.entry(STAIR_CREATE_TOOL, "Treppe erstellen"),
            Map.entry(STAIR_CREATE_SQUARE_TOOL, "Treppe erstellen"),
            Map.entry(STAIR_CREATE_CIRCULAR_TOOL, "Treppe erstellen"),
            Map.entry(TRANSITION_CREATE_TOOL, "Übergang erstellen"),
            Map.entry(FEATURE_POI_CREATE_TOOL, "POI erstellen"),
            Map.entry(FEATURE_OBJECT_CREATE_TOOL, "Objekt erstellen"),
            Map.entry(FEATURE_ENCOUNTER_CREATE_TOOL, "Encounter erstellen"));

    private final ReadOnlyObjectWrapper<DungeonEditorControlsContentModel.ToolProjection> toolProjection =
            new ReadOnlyObjectWrapper<>(DungeonEditorControlsContentModel.ToolProjection.initial());
    private final Map<ToolFamily, String> selectedFamilyOptionKeys = new EnumMap<>(ToolFamily.class);

    ReadOnlyObjectProperty<DungeonEditorControlsContentModel.ToolProjection> toolProjectionProperty() {
        return toolProjection.getReadOnlyProperty();
    }

    DungeonEditorControlsContentModel.ToolControls toolControls() {
        return currentToolControls(selectedFamilyOptionKeys);
    }

    void showSelectedTool(String selectedTool) {
        if (defaultToolLabel().equals(selectedTool)) {
            selectedFamilyOptionKeys.clear();
        }
        toolProjection.set(new DungeonEditorControlsContentModel.ToolProjection(selectedTool, toolControls()));
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
            toolProjection.set(new DungeonEditorControlsContentModel.ToolProjection(
                    toolProjection.get().selectedTool(),
                    toolControls()));
        }
    }

    boolean wallSingleClickModeSelected() {
        return wallSingleClickModeOptionKey().equals(selectedFamilyOptionKeys.get(ToolFamily.WALL));
    }

    static DungeonEditorControlsContentModel.ToolControls defaultToolControls() {
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

    static String labelOf(@Nullable String tool) {
        return ToolPresentation.labelOf(tool);
    }

    static String normalizeViewModeKey(@Nullable String viewModeKey) {
        return ToolPresentation.normalizeViewModeKey(viewModeKey);
    }

    static String normalizedToolKey(@Nullable String selectedToolKey) {
        return ToolPresentation.toPublishedToolKey(selectedToolKey);
    }

    private static DungeonEditorControlsContentModel.ToolControls currentToolControls(
            Map<ToolFamily, String> selectedFamilyOptionKeys
    ) {
        return new DungeonEditorControlsContentModel.ToolControls(
                defaultToolLabel(),
                gridViewLabel(),
                graphViewLabel(),
                new DungeonEditorControlsContentModel.ToolButton(defaultToolLabel(), defaultToolLabel(), SELECT_TOOL),
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
        private final String primaryTool;
        private final List<ToolOptionSpec> optionSpecs;

        ToolFamily(String key, String label, String primaryTool, ToolOptionSpec... optionSpecs) {
            this.key = key;
            this.label = label;
            this.primaryTool = primaryTool;
            this.optionSpecs = List.copyOf(List.of(optionSpecs));
        }

        private DungeonEditorControlsContentModel.ToolFamilyButton toButton(
                Map<ToolFamily, String> selectedFamilyOptionKeys
        ) {
            return new DungeonEditorControlsContentModel.ToolFamilyButton(
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
            if (primaryTool.equals(toolKey)) {
                return true;
            }
            for (DungeonEditorControlsContentModel.ToolButton option : toolOptions()) {
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
            for (DungeonEditorControlsContentModel.ToolButton option : toolOptions()) {
                if (option.enabled() && option.key().equals(optionKey)) {
                    return true;
                }
            }
            return false;
        }

        private List<DungeonEditorControlsContentModel.ToolButton> toolOptions() {
            if (optionSpecs.isEmpty()) {
                return List.of(toToolButton(primaryTool));
            }
            return optionSpecs.stream()
                    .map(option -> new DungeonEditorControlsContentModel.ToolButton(
                            option.label(),
                            labelOf(option.toolKey()),
                            option.key(),
                            option.toolKey(),
                            option.enabled()))
                    .toList();
        }

        private static DungeonEditorControlsContentModel.ToolButton toToolButton(String tool) {
            String label = labelOf(tool);
            return new DungeonEditorControlsContentModel.ToolButton(label, label, tool);
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
        ToolOptionSpec {
            key = key == null ? "" : key;
            label = label == null ? "" : label;
            toolKey = toolKey == null ? "" : toolKey;
        }
    }

    private interface ToolPresentation {

        static String labelOf(@Nullable String tool) {
            return TOOL_LABELS.get(toPublishedToolKey(tool));
        }

        static String normalizeViewModeKey(@Nullable String viewModeKey) {
            return graphViewLabel().equals(viewModeKey) ? graphViewLabel() : gridViewLabel();
        }

        static String toPublishedToolKey(@Nullable String selectedToolKey) {
            String safeToolKey = selectedToolKey == null ? "" : selectedToolKey.trim();
            return TOOL_LABELS.containsKey(safeToolKey) ? safeToolKey : SELECT_TOOL;
        }
    }
}
