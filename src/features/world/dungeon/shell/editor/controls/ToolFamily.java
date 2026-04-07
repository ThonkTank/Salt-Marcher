package features.world.dungeon.shell.editor.controls;

import features.world.dungeon.state.DungeonEditorTool;

import java.util.List;

enum ToolFamily {
    ROOM(List.of(DungeonEditorTool.ROOM_PAINT, DungeonEditorTool.ROOM_DELETE)),
    FLOOR(List.of(DungeonEditorTool.FLOOR_PAINT, DungeonEditorTool.FLOOR_DELETE)),
    WALL(List.of(DungeonEditorTool.CLUSTER_WALL, DungeonEditorTool.CLUSTER_WALL_DELETE)),
    CONNECTIONS(List.of(DungeonEditorTool.DOOR, DungeonEditorTool.CORRIDOR, DungeonEditorTool.STAIR)),
    TRANSITION(List.of(DungeonEditorTool.TRANSITION_CREATE, DungeonEditorTool.TRANSITION_DELETE));

    private final List<DungeonEditorTool> tools;

    ToolFamily(List<DungeonEditorTool> tools) {
        this.tools = List.copyOf(tools);
        if (this.tools.isEmpty()) {
            throw new IllegalArgumentException("tool family requires at least one tool");
        }
    }

    String label() {
        return switch (this) {
            case ROOM -> "Raum";
            case FLOOR -> "Boden";
            case WALL -> "Wand";
            case CONNECTIONS -> "Connections";
            case TRANSITION -> "Übergang";
        };
    }

    DungeonEditorTool defaultTool() {
        return tools.getFirst();
    }

    List<DungeonEditorTool> tools() {
        return tools;
    }

    boolean contains(DungeonEditorTool tool) {
        return tool != null && tools.contains(tool);
    }

    static ToolFamily forTool(DungeonEditorTool tool) {
        if (tool == null) {
            return null;
        }
        return switch (tool) {
            case SELECT -> null;
            case ROOM_PAINT, ROOM_DELETE -> ROOM;
            case FLOOR_PAINT, FLOOR_DELETE -> FLOOR;
            case CLUSTER_WALL, CLUSTER_WALL_DELETE -> WALL;
            case DOOR, CORRIDOR, STAIR -> CONNECTIONS;
            case TRANSITION_CREATE, TRANSITION_DELETE -> TRANSITION;
        };
    }
}
