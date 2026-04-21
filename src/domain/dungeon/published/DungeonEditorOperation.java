package src.domain.dungeon.published;

/**
 * Semantic operations accepted by the dungeon mutation pipeline.
 */
public sealed interface DungeonEditorOperation permits
        DungeonEditorOperation.MoveRoomCluster,
        DungeonEditorOperation.MoveRoomAnchor,
        DungeonEditorOperation.ResetDemoLayout {

    record MoveRoomCluster(long clusterId, int deltaQ, int deltaR) implements DungeonEditorOperation {
    }

    record MoveRoomAnchor(int deltaQ, int deltaR) implements DungeonEditorOperation {
    }

    record ResetDemoLayout() implements DungeonEditorOperation {
    }
}
