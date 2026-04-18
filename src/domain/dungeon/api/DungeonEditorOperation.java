package src.domain.dungeon.api;

/**
 * Semantic operations accepted by the dungeon mutation pipeline.
 */
public sealed interface DungeonEditorOperation permits
        DungeonEditorOperation.MoveRoomAnchor,
        DungeonEditorOperation.ResetDemoLayout {

    record MoveRoomAnchor(int deltaQ, int deltaR) implements DungeonEditorOperation {
    }

    record ResetDemoLayout() implements DungeonEditorOperation {
    }
}
