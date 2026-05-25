package src.domain.dungeon.model.worldspace.model.session.model;

final class DungeonEditorSessionWorkflowState {
    private DungeonEditorSession current = DungeonEditorSession.empty();

    DungeonEditorSession current() {
        return current;
    }

    void replace(DungeonEditorSession session) {
        current = session;
    }
}
