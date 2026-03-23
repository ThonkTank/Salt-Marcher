package features.world.dungeonmap.shell.editor.controls;

import features.world.dungeonmap.shell.editor.DungeonEditorTool;

enum ToolFamily {
    ROOM(DungeonEditorTool.ROOM_PAINT, DungeonEditorTool.ROOM_DELETE),
    WALL(DungeonEditorTool.CLUSTER_WALL, DungeonEditorTool.CLUSTER_WALL_DELETE),
    DOOR(DungeonEditorTool.CLUSTER_DOOR, DungeonEditorTool.CLUSTER_DOOR_DELETE),
    CORRIDOR(DungeonEditorTool.CORRIDOR_CREATE, DungeonEditorTool.CORRIDOR_DELETE),
    STAIR(DungeonEditorTool.STAIR_CREATE, DungeonEditorTool.STAIR_DELETE),
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
            case WALL -> "Wand";
            case DOOR -> "Tür";
            case CORRIDOR -> "Korridor";
            case STAIR -> "Treppe";
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
            case CLUSTER_WALL, CLUSTER_WALL_DELETE -> WALL;
            case CLUSTER_DOOR, CLUSTER_DOOR_DELETE -> DOOR;
            case CORRIDOR_CREATE, CORRIDOR_DELETE -> CORRIDOR;
            case STAIR_CREATE, STAIR_DELETE -> STAIR;
            case TRANSITION_CREATE, TRANSITION_DELETE -> TRANSITION;
        };
    }
}
