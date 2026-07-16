package features.dungeon.application.editor.session;

final class DungeonEditorSessionWorkflowState {
    private DungeonEditorSession current = DungeonEditorSession.empty();

    DungeonEditorSession current() {
        return current;
    }

    void replace(DungeonEditorSession session) {
        current = session;
    }
}
