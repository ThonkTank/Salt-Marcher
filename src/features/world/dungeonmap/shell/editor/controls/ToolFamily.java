package features.world.dungeonmap.shell.editor.controls;

import features.world.dungeonmap.shell.editor.DungeonEditorTool;

enum ToolFamily {
    ROOM("Raum", DungeonEditorTool.ROOM),
    WALL("Wand", DungeonEditorTool.WALL),
    DOOR("Tür", DungeonEditorTool.DOOR),
    CORRIDOR("Korridor", DungeonEditorTool.CORRIDOR);

    private final String label;
    private final DungeonEditorTool tool;

    ToolFamily(String label, DungeonEditorTool tool) {
        this.label = label;
        this.tool = tool;
    }

    String label() {
        return label;
    }

    DungeonEditorTool tool() {
        return tool;
    }
}
