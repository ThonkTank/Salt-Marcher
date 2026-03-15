package features.world.dungeonmap.ui.concept.state;

import features.world.dungeonmap.model.projection.DungeonConceptCanvasNode;
import features.world.dungeonmap.model.projection.DungeonConceptCanvasEdge;

public record DungeonConceptSelection(
        SelectionType type,
        DungeonConceptCanvasNode node,
        DungeonConceptCanvasEdge edge
) {
    public enum SelectionType {
        NONE,
        NODE,
        EDGE
    }

    public static DungeonConceptSelection none() {
        return new DungeonConceptSelection(SelectionType.NONE, null, null);
    }

    public static DungeonConceptSelection node(DungeonConceptCanvasNode node) {
        return new DungeonConceptSelection(SelectionType.NODE, node, null);
    }

    public static DungeonConceptSelection edge(DungeonConceptCanvasEdge edge) {
        return new DungeonConceptSelection(SelectionType.EDGE, null, edge);
    }
}
