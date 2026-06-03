package src.domain.dungeon.model.worldspace.session.model;

final class DungeonEditorSessionWorkflowState {
    private DungeonEditorSession current = DungeonEditorSession.empty();

    DungeonEditorSession current() {
        return current;
    }

    void replace(DungeonEditorSession session) {
        current = session;
    }
}
