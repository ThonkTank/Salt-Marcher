package features.world.dungeonmap.ui.concept.canvas;

import features.world.dungeonmap.model.projection.DungeonConceptCanvasEdge;
import features.world.dungeonmap.ui.concept.state.DungeonConceptTool;
import javafx.css.PseudoClass;
import javafx.scene.Cursor;
import javafx.scene.shape.Line;

final class DungeonConceptEdgeVisual {

    private static final PseudoClass TARGET = PseudoClass.getPseudoClass("target");
    private static final PseudoClass SELECTED = PseudoClass.getPseudoClass("selected");

    private final DungeonConceptCanvasEdge edge;
    private final DungeonConceptNodeVisual from;
    private final DungeonConceptNodeVisual to;
    private final Line visibleLine = createVisibleLine();
    private final Line hitLine = createHitLine();

    DungeonConceptEdgeVisual(DungeonConceptCanvasEdge edge, DungeonConceptNodeVisual from, DungeonConceptNodeVisual to) {
        this.edge = edge;
        this.from = from;
        this.to = to;
    }

    DungeonConceptCanvasEdge edge() {
        return edge;
    }

    DungeonConceptNodeVisual from() {
        return from;
    }

    DungeonConceptNodeVisual to() {
        return to;
    }

    Line visibleLine() {
        return visibleLine;
    }

    Line hitLine() {
        return hitLine;
    }

    void updateCursor(DungeonConceptTool activeTool) {
        Cursor cursor = switch (activeTool) {
            case ROOM, CONNECT -> Cursor.CROSSHAIR;
            case MOVE, SELECT -> Cursor.DEFAULT;
        };
        hitLine.setCursor(cursor);
    }

    void setHighlighted(boolean highlighted) {
        visibleLine.pseudoClassStateChanged(TARGET, highlighted);
    }

    void setSelected(boolean selected) {
        visibleLine.pseudoClassStateChanged(SELECTED, selected);
    }

    private static Line createVisibleLine() {
        Line line = new Line();
        line.getStyleClass().add("dungeon-concept-edge");
        return line;
    }

    private static Line createHitLine() {
        Line line = new Line();
        line.getStyleClass().add("dungeon-concept-edge-hit");
        return line;
    }
}
