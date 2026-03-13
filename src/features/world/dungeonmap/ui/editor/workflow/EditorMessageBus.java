package features.world.dungeonmap.ui.editor.workflow;

import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;

final class EditorMessageBus {

    private final DungeonToolSettingsPane toolSettingsPane;

    public EditorMessageBus(DungeonToolSettingsPane toolSettingsPane) {
        this.toolSettingsPane = toolSettingsPane;
    }

    public void showMessage(String title, String message) {
        toolSettingsPane.showWorkflowMessage(title, message);
    }

    public void clearMessage() {
        toolSettingsPane.clearWorkflowMessage();
    }
}
