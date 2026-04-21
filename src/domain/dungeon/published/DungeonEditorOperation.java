package src.domain.dungeon.published;

/**
 * Semantic operations accepted by the dungeon mutation pipeline.
 */
public sealed interface DungeonEditorOperation permits
        DungeonEditorOperation.MoveTopologyElement,
        DungeonEditorOperation.MoveRoomAnchor,
        DungeonEditorOperation.PaintRoomRectangle,
        DungeonEditorOperation.DeleteRoomRectangle,
        DungeonEditorOperation.ResetDemoLayout {

    record MoveTopologyElement(DungeonTopologyElementRef ref, int deltaQ, int deltaR) implements DungeonEditorOperation {
    }

    record MoveRoomAnchor(int deltaQ, int deltaR) implements DungeonEditorOperation {
    }

    record PaintRoomRectangle(DungeonCellRef start, DungeonCellRef end) implements DungeonEditorOperation {
    }

    record DeleteRoomRectangle(DungeonCellRef start, DungeonCellRef end) implements DungeonEditorOperation {
    }

    record ResetDemoLayout() implements DungeonEditorOperation {
    }
}
