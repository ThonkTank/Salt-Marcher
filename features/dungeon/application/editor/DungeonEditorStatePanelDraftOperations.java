package features.dungeon.application.editor;

public interface DungeonEditorStatePanelDraftOperations {
    void updateStatePanelRoomNarrationDraft(RoomNarrationDraftInput input);

    void updateStatePanelLabelNameDraft(DungeonEditorRuntimeLabelTarget target, String name);

    void updateStatePanelCorridorPointDraft(String q, String r);

    void moveStatePanelCorridorPoint(int q, int r);

    void updateStatePanelTransitionDescriptionDraft(long transitionId, String description);

    void updateStatePanelTransitionDestinationDraft(TransitionDestinationDraftInput input);

    void updateStatePanelStairGeometryDraft(StairGeometryDraftInput input);
}
