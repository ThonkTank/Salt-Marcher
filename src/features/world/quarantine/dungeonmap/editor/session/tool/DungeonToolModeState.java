package features.world.quarantine.dungeonmap.editor.session.tool;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;

public final class DungeonToolModeState {

    private DungeonEditorTool selectedTool = DungeonEditorTool.SELECT;
    private DungeonEditorTool rememberedRoomTool = DungeonEditorTool.ROOM_PAINT;
    private DungeonEditorTool rememberedWallTool = DungeonEditorTool.CLUSTER_WALL;
    private DungeonEditorTool rememberedDoorTool = DungeonEditorTool.CLUSTER_DOOR;
    private DungeonEditorTool rememberedCorridorTool = DungeonEditorTool.CORRIDOR_CREATE;
    private boolean deleteOverrideActive;

    public DungeonEditorTool selectedTool() {
        return selectedTool;
    }

    public DungeonEditorTool activeTool() {
        if (!deleteOverrideActive) {
            return selectedTool;
        }
        return selectedTool.deleteVariant();
    }

    public boolean deleteOverrideActive() {
        return deleteOverrideActive;
    }

    public void selectPersistentTool(DungeonEditorTool tool) {
        selectedTool = normalize(tool);
        deleteOverrideActive = false;
        remember(selectedTool);
    }

    public void showDeleteOverride() {
        deleteOverrideActive = true;
    }

    public void clearDeleteOverride() {
        deleteOverrideActive = false;
    }

    public DungeonEditorTool switchPersistentMode(boolean deleteMode) {
        DungeonEditorTool nextTool = deleteMode ? selectedTool.deleteVariant() : selectedTool.editVariant();
        if (nextTool == selectedTool) {
            return null;
        }
        selectPersistentTool(nextTool);
        return nextTool;
    }

    public DungeonEditorTool preferredToolFor(DungeonEditorTool toolFamilyMember) {
        DungeonEditorTool normalized = normalize(toolFamilyMember);
        if (normalized.isRoomTool()) {
            return rememberedRoomTool;
        }
        if (normalized.isWallTool()) {
            return rememberedWallTool;
        }
        if (normalized.isDoorTool()) {
            return rememberedDoorTool;
        }
        if (normalized.isCorridorTool()) {
            return rememberedCorridorTool;
        }
        return normalized;
    }

    private void remember(DungeonEditorTool tool) {
        if (tool == null) {
            return;
        }
        if (tool.isRoomTool()) {
            rememberedRoomTool = tool;
        } else if (tool.isWallTool()) {
            rememberedWallTool = tool;
        } else if (tool.isDoorTool()) {
            rememberedDoorTool = tool;
        } else if (tool.isCorridorTool()) {
            rememberedCorridorTool = tool;
        }
    }

    private static DungeonEditorTool normalize(DungeonEditorTool tool) {
        return tool == null ? DungeonEditorTool.SELECT : tool;
    }
}
