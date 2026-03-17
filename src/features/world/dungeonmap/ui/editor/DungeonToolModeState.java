package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.ui.workspace.DungeonEditorTool;

final class DungeonToolModeState {

    private DungeonEditorTool selectedTool = DungeonEditorTool.SELECT;
    private DungeonEditorTool rememberedRoomTool = DungeonEditorTool.ROOM_PAINT;
    private DungeonEditorTool rememberedWallTool = DungeonEditorTool.CLUSTER_WALL;
    private DungeonEditorTool rememberedDoorTool = DungeonEditorTool.CLUSTER_DOOR;
    private DungeonEditorTool rememberedCorridorTool = DungeonEditorTool.CORRIDOR_CREATE;
    private boolean deleteOverrideActive;

    DungeonEditorTool selectedTool() {
        return selectedTool;
    }

    DungeonEditorTool activeTool() {
        if (!deleteOverrideActive) {
            return selectedTool;
        }
        DungeonEditorTool deleteTool = selectedTool.deleteVariant();
        return deleteTool == null ? selectedTool : deleteTool;
    }

    boolean deleteOverrideActive() {
        return deleteOverrideActive;
    }

    void selectPersistentTool(DungeonEditorTool tool) {
        selectedTool = normalize(tool);
        deleteOverrideActive = false;
        remember(selectedTool);
    }

    void showDeleteOverride() {
        deleteOverrideActive = true;
    }

    void clearDeleteOverride() {
        deleteOverrideActive = false;
    }

    DungeonEditorTool switchPersistentMode(boolean deleteMode) {
        DungeonEditorTool nextTool = deleteMode ? selectedTool.deleteVariant() : selectedTool.editVariant();
        if (nextTool == null || nextTool == selectedTool) {
            return null;
        }
        selectPersistentTool(nextTool);
        return nextTool;
    }

    DungeonEditorTool preferredToolFor(DungeonEditorTool toolFamilyMember) {
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
