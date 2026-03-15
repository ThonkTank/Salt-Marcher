package features.world.dungeonmap.ui.concept.canvas;

import features.world.dungeonmap.model.projection.DungeonConceptCanvasEdge;
import features.world.dungeonmap.model.projection.DungeonConceptCanvasNode;
import features.world.dungeonmap.model.projection.DungeonConceptState;
import features.world.dungeonmap.ui.concept.state.DungeonConceptTool;
import javafx.geometry.Point2D;
import javafx.scene.Cursor;
import javafx.scene.control.Label;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Line;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class DungeonConceptPane extends StackPane {

    public record EdgeSplitRequest(Long edgeId, double x, double y) {}
    public record RoomCreateRequest(Long conceptLevelId, double x, double y) {}
    public record NodePosition(
            String nodeKey,
            Long conceptLevelId,
            features.world.dungeonmap.model.domain.DungeonConceptNodeType nodeType,
            Integer externalNodeIndex,
            Long connectionId,
            double x,
            double y
    ) {}

    private static final double NODE_MARGIN = 36;
    private static final double INITIAL_RADIUS_X = 140;
    private static final double INITIAL_RADIUS_Y = 110;
    private static final double STABILIZE_MILLIS = 1800;

    private final Pane edgesLayer = new Pane();
    private final Pane nodesLayer = new Pane();
    private final Label statusLabel = new Label("Kein Dungeon geladen");
    private final Map<String, DungeonConceptNodeVisual> nodeVisuals = new LinkedHashMap<>();
    private final List<DungeonConceptEdgeVisual> edgeVisuals = new ArrayList<>();
    private final Line draftLine = createDraftLine();
    private final DungeonConceptLayoutEngine layoutEngine = new DungeonConceptLayoutEngine(
            this::nodeVisualList,
            this::edgeVisualList,
            this::getWidth,
            this::getHeight,
            this::updateGeometry,
            this::handleLayoutSettled);

    private Consumer<DungeonConceptCanvasNode> onNodeSelected;
    private Consumer<DungeonConceptCanvasNode> onNodeDeleteRequested;
    private Runnable onBackgroundSelected;
    private Consumer<List<NodePosition>> onLayoutSettled;
    private BiConsumer<DungeonConceptCanvasNode, DungeonConceptCanvasNode> onConnectionRequested;
    private Consumer<Long> onEdgeDeleteRequested;
    private Consumer<EdgeSplitRequest> onEdgeSplitRequested;
    private Consumer<RoomCreateRequest> onRoomCreateRequested;
    private String selectedNodeKey;
    private Long selectedEdgeId;
    private String draftStartNodeKey;
    private double draftMouseX;
    private double draftMouseY;
    private Long activeLevelId;
    private DungeonConceptTool activeTool = DungeonConceptTool.SELECT;

    public DungeonConceptPane() {
        getStyleClass().add("dungeon-map-canvas");
        setMinSize(200, 200);
        setPrefSize(Region.USE_COMPUTED_SIZE, Region.USE_COMPUTED_SIZE);
        setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        setFocusTraversable(true);

        edgesLayer.setPickOnBounds(false);
        nodesLayer.setPickOnBounds(false);
        statusLabel.getStyleClass().addAll("text-muted", "dungeon-map-empty-state");
        statusLabel.setMouseTransparent(true);

        edgesLayer.getChildren().add(draftLine);
        getChildren().addAll(edgesLayer, nodesLayer, statusLabel);

        setOnMousePressed(this::handleBackgroundPressed);
        setOnMouseMoved(this::updateDraftMousePosition);
        setOnMouseDragged(this::updateDraftMousePosition);
        setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ESCAPE) {
                cancelConnectionDraft();
                event.consume();
            }
        });
    }

    public void loadState(DungeonConceptState state, Long activeLevelId) {
        nodeVisuals.clear();
        edgeVisuals.clear();
        edgesLayer.getChildren().setAll(draftLine);
        nodesLayer.getChildren().clear();
        selectedNodeKey = null;
        this.activeLevelId = activeLevelId;
        layoutEngine.reset();
        cancelConnectionDraft();

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

        for (int index = 0; index < levelNodes.size(); index++) {
            DungeonConceptNodeVisual visual = new DungeonConceptNodeVisual(
                    levelNodes.get(index),
                    fallbackX(index, levelNodes.size()),
                    fallbackY(index, levelNodes.size()));
            wireNodeInteractions(visual);
            visual.updateCursor(activeTool);
            nodeVisuals.put(visual.node().nodeKey(), visual);
            nodesLayer.getChildren().add(visual.view());
        }

        for (DungeonConceptCanvasEdge edge : state.canvasEdges()) {
            if (!activeLevelId.equals(edge.conceptLevelId())) {
                continue;
            }
            DungeonConceptNodeVisual from = nodeVisuals.get(edge.fromNodeKey());
            DungeonConceptNodeVisual to = nodeVisuals.get(edge.toNodeKey());
            if (from == null || to == null) {
                continue;
            }
            DungeonConceptEdgeVisual visual = new DungeonConceptEdgeVisual(edge, from, to);
            wireEdgeInteractions(visual);
            visual.updateCursor(activeTool);
            edgeVisuals.add(visual);
            edgesLayer.getChildren().addAll(visual.visibleLine(), visual.hitLine());
        }

        updateGeometry();
        updateSelectionStyles();
        if (hasUnpositionedNodes(levelNodes)) {
            layoutEngine.start(STABILIZE_MILLIS, false);
        }
    }

    public void setSelection(String nodeKey, Long edgeId) {
        selectedNodeKey = nodeKey;
        selectedEdgeId = edgeId;
        updateSelectionStyles();
    }

    public void setActiveTool(DungeonConceptTool activeTool) {
        this.activeTool = activeTool == null ? DungeonConceptTool.SELECT : activeTool;
        setCursor(switch (this.activeTool) {
            case MOVE, SELECT -> Cursor.DEFAULT;
            case ROOM, CONNECT -> Cursor.CROSSHAIR;
        });
        for (DungeonConceptNodeVisual visual : nodeVisuals.values()) {
            visual.updateCursor(this.activeTool);
        }
        for (DungeonConceptEdgeVisual visual : edgeVisuals) {
            visual.updateCursor(this.activeTool);
        }
        if (this.activeTool != DungeonConceptTool.CONNECT) {
            cancelConnectionDraft();
        }
    }

    public void setOnNodeSelected(Consumer<DungeonConceptCanvasNode> onNodeSelected) {
        this.onNodeSelected = onNodeSelected;
    }

    public void setOnNodeDeleteRequested(Consumer<DungeonConceptCanvasNode> onNodeDeleteRequested) {
        this.onNodeDeleteRequested = onNodeDeleteRequested;
    }

    public void setOnBackgroundSelected(Runnable onBackgroundSelected) {
        this.onBackgroundSelected = onBackgroundSelected;
    }

    public void setOnLayoutSettled(Consumer<List<NodePosition>> onLayoutSettled) {
        this.onLayoutSettled = onLayoutSettled;
    }

    public void setOnConnectionRequested(BiConsumer<DungeonConceptCanvasNode, DungeonConceptCanvasNode> onConnectionRequested) {
        this.onConnectionRequested = onConnectionRequested;
    }

    public void setOnEdgeDeleteRequested(Consumer<Long> onEdgeDeleteRequested) {
        this.onEdgeDeleteRequested = onEdgeDeleteRequested;
    }

    public void setOnEdgeSplitRequested(Consumer<EdgeSplitRequest> onEdgeSplitRequested) {
        this.onEdgeSplitRequested = onEdgeSplitRequested;
    }

    public void setOnRoomCreateRequested(Consumer<RoomCreateRequest> onRoomCreateRequested) {
        this.onRoomCreateRequested = onRoomCreateRequested;
    }

    private void handleBackgroundPressed(MouseEvent event) {
        if (event.getButton() != MouseButton.PRIMARY && event.getButton() != MouseButton.SECONDARY) {
            return;
        }
        if (event.getTarget() != this && event.getTarget() != nodesLayer && event.getTarget() != edgesLayer) {
            return;
        }
        requestFocus();
        if (event.getButton() == MouseButton.SECONDARY || draftStartNodeKey != null) {
            cancelConnectionDraft();
            event.consume();
            return;
        }
        if (activeTool == DungeonConceptTool.ROOM
                && event.getButton() == MouseButton.PRIMARY
                && activeLevelId != null
                && onRoomCreateRequested != null) {
            Point2D clickPoint = sceneToLocal(event.getSceneX(), event.getSceneY());
            onRoomCreateRequested.accept(new RoomCreateRequest(
                    activeLevelId,
                    clamp(clickPoint.getX(), NODE_MARGIN, Math.max(NODE_MARGIN, getWidth() - NODE_MARGIN)),
                    clamp(clickPoint.getY(), NODE_MARGIN, Math.max(NODE_MARGIN, getHeight() - NODE_MARGIN))));
            event.consume();
            return;
        }
        if (onBackgroundSelected != null) {
            onBackgroundSelected.run();
        }
    }

    private void wireNodeInteractions(DungeonConceptNodeVisual visual) {
        visual.view().setOnMouseClicked(event -> {
            requestFocus();
            if (event.getButton() == MouseButton.SECONDARY) {
                if ((activeTool == DungeonConceptTool.ROOM || activeTool == DungeonConceptTool.CONNECT)
                        && onNodeDeleteRequested != null) {
                    cancelConnectionDraft();
                    onNodeDeleteRequested.accept(visual.positionedNode());
                    event.consume();
                }
                return;
            }
            if (event.getButton() != MouseButton.PRIMARY) {
                return;
            }
            event.consume();
            if (activeTool == DungeonConceptTool.CONNECT) {
                updateDraftMousePosition(event);
                if (draftStartNodeKey == null) {
                    startConnectionDraft(visual, event);
                } else {
                    finishConnectionDraft(visual);
                }
                return;
            }
            if (onNodeSelected != null) {
                onNodeSelected.accept(visual.positionedNode());
            }
        });
        visual.view().setOnMousePressed(event -> {
            if (event.getButton() != MouseButton.PRIMARY) {
                return;
            }
            requestFocus();
            if (effectiveTool(event) != DungeonConceptTool.MOVE) {
                return;
            }
            visual.setDragging(true);
            visual.setDragOffsetX(event.getSceneX() - visual.x());
            visual.setDragOffsetY(event.getSceneY() - visual.y());
            event.consume();
        });
        visual.view().setOnMouseDragged(event -> {
            if (!visual.dragging()) {
                return;
            }
            visual.setX(clamp(event.getSceneX() - visual.dragOffsetX(), NODE_MARGIN, Math.max(NODE_MARGIN, getWidth() - NODE_MARGIN)));
            visual.setY(clamp(event.getSceneY() - visual.dragOffsetY(), NODE_MARGIN, Math.max(NODE_MARGIN, getHeight() - NODE_MARGIN)));
            visual.setVx(0);
            visual.setVy(0);
            updateGeometry();
            layoutEngine.start(STABILIZE_MILLIS, false);
            event.consume();
        });
        visual.view().setOnMouseReleased(event -> {
            if (!visual.dragging()) {
                return;
            }
            visual.setDragging(false);
            layoutEngine.start(STABILIZE_MILLIS, true);
            event.consume();
        });
    }

    private void wireEdgeInteractions(DungeonConceptEdgeVisual visual) {
        visual.hitLine().setOnMouseEntered(event -> visual.setHighlighted(true));
        visual.hitLine().setOnMouseExited(event -> visual.setHighlighted(false));
        visual.hitLine().setOnMousePressed(event -> {
            requestFocus();
            if (event.getButton() == MouseButton.SECONDARY && onEdgeDeleteRequested != null) {
                cancelConnectionDraft();
                onEdgeDeleteRequested.accept(visual.edge().edgeId());
                event.consume();
                return;
            }
            if (activeTool != DungeonConceptTool.ROOM) {
                return;
            }
            if (event.getButton() == MouseButton.PRIMARY
                    && onEdgeSplitRequested != null) {
                cancelConnectionDraft();
                Point2D clickPoint = edgesLayer.sceneToLocal(event.getSceneX(), event.getSceneY());
                onEdgeSplitRequested.accept(new EdgeSplitRequest(visual.edge().edgeId(), clickPoint.getX(), clickPoint.getY()));
                event.consume();
            }
        });
    }

    private void updateGeometry() {
        for (DungeonConceptNodeVisual visual : nodeVisuals.values()) {
            visual.relocate();
        }
        for (DungeonConceptEdgeVisual visual : edgeVisuals) {
            updateEdgeGeometry(visual);
        }
        if (draftStartNodeKey != null) {
            DungeonConceptNodeVisual start = nodeVisuals.get(draftStartNodeKey);
            if (start != null) {
                Point2D startAnchor = start.edgeAnchor(edgesLayer);
                draftLine.setStartX(startAnchor.getX());
                draftLine.setStartY(startAnchor.getY());
                draftLine.setEndX(draftMouseX);
                draftLine.setEndY(draftMouseY);
            }
        }
    }

    private void updateEdgeGeometry(DungeonConceptEdgeVisual visual) {
        Point2D fromAnchor = visual.from().edgeAnchor(edgesLayer);
        Point2D toAnchor = visual.to().edgeAnchor(edgesLayer);
        visual.visibleLine().setStartX(fromAnchor.getX());
        visual.visibleLine().setStartY(fromAnchor.getY());
        visual.visibleLine().setEndX(toAnchor.getX());
        visual.visibleLine().setEndY(toAnchor.getY());
        visual.hitLine().setStartX(fromAnchor.getX());
        visual.hitLine().setStartY(fromAnchor.getY());
        visual.hitLine().setEndX(toAnchor.getX());
        visual.hitLine().setEndY(toAnchor.getY());
    }

    private void updateSelectionStyles() {
        for (DungeonConceptNodeVisual visual : nodeVisuals.values()) {
            visual.updateSelectionStyles(
                    visual.node().nodeKey().equals(selectedNodeKey),
                    visual.node().nodeKey().equals(draftStartNodeKey));
        }
        for (DungeonConceptEdgeVisual visual : edgeVisuals) {
            visual.setSelected(selectedEdgeId != null && selectedEdgeId.equals(visual.edge().edgeId()));
        }
    }

    private void handleLayoutSettled(boolean persistLayout) {
        if (!persistLayout || onLayoutSettled == null) {
            return;
        }
        onLayoutSettled.accept(currentNodePositions());
    }

    private void startConnectionDraft(DungeonConceptNodeVisual start, MouseEvent event) {
        draftStartNodeKey = start.node().nodeKey();
        selectedNodeKey = start.node().nodeKey();
        draftLine.setVisible(true);
        updateDraftMousePosition(event);
        updateSelectionStyles();
        if (onNodeSelected != null) {
            onNodeSelected.accept(start.positionedNode());
        }
    }

    private void finishConnectionDraft(DungeonConceptNodeVisual target) {
        DungeonConceptNodeVisual start = nodeVisuals.get(draftStartNodeKey);
        if (start == null || target == null) {
            cancelConnectionDraft();
            return;
        }
        if (!start.node().nodeKey().equals(target.node().nodeKey())
                && !hasExistingEdge(start.node().nodeKey(), target.node().nodeKey())
                && onConnectionRequested != null) {
            onConnectionRequested.accept(start.positionedNode(), target.positionedNode());
        }
        cancelConnectionDraft();
    }

    private void cancelConnectionDraft() {
        draftStartNodeKey = null;
        draftLine.setVisible(false);
        updateSelectionStyles();
    }

    private boolean hasExistingEdge(String firstNodeKey, String secondNodeKey) {
        for (DungeonConceptEdgeVisual edge : edgeVisuals) {
            if (edge.edge().fromNodeKey().equals(firstNodeKey) && edge.edge().toNodeKey().equals(secondNodeKey)) {
                return true;
            }
            if (edge.edge().fromNodeKey().equals(secondNodeKey) && edge.edge().toNodeKey().equals(firstNodeKey)) {
                return true;
            }
        }
        return false;
    }

    private void updateDraftMousePosition(MouseEvent event) {
        if (event == null || draftStartNodeKey == null) {
            return;
        }
        Point2D mouse = sceneToLocal(event.getSceneX(), event.getSceneY());
        draftMouseX = clamp(mouse.getX(), NODE_MARGIN, Math.max(NODE_MARGIN, getWidth() - NODE_MARGIN));
        draftMouseY = clamp(mouse.getY(), NODE_MARGIN, Math.max(NODE_MARGIN, getHeight() - NODE_MARGIN));
        updateGeometry();
    }

    private DungeonConceptTool effectiveTool(MouseEvent event) {
        if (event != null && event.isShiftDown()) {
            return DungeonConceptTool.MOVE;
        }
        return activeTool;
    }

    private boolean hasUnpositionedNodes(List<DungeonConceptCanvasNode> nodes) {
        for (DungeonConceptCanvasNode node : nodes) {
            if (node.x() == 0 && node.y() == 0) {
                return true;
            }
        }
        return false;
    }

    private double fallbackX(int index, int total) {
        double centerX = Math.max(getWidth(), 800) / 2.0;
        double angle = total <= 1 ? 0 : (Math.PI * 2 * index) / total;
        return centerX + Math.cos(angle) * INITIAL_RADIUS_X;
    }

    private double fallbackY(int index, int total) {
        double centerY = Math.max(getHeight(), 600) / 2.0;
        double angle = total <= 1 ? 0 : (Math.PI * 2 * index) / total;
        return centerY + Math.sin(angle) * INITIAL_RADIUS_Y;
    }

    private void showStatus(String text) {
        statusLabel.setText(text);
        statusLabel.setVisible(true);
        statusLabel.setManaged(true);
    }

    private List<NodePosition> currentNodePositions() {
        List<NodePosition> result = new ArrayList<>();
        for (DungeonConceptNodeVisual visual : nodeVisuals.values()) {
            DungeonConceptCanvasNode node = visual.node();
            result.add(new NodePosition(
                    node.nodeKey(),
                    node.conceptLevelId(),
                    node.nodeType(),
                    node.externalNodeIndex(),
                    node.connectionId(),
                    visual.x(),
                    visual.y()));
        }
        return List.copyOf(result);
    }

    private List<DungeonConceptNodeVisual> nodeVisualList() {
        return new ArrayList<>(nodeVisuals.values());
    }

    private List<DungeonConceptEdgeVisual> edgeVisualList() {
        return List.copyOf(edgeVisuals);
    }

    private static Line createDraftLine() {
        Line line = new Line();
        line.getStyleClass().add("dungeon-concept-draft-edge");
        line.setMouseTransparent(true);
        line.setVisible(false);
        return line;
    }

    private static double clamp(double value, double min, double max) {
        return DungeonConceptLayoutEngine.clamp(value, min, max);
    }
}
