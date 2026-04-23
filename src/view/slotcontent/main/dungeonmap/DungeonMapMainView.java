package src.view.slotcontent.main.dungeonmap;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.control.Label;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.Pane;
import javafx.scene.layout.StackPane;
import javafx.scene.paint.Color;
import javafx.scene.text.TextAlignment;

public class DungeonMapMainView extends BorderPane {

    private static final double DEFAULT_WIDTH = 960.0;
    private static final double DEFAULT_HEIGHT = 640.0;
    private static final double BASE_GRID = 32.0;
    private static final double MIN_ZOOM = 0.1;
    private static final double MAX_ZOOM = 4.0;
    private static final double ZOOM_STEP_FACTOR = 1.1;
    private static final int[] GRID_STEPS = {1, 5, 10, 25};
    private final ObjectProperty<DungeonMapDisplayModel> renderModel =
            new SimpleObjectProperty<>(DungeonMapDisplayModel.empty());
    private final StackPane contentHost = new StackPane();
    private final Pane canvasLayer = new Pane();
    private final Canvas canvas = new Canvas(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    private final Label overlayMessage = new Label();
    private double panX;
    private double panY;
    private double zoom = 1.0;
    private double lastDragSceneX;
    private double lastDragSceneY;
    private boolean middleDragActive;
    private boolean primaryInteractionActive;
    private Runnable viewportChangedHandler = () -> {};
    private Function<DungeonMapPointerEvent, Boolean> primaryPressedHandler = ignored -> false;
    private Consumer<DungeonMapPointerEvent> primaryDraggedHandler = ignored -> {};
    private Consumer<DungeonMapPointerEvent> primaryReleasedHandler = ignored -> {};
    private Consumer<Integer> levelScrolledHandler = ignored -> {};

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonMapMainView() {
        getStyleClass().add("surface-root");
        setPadding(new Insets(8));
        configureLabels();
        configureContentHost();
        renderModel.addListener((ignored, before, after) -> redraw());
        setCenter(contentHost);
        installInteractionHandlers();
        redraw();
    }

    public final ObjectProperty<DungeonMapDisplayModel> renderModelProperty() {
        return renderModel;
    }

    public final double zoom() {
        return zoom;
    }

    public final void onViewportChanged(Runnable action) {
        viewportChangedHandler = action == null ? () -> {} : action;
    }

    public final void onPrimaryPressed(Function<DungeonMapPointerEvent, Boolean> action) {
        primaryPressedHandler = action == null ? ignored -> false : action;
    }

    public final void onPrimaryDragged(Consumer<DungeonMapPointerEvent> action) {
        primaryDraggedHandler = action == null ? ignored -> {} : action;
    }

    public final void onPrimaryReleased(Consumer<DungeonMapPointerEvent> action) {
        primaryReleasedHandler = action == null ? ignored -> {} : action;
    }

    public final void onLevelScrolled(Consumer<Integer> action) {
        levelScrolledHandler = action == null ? ignored -> {} : action;
    }

    public final void resetCamera() {
        resetCameraState();
        cameraChanged();
        canvasLayer.requestFocus();
    }

    private void resetCameraState() {
        panX = 0.0;
        panY = 0.0;
        zoom = 1.0;
    }

    private void configureLabels() {
        overlayMessage.getStyleClass().add("dungeon-map-overlay-placeholder");
        overlayMessage.setWrapText(true);
        overlayMessage.setMouseTransparent(true);
    }

    private void configureContentHost() {
        contentHost.getStyleClass().add("map-workspace-content");
        contentHost.setAlignment(Pos.CENTER);
        canvasLayer.setMinSize(0.0, 0.0);
        canvasLayer.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        canvasLayer.setFocusTraversable(true);
        canvas.getStyleClass().add("dungeon-map-canvas");
        canvas.widthProperty().bind(canvasLayer.widthProperty());
        canvas.heightProperty().bind(canvasLayer.heightProperty());
        canvas.widthProperty().addListener((ignored, before, after) -> redraw());
        canvas.heightProperty().addListener((ignored, before, after) -> redraw());
        canvasLayer.getChildren().setAll(canvas);
        contentHost.getChildren().setAll(canvasLayer, overlayMessage);
        StackPane.setAlignment(canvasLayer, Pos.TOP_LEFT);
        StackPane.setAlignment(overlayMessage, Pos.CENTER);
    }

    private void installInteractionHandlers() {
        canvasLayer.addEventFilter(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
        canvasLayer.addEventFilter(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
        canvasLayer.addEventFilter(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
        canvasLayer.addEventFilter(ScrollEvent.SCROLL, this::handleScroll);
    }

    private void handleMousePressed(MouseEvent event) {
        canvasLayer.requestFocus();
        if (event.getButton() == MouseButton.MIDDLE) {
            middleDragActive = true;
            lastDragSceneX = event.getSceneX();
            lastDragSceneY = event.getSceneY();
            event.consume();
        } else if (event.getButton() == MouseButton.PRIMARY) {
            primaryInteractionActive = Boolean.TRUE.equals(primaryPressedHandler.apply(pointerEvent(event, true, false)));
            event.consume();
        } else if (event.getButton() == MouseButton.SECONDARY) {
            boolean secondaryHandled = Boolean.TRUE.equals(primaryPressedHandler.apply(pointerEvent(event, false, true)));
            primaryInteractionActive = primaryInteractionActive && !secondaryHandled;
            event.consume();
        }
    }

    private void handleMouseDragged(MouseEvent event) {
        if (primaryInteractionActive) {
            primaryDraggedHandler.accept(pointerEvent(event, true, false));
            event.consume();
            return;
        }
        if (!middleDragActive) {
            return;
        }
        panByPixels(event.getSceneX() - lastDragSceneX, event.getSceneY() - lastDragSceneY);
        lastDragSceneX = event.getSceneX();
        lastDragSceneY = event.getSceneY();
        cameraChanged();
        event.consume();
    }

    private void handleMouseReleased(MouseEvent event) {
        if (event.getButton() == MouseButton.MIDDLE) {
            middleDragActive = false;
            event.consume();
        } else if (event.getButton() == MouseButton.PRIMARY) {
            if (primaryInteractionActive) {
                primaryReleasedHandler.accept(pointerEvent(event, true, false));
            }
            primaryInteractionActive = false;
            event.consume();
        }
    }

    private void handleScroll(ScrollEvent event) {
        if (event.isControlDown() && event.getDeltaY() != 0.0) {
            levelScrolledHandler.accept(event.getDeltaY() > 0.0 ? 1 : -1);
            cameraChanged();
            event.consume();
            return;
        }
        if (event.getDeltaY() > 0.0) {
            zoomAround(event.getX(), event.getY(), ZOOM_STEP_FACTOR);
        } else if (event.getDeltaY() < 0.0) {
            zoomAround(event.getX(), event.getY(), 1.0 / ZOOM_STEP_FACTOR);
        }
        cameraChanged();
        event.consume();
    }

    private DungeonMapPointerEvent pointerEvent(
            MouseEvent event,
            boolean primaryButtonDown,
            boolean secondaryButtonDown
    ) {
        double worldQ = screenToWorldX(event.getX());
        double worldR = screenToWorldY(event.getY());
        int q = (int) Math.floor(worldQ);
        int r = (int) Math.floor(worldR);
        DungeonMapDisplayModel model = renderModel.get() == null ? DungeonMapDisplayModel.empty() : renderModel.get();
        return new DungeonMapPointerEvent(
                q,
                r,
                model.projectionLevel(),
                primaryButtonDown,
                secondaryButtonDown,
                hitTarget(model, q, r, worldQ, worldR, model.projectionLevel()),
                vertexTarget(worldQ, worldR, model.projectionLevel()),
                boundaryTarget(model, worldQ, worldR, model.projectionLevel()));
    }

    private DungeonMapHitTarget hitTarget(
            DungeonMapDisplayModel model,
            int q,
            int r,
            double worldQ,
            double worldR,
            int level
    ) {
        if (model.viewMode() != DungeonMapDisplayModel.ViewMode.GRID) {
            return DungeonMapHitTarget.empty();
        }
        DungeonMapHitTarget markerHit = markerHitTarget(model, worldQ, worldR, level);
        if (markerHit.kind() != DungeonMapHitKind.EMPTY) {
            return markerHit;
        }
        DungeonMapHitTarget labelHit = labelHitTarget(model, worldQ, worldR, level);
        if (labelHit.kind() != DungeonMapHitKind.EMPTY) {
            return labelHit;
        }
        for (int index = model.cells().size() - 1; index >= 0; index--) {
            DungeonMapDisplayModel.RenderCell cell = model.cells().get(index);
            if (cell.preview() || cell.q() != q || cell.r() != r || cell.z() != level) {
                continue;
            }
            return new DungeonMapHitTarget(
                    hitKind(cell.kind()),
                    cell.ownerId(),
                    cell.clusterId(),
                    cell.topologyRef().kind(),
                    cell.topologyRef().id(),
                    cell.label());
        }
        return DungeonMapHitTarget.empty();
    }

    private DungeonMapHitTarget markerHitTarget(
            DungeonMapDisplayModel model,
            double worldQ,
            double worldR,
            int level
    ) {
        double radiusInCells = Math.max(0.28, 11.0 / gridSize());
        for (int index = model.markers().size() - 1; index >= 0; index--) {
            DungeonMapDisplayModel.RenderMarker marker = model.markers().get(index);
            if (marker.preview() || marker.z() != level || marker.handleOwnerId() <= 0L) {
                continue;
            }
            double deltaQ = worldQ - marker.q();
            double deltaR = worldR - marker.r();
            if (Math.hypot(deltaQ, deltaR) > radiusInCells) {
                continue;
            }
            return new DungeonMapHitTarget(
                    DungeonMapHitKind.HANDLE,
                    marker.handleOwnerId(),
                    marker.handleClusterId(),
                    marker.handleTopologyRefKind(),
                    marker.handleTopologyRefId(),
                    marker.label(),
                    marker.handleKind(),
                    marker.handleCorridorId(),
                    marker.handleRoomId(),
                    marker.handleIndex(),
                    marker.handleQ(),
                    marker.handleR(),
                    marker.handleLevel(),
                    marker.handleDirection());
        }
        return DungeonMapHitTarget.empty();
    }

    private DungeonMapHitTarget labelHitTarget(
            DungeonMapDisplayModel model,
            double worldQ,
            double worldR,
            int level
    ) {
        for (int index = model.labels().size() - 1; index >= 0; index--) {
            DungeonMapDisplayModel.RenderLabel label = model.labels().get(index);
            if (label.preview() || label.z() != level || label.label().isBlank()) {
                continue;
            }
            double labelWidth = Math.max(56.0, Math.min(180.0, label.label().length() * 7.2 + 16.0));
            double widthInCells = labelWidth / gridSize();
            double heightInCells = 24.0 / gridSize();
            if (worldQ < label.q() - widthInCells / 2.0
                    || worldQ > label.q() + widthInCells / 2.0
                    || worldR < label.r() - heightInCells / 2.0
                    || worldR > label.r() + heightInCells / 2.0) {
                continue;
            }
            return new DungeonMapHitTarget(
                    DungeonMapHitKind.LABEL,
                    label.ownerId(),
                    label.clusterId(),
                    label.topologyRef().kind(),
                    label.topologyRef().id(),
                    label.label());
        }
        return DungeonMapHitTarget.empty();
    }

    private DungeonMapVertexTarget vertexTarget(double worldQ, double worldR, int level) {
        int vertexQ = (int) Math.round(worldQ);
        int vertexR = (int) Math.round(worldR);
        double distance = Math.hypot(worldQ - vertexQ, worldR - vertexR);
        double maxDistance = Math.max(7.0 / gridSize(), 0.22);
        return distance <= maxDistance
                ? new DungeonMapVertexTarget(true, vertexQ, vertexR, level)
                : DungeonMapVertexTarget.empty();
    }

    private DungeonMapBoundaryTarget boundaryTarget(
            DungeonMapDisplayModel model,
            double worldQ,
            double worldR,
            int level
    ) {
        double maxDistance = Math.max(7.0 / gridSize(), 0.22);
        DungeonMapBoundaryTarget bestTarget = DungeonMapBoundaryTarget.empty();
        double bestDistance = maxDistance;
        for (int index = model.edges().size() - 1; index >= 0; index--) {
            DungeonMapDisplayModel.RenderEdge edge = model.edges().get(index);
            if (edge.preview() || edge.z() != level) {
                continue;
            }
            double distance = distanceToSegment(worldQ, worldR, edge.startQ(), edge.startR(), edge.endQ(), edge.endR());
            if (distance > bestDistance) {
                continue;
            }
            bestDistance = distance;
            bestTarget = new DungeonMapBoundaryTarget(
                    true,
                    edge.kind().name(),
                    edge.ownerId(),
                    edgeClusterId(model, edge),
                    edge.topologyRef().kind(),
                    edge.topologyRef().id(),
                    (int) Math.round(edge.startQ()),
                    (int) Math.round(edge.startR()),
                    (int) Math.round(edge.endQ()),
                    (int) Math.round(edge.endR()),
                    edge.z());
        }
        return bestTarget;
    }

    private static double distanceToSegment(
            double pointQ,
            double pointR,
            double startQ,
            double startR,
            double endQ,
            double endR
    ) {
        double deltaQ = endQ - startQ;
        double deltaR = endR - startR;
        double lengthSquared = deltaQ * deltaQ + deltaR * deltaR;
        if (lengthSquared <= 0.0) {
            return Math.hypot(pointQ - startQ, pointR - startR);
        }
        double projection = ((pointQ - startQ) * deltaQ + (pointR - startR) * deltaR) / lengthSquared;
        double clamped = Math.max(0.0, Math.min(1.0, projection));
        double nearestQ = startQ + clamped * deltaQ;
        double nearestR = startR + clamped * deltaR;
        return Math.hypot(pointQ - nearestQ, pointR - nearestR);
    }

    private static long edgeClusterId(DungeonMapDisplayModel model, DungeonMapDisplayModel.RenderEdge edge) {
        SimpleCell start = new SimpleCell((int) Math.round(edge.startQ()), (int) Math.round(edge.startR()), edge.z());
        SimpleCell end = new SimpleCell((int) Math.round(edge.endQ()), (int) Math.round(edge.endR()), edge.z());
        for (SimpleCell touchingCell : touchingCells(start, end)) {
            for (DungeonMapDisplayModel.RenderCell cell : model.cells()) {
                if (!cell.preview()
                        && cell.z() == edge.z()
                        && cell.clusterId() > 0L
                        && cell.q() == touchingCell.q()
                        && cell.r() == touchingCell.r()) {
                    return cell.clusterId();
                }
            }
        }
        return 0L;
    }

    private static java.util.List<SimpleCell> touchingCells(SimpleCell start, SimpleCell end) {
        if (start == null || end == null || start.z() != end.z()) {
            return java.util.List.of();
        }
        if (start.r() == end.r()) {
            return horizontalTouchingCells(start, end);
        }
        if (start.q() == end.q()) {
            return verticalTouchingCells(start, end);
        }
        return java.util.List.of();
    }

    private static java.util.List<SimpleCell> horizontalTouchingCells(SimpleCell start, SimpleCell end) {
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        java.util.List<SimpleCell> result = new java.util.ArrayList<>();
        for (int q = minQ; q < maxQ; q++) {
            result.add(new SimpleCell(q, start.r() - 1, start.z()));
            result.add(new SimpleCell(q, start.r(), start.z()));
        }
        return java.util.List.copyOf(result);
    }

    private static java.util.List<SimpleCell> verticalTouchingCells(SimpleCell start, SimpleCell end) {
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        java.util.List<SimpleCell> result = new java.util.ArrayList<>();
        for (int r = minR; r < maxR; r++) {
            result.add(new SimpleCell(start.q() - 1, r, start.z()));
            result.add(new SimpleCell(start.q(), r, start.z()));
        }
        return java.util.List.copyOf(result);
    }

    private static DungeonMapHitKind hitKind(DungeonMapDisplayModel.CellKind kind) {
        return switch (kind) {
            case ROOM -> DungeonMapHitKind.ROOM;
            case CORRIDOR -> DungeonMapHitKind.CORRIDOR;
            case STAIR -> DungeonMapHitKind.STAIR;
            case TRANSITION -> DungeonMapHitKind.TRANSITION;
        };
    }

    private void panByPixels(double deltaX, double deltaY) {
        panX += deltaX;
        panY += deltaY;
    }

    private void zoomAround(double canvasX, double canvasY, double factor) {
        double nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
        double scale = nextZoom / zoom;
        panX = canvasX - (canvasX - panX) * scale;
        panY = canvasY - (canvasY - panY) * scale;
        zoom = nextZoom;
    }

    private void cameraChanged() {
        redraw();
        viewportChangedHandler.run();
    }

    private void redraw() {
        DungeonMapDisplayModel model = renderModel.get() == null ? DungeonMapDisplayModel.empty() : renderModel.get();
        renderScene(model);
    }

    private void renderScene(DungeonMapDisplayModel model) {
        GraphicsContext gc = canvas.getGraphicsContext2D();
        gc.clearRect(0.0, 0.0, width(), height());
        overlayMessage.setText("");
        if (model.topology() != DungeonMapDisplayModel.RenderTopology.SQUARE) {
            overlayMessage.setText("Hex topology rendering is not available yet.");
            overlayMessage.setVisible(true);
            return;
        }
        if (model.viewMode() == DungeonMapDisplayModel.ViewMode.GRAPH) {
            renderGraph(gc, model);
        } else {
            renderGridScene(gc, model);
        }
        renderOverlayMessage(model);
    }

    private void renderGridScene(GraphicsContext gc, DungeonMapDisplayModel model) {
        fillBackground(gc);
        drawGrid(gc);
        drawCells(gc, model, true);
        drawEdges(gc, model, true);
        drawMarkers(gc, model, true);
        drawPartyToken(gc, model);
        drawLabels(gc, model, true);
        drawAxes(gc);
    }

    private void renderGraph(GraphicsContext gc, DungeonMapDisplayModel model) {
        fillBackground(gc);
        Map<Long, GraphPoint> points = graphPoints(model);
        gc.setStroke(graphLink());
        gc.setLineWidth(3.0);
        for (DungeonMapDisplayModel.GraphLink link : model.graphLinks()) {
            GraphPoint from = points.get(link.fromId());
            GraphPoint to = points.get(link.toId());
            if (from != null && to != null) {
                gc.setStroke(link.selected() ? highlightStroke() : graphLink());
                gc.strokeLine(from.x(), from.y(), to.x(), to.y());
            }
        }
        gc.setTextAlign(TextAlignment.CENTER);
        for (DungeonMapDisplayModel.GraphNode node : model.graphNodes()) {
            GraphPoint point = points.get(node.id());
            if (point == null) {
                continue;
            }
            gc.setFill(node.selected() ? partyFill() : graphNodeFill());
            gc.fillRoundRect(point.x() - 42.0, point.y() - 18.0, 84.0, 36.0, 18.0, 18.0);
            gc.setStroke(node.selected() ? partyStroke() : roomStroke());
            gc.setLineWidth(node.selected() ? 2.4 : 2.0);
            gc.strokeRoundRect(point.x() - 42.0, point.y() - 18.0, 84.0, 36.0, 18.0, 18.0);
            gc.setFill(node.selected() ? partyShadow() : labelText());
            gc.fillText(abbreviateLabel(node.label(), 14), point.x(), point.y() + 4.0);
        }
        gc.setTextAlign(TextAlignment.LEFT);
        drawInfoPill(gc, "Graph · " + model.graphNodes().size() + " rooms", 12.0, height() - 36.0);
    }

    private void fillBackground(GraphicsContext gc) {
        gc.setFill(background());
        gc.fillRect(0.0, 0.0, width(), height());
    }

    private void drawGrid(GraphicsContext gc) {
        for (int index = 0; index < GRID_STEPS.length; index++) {
            int gridStep = GRID_STEPS[index];
            double pixelSpacing = gridSize() * gridStep;
            if (pixelSpacing >= 10.0) {
                drawGridTier(gc, pixelSpacing, gridColor(index), gridWidth(index));
            }
        }
    }

    private void drawGridTier(GraphicsContext gc, double spacing, Color stroke, double lineWidth) {
        gc.setStroke(stroke);
        gc.setLineWidth(lineWidth);
        double offsetX = normalizedOffset(panX, spacing);
        double offsetY = normalizedOffset(panY, spacing);
        for (double x = offsetX; x <= width(); x += spacing) {
            if (worldLineIndex(x, panX, spacing) != 0) {
                gc.strokeLine(x, 0.0, x, height());
            }
        }
        for (double y = offsetY; y <= height(); y += spacing) {
            if (worldLineIndex(y, panY, spacing) != 0) {
                gc.strokeLine(0.0, y, width(), y);
            }
        }
    }

    private void drawCells(GraphicsContext gc, DungeonMapDisplayModel model, boolean includeOverlay) {
        for (DungeonMapDisplayModel.RenderCell cell : model.cells()) {
            boolean overlay = cell.z() != model.projectionLevel();
            if (overlay && (!includeOverlay || !includeOverlayLevel(model, cell.z()))) {
                continue;
            }
            double x = worldToScreenX(cell.q());
            double y = worldToScreenY(cell.r());
            double size = gridSize();
            if (x + size < -8.0 || y + size < -8.0 || x > width() + 8.0 || y > height() + 8.0) {
                continue;
            }
            gc.save();
            if (overlay) {
                gc.setGlobalAlpha(overlayAlpha(cell.z(), model.projectionLevel(), model.overlaySettings().opacity()));
            } else if (cell.preview()) {
                gc.setGlobalAlpha(0.58);
            }
            gc.setFill(fillFor(cell, model.projectionLevel()));
            gc.fillRect(x, y, size, size);
            gc.setStroke(strokeFor(cell, model.projectionLevel()));
            gc.setLineWidth(cell.selected() ? 2.4 : 1.0);
            gc.strokeRect(x, y, size, size);
            gc.restore();
        }
    }

    private void drawEdges(GraphicsContext gc, DungeonMapDisplayModel model, boolean includeOverlay) {
        for (DungeonMapDisplayModel.RenderEdge edge : model.edges()) {
            boolean overlay = edge.z() != model.projectionLevel();
            if (overlay && (!includeOverlay || !includeOverlayLevel(model, edge.z()))) {
                continue;
            }
            gc.save();
            if (overlay) {
                gc.setGlobalAlpha(overlayAlpha(edge.z(), model.projectionLevel(), model.overlaySettings().opacity()));
            } else if (edge.preview()) {
                gc.setGlobalAlpha(0.72);
                gc.setLineDashes(8.0, 5.0);
            }
            gc.setStroke(edge.preview()
                    ? previewStroke()
                    : edge.kind() == DungeonMapDisplayModel.EdgeKind.DOOR
                            ? doorStroke()
                            : edge.selected() ? highlightStroke() : wallStroke());
            gc.setLineWidth(edge.preview()
                    ? 2.6
                    : edge.kind() == DungeonMapDisplayModel.EdgeKind.DOOR ? 3.6 : edge.selected() ? 2.8 : 2.0);
            gc.strokeLine(worldToScreenX(edge.startQ()), worldToScreenY(edge.startR()),
                    worldToScreenX(edge.endQ()), worldToScreenY(edge.endR()));
            gc.restore();
        }
    }

    private void drawMarkers(GraphicsContext gc, DungeonMapDisplayModel model, boolean includeOverlay) {
        gc.setTextAlign(TextAlignment.CENTER);
        for (DungeonMapDisplayModel.RenderMarker marker : model.markers()) {
            boolean overlay = marker.z() != model.projectionLevel();
            if (overlay && (!includeOverlay || !includeOverlayLevel(model, marker.z()))) {
                continue;
            }
            double cx = worldToScreenX(marker.q());
            double cy = worldToScreenY(marker.r());
            double radius = marker.kind() == DungeonMapDisplayModel.MarkerKind.DOOR ? 10.0 : 12.0;
            gc.save();
            if (overlay) {
                gc.setGlobalAlpha(overlayAlpha(marker.z(), model.projectionLevel(), model.overlaySettings().opacity()));
            } else if (marker.preview()) {
                gc.setGlobalAlpha(0.72);
            }
            gc.setFill(marker.preview() ? previewFill() : markerFill(marker));
            gc.fillRoundRect(cx - radius, cy - radius, radius * 2.0, radius * 2.0, 10.0, 10.0);
            gc.setStroke(marker.preview() ? previewStroke() : marker.selected() ? highlightStroke() : markerStroke(marker));
            gc.setLineWidth(marker.selected() ? 2.2 : 1.4);
            gc.strokeRoundRect(cx - radius, cy - radius, radius * 2.0, radius * 2.0, 10.0, 10.0);
            gc.setFill(labelText());
            gc.fillText(marker.label(), cx, cy + 4.0);
            gc.restore();
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private void drawLabels(GraphicsContext gc, DungeonMapDisplayModel model, boolean includeOverlay) {
        if (gridSize() < 18.0) {
            return;
        }
        gc.setTextAlign(TextAlignment.CENTER);
        for (DungeonMapDisplayModel.RenderLabel label : model.labels()) {
            if (!visibleLabel(model, includeOverlay, label)) {
                continue;
            }
            drawLabel(gc, model, label);
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private boolean visibleLabel(
            DungeonMapDisplayModel model,
            boolean includeOverlay,
            DungeonMapDisplayModel.RenderLabel label
    ) {
        boolean overlay = label.z() != model.projectionLevel();
        return !label.label().isBlank()
                && (!overlay || (includeOverlay && includeOverlayLevel(model, label.z())));
    }

    private void drawLabel(
            GraphicsContext gc,
            DungeonMapDisplayModel model,
            DungeonMapDisplayModel.RenderLabel label
    ) {
        double width = Math.max(56.0, Math.min(180.0, label.label().length() * 7.2 + 16.0));
        double x = worldToScreenX(label.q()) - width / 2.0;
        double y = worldToScreenY(label.r()) - 12.0;
        if (x + width < 0.0 || x > width() || y + 24.0 < 0.0 || y > height()) {
            return;
        }
        gc.save();
        applyLabelAlpha(gc, model, label);
        gc.setFill(label.preview() ? previewFill() : labelFill());
        gc.fillRoundRect(x, y, width, 24.0, 14.0, 14.0);
        gc.setStroke(label.preview() ? previewStroke() : label.selected() ? highlightStroke() : labelBorder());
        gc.setLineWidth(label.selected() ? 2.0 : 1.0);
        gc.strokeRoundRect(x, y, width, 24.0, 14.0, 14.0);
        gc.setFill(labelText());
        gc.fillText(label.label(), x + width / 2.0, y + 16.5);
        gc.restore();
    }

    private void applyLabelAlpha(
            GraphicsContext gc,
            DungeonMapDisplayModel model,
            DungeonMapDisplayModel.RenderLabel label
    ) {
        boolean overlay = label.z() != model.projectionLevel();
        if (overlay) {
            gc.setGlobalAlpha(overlayAlpha(label.z(), model.projectionLevel(), model.overlaySettings().opacity()));
        } else if (label.preview()) {
            gc.setGlobalAlpha(0.76);
        }
    }

    private void drawPartyToken(GraphicsContext gc, DungeonMapDisplayModel model) {
        DungeonMapDisplayModel.PartyToken token = model.partyToken();
        if (token == null || !token.visible() || token.z() != model.projectionLevel()) {
            return;
        }
        double cx = worldToScreenX(token.q());
        double cy = worldToScreenY(token.r());
        double outerRadius = Math.max(7.5, gridSize() * 0.26);
        double innerRadius = Math.max(3.2, outerRadius * 0.42);
        double forwardX = token.heading().dx();
        double forwardY = token.heading().dy();
        double sideX = -forwardY;
        double sideY = forwardX;
        double[] shapeX = {
                cx + forwardX * outerRadius * 1.18,
                cx + forwardX * outerRadius * 0.54 + sideX * outerRadius * 0.76,
                cx - forwardX * outerRadius * 0.92 + sideX * outerRadius * 0.92,
                cx - forwardX * outerRadius * 1.02,
                cx - forwardX * outerRadius * 0.92 - sideX * outerRadius * 0.92,
                cx + forwardX * outerRadius * 0.54 - sideX * outerRadius * 0.76
        };
        double[] shapeY = {
                cy + forwardY * outerRadius * 1.18,
                cy + forwardY * outerRadius * 0.54 + sideY * outerRadius * 0.76,
                cy - forwardY * outerRadius * 0.92 + sideY * outerRadius * 0.92,
                cy - forwardY * outerRadius * 1.02,
                cy - forwardY * outerRadius * 0.92 - sideY * outerRadius * 0.92,
                cy + forwardY * outerRadius * 0.54 - sideY * outerRadius * 0.76
        };
        double[] shadowX = new double[shapeX.length];
        double[] shadowY = new double[shapeY.length];
        for (int index = 0; index < shapeX.length; index++) {
            shadowX[index] = shapeX[index] - 1.5;
            shadowY[index] = shapeY[index] + 1.5;
        }
        gc.setFill(partyShadow());
        gc.fillPolygon(shadowX, shadowY, shadowX.length);
        gc.setFill(partyFill());
        gc.fillPolygon(shapeX, shapeY, shapeX.length);
        gc.setStroke(partyStroke());
        gc.setLineWidth(2.2);
        gc.strokePolygon(shapeX, shapeY, shapeX.length);
        gc.setFill(partyStroke());
        gc.fillOval(cx - innerRadius, cy - innerRadius, innerRadius * 2.0, innerRadius * 2.0);
    }

    private void drawAxes(GraphicsContext gc) {
        gc.setStroke(axis());
        gc.setLineWidth(2.6);
        if (panX >= -gridSize() && panX <= width() + gridSize()) {
            gc.strokeLine(panX, 0.0, panX, height());
        }
        if (panY >= -gridSize() && panY <= height() + gridSize()) {
            gc.strokeLine(0.0, panY, width(), panY);
        }
    }

    private void drawInfoPill(GraphicsContext gc, String text, double x, double y) {
        if (text == null || text.isBlank()) {
            return;
        }
        double labelWidth = infoPillWidth(text);
        gc.setFill(labelFill());
        gc.fillRoundRect(x, y, labelWidth, 24.0, 14.0, 14.0);
        gc.setStroke(labelBorder());
        gc.setLineWidth(1.0);
        gc.strokeRoundRect(x, y, labelWidth, 24.0, 14.0, 14.0);
        gc.setFill(labelText());
        gc.setTextAlign(TextAlignment.LEFT);
        gc.fillText(text, x + 8.0, y + 16.5);
    }

    private Color fillFor(DungeonMapDisplayModel.RenderCell cell, int projectionLevel) {
        if (cell.preview()) {
            return cell.destructivePreview() ? color(0x99, 0x43, 0x3d, 0.62) : previewFill();
        }
        if (cell.z() != projectionLevel) {
            return blend(cell.z() > projectionLevel ? roomFill() : corridorFill(),
                    cell.z() > projectionLevel ? aboveTint() : belowTint(),
                    0.56);
        }
        if (cell.selected()) {
            return selectedFill();
        }
        return switch (cell.kind()) {
            case ROOM -> roomFill();
            case CORRIDOR -> corridorFill();
            case STAIR -> stairFill();
            case TRANSITION -> transitionFill();
        };
    }

    private Color strokeFor(DungeonMapDisplayModel.RenderCell cell, int projectionLevel) {
        if (cell.preview()) {
            return cell.destructivePreview() ? color(0xff, 0xc1, 0x87, 1.0) : previewStroke();
        }
        if (cell.z() != projectionLevel) {
            return blend(roomStroke(), cell.z() > projectionLevel ? aboveTint() : belowTint(), 0.62);
        }
        if (cell.selected()) {
            return selectedStroke();
        }
        return switch (cell.kind()) {
            case ROOM -> roomStroke();
            case CORRIDOR, STAIR -> corridorStroke();
            case TRANSITION -> transitionStroke();
        };
    }

    private Color markerFill(DungeonMapDisplayModel.RenderMarker marker) {
        return switch (marker.kind()) {
            case DOOR -> labelFill();
            case STAIR -> stairFill();
            case TRANSITION -> transitionFill();
            case WAYPOINT -> previewFill();
            case CLUSTER -> labelFill();
        };
    }

    private Color markerStroke(DungeonMapDisplayModel.RenderMarker marker) {
        return switch (marker.kind()) {
            case DOOR -> doorStroke();
            case STAIR -> corridorStroke();
            case TRANSITION -> transitionStroke();
            case WAYPOINT -> previewStroke();
            case CLUSTER -> labelBorder();
        };
    }

    private Map<Long, GraphPoint> graphPoints(DungeonMapDisplayModel model) {
        Map<Long, GraphPoint> points = new LinkedHashMap<>();
        int count = Math.max(model.graphNodes().size(), 1);
        double radius = 130.0 * zoom;
        double centerX = width() / 2.0 + panX;
        double centerY = height() / 2.0 + panY;
        for (int index = 0; index < model.graphNodes().size(); index++) {
            DungeonMapDisplayModel.GraphNode node = model.graphNodes().get(index);
            double angle = (-Math.PI / 2.0) + (Math.PI * 2.0 * index / count);
            points.put(node.id(), new GraphPoint(
                    centerX + Math.cos(angle) * radius,
                    centerY + Math.sin(angle) * radius));
        }
        return points;
    }

    private void renderOverlayMessage(DungeonMapDisplayModel model) {
        overlayMessage.getStyleClass().removeAll("dungeon-map-overlay-placeholder", "dungeon-map-overlay-note");
        overlayMessage.getStyleClass().add(model.mapLoaded() ? "dungeon-map-overlay-note" : "dungeon-map-overlay-placeholder");
        overlayMessage.setText(model.overlayMessage());
        overlayMessage.setVisible(!model.overlayMessage().isBlank());
        overlayMessage.setManaged(!model.overlayMessage().isBlank());
    }

    private double width() {
        return canvas.getWidth() > 1.0 ? canvas.getWidth() : DEFAULT_WIDTH;
    }

    private double height() {
        return canvas.getHeight() > 1.0 ? canvas.getHeight() : DEFAULT_HEIGHT;
    }

    private double gridSize() {
        return BASE_GRID * zoom;
    }

    private double worldToScreenX(double worldX) {
        return panX + worldX * gridSize();
    }

    private double worldToScreenY(double worldY) {
        return panY + worldY * gridSize();
    }

    private double screenToWorldX(double screenX) {
        return (screenX - panX) / gridSize();
    }

    private double screenToWorldY(double screenY) {
        return (screenY - panY) / gridSize();
    }

    private double normalizedOffset(double pan, double spacing) {
        double offset = pan % spacing;
        return offset < 0.0 ? offset + spacing : offset;
    }

    private int worldLineIndex(double canvasCoordinate, double pan, double spacing) {
        return (int) Math.round((canvasCoordinate - pan) / spacing);
    }

    private Color gridColor(int tier) {
        return switch (tier) {
            case 0 -> gridMinor();
            case 1 -> gridMedium();
            case 2 -> gridMajor();
            default -> gridMax();
        };
    }

    private double gridWidth(int tier) {
        return switch (tier) {
            case 0 -> 0.9;
            case 1 -> 1.05;
            case 2 -> 1.4;
            default -> 1.8;
        };
    }

    private boolean includeOverlayLevel(DungeonMapDisplayModel model, int level) {
        DungeonMapDisplayModel.LevelOverlaySettings settings = model.overlaySettings();
        return switch (settings.mode()) {
            case OFF -> false;
            case NEARBY -> Math.abs(level - model.projectionLevel()) <= settings.levelRange();
            case SELECTED -> settings.selectedLevels().contains(level);
        };
    }

    private double overlayAlpha(int z, int projectionLevel, double configuredOpacity) {
        int distance = Math.max(1, Math.abs(z - projectionLevel));
        return Math.max(0.05, Math.min(0.95, configuredOpacity / Math.sqrt(distance)));
    }

    private double infoPillWidth(String text) {
        return (text == null ? 0 : text.length()) * 7.2 + 16.0;
    }

    private String abbreviateLabel(String label, int maxLength) {
        if (label == null || label.length() <= maxLength) {
            return label == null ? "" : label;
        }
        return label.substring(0, Math.max(1, maxLength - 1)) + ".";
    }

    private Color background() {
        return color(0x12, 0x18, 0x1c, 1.0);
    }

    private Color gridMinor() {
        return color(0x66, 0x77, 0x82, 0.18);
    }

    private Color gridMedium() {
        return color(0x73, 0x83, 0x90, 0.16);
    }

    private Color gridMajor() {
        return color(0x8d, 0x9c, 0xa8, 0.22);
    }

    private Color gridMax() {
        return color(0xb1, 0xbc, 0xc5, 0.28);
    }

    private Color axis() {
        return color(0xc5, 0xd1, 0xd8, 0.32);
    }

    private Color roomFill() {
        return color(0x2a, 0x32, 0x38, 1.0);
    }

    private Color roomStroke() {
        return color(0x8a, 0x6a, 0x35, 1.0);
    }

    private Color wallStroke() {
        return color(0x8a, 0x6a, 0x35, 1.0);
    }

    private Color highlightStroke() {
        return color(0xf1, 0xd3, 0x8a, 1.0);
    }

    private Color corridorFill() {
        return color(0x3b, 0x50, 0x53, 0.8);
    }

    private Color corridorStroke() {
        return color(0x91, 0xb6, 0xb0, 1.0);
    }

    private Color selectedFill() {
        return color(0x58, 0x70, 0x6e, 0.95);
    }

    private Color selectedStroke() {
        return color(0xd7, 0xec, 0xe7, 1.0);
    }

    private Color previewFill() {
        return color(0xd7, 0xec, 0xe7, 0.72);
    }

    private Color previewStroke() {
        return color(0xf1, 0xd3, 0x8a, 1.0);
    }

    private Color partyFill() {
        return color(0xff, 0xb6, 0x2a, 1.0);
    }

    private Color partyStroke() {
        return color(0xff, 0xf0, 0xc6, 1.0);
    }

    private Color partyShadow() {
        return color(0x12, 0x0f, 0x08, 0.8);
    }

    private Color labelFill() {
        return color(0x18, 0x1f, 0x24, 1.0);
    }

    private Color labelBorder() {
        return color(0x8a, 0x6a, 0x35, 1.0);
    }

    private Color labelText() {
        return color(0xec, 0xed, 0xee, 1.0);
    }

    private Color aboveTint() {
        return color(0x7c, 0xc8, 0xf4, 1.0);
    }

    private Color belowTint() {
        return color(0xd6, 0xa5, 0x65, 1.0);
    }

    private Color doorStroke() {
        return color(0xe5, 0xc0, 0x6f, 1.0);
    }

    private Color graphLink() {
        return color(0x56, 0x63, 0x6c, 1.0);
    }

    private Color graphNodeFill() {
        return color(0x2f, 0x3a, 0x41, 1.0);
    }

    private Color stairFill() {
        return color(0x3b, 0x50, 0x53, 0.95);
    }

    private Color transitionFill() {
        return color(0x58, 0x7f, 0x9a, 0.95);
    }

    private Color transitionStroke() {
        return color(0xac, 0xc7, 0xd8, 1.0);
    }

    private Color blend(Color base, Color tint, double tintRatio) {
        double ratio = Math.max(0.0, Math.min(1.0, tintRatio));
        double baseRatio = 1.0 - ratio;
        return new Color(
                base.getRed() * baseRatio + tint.getRed() * ratio,
                base.getGreen() * baseRatio + tint.getGreen() * ratio,
                base.getBlue() * baseRatio + tint.getBlue() * ratio,
                base.getOpacity());
    }

    private Color color(int red, int green, int blue, double opacity) {
        return new Color(red / 255.0, green / 255.0, blue / 255.0, opacity);
    }

    private record GraphPoint(double x, double y) {
    }

    private record SimpleCell(int q, int r, int z) {
    }

    public enum DungeonMapHitKind {
        EMPTY,
        HANDLE,
        LABEL,
        ROOM,
        CORRIDOR,
        STAIR,
        TRANSITION
    }

    public record DungeonMapHitTarget(
            DungeonMapHitKind kind,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            String label,
            String handleKind,
            long handleCorridorId,
            long handleRoomId,
            int handleIndex,
            int handleQ,
            int handleR,
            int handleLevel,
            String handleDirection
    ) {

        public DungeonMapHitTarget(
                DungeonMapHitKind kind,
                long ownerId,
                long clusterId,
                String topologyRefKind,
                long topologyRefId,
                String label
        ) {
            this(kind, ownerId, clusterId, topologyRefKind, topologyRefId, label,
                    "CLUSTER_LABEL", 0L, ownerId, 0, 0, 0, 0, "");
        }

        public DungeonMapHitTarget {
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind;
            topologyRefId = Math.max(0L, topologyRefId);
            label = label == null ? "" : label;
            handleKind = handleKind == null || handleKind.isBlank() ? "CLUSTER_LABEL" : handleKind;
            handleCorridorId = Math.max(0L, handleCorridorId);
            handleRoomId = Math.max(0L, handleRoomId);
            handleDirection = handleDirection == null ? "" : handleDirection;
        }

        public static DungeonMapHitTarget empty() {
            return new DungeonMapHitTarget(DungeonMapHitKind.EMPTY, 0L, 0L, "EMPTY", 0L, "");
        }
    }

    public record DungeonMapPointerEvent(
            int q,
            int r,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            DungeonMapHitTarget hitTarget,
            DungeonMapVertexTarget vertexTarget,
            DungeonMapBoundaryTarget boundaryTarget
    ) {
        public DungeonMapPointerEvent(
                int q,
                int r,
                int level,
                boolean primaryButtonDown,
                DungeonMapHitTarget hitTarget
        ) {
            this(
                    q,
                    r,
                    level,
                    primaryButtonDown,
                    false,
                    hitTarget,
                    DungeonMapVertexTarget.empty(),
                    DungeonMapBoundaryTarget.empty());
        }
    }

    public record DungeonMapVertexTarget(
            boolean present,
            int q,
            int r,
            int level
    ) {
        public static DungeonMapVertexTarget empty() {
            return new DungeonMapVertexTarget(false, 0, 0, 0);
        }
    }

    public record DungeonMapBoundaryTarget(
            boolean present,
            String kind,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            int startQ,
            int startR,
            int endQ,
            int endR,
            int level
    ) {
        public DungeonMapBoundaryTarget {
            kind = kind == null || kind.isBlank() ? "WALL" : kind;
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind;
            topologyRefId = Math.max(0L, topologyRefId);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
        }

        public static DungeonMapBoundaryTarget empty() {
            return new DungeonMapBoundaryTarget(false, "WALL", 0L, 0L, "EMPTY", 0L, 0, 0, 0, 0, 0);
        }
    }
}
