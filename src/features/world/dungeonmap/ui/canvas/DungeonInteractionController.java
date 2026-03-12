package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.BrushShape;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonWall;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.controls.WallEditorMode;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.MouseButton;
import javafx.scene.paint.Color;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.function.Consumer;
import java.util.function.Supplier;

final class DungeonInteractionController {

    private static final Color HOVER_PAINT_FILL = Color.web("#d9a030", 0.35);
    private static final Color HOVER_ERASE_FILL = Color.web("#e53935", 0.35);
    private static final Color HOVER_EDGE_STROKE = Color.web("#d9a030", 0.70);
    private static final Color HOVER_EDGE_ERASE_STROKE = Color.web("#e53935", 0.75);
    private static final double WALL_VERTEX_SNAP_RATIO = 0.35;

    private final Canvas selectionCanvas;
    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;
    private final Runnable redrawAll;
    private Runnable redrawSelection;

    private DungeonEditorTool activeTool = DungeonEditorTool.SELECT;
    private String lastDraggedCellKey;
    private String lastDraggedEdgeKey;
    private int hoverCellX = -1;
    private int hoverCellY = -1;
    private int hoverEdgeX = -1;
    private int hoverEdgeY = -1;
    private PassageDirection hoverEdgeDir;
    private int hoverVertexX = -1;
    private int hoverVertexY = -1;
    private Supplier<Integer> brushSizeSupplier;
    private Supplier<BrushShape> brushShapeSupplier;
    private Supplier<WallEditorMode> wallEditorModeSupplier;
    private Consumer<DungeonMapPane.CellInteraction> onCellClicked;
    private Consumer<DungeonMapPane.CellInteraction> onCellPainted;
    private Runnable onPaintStrokeFinished;
    private Consumer<DungeonMapPane.EdgeInteraction> onEdgeClicked;
    private Consumer<DungeonMapPane.EdgeInteraction> onEdgePainted;
    private Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathPreview;
    private Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathFinished;
    private Runnable onEdgeStrokeFinished;
    private VertexRef activeWallPaintStart;
    private List<DungeonMapPane.EdgeInteraction> activeWallPaintPath = List.of();

    DungeonInteractionController(
            Canvas selectionCanvas,
            DungeonCanvasModel model,
            DungeonViewport viewport,
            Runnable redrawAll
    ) {
        this.selectionCanvas = selectionCanvas;
        this.model = model;
        this.viewport = viewport;
        this.redrawAll = redrawAll;
        bind();
    }

    void setRedrawSelection(Runnable redrawSelection) {
        this.redrawSelection = redrawSelection;
    }

    void setActiveTool(DungeonEditorTool activeTool) {
        this.activeTool = activeTool == null ? DungeonEditorTool.SELECT : activeTool;
        lastDraggedCellKey = null;
        lastDraggedEdgeKey = null;
        clearActiveWallPaintPath();
        if (this.activeTool.isBrushTool()) {
            drawHover();
        } else {
            clearHover();
        }
        if (edgeHoverEnabled()) {
            drawEdgeHover();
        } else {
            clearEdgeHover();
        }
        updateCursor();
    }

    void setOnEdgeClicked(Consumer<DungeonMapPane.EdgeInteraction> onEdgeClicked) {
        this.onEdgeClicked = onEdgeClicked;
    }

    void setBrushSizeSupplier(Supplier<Integer> supplier) {
        this.brushSizeSupplier = supplier;
    }

    void setBrushShapeSupplier(Supplier<BrushShape> supplier) {
        this.brushShapeSupplier = supplier;
    }

    void setWallEditorModeSupplier(Supplier<WallEditorMode> supplier) {
        this.wallEditorModeSupplier = supplier;
    }

    void setOnCellClicked(Consumer<DungeonMapPane.CellInteraction> onCellClicked) {
        this.onCellClicked = onCellClicked;
    }

    void setOnCellPainted(Consumer<DungeonMapPane.CellInteraction> onCellPainted) {
        this.onCellPainted = onCellPainted;
    }

    void setOnPaintStrokeFinished(Runnable onPaintStrokeFinished) {
        this.onPaintStrokeFinished = onPaintStrokeFinished;
    }

    void setOnEdgePainted(Consumer<DungeonMapPane.EdgeInteraction> onEdgePainted) {
        this.onEdgePainted = onEdgePainted;
    }

    void setOnEdgePaintPathPreview(Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathPreview) {
        this.onEdgePaintPathPreview = onEdgePaintPathPreview;
    }

    void setOnEdgePaintPathFinished(Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathFinished) {
        this.onEdgePaintPathFinished = onEdgePaintPathFinished;
    }

    void setOnEdgeStrokeFinished(Runnable onEdgeStrokeFinished) {
        this.onEdgeStrokeFinished = onEdgeStrokeFinished;
    }

    private void bind() {
        selectionCanvas.setOnScroll(event -> {
            viewport.zoomAt(event.getX(), event.getY(), event.getDeltaY());
            redrawAll.run();
            event.consume();
        });
        selectionCanvas.setOnMousePressed(event -> {
            if (event.getButton() == MouseButton.SECONDARY) {
                viewport.startPan(event.getX(), event.getY());
                return;
            }
            if (event.getButton() == MouseButton.PRIMARY && activeTool.isBrushTool()) {
                handlePaintAt(event.getX(), event.getY());
            } else if (event.getButton() == MouseButton.PRIMARY && isWallPaintPathMode()) {
                beginWallPaintPath(event.getX(), event.getY());
            } else if (event.getButton() == MouseButton.PRIMARY && usesWallEraseBrush()) {
                handleEdgeEraseAt(event.getX(), event.getY());
            }
        });
        selectionCanvas.setOnMouseDragged(event -> {
            if (viewport.isPanning()) {
                viewport.panTo(event.getX(), event.getY());
                clearHover();
                redrawAll.run();
                return;
            }
            if (activeTool.isBrushTool() && event.isPrimaryButtonDown()) {
                handlePaintAt(event.getX(), event.getY());
            }
            if (isWallPaintPathMode() && event.isPrimaryButtonDown()) {
                updateWallPaintPath(event.getX(), event.getY());
            } else if (usesWallEraseBrush() && event.isPrimaryButtonDown()) {
                handleEdgeEraseAt(event.getX(), event.getY());
            }
            if (activeTool.isBrushTool()) {
                updateHover(event.getX(), event.getY());
            } else if (edgeHoverEnabled()) {
                updateEdgeHover(event.getX(), event.getY());
            }
        });
        selectionCanvas.setOnMouseReleased(event -> {
            viewport.endPan();
            lastDraggedCellKey = null;
            lastDraggedEdgeKey = null;
            if (activeTool.isBrushTool() && event.getButton() == MouseButton.PRIMARY && onPaintStrokeFinished != null) {
                onPaintStrokeFinished.run();
            }
            if (event.getButton() == MouseButton.PRIMARY && isWallPaintPathMode()) {
                finishWallPaintPath();
                if (onEdgeStrokeFinished != null) {
                    onEdgeStrokeFinished.run();
                }
            } else if (event.getButton() == MouseButton.PRIMARY && usesWallEraseBrush() && onEdgeStrokeFinished != null) {
                onEdgeStrokeFinished.run();
            }
        });
        selectionCanvas.setOnMouseMoved(event -> {
            if (activeTool.isBrushTool()) {
                updateHover(event.getX(), event.getY());
            } else if (edgeHoverEnabled()) {
                updateEdgeHover(event.getX(), event.getY());
            }
        });
        selectionCanvas.setOnMouseExited(event -> {
            if (activeTool.isBrushTool()) {
                clearHover();
            } else if (edgeHoverEnabled()) {
                clearEdgeHover();
            }
        });
        selectionCanvas.setOnMouseClicked(event -> {
            if (event.getButton() != MouseButton.PRIMARY || !event.isStillSincePress()) {
                return;
            }
            if (activeTool == DungeonEditorTool.PASSAGE && currentWallEditorMode().placesPassages()) {
                handleEdgeClick(event.getX(), event.getY());
                return;
            }
            if (activeTool == DungeonEditorTool.PASSAGE && !currentWallEditorMode().placesPassages()) {
                return;
            }
            if (activeTool.isBrushTool()) {
                return;
            }
            DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, event.getX(), event.getY());
            if (interaction != null && onCellClicked != null) {
                onCellClicked.accept(interaction);
            }
        });
    }

    private void beginWallPaintPath(double screenX, double screenY) {
        VertexRef vertex = findPaintVertexAt(screenX, screenY);
        if (vertex == null) {
            clearActiveWallPaintPath();
            return;
        }
        activeWallPaintStart = vertex;
        activeWallPaintPath = List.of();
        if (onEdgePaintPathPreview != null) {
            onEdgePaintPathPreview.accept(List.of());
        }
    }

    private void updateWallPaintPath(double screenX, double screenY) {
        if (activeWallPaintStart == null) {
            return;
        }
        VertexRef target = findPaintVertexAt(screenX, screenY);
        if (target == null) {
            activeWallPaintPath = List.of();
            if (onEdgePaintPathPreview != null) {
                onEdgePaintPathPreview.accept(List.of());
            }
            return;
        }
        List<DungeonMapPane.EdgeInteraction> path = findWallPaintPath(activeWallPaintStart, target);
        activeWallPaintPath = path;
        if (onEdgePaintPathPreview != null) {
            onEdgePaintPathPreview.accept(path);
        }
    }

    private void finishWallPaintPath() {
        List<DungeonMapPane.EdgeInteraction> finishedPath = activeWallPaintPath;
        clearActiveWallPaintPath();
        if (!finishedPath.isEmpty() && onEdgePaintPathFinished != null) {
            onEdgePaintPathFinished.accept(finishedPath);
        }
    }

    private void clearActiveWallPaintPath() {
        activeWallPaintStart = null;
        activeWallPaintPath = List.of();
        if (onEdgePaintPathPreview != null) {
            onEdgePaintPathPreview.accept(List.of());
        }
    }

    private void handleEdgeEraseAt(double screenX, double screenY) {
        DungeonMapPane.EdgeInteraction interaction = interactionAt(screenX, screenY, true);
        if (interaction == null || onEdgePainted == null) {
            return;
        }
        String edgeKey = interaction.direction().edgeKey(interaction.x(), interaction.y());
        if (edgeKey.equals(lastDraggedEdgeKey)) {
            return;
        }
        lastDraggedEdgeKey = edgeKey;
        onEdgePainted.accept(interaction);
    }

    private void handlePaintAt(double screenX, double screenY) {
        DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, screenX, screenY);
        if (interaction == null || onCellPainted == null) {
            return;
        }
        int size = currentBrushSize();
        int radius = size - 1;
        if (radius == 0) {
            String cellKey = interaction.x() + ":" + interaction.y();
            if (!cellKey.equals(lastDraggedCellKey)) {
                lastDraggedCellKey = cellKey;
                onCellPainted.accept(interaction);
            }
        } else {
            BrushShape shape = currentBrushShape();
            for (int dy = -radius; dy <= radius; dy++) {
                for (int dx = -radius; dx <= radius; dx++) {
                    if (!inShape(shape, dx, dy, radius)) {
                        continue;
                    }
                    DungeonMapPane.CellInteraction shifted =
                            model.interactionAt(
                                    viewport,
                                    viewport.screenCenterX(interaction.x() + dx),
                                    viewport.screenCenterY(interaction.y() + dy));
                    if (shifted != null) {
                        onCellPainted.accept(shifted);
                    }
                }
            }
            lastDraggedCellKey = interaction.x() + ":" + interaction.y();
        }
    }

    private void updateHover(double screenX, double screenY) {
        DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, screenX, screenY);
        int newX = interaction == null ? -1 : interaction.x();
        int newY = interaction == null ? -1 : interaction.y();
        if (newX == hoverCellX && newY == hoverCellY) {
            return;
        }
        hoverCellX = newX;
        hoverCellY = newY;
        drawHover();
    }

    private void clearHover() {
        hoverCellX = -1;
        hoverCellY = -1;
        drawHover();
    }

    private void drawHover() {
        GraphicsContext gc = selectionCanvas.getGraphicsContext2D();
        gc.clearRect(0, 0, selectionCanvas.getWidth(), selectionCanvas.getHeight());
        if (redrawSelection != null) {
            redrawSelection.run();
        }
        if (hoverCellX < 0 || hoverCellY < 0) {
            return;
        }
        Color fill = activeTool == DungeonEditorTool.ERASE ? HOVER_ERASE_FILL : HOVER_PAINT_FILL;
        gc.setFill(fill);
        int size = currentBrushSize();
        int radius = size - 1;
        double cellSize = viewport.scaledCellSize();
        BrushShape shape = currentBrushShape();
        for (int dy = -radius; dy <= radius; dy++) {
            for (int dx = -radius; dx <= radius; dx++) {
                if (!inShape(shape, dx, dy, radius)) {
                    continue;
                }
                int cx = hoverCellX + dx;
                int cy = hoverCellY + dy;
                if (model.interactionAt(viewport, viewport.screenCenterX(cx), viewport.screenCenterY(cy)) != null) {
                    gc.fillRect(viewport.screenX(cx), viewport.screenY(cy), cellSize - 1, cellSize - 1);
                }
            }
        }
    }

    private void updateEdgeHover(double screenX, double screenY) {
        if (isWallPaintPathMode()) {
            VertexRef vertex = findPaintVertexAt(screenX, screenY);
            int newVertexX = vertex == null ? -1 : vertex.x();
            int newVertexY = vertex == null ? -1 : vertex.y();
            if (newVertexX == hoverVertexX && newVertexY == hoverVertexY) {
                return;
            }
            hoverVertexX = newVertexX;
            hoverVertexY = newVertexY;
            hoverEdgeX = -1;
            hoverEdgeY = -1;
            hoverEdgeDir = null;
            drawEdgeHover();
            return;
        }
        hoverVertexX = -1;
        hoverVertexY = -1;
        DungeonMapPane.EdgeInteraction interaction = interactionAt(screenX, screenY, isWallStrokeMode());
        int newX = interaction == null ? -1 : interaction.x();
        int newY = interaction == null ? -1 : interaction.y();
        PassageDirection newDir = interaction == null ? null : interaction.direction();
        if (newX == hoverEdgeX && newY == hoverEdgeY && newDir == hoverEdgeDir) {
            return;
        }
        hoverEdgeX = newX;
        hoverEdgeY = newY;
        hoverEdgeDir = newDir;
        drawEdgeHover();
    }

    private void clearEdgeHover() {
        hoverEdgeX = -1;
        hoverEdgeY = -1;
        hoverEdgeDir = null;
        hoverVertexX = -1;
        hoverVertexY = -1;
        drawEdgeHover();
    }

    private void drawEdgeHover() {
        GraphicsContext gc = selectionCanvas.getGraphicsContext2D();
        gc.clearRect(0, 0, selectionCanvas.getWidth(), selectionCanvas.getHeight());
        if (redrawSelection != null) {
            redrawSelection.run();
        }
        if (isWallPaintPathMode() && hoverVertexX >= 0 && hoverVertexY >= 0) {
            gc.setFill(HOVER_EDGE_STROKE);
            double radius = Math.max(4.0, 5.0 * viewport.strokeScale());
            double centerX = viewport.screenX(hoverVertexX);
            double centerY = viewport.screenY(hoverVertexY);
            gc.fillOval(centerX - radius, centerY - radius, radius * 2.0, radius * 2.0);
            return;
        }
        if (hoverEdgeX < 0 || hoverEdgeDir == null) {
            return;
        }
        gc.setStroke(currentWallEditorMode().erasesWalls() ? HOVER_EDGE_ERASE_STROKE : HOVER_EDGE_STROKE);
        gc.setLineWidth(Math.max(3.0, 5.0 * viewport.strokeScale()));
        strokeEdge(gc, hoverEdgeX, hoverEdgeY, hoverEdgeDir);
    }

    private void handleEdgeClick(double screenX, double screenY) {
        DungeonMapPane.EdgeInteraction interaction = interactionAt(screenX, screenY, false);
        if (interaction == null || onEdgeClicked == null) {
            return;
        }
        onEdgeClicked.accept(interaction);
    }

    private DungeonMapPane.EdgeInteraction interactionAt(double screenX, double screenY, boolean strokeEditing) {
        int[] edge = findEdgeAt(screenX, screenY);
        if (edge == null) {
            return null;
        }
        PassageDirection dir = edge[2] == 0 ? PassageDirection.EAST : PassageDirection.SOUTH;
        String edgeKey = dir.edgeKey(edge[0], edge[1]);
        DungeonWall existingWall = model.wallsByEdge().get(edgeKey);
        DungeonPassage existingPassage = model.passagesByEdge().get(edgeKey);
        if (strokeEditing) {
            WallEditorMode mode = currentWallEditorMode();
            if (mode.paintsWalls() && !isPaintableWallEdge(edge[0], edge[1], dir)) {
                return null;
            }
            if (mode.erasesWalls() && existingWall == null) {
                return null;
            }
        } else if (currentWallEditorMode().placesPassages() && !isEditableEdge(edge[0], edge[1], dir)) {
            return null;
        }
        return new DungeonMapPane.EdgeInteraction(edge[0], edge[1], dir, existingWall, existingPassage);
    }

    private int[] findEdgeAt(double screenX, double screenY) {
        if (model.state() == null || model.state().map() == null) {
            return null;
        }
        double cellSize = viewport.scaledCellSize();
        double fx = (screenX - viewport.screenX(0)) / cellSize;
        double fy = (screenY - viewport.screenY(0)) / cellSize;
        int cx = (int) Math.floor(fx);
        int cy = (int) Math.floor(fy);
        double rx = fx - cx;
        double ry = fy - cy;

        int canonX;
        int canonY;
        PassageDirection dir;
        if (rx < ry && rx < 1.0 - ry) {
            canonX = cx - 1;
            canonY = cy;
            dir = PassageDirection.EAST;
        } else if (rx > ry && rx > 1.0 - ry) {
            canonX = cx;
            canonY = cy;
            dir = PassageDirection.EAST;
        } else if (ry < rx && ry < 1.0 - rx) {
            canonX = cx;
            canonY = cy - 1;
            dir = PassageDirection.SOUTH;
        } else {
            canonX = cx;
            canonY = cy;
            dir = PassageDirection.SOUTH;
        }

        if (!isEditableEdge(canonX, canonY, dir) && !isInteriorEdge(canonX, canonY, dir)) {
            return null;
        }
        return new int[]{canonX, canonY, dir == PassageDirection.EAST ? 0 : 1};
    }

    private VertexRef findPaintVertexAt(double screenX, double screenY) {
        if (model.state() == null || model.state().map() == null) {
            return null;
        }
        double cellSize = viewport.scaledCellSize();
        double fx = (screenX - viewport.screenX(0)) / cellSize;
        double fy = (screenY - viewport.screenY(0)) / cellSize;
        int baseX = (int) Math.floor(fx);
        int baseY = (int) Math.floor(fy);
        VertexRef best = null;
        double bestDistance = Double.MAX_VALUE;
        for (int dx = 0; dx <= 1; dx++) {
            for (int dy = 0; dy <= 1; dy++) {
                int vx = baseX + dx;
                int vy = baseY + dy;
                double vertexScreenX = viewport.screenX(vx);
                double vertexScreenY = viewport.screenY(vy);
                double distance = Math.hypot(screenX - vertexScreenX, screenY - vertexScreenY);
                if (distance < bestDistance) {
                    VertexRef candidate = new VertexRef(vx, vy);
                    if (isPaintVertex(candidate)) {
                        best = candidate;
                        bestDistance = distance;
                    }
                }
            }
        }
        if (best == null || bestDistance > cellSize * WALL_VERTEX_SNAP_RATIO) {
            return null;
        }
        return best;
    }

    private boolean isPaintVertex(VertexRef vertex) {
        return !neighboringPaintableEdges(vertex).isEmpty();
    }

    private List<DungeonMapPane.EdgeInteraction> findWallPaintPath(VertexRef start, VertexRef goal) {
        if (start == null || goal == null) {
            return List.of();
        }
        if (start.equals(goal)) {
            return List.of();
        }
        PriorityQueue<VertexPathNode> openSet = new PriorityQueue<>(Comparator
                .comparingInt(VertexPathNode::priority)
                .thenComparingInt(VertexPathNode::heuristic)
                .thenComparingInt(node -> node.vertex().y())
                .thenComparingInt(node -> node.vertex().x()));
        Map<VertexRef, Integer> costByVertex = new HashMap<>();
        Map<VertexRef, VertexStep> previous = new HashMap<>();
        int initialHeuristic = heuristic(start, goal);
        openSet.add(new VertexPathNode(start, initialHeuristic, initialHeuristic));
        costByVertex.put(start, 0);

        while (!openSet.isEmpty()) {
            VertexPathNode current = openSet.poll();
            if (current.vertex().equals(goal)) {
                return rebuildPath(previous, current.vertex());
            }
            Integer knownCost = costByVertex.get(current.vertex());
            if (knownCost == null || knownCost + heuristic(current.vertex(), goal) < current.priority()) {
                continue;
            }
            for (VertexStep neighbor : neighboringPaintableEdges(current.vertex())) {
                int nextCost = knownCost + 1;
                Integer existingCost = costByVertex.get(neighbor.vertex());
                if (existingCost != null && existingCost <= nextCost) {
                    continue;
                }
                previous.put(neighbor.vertex(), neighbor);
                costByVertex.put(neighbor.vertex(), nextCost);
                int h = heuristic(neighbor.vertex(), goal);
                openSet.add(new VertexPathNode(neighbor.vertex(), nextCost + h, h));
            }
        }
        return List.of();
    }

    private List<VertexStep> neighboringPaintableEdges(VertexRef vertex) {
        List<VertexStep> neighbors = new ArrayList<>(4);
        addPaintableStep(neighbors, vertex, new VertexRef(vertex.x() - 1, vertex.y()));
        addPaintableStep(neighbors, vertex, new VertexRef(vertex.x() + 1, vertex.y()));
        addPaintableStep(neighbors, vertex, new VertexRef(vertex.x(), vertex.y() - 1));
        addPaintableStep(neighbors, vertex, new VertexRef(vertex.x(), vertex.y() + 1));
        neighbors.sort(Comparator
                .comparingInt((VertexStep step) -> step.vertex().y())
                .thenComparingInt(step -> step.vertex().x())
                .thenComparingInt(step -> step.edge().direction().ordinal())
                .thenComparingInt(step -> step.edge().y())
                .thenComparingInt(step -> step.edge().x()));
        return neighbors;
    }

    private void addPaintableStep(List<VertexStep> steps, VertexRef from, VertexRef to) {
        EdgeRef edge = edgeBetween(from, to);
        if (edge != null && isPaintableWallEdge(edge.x(), edge.y(), edge.direction())) {
            steps.add(new VertexStep(to, edge, from));
        }
    }

    private EdgeRef edgeBetween(VertexRef from, VertexRef to) {
        int dx = to.x() - from.x();
        int dy = to.y() - from.y();
        if (Math.abs(dx) + Math.abs(dy) != 1) {
            return null;
        }
        if (dx == 1) {
            return new EdgeRef(from.x(), from.y() - 1, PassageDirection.SOUTH);
        }
        if (dx == -1) {
            return new EdgeRef(to.x(), to.y() - 1, PassageDirection.SOUTH);
        }
        if (dy == 1) {
            return new EdgeRef(from.x() - 1, from.y(), PassageDirection.EAST);
        }
        return new EdgeRef(to.x() - 1, to.y(), PassageDirection.EAST);
    }

    private List<DungeonMapPane.EdgeInteraction> rebuildPath(Map<VertexRef, VertexStep> previous, VertexRef end) {
        List<DungeonMapPane.EdgeInteraction> path = new ArrayList<>();
        VertexRef current = end;
        while (previous.containsKey(current)) {
            VertexStep step = previous.get(current);
            path.add(0, toInteraction(step.edge()));
            current = step.previousVertex();
        }
        return path;
    }

    private int heuristic(VertexRef a, VertexRef b) {
        return Math.abs(a.x() - b.x()) + Math.abs(a.y() - b.y());
    }

    private DungeonMapPane.EdgeInteraction toInteraction(EdgeRef edge) {
        String edgeKey = edge.direction().edgeKey(edge.x(), edge.y());
        return new DungeonMapPane.EdgeInteraction(
                edge.x(),
                edge.y(),
                edge.direction(),
                model.wallsByEdge().get(edgeKey),
                model.passagesByEdge().get(edgeKey));
    }

    private boolean isEditableEdge(int x, int y, PassageDirection dir) {
        boolean sideA = hasFilledSquare(x, y);
        boolean sideB = dir == PassageDirection.EAST
                ? hasFilledSquare(x + 1, y)
                : hasFilledSquare(x, y + 1);
        return sideA || sideB;
    }

    private boolean isInteriorEdge(int x, int y, PassageDirection dir) {
        boolean sideA = hasFilledSquare(x, y);
        boolean sideB = dir == PassageDirection.EAST
                ? hasFilledSquare(x + 1, y)
                : hasFilledSquare(x, y + 1);
        return sideA && sideB;
    }

    private boolean isPaintableWallEdge(int x, int y, PassageDirection dir) {
        return isInteriorEdge(x, y, dir);
    }

    private boolean hasFilledSquare(int x, int y) {
        return model.squaresByCoord().get(x + ":" + y) != null;
    }

    private void strokeEdge(GraphicsContext gc, int x, int y, PassageDirection dir) {
        if (dir == PassageDirection.EAST) {
            double sx = viewport.screenX(x + 1);
            double sy = viewport.screenY(y);
            double ey = viewport.screenY(y + 1);
            gc.strokeLine(sx, sy, sx, ey);
            return;
        }
        double sx = viewport.screenX(x);
        double sy = viewport.screenY(y + 1);
        double ex = viewport.screenX(x + 1);
        gc.strokeLine(sx, sy, ex, sy);
    }

    private void updateCursor() {
        selectionCanvas.setCursor(activeTool.cursor());
    }

    private boolean edgeHoverEnabled() {
        return activeTool == DungeonEditorTool.PASSAGE || activeTool.edgeHoverEnabled();
    }

    private boolean isWallStrokeMode() {
        return activeTool == DungeonEditorTool.PASSAGE && !currentWallEditorMode().placesPassages();
    }

    private boolean isWallPaintPathMode() {
        return activeTool == DungeonEditorTool.PASSAGE && currentWallEditorMode().paintsWalls();
    }

    private boolean usesWallEraseBrush() {
        return activeTool == DungeonEditorTool.PASSAGE && currentWallEditorMode().erasesWalls();
    }

    private WallEditorMode currentWallEditorMode() {
        if (wallEditorModeSupplier != null) {
            WallEditorMode mode = wallEditorModeSupplier.get();
            if (mode != null) {
                return mode;
            }
        }
        return WallEditorMode.PAINT_WALL;
    }

    private int currentBrushSize() {
        if (brushSizeSupplier != null) {
            Integer val = brushSizeSupplier.get();
            if (val != null) {
                return val;
            }
        }
        return 1;
    }

    private BrushShape currentBrushShape() {
        if (brushShapeSupplier != null) {
            BrushShape shape = brushShapeSupplier.get();
            if (shape != null) {
                return shape;
            }
        }
        return BrushShape.SQUARE;
    }

    private static boolean inShape(BrushShape shape, int dx, int dy, int radius) {
        return switch (shape) {
            case SQUARE -> true;
            case CIRCLE -> dx * dx + dy * dy <= radius * radius;
            case DIAMOND -> Math.abs(dx) + Math.abs(dy) <= radius;
        };
    }

    private record EdgeRef(int x, int y, PassageDirection direction) {
    }

    private record VertexRef(int x, int y) {
    }

    private record VertexStep(VertexRef vertex, EdgeRef edge, VertexRef previousVertex) {
    }

    private record VertexPathNode(VertexRef vertex, int priority, int heuristic) {
    }
}
