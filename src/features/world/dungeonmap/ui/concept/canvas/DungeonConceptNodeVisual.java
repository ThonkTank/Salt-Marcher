package features.world.dungeonmap.ui.concept.canvas;

import features.world.dungeonmap.model.domain.DungeonConceptNodeType;
import features.world.dungeonmap.model.projection.DungeonConceptCanvasNode;
import features.world.dungeonmap.ui.concept.state.DungeonConceptTool;
import features.world.dungeonmap.ui.shared.format.DungeonConceptTransitionText;
import javafx.css.PseudoClass;
import javafx.geometry.Point2D;
import javafx.scene.Cursor;
import javafx.scene.control.Label;
import javafx.scene.layout.Pane;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Circle;

final class DungeonConceptNodeVisual {

    private final DungeonConceptCanvasNode node;
    private final Circle dot = new Circle(12);
    private final Label icon = new Label();
    private final Label label = new Label();
    private final StackPane glyph = new StackPane();
    private final StackPane token = new StackPane();
    private final StackPane view = createInteractiveView();
    private double glyphCenterOffsetX = 35;
    private double glyphCenterOffsetY = 20;
    private double x;
    private double y;
    private double vx;
    private double vy;
    private double dragOffsetX;
    private double dragOffsetY;
    private boolean dragging;

    DungeonConceptNodeVisual(DungeonConceptCanvasNode node, double fallbackX, double fallbackY) {
        this.node = node;
        this.x = node.x() == 0 ? fallbackX : node.x();
        this.y = node.y() == 0 ? fallbackY : node.y();

        dot.getStyleClass().add("dungeon-concept-node-dot");
        icon.setText(node.iconText());
        icon.getStyleClass().add("dungeon-concept-node-icon");
        icon.setMouseTransparent(true);
        glyph.getStyleClass().add("dungeon-concept-node-glyph");
        glyph.getChildren().addAll(dot, icon);
        token.getChildren().add(glyph);
        token.setPickOnBounds(false);

        label.setText(DungeonConceptTransitionText.nodeLabel(node));
        label.getStyleClass().add("dungeon-concept-node-label");
        label.setMouseTransparent(true);

        view.getChildren().addAll(token, label);
        StackPane.setAlignment(label, javafx.geometry.Pos.TOP_CENTER);
        label.setTranslateY(-24);
        view.getStyleClass().add("dungeon-concept-node");
        if (node.nodeType() == DungeonConceptNodeType.ENTRANCE) {
            view.getStyleClass().add("dungeon-concept-node-entrance");
        } else if (node.nodeType() == DungeonConceptNodeType.EXIT) {
            view.getStyleClass().add("dungeon-concept-node-exit");
        } else if (node.nodeType() == DungeonConceptNodeType.ROOM) {
            view.getStyleClass().add("dungeon-concept-node-room");
        } else {
            view.getStyleClass().add("dungeon-concept-node-transition");
        }
        view.setPickOnBounds(false);
        view.applyCss();
        view.autosize();
        view.resize(Math.max(70, view.prefWidth(-1)), Math.max(40, view.prefHeight(-1)));
        view.layout();
        glyphCenterOffsetX = glyph.getBoundsInParent().getMinX() + glyph.getBoundsInParent().getWidth() / 2.0;
        glyphCenterOffsetY = glyph.getBoundsInParent().getMinY() + glyph.getBoundsInParent().getHeight() / 2.0;
        updateCursor(DungeonConceptTool.SELECT);
    }

    StackPane view() {
        return view;
    }

    DungeonConceptCanvasNode node() {
        return node;
    }

    double x() {
        return x;
    }

    void setX(double x) {
        this.x = x;
    }

    double y() {
        return y;
    }

    void setY(double y) {
        this.y = y;
    }

    double vx() {
        return vx;
    }

    void setVx(double vx) {
        this.vx = vx;
    }

    double vy() {
        return vy;
    }

    void setVy(double vy) {
        this.vy = vy;
    }

    double dragOffsetX() {
        return dragOffsetX;
    }

    void setDragOffsetX(double dragOffsetX) {
        this.dragOffsetX = dragOffsetX;
    }

    double dragOffsetY() {
        return dragOffsetY;
    }

    void setDragOffsetY(double dragOffsetY) {
        this.dragOffsetY = dragOffsetY;
    }

    boolean dragging() {
        return dragging;
    }

    void setDragging(boolean dragging) {
        this.dragging = dragging;
    }

    void relocate() {
        view.relocate(x - glyphCenterOffsetX, y - glyphCenterOffsetY);
    }

    Point2D edgeAnchor(Pane targetLayer) {
        Point2D center = dot.localToScene(dot.getCenterX(), dot.getCenterY());
        return targetLayer.sceneToLocal(center);
    }

    void updateCursor(DungeonConceptTool activeTool) {
        Cursor cursor = switch (activeTool) {
            case MOVE -> Cursor.HAND;
            case SELECT -> Cursor.DEFAULT;
            case ROOM, CONNECT -> Cursor.CROSSHAIR;
        };
        view.setCursor(cursor);
    }

    void updateSelectionStyles(boolean selected, boolean connecting) {
        view.pseudoClassStateChanged(PseudoClass.getPseudoClass("selected"), selected);
        view.pseudoClassStateChanged(PseudoClass.getPseudoClass("connecting"), connecting);
    }

    DungeonConceptCanvasNode positionedNode() {
        return node.withPosition(x, y);
    }

    private StackPane createInteractiveView() {
        return new StackPane() {
            @Override
            public boolean contains(double localX, double localY) {
                Point2D scenePoint = localToScene(localX, localY);
                if (scenePoint == null) {
                    return false;
                }
                Point2D dotPoint = dot.sceneToLocal(scenePoint);
                return dot.contains(dotPoint);
            }
        };
    }
}
