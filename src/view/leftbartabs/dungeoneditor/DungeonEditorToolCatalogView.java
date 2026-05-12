package src.view.leftbartabs.dungeoneditor;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContributionModel.ToolFamily;

final class ToolCatalog {

    static final String DEFAULT_TOOL_LABEL = "Auswahl";
    static final String GRID_VIEW_LABEL = "Grid";
    static final String GRAPH_VIEW_LABEL = "Graph";
    static final String ROOM_PAINT_LABEL = "Raum malen";
    static final String ROOM_DELETE_LABEL = "Raum löschen";
    private static final Map<DungeonEditorTool, String> TOOL_LABELS = createToolLabels();
    private static final Map<String, DungeonEditorSessionValues.Tool> SESSION_TOOLS_BY_LABEL =
            createSessionToolsByLabel();
    private static final Map<ToolFamily, ToolPalette> PALETTES = createPalettes();

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

    static DungeonEditorSessionValues.ViewMode toSessionViewMode(@Nullable String viewModeKey) {
        return GRAPH_VIEW_LABEL.equals(viewModeKey)
                ? DungeonEditorSessionValues.ViewMode.GRAPH
                : DungeonEditorSessionValues.ViewMode.GRID;
    }

    static DungeonEditorSessionValues.Tool toSessionTool(@Nullable String selectedToolLabel) {
        return SESSION_TOOLS_BY_LABEL.getOrDefault(selectedToolLabel, DungeonEditorSessionValues.Tool.SELECT);
    }

    static ToolPalette paletteFor(@Nullable ToolFamily family) {
        return family == null ? ToolPalette.empty() : PALETTES.getOrDefault(family, ToolPalette.empty());
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

    private static Map<String, DungeonEditorSessionValues.Tool> createSessionToolsByLabel() {
        Map<String, DungeonEditorSessionValues.Tool> toolsByLabel = new HashMap<>();
        toolsByLabel.put(DEFAULT_TOOL_LABEL, DungeonEditorSessionValues.Tool.SELECT);
        toolsByLabel.put(ROOM_PAINT_LABEL, DungeonEditorSessionValues.Tool.ROOM_PAINT);
        toolsByLabel.put(ROOM_DELETE_LABEL, DungeonEditorSessionValues.Tool.ROOM_DELETE);
        toolsByLabel.put("Wand setzen", DungeonEditorSessionValues.Tool.WALL_CREATE);
        toolsByLabel.put("Wand löschen", DungeonEditorSessionValues.Tool.WALL_DELETE);
        toolsByLabel.put("Tür setzen", DungeonEditorSessionValues.Tool.DOOR_CREATE);
        toolsByLabel.put("Tür löschen", DungeonEditorSessionValues.Tool.DOOR_DELETE);
        toolsByLabel.put("Korridor erstellen", DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
        toolsByLabel.put("Korridor löschen", DungeonEditorSessionValues.Tool.CORRIDOR_DELETE);
        toolsByLabel.put("Treppe erstellen", DungeonEditorSessionValues.Tool.STAIR_CREATE);
        toolsByLabel.put("Treppe löschen", DungeonEditorSessionValues.Tool.STAIR_DELETE);
        toolsByLabel.put("Übergang erstellen", DungeonEditorSessionValues.Tool.TRANSITION_CREATE);
        toolsByLabel.put("Übergang löschen", DungeonEditorSessionValues.Tool.TRANSITION_DELETE);
        return Map.copyOf(toolsByLabel);
    }

    private static Map<ToolFamily, ToolPalette> createPalettes() {
        Map<ToolFamily, ToolPalette> palettes = new EnumMap<>(ToolFamily.class);
        palettes.put(ToolFamily.ROOM, new ToolPalette(ROOM_PAINT_LABEL, ROOM_DELETE_LABEL));
        palettes.put(ToolFamily.WALL, new ToolPalette("Wand setzen", "Wand löschen"));
        palettes.put(ToolFamily.DOOR, new ToolPalette("Tür setzen", "Tür löschen"));
        palettes.put(ToolFamily.CORRIDOR, new ToolPalette("Korridor erstellen", "Korridor löschen"));
        palettes.put(ToolFamily.STAIR, new ToolPalette("Treppe erstellen", "Treppe löschen"));
        palettes.put(ToolFamily.TRANSITION, new ToolPalette("Übergang erstellen", "Übergang löschen"));
        return Map.copyOf(palettes);
    }
}

record ToolPalette(
        String primaryToolLabel,
        String secondaryToolLabel
) {
    ToolPalette {
        primaryToolLabel = primaryToolLabel == null ? "" : primaryToolLabel;
        secondaryToolLabel = secondaryToolLabel == null ? "" : secondaryToolLabel;
    }

    static ToolPalette empty() {
        return new ToolPalette("", "");
    }

    boolean available() {
        return !primaryToolLabel.isBlank() && !secondaryToolLabel.isBlank();
    }
}
