package features.world.dungeonmap.shell.editor.controls;

import features.world.dungeonmap.state.DungeonEditorTool;

enum ToolFamily {
    ROOM(DungeonEditorTool.ROOM_PAINT, DungeonEditorTool.ROOM_DELETE),
    FLOOR(DungeonEditorTool.FLOOR_PAINT, DungeonEditorTool.FLOOR_DELETE),
    WALL(DungeonEditorTool.CLUSTER_WALL, DungeonEditorTool.CLUSTER_WALL_DELETE),
    CONNECTIONS(DungeonEditorTool.CONNECTIONS, DungeonEditorTool.CONNECTIONS_DELETE),
    TRANSITION(DungeonEditorTool.TRANSITION_CREATE, DungeonEditorTool.TRANSITION_DELETE);

    private final DungeonEditorTool primaryTool;
    private final DungeonEditorTool secondaryTool;

    ToolFamily(DungeonEditorTool primaryTool, DungeonEditorTool secondaryTool) {
        this.primaryTool = primaryTool;
        this.secondaryTool = secondaryTool;
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

    DungeonEditorTool primaryTool() {
        return primaryTool;
    }

    DungeonEditorTool secondaryTool() {
        return secondaryTool;
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
            case CONNECTIONS, CONNECTIONS_DELETE -> CONNECTIONS;
            case TRANSITION_CREATE, TRANSITION_DELETE -> TRANSITION;
        };
    }
}
