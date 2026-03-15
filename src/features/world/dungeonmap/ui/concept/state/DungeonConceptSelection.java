package features.world.dungeonmap.ui.concept.state;

import features.world.dungeonmap.model.projection.DungeonConceptCanvasNode;

public record DungeonConceptSelection(
        SelectionType type,
        DungeonConceptCanvasNode node
) {
    public enum SelectionType {
        NONE,
        NODE
    }

    public static DungeonConceptSelection none() {
        return new DungeonConceptSelection(SelectionType.NONE, null);
    }

    public static DungeonConceptSelection node(DungeonConceptCanvasNode node) {
        return new DungeonConceptSelection(SelectionType.NODE, node);
    }
}
