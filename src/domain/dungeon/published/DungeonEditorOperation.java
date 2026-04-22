package src.domain.dungeon.published;

/**
 * Semantic operations accepted by the dungeon mutation pipeline.
 */
public sealed interface DungeonEditorOperation permits
        DungeonEditorOperation.MoveTopologyElement,
        DungeonEditorOperation.MoveRoomAnchor,
        DungeonEditorOperation.PaintRoomRectangle,
        DungeonEditorOperation.DeleteRoomRectangle,
        DungeonEditorOperation.SaveRoomNarration,
        DungeonEditorOperation.ResetDemoLayout {

    record MoveTopologyElement(
            DungeonTopologyElementRef ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorOperation {
        public MoveTopologyElement(DungeonTopologyElementRef ref, int deltaQ, int deltaR) {
            this(ref, deltaQ, deltaR, 0);
        }
    }

    record MoveRoomAnchor(int deltaQ, int deltaR) implements DungeonEditorOperation {
    }

    record PaintRoomRectangle(DungeonCellRef start, DungeonCellRef end) implements DungeonEditorOperation {
    }

    record DeleteRoomRectangle(DungeonCellRef start, DungeonCellRef end) implements DungeonEditorOperation {
    }

    record SaveRoomNarration(
            long roomId,
            String visualDescription,
            java.util.List<DungeonInspectorSnapshot.RoomExitNarration> exits
    ) implements DungeonEditorOperation {
        public SaveRoomNarration {
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? java.util.List.of() : java.util.List.copyOf(exits);
        }
    }

    record ResetDemoLayout() implements DungeonEditorOperation {
    }
}
