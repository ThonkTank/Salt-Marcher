package features.world.quarantine.dungeonmap.editor.shell.controls;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;

enum ToolFamily {
    ROOM(DungeonEditorTool.ROOM_PAINT, DungeonEditorTool.ROOM_DELETE),
    WALL(DungeonEditorTool.CLUSTER_WALL, DungeonEditorTool.CLUSTER_WALL_DELETE),
    DOOR(DungeonEditorTool.CLUSTER_DOOR, DungeonEditorTool.CLUSTER_DOOR_DELETE),
    CORRIDOR(DungeonEditorTool.CORRIDOR_CREATE, DungeonEditorTool.CORRIDOR_DELETE);

    private final DungeonEditorTool primaryTool;
    private final DungeonEditorTool secondaryTool;

    ToolFamily(DungeonEditorTool primaryTool, DungeonEditorTool secondaryTool) {
        this.primaryTool = primaryTool;
        this.secondaryTool = secondaryTool;
    }

    DungeonEditorTool primaryTool() {
        return primaryTool;
    }

    DungeonEditorTool secondaryTool() {
        return secondaryTool;
    }

    static ToolFamily forTool(DungeonEditorTool tool) {
        if (tool == null || tool == DungeonEditorTool.SELECT) {
            return null;
        }
        if (tool.isCorridorTool()) {
            return CORRIDOR;
        }
        if (tool.isWallTool()) {
            return WALL;
        }
        if (tool.isDoorTool()) {
            return DOOR;
        }
        return ROOM;
    }
}
