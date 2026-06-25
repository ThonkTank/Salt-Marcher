package src.features.dungeon.runtime;

public interface DungeonEditorTransitionStairOperations {
    void saveRoomNarration(RoomNarration narration);

    void saveLabelName(DungeonEditorRuntimeLabelTarget target, String name);

    void saveTransitionLink(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional);

    void saveTransitionDescription(long transitionId, String description);

    void saveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2);
}
