package features.world.dungeonmap.ui.concept.canvas;

import features.world.dungeonmap.model.domain.DungeonConceptNodeType;
import features.world.dungeonmap.model.projection.DungeonConceptCanvasNode;
import features.world.dungeonmap.model.projection.DungeonConceptState;
import javafx.scene.Cursor;
import javafx.scene.control.Label;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

public final class DungeonConceptPane extends StackPane {

    public record NodePosition(
            String nodeKey,
            Long conceptLevelId,
            DungeonConceptNodeType nodeType,
            Integer entranceIndex,
            Long connectionId,
            double x,
            double y
    ) {}

    private static final double NODE_MARGIN = 60;
    private static final double HORIZONTAL_GAP = 150;
    private static final double VERTICAL_GAP = 120;

    private final Pane nodesLayer = new Pane();
    private final Label statusLabel = new Label("Kein Dungeon geladen");
    private final Map<String, NodeVisual> nodeVisuals = new LinkedHashMap<>();

    private Consumer<DungeonConceptCanvasNode> onNodeSelected;
    private Runnable onBackgroundSelected;
    private Consumer<List<NodePosition>> onLayoutSettled;
    private String selectedNodeKey;

    public DungeonConceptPane() {
        getStyleClass().add("dungeon-map-canvas");
        setMinSize(200, 200);
        setPrefSize(Region.USE_COMPUTED_SIZE, Region.USE_COMPUTED_SIZE);
        setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);

        nodesLayer.setPickOnBounds(false);
        statusLabel.getStyleClass().addAll("text-muted", "dungeon-map-empty-state");
        statusLabel.setMouseTransparent(true);

        getChildren().addAll(nodesLayer, statusLabel);
        setOnMouseClicked(event -> {
            if (event.getTarget() == this || event.getTarget() == nodesLayer) {
                if (onBackgroundSelected != null) {
                    onBackgroundSelected.run();
                }
            }
        });
    }

    public void loadState(DungeonConceptState state, Long activeLevelId) {
        nodeVisuals.clear();
        nodesLayer.getChildren().clear();
        selectedNodeKey = null;

        if (state == null || state.map() == null || activeLevelId == null) {
            showStatus("Kein Dungeon geladen");
            return;
        }

        List<DungeonConceptCanvasNode> levelNodes = new ArrayList<>();
        for (DungeonConceptCanvasNode node : state.canvasNodes()) {
            if (activeLevelId.equals(node.conceptLevelId())) {
                levelNodes.add(node);
            }
        }
        if (levelNodes.isEmpty()) {
            showStatus("Keine Startknoten auf dieser Ebene");
            return;
        }

        statusLabel.setVisible(false);
        statusLabel.setManaged(false);

        int transitionIndex = 0;
        int entranceIndex = 0;
        for (DungeonConceptCanvasNode node : levelNodes) {
            int layoutIndex;
            int row;
            if (node.nodeType() == DungeonConceptNodeType.ENTRANCE) {
                row = 0;
                layoutIndex = entranceIndex++;
            } else {
                row = 1;
                layoutIndex = transitionIndex++;
            }
            NodeVisual visual = new NodeVisual(node, fallbackX(layoutIndex), fallbackY(row));
            nodeVisuals.put(node.nodeKey(), visual);
            nodesLayer.getChildren().add(visual.view());
        }
        updateNodeGeometry();
        updateSelectionStyles();
    }

    public void setSelection(String nodeKey) {
        selectedNodeKey = nodeKey;
        updateSelectionStyles();
    }

    public void setOnNodeSelected(Consumer<DungeonConceptCanvasNode> onNodeSelected) {
        this.onNodeSelected = onNodeSelected;
    }

    public void setOnBackgroundSelected(Runnable onBackgroundSelected) {
        this.onBackgroundSelected = onBackgroundSelected;
    }

    public void setOnLayoutSettled(Consumer<List<NodePosition>> onLayoutSettled) {
        this.onLayoutSettled = onLayoutSettled;
    }

    private void showStatus(String text) {
        statusLabel.setText(text);
        statusLabel.setVisible(true);
        statusLabel.setManaged(true);
    }

    private void updateNodeGeometry() {
        for (NodeVisual visual : nodeVisuals.values()) {
            visual.view().relocate(visual.x - visual.width / 2.0, visual.y - visual.height / 2.0);
        }
    }

    private void updateSelectionStyles() {
        javafx.css.PseudoClass selected = javafx.css.PseudoClass.getPseudoClass("selected");
        for (NodeVisual visual : nodeVisuals.values()) {
            visual.view().pseudoClassStateChanged(selected, visual.node().nodeKey().equals(selectedNodeKey));
        }
    }

    private double fallbackX(int index) {
        return NODE_MARGIN + 110 + (index * HORIZONTAL_GAP);
    }

    private double fallbackY(int row) {
        return NODE_MARGIN + 80 + (row * VERTICAL_GAP);
    }

    private List<NodePosition> currentNodePositions() {
        List<NodePosition> result = new ArrayList<>();
        for (NodeVisual visual : nodeVisuals.values()) {
            result.add(new NodePosition(
                    visual.node().nodeKey(),
                    visual.node().conceptLevelId(),
                    visual.node().nodeType(),
                    visual.node().entranceIndex(),
                    visual.node().connectionId(),
                    visual.x,
                    visual.y));
        }
        return List.copyOf(result);
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private final class NodeVisual {
        private final DungeonConceptCanvasNode node;
        private final StackPane view = new StackPane();
        private final Label label = new Label();
        private double x;
        private double y;
        private double dragOffsetX;
        private double dragOffsetY;
        private double width = 120;
        private double height = 56;

        private NodeVisual(DungeonConceptCanvasNode node, double fallbackX, double fallbackY) {
            this.node = node;
            this.x = node.x() == 0 ? fallbackX : node.x();
            this.y = node.y() == 0 ? fallbackY : node.y();
            label.setText(node.displayName());
            view.getChildren().add(label);
            view.getStyleClass().add("dungeon-concept-node");
            if (node.nodeType() == DungeonConceptNodeType.ENTRANCE) {
                view.getStyleClass().add("dungeon-concept-node-entrance");
            } else {
                view.getStyleClass().add("dungeon-concept-node-transition");
            }
            view.setCursor(Cursor.HAND);
            view.applyCss();
            view.autosize();
            width = Math.max(120, view.prefWidth(-1));
            height = Math.max(56, view.prefHeight(-1));

            view.setOnMouseClicked(event -> {
                event.consume();
                if (onNodeSelected != null) {
                    onNodeSelected.accept(node.withPosition(x, y));
                }
            });
            view.setOnMousePressed(event -> {
                dragOffsetX = event.getSceneX() - x;
                dragOffsetY = event.getSceneY() - y;
                event.consume();
            });
            view.setOnMouseDragged(event -> {
                x = clamp(event.getSceneX() - dragOffsetX, NODE_MARGIN, Math.max(NODE_MARGIN, getWidth() - NODE_MARGIN));
                y = clamp(event.getSceneY() - dragOffsetY, NODE_MARGIN, Math.max(NODE_MARGIN, getHeight() - NODE_MARGIN));
                updateNodeGeometry();
                event.consume();
            });
            view.setOnMouseReleased(event -> {
                if (onLayoutSettled != null) {
                    onLayoutSettled.accept(currentNodePositions());
                }
                event.consume();
            });
        }

        public StackPane view() {
            return view;
        }

        public DungeonConceptCanvasNode node() {
            return node;
        }
    }
}
