package src.view.leftbartabs.dungeoneditor;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;

final class DungeonEditorToolCatalog {

    static final String DEFAULT_TOOL_LABEL = "Auswahl";
    static final String GRID_VIEW_LABEL = "Grid";
    static final String GRAPH_VIEW_LABEL = "Graph";

    private static final Map<DungeonEditorTool, String> TOOL_LABELS = createToolLabels();
    private static final Map<String, DungeonEditorPublishedEvent.Tool> PUBLISHED_TOOLS_BY_LABEL =
            createPublishedToolsByLabel();
    private static final Map<DungeonEditorToolFamily, DungeonEditorToolPalette> PALETTES = createPalettes();

    private DungeonEditorToolCatalog() {
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

    static DungeonEditorPublishedEvent.ViewMode toPublishedViewMode(@Nullable String viewModeKey) {
        return GRAPH_VIEW_LABEL.equals(viewModeKey)
                ? DungeonEditorPublishedEvent.ViewMode.GRAPH
                : DungeonEditorPublishedEvent.ViewMode.GRID;
    }

    static DungeonEditorPublishedEvent.Tool toPublishedTool(@Nullable String selectedToolLabel) {
        return PUBLISHED_TOOLS_BY_LABEL.getOrDefault(selectedToolLabel, DungeonEditorPublishedEvent.Tool.SELECT);
    }

    static DungeonEditorToolPalette paletteFor(@Nullable DungeonEditorToolFamily family) {
        return family == null ? DungeonEditorToolPalette.empty() : PALETTES.getOrDefault(family, DungeonEditorToolPalette.empty());
    }

    private static Map<DungeonEditorTool, String> createToolLabels() {
        Map<DungeonEditorTool, String> toolLabels = new EnumMap<>(DungeonEditorTool.class);
        toolLabels.put(DungeonEditorTool.SELECT, DEFAULT_TOOL_LABEL);
        toolLabels.put(DungeonEditorTool.ROOM_PAINT, "Raum malen");
        toolLabels.put(DungeonEditorTool.ROOM_DELETE, "Raum löschen");
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

    private static Map<String, DungeonEditorPublishedEvent.Tool> createPublishedToolsByLabel() {
        Map<String, DungeonEditorPublishedEvent.Tool> toolsByLabel = new HashMap<>();
        toolsByLabel.put(DEFAULT_TOOL_LABEL, DungeonEditorPublishedEvent.Tool.SELECT);
        toolsByLabel.put("Raum malen", DungeonEditorPublishedEvent.Tool.ROOM_PAINT);
        toolsByLabel.put("Raum löschen", DungeonEditorPublishedEvent.Tool.ROOM_DELETE);
        toolsByLabel.put("Wand setzen", DungeonEditorPublishedEvent.Tool.WALL_CREATE);
        toolsByLabel.put("Wand löschen", DungeonEditorPublishedEvent.Tool.WALL_DELETE);
        toolsByLabel.put("Tür setzen", DungeonEditorPublishedEvent.Tool.DOOR_CREATE);
        toolsByLabel.put("Tür löschen", DungeonEditorPublishedEvent.Tool.DOOR_DELETE);
        toolsByLabel.put("Korridor erstellen", DungeonEditorPublishedEvent.Tool.CORRIDOR_CREATE);
        toolsByLabel.put("Korridor löschen", DungeonEditorPublishedEvent.Tool.CORRIDOR_DELETE);
        toolsByLabel.put("Treppe erstellen", DungeonEditorPublishedEvent.Tool.STAIR_CREATE);
        toolsByLabel.put("Treppe löschen", DungeonEditorPublishedEvent.Tool.STAIR_DELETE);
        toolsByLabel.put("Übergang erstellen", DungeonEditorPublishedEvent.Tool.TRANSITION_CREATE);
        toolsByLabel.put("Übergang löschen", DungeonEditorPublishedEvent.Tool.TRANSITION_DELETE);
        return Map.copyOf(toolsByLabel);
    }

    private static Map<DungeonEditorToolFamily, DungeonEditorToolPalette> createPalettes() {
        Map<DungeonEditorToolFamily, DungeonEditorToolPalette> palettes = new EnumMap<>(DungeonEditorToolFamily.class);
        palettes.put(DungeonEditorToolFamily.ROOM, new DungeonEditorToolPalette("Raum malen", "Raum löschen"));
        palettes.put(DungeonEditorToolFamily.WALL, new DungeonEditorToolPalette("Wand setzen", "Wand löschen"));
        palettes.put(DungeonEditorToolFamily.DOOR, new DungeonEditorToolPalette("Tür setzen", "Tür löschen"));
        palettes.put(DungeonEditorToolFamily.CORRIDOR, new DungeonEditorToolPalette("Korridor erstellen", "Korridor löschen"));
        palettes.put(DungeonEditorToolFamily.STAIR, new DungeonEditorToolPalette("Treppe erstellen", "Treppe löschen"));
        palettes.put(DungeonEditorToolFamily.TRANSITION, new DungeonEditorToolPalette("Übergang erstellen", "Übergang löschen"));
        return Map.copyOf(palettes);
    }
}

record DungeonEditorToolPalette(
        String primaryToolLabel,
        String secondaryToolLabel
) {
    DungeonEditorToolPalette {
        primaryToolLabel = primaryToolLabel == null ? "" : primaryToolLabel;
        secondaryToolLabel = secondaryToolLabel == null ? "" : secondaryToolLabel;
    }

    static DungeonEditorToolPalette empty() {
        return new DungeonEditorToolPalette("", "");
    }

    boolean available() {
        return !primaryToolLabel.isBlank() && !secondaryToolLabel.isBlank();
    }
}
