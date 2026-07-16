package features.dungeon.application.editor;

public interface DungeonEditorTransitionStairOperations {
    void saveRoomNarration(RoomNarration narration);

    void saveLabelName(DungeonEditorRuntimeLabelTarget target, String name);

    void saveTransitionLink(long sourceTransitionId, TransitionDestinationDraftInput input);

    void saveTransitionDescription(long transitionId, String description);

    void saveStairGeometry(StairGeometryDraftInput input);
}
