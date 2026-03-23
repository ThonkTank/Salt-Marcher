package features.world.dungeonmap.canvas.grid;

import features.world.dungeonmap.application.runtime.DungeonHeading;
import features.world.dungeonmap.application.runtime.DungeonRuntimeDoorDescriptor;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurface;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurfaceResolver;
import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonRenderState;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.base.DungeonSceneRenderer;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Tile;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.text.Font;
import javafx.scene.text.TextAlignment;

import java.util.Collection;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

public final class DungeonGridSceneRenderer implements DungeonSceneRenderer {

    @Override
    public void render(
            GraphicsContext gc,
            double width,
            double height,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            boolean editorMode,
            DungeonRenderState renderState
    ) {
        fillBackground(gc, width, height, editorMode);
        drawGrid(gc, width, height, camera, editorMode);
        if (editorMode) {
            drawPaintPreview(gc, camera, renderState.previewPaintShape(), renderState.previewPaintDeleteMode());
        }
        Set<VertexEdge> selectedRoomBoundaryEdges = drawRooms(gc, mapModel, camera, editorMode, renderState.selectedTargetKey());
        drawCorridors(gc, mapModel, camera, editorMode, renderState.selectedTargetKey());
        drawStairs(gc, mapModel, camera, editorMode, renderState.selectedTargetKey());
        drawPartyToken(gc, mapModel, camera, renderState.activeLocation(), renderState.heading());
        if (!editorMode) {
            drawDoorNumbers(gc, mapModel, camera, renderState.activeLocation(), renderState.heading());
        }
        drawSelectedRoomBoundaries(gc, camera, DungeonCanvasTheme.BASE_GRID * camera.zoom(), selectedRoomBoundaryEdges);
        if (editorMode) {
            drawStairPreview(gc, camera, renderState.previewStairPath(), renderState.projectionLevel());
            drawInteractiveLabels(gc, mapModel, camera, renderState.selectedTargetKey());
        }
        drawAxes(gc, width, height, camera, editorMode);
        drawGridReference(gc, width, height, camera);
    }

    private static void fillBackground(GraphicsContext gc, double width, double height, boolean editorMode) {
        gc.setFill(DungeonCanvasTheme.background(editorMode));
        gc.fillRect(0, 0, width, height);
    }

    private static void drawGrid(GraphicsContext gc, double width, double height, DungeonCanvasCamera camera, boolean editorMode) {
        GridScale scale = GridScale.resolve(camera.zoom());
        for (int tier = 0; tier < scale.steps().length; tier++) {
            drawGridTier(gc, width, height, camera, editorMode, scale.steps()[tier], tier);
        }
    }

    private static void drawGridTier(
            GraphicsContext gc,
            double width,
            double height,
            DungeonCanvasCamera camera,
            boolean editorMode,
            int spacingSquares,
            int tier
    ) {
        if (spacingSquares <= 0) {
            return;
        }
        double pixelSpacing = DungeonCanvasTheme.BASE_GRID * camera.zoom() * spacingSquares;
        if (pixelSpacing <= 0.0) {
            return;
        }
        double offsetX = normalizedOffset(camera.panX(), pixelSpacing);
        double offsetY = normalizedOffset(camera.panY(), pixelSpacing);
        gc.setStroke(DungeonCanvasTheme.gridTier(editorMode, tier));
        gc.setLineWidth(DungeonCanvasTheme.gridTierWidth(tier));
        for (double x = offsetX; x <= width; x += pixelSpacing) {
            int lineIndex = worldLineIndex(x, camera.panX(), pixelSpacing);
            if (lineIndex == 0) {
                continue;
            }
            gc.strokeLine(x, 0, x, height);
        }
        for (double y = offsetY; y <= height; y += pixelSpacing) {
            int lineIndex = worldLineIndex(y, camera.panY(), pixelSpacing);
            if (lineIndex == 0) {
                continue;
            }
            gc.strokeLine(0, y, width, y);
        }
    }

    private static Set<VertexEdge> drawRooms(
            GraphicsContext gc,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            boolean editorMode,
            String selectedTargetKey
    ) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setFill(DungeonCanvasTheme.CELL_FILL);
        Set<VertexEdge> roomBoundaryEdges = new LinkedHashSet<>();
        Set<VertexEdge> selectedRoomBoundaryEdges = new LinkedHashSet<>();
        for (RoomCluster cluster : mapModel.clusters()) {
            InteractiveLabelHandle handle = cluster.labelHandle();
            boolean selected = handle != null && java.util.Objects.equals(handle.key(), selectedTargetKey);
            for (Room room : cluster.rooms()) {
                Set<Tile> tiles = room.floor().shape().tiles();
                fillRoomTiles(gc, camera, gridSize, tiles);
                strokeRoomTiles(gc, camera, gridSize, tiles, DungeonCanvasTheme.grid(editorMode), 1.0);
                room.walls().forEach(wall -> {
                    if (selected) {
                        selectedRoomBoundaryEdges.addAll(wall.edges());
                    } else {
                        roomBoundaryEdges.addAll(wall.edges());
                    }
                });
                if (!editorMode) {
                    gc.setFill(DungeonCanvasTheme.text(editorMode));
                    gc.setFont(DungeonCanvasTheme.ROOM_LABEL_FONT);
                    drawRoomLabel(gc, room.name(), camera, gridSize, room);
                    gc.setFill(DungeonCanvasTheme.CELL_FILL);
                }
            }
        }
        drawRoomBoundaries(gc, camera, gridSize, roomBoundaryEdges);
        return selectedRoomBoundaryEdges;
    }

    private static void fillRoomTiles(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<Tile> tiles
    ) {
        for (Tile tile : tiles) {
            double x = camera.panX() + tile.x() * gridSize;
            double y = camera.panY() + tile.y() * gridSize;
            gc.fillRect(x, y, gridSize, gridSize);
        }
    }

    private static void strokeRoomTiles(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<Tile> tiles,
            javafx.scene.paint.Color stroke,
            double lineWidth
    ) {
        gc.setStroke(stroke);
        gc.setLineWidth(lineWidth);
        for (Tile tile : tiles) {
            double x = camera.panX() + tile.x() * gridSize;
            double y = camera.panY() + tile.y() * gridSize;
            gc.strokeRect(x, y, gridSize, gridSize);
        }
    }

    private static void drawRoomBoundaries(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<VertexEdge> edges
    ) {
        if (edges.isEmpty()) {
            return;
        }
        gc.setStroke(DungeonCanvasTheme.WALL_STROKE);
        gc.setLineWidth(2.0);
        for (VertexEdge edge : edges) {
            strokeEdge(gc, camera, gridSize, edge);
        }
    }

    private static void drawSelectedRoomBoundaries(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<VertexEdge> edges
    ) {
        if (edges.isEmpty()) {
            return;
        }
        gc.setStroke(DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE);
        gc.setLineWidth(2.6);
        for (VertexEdge edge : edges) {
            strokeEdge(gc, camera, gridSize, edge);
        }
    }

    private static void strokeEdge(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            VertexEdge edge
    ) {
        double startX = camera.panX() + edge.start().x() * gridSize;
        double startY = camera.panY() + edge.start().y() * gridSize;
        double endX = camera.panX() + edge.end().x() * gridSize;
        double endY = camera.panY() + edge.end().y() * gridSize;
        gc.strokeLine(startX, startY, endX, endY);
    }

    private static void drawRoomLabel(
            GraphicsContext gc,
            String roomName,
            DungeonCanvasCamera camera,
            double gridSize,
            Room room
    ) {
        if (roomName == null || roomName.isBlank()) {
            return;
        }
        double centerX = camera.panX() + (room.floor().shape().anchor().x() + 0.15) * gridSize;
        double centerY = camera.panY() + (room.floor().shape().anchor().y() + 0.55) * gridSize;
        gc.fillText(roomName, centerX, centerY);
    }

    private static void drawInteractiveLabels(
            GraphicsContext gc,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            String selectedTargetKey
    ) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setFont(DungeonCanvasTheme.HUD_FONT);
        gc.setTextAlign(TextAlignment.CENTER);
        for (RoomCluster cluster : mapModel.clusters()) {
            InteractiveLabelHandle handle = cluster.labelHandle();
            javafx.geometry.Rectangle2D bounds = DungeonGridInteractiveLabels.bounds(handle, camera, gridSize);
            boolean selected = handle != null && java.util.Objects.equals(handle.key(), selectedTargetKey);
            gc.setFill(selected ? DungeonCanvasTheme.GRAPH_NODE_FILL : DungeonCanvasTheme.LABEL_FILL);
            gc.fillRoundRect(bounds.getMinX(), bounds.getMinY(), bounds.getWidth(), bounds.getHeight(), 14, 14);
            gc.setStroke(selected ? DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE : DungeonCanvasTheme.LABEL_BORDER);
            gc.setLineWidth(selected ? 2.0 : 1.0);
            gc.strokeRoundRect(bounds.getMinX(), bounds.getMinY(), bounds.getWidth(), bounds.getHeight(), 14, 14);
            gc.setFill(DungeonCanvasTheme.LABEL_TEXT);
            gc.fillText(handle.label(), bounds.getMinX() + bounds.getWidth() / 2.0, bounds.getMinY() + 16.5);
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private static void drawCorridors(
            GraphicsContext gc,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            boolean editorMode,
            String selectedTargetKey
    ) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        for (Corridor corridor : mapModel.corridors()) {
            if (corridor == null || corridor.path() == null || corridor.path().floor() == null) {
                continue;
            }
            boolean selected = java.util.Objects.equals(corridor.targetKey(), selectedTargetKey);
            Set<Tile> corridorTiles = corridor.path().floor().shape().tiles();
            gc.setFill(selected ? DungeonCanvasTheme.CORRIDOR_SELECTED_FILL : DungeonCanvasTheme.CELL_FILL);
            fillRoomTiles(gc, camera, gridSize, corridorTiles);
            strokeRoomTiles(gc, camera, gridSize, corridorTiles, DungeonCanvasTheme.grid(editorMode), 1.0);

            Set<VertexEdge> wallEdges = new LinkedHashSet<>(corridor.path().floor().shape().boundaryEdges());
            wallEdges.removeAll(corridor.path().doorEdges());
            drawCorridorBoundaries(gc, camera, gridSize, wallEdges, selected);

            gc.setStroke(selected ? DungeonCanvasTheme.CORRIDOR_SELECTED_STROKE : DungeonCanvasTheme.CORRIDOR_STROKE);
            gc.setLineWidth(selected ? 3.0 : 2.0);
            for (VertexEdge edge : corridor.path().doorEdges()) {
                strokeEdge(gc, camera, gridSize, edge);
            }
        }
    }

    private static void drawCorridorBoundaries(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<VertexEdge> edges,
            boolean selected
    ) {
        if (edges.isEmpty()) {
            return;
        }
        gc.setStroke(selected ? DungeonCanvasTheme.CORRIDOR_SELECTED_STROKE : DungeonCanvasTheme.WALL_STROKE);
        gc.setLineWidth(selected ? 2.5 : 2.0);
        for (VertexEdge edge : edges) {
            strokeEdge(gc, camera, gridSize, edge);
        }
    }

    private static void drawStairs(
            GraphicsContext gc,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            boolean editorMode,
            String selectedTargetKey
    ) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setTextAlign(TextAlignment.CENTER);
        gc.setFont(DungeonCanvasTheme.ROOM_LABEL_FONT);
        for (DungeonStair stair : mapModel.stairs()) {
            if (stair == null) {
                continue;
            }
            boolean selected = java.util.Objects.equals(stair.targetKey(), selectedTargetKey);
            gc.setFill(selected ? DungeonCanvasTheme.CORRIDOR_SELECTED_FILL : DungeonCanvasTheme.CORRIDOR_FILL);
            gc.setStroke(selected ? DungeonCanvasTheme.CORRIDOR_SELECTED_STROKE : DungeonCanvasTheme.CORRIDOR_STROKE);
            gc.setLineWidth(selected ? 2.5 : 1.8);
            for (var node : stair.path()) {
                double x = camera.panX() + node.x() * gridSize;
                double y = camera.panY() + node.y() * gridSize;
                gc.fillRoundRect(x + gridSize * 0.18, y + gridSize * 0.18, gridSize * 0.64, gridSize * 0.64, 10, 10);
                gc.strokeRoundRect(x + gridSize * 0.18, y + gridSize * 0.18, gridSize * 0.64, gridSize * 0.64, 10, 10);
            }
            for (var exit : stair.exits()) {
                double centerX = camera.panX() + (exit.position().x() + 0.5) * gridSize;
                double centerY = camera.panY() + (exit.position().y() + 0.5) * gridSize;
                double radius = Math.max(6.0, gridSize * 0.18);
                gc.setFill(selected ? DungeonCanvasTheme.LABEL_TEXT : DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE);
                gc.fillOval(centerX - radius, centerY - radius, radius * 2, radius * 2);
                if (editorMode) {
                    gc.setFill(DungeonCanvasTheme.LABEL_TEXT);
                    gc.fillText(Integer.toString(exit.position().z()), centerX, centerY - gridSize * 0.38);
                }
            }
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private static void drawPartyToken(
            GraphicsContext gc,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            DungeonRuntimeLocation activeLocation,
            DungeonHeading heading
    ) {
        if (mapModel == null || activeLocation == null) {
            return;
        }
        var centerCell = activeCell(mapModel, activeLocation);
        if (centerCell == null) {
            return;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        double centerX = camera.panX() + (centerCell.x() + 0.5) * gridSize;
        double centerY = camera.panY() + (centerCell.y() + 0.5) * gridSize;
        double outerRadius = Math.max(7.5, gridSize * 0.26);
        double innerRadius = Math.max(3.2, outerRadius * 0.42);
        DungeonHeading resolvedHeading = heading == null ? DungeonHeading.defaultHeading() : heading;
        double forwardX = resolvedHeading.delta().x();
        double forwardY = resolvedHeading.delta().y();
        double sideX = -forwardY;
        double sideY = forwardX;
        double rearOffset = outerRadius * 0.92;
        double shoulderOffset = outerRadius * 0.54;
        double halfWidth = outerRadius * 0.92;
        double shoulderWidth = outerRadius * 0.76;
        double tipLength = outerRadius * 1.18;
        double[] shapeX = {
                centerX + forwardX * tipLength,
                centerX + forwardX * shoulderOffset + sideX * shoulderWidth,
                centerX - forwardX * rearOffset + sideX * halfWidth,
                centerX - forwardX * outerRadius * 1.02,
                centerX - forwardX * rearOffset - sideX * halfWidth,
                centerX + forwardX * shoulderOffset - sideX * shoulderWidth
        };
        double[] shapeY = {
                centerY + forwardY * tipLength,
                centerY + forwardY * shoulderOffset + sideY * shoulderWidth,
                centerY - forwardY * rearOffset + sideY * halfWidth,
                centerY - forwardY * outerRadius * 1.02,
                centerY - forwardY * rearOffset - sideY * halfWidth,
                centerY + forwardY * shoulderOffset - sideY * shoulderWidth
        };
        double[] shadowX = new double[shapeX.length];
        double[] shadowY = new double[shapeY.length];
        for (int i = 0; i < shapeX.length; i++) {
            shadowX[i] = shapeX[i] - 1.5;
            shadowY[i] = shapeY[i] + 1.5;
        }
        gc.setFill(DungeonCanvasTheme.PARTY_TOKEN_SHADOW);
        gc.fillPolygon(shadowX, shadowY, shadowX.length);
        gc.setFill(DungeonCanvasTheme.PARTY_TOKEN_FILL);
        gc.fillPolygon(shapeX, shapeY, shapeX.length);
        gc.setStroke(DungeonCanvasTheme.PARTY_TOKEN_STROKE);
        gc.setLineWidth(2.2);
        gc.strokePolygon(shapeX, shapeY, shapeX.length);
        gc.setFill(DungeonCanvasTheme.PARTY_TOKEN_STROKE);
        gc.fillOval(centerX - innerRadius, centerY - innerRadius, innerRadius * 2, innerRadius * 2);
    }

    private static void drawDoorNumbers(
            GraphicsContext gc,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            DungeonRuntimeLocation activeLocation,
            DungeonHeading heading
    ) {
        DungeonRuntimeSurface surface = DungeonRuntimeSurfaceResolver.resolve(mapModel, activeLocation, heading);
        if (surface == null || surface.doors().isEmpty()) {
            return;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        for (DungeonRuntimeDoorDescriptor exit : surface.doors()) {
            drawDoorNumber(gc, camera, gridSize, exit);
        }
    }

    private static void drawDoorNumber(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            DungeonRuntimeDoorDescriptor exit
    ) {
        if (exit == null || exit.anchorEdge() == null) {
            return;
        }
        VertexEdge edge = exit.anchorEdge();
        double centerX = camera.panX() + ((edge.start().x() + edge.end().x()) / 2.0) * gridSize;
        double centerY = camera.panY() + ((edge.start().y() + edge.end().y()) / 2.0) * gridSize;
        double width = 22.0;
        double height = 18.0;
        gc.setFill(DungeonCanvasTheme.LABEL_FILL);
        gc.fillRoundRect(centerX - width / 2.0, centerY - height / 2.0, width, height, 10, 10);
        gc.setStroke(DungeonCanvasTheme.LABEL_BORDER);
        gc.setLineWidth(1.0);
        gc.strokeRoundRect(centerX - width / 2.0, centerY - height / 2.0, width, height, 10, 10);
        gc.setFill(DungeonCanvasTheme.LABEL_TEXT);
        gc.setFont(DungeonCanvasTheme.ROOM_LABEL_FONT);
        gc.setTextAlign(TextAlignment.CENTER);
        gc.fillText(Integer.toString(exit.number()), centerX, centerY + 4.0);
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private static features.world.dungeonmap.model.geometry.Point2i activeCell(DungeonLayout mapModel, DungeonRuntimeLocation activeLocation) {
        if (activeLocation instanceof DungeonRuntimeLocation.Tile tile) {
            return tile.tile().projectedCell();
        }
        if (activeLocation instanceof DungeonRuntimeLocation.StairExit stairExit) {
            return stairExit.tile().projectedCell();
        }
        if (activeLocation instanceof DungeonRuntimeLocation.Room room) {
            Room resolvedRoom = mapModel.findRoom(room.roomId());
            return resolvedRoom == null ? null : resolvedRoom.floor().shape().centerCell();
        }
        if (activeLocation instanceof DungeonRuntimeLocation.Corridor corridor) {
            Corridor resolvedCorridor = mapModel.findCorridor(corridor.corridorId());
            return resolvedCorridor == null || resolvedCorridor.path() == null || resolvedCorridor.path().floor() == null
                    ? null
                    : resolvedCorridor.path().floor().shape().centerCell();
        }
        if (activeLocation instanceof DungeonRuntimeLocation.CorridorComponent component) {
            var network = mapModel.corridorNetworks().stream()
                    .filter(candidate -> component.componentId().equals(candidate.networkId()))
                    .findFirst()
                    .orElse(null);
            return network == null || network.floor() == null ? null : network.floor().shape().centerCell();
        }
        return null;
    }

    private static Set<VertexEdge> boundaryEdges(Collection<? extends Door> doors) {
        Set<VertexEdge> edges = new LinkedHashSet<>();
        if (doors == null) {
            return edges;
        }
        for (var door : doors) {
            if (door == null) {
                continue;
            }
            edges.addAll(door.edges());
        }
        return edges;
    }

    private static void drawPaintPreview(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            TileShape previewPaintShape,
            boolean deleteMode
    ) {
        if (previewPaintShape == null || previewPaintShape.size() == 0) {
            return;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setFill(deleteMode ? DungeonCanvasTheme.DELETE_PREVIEW_FILL : DungeonCanvasTheme.PAINT_PREVIEW_FILL);
        gc.setStroke(deleteMode ? DungeonCanvasTheme.DELETE_PREVIEW_STROKE : DungeonCanvasTheme.PAINT_PREVIEW_STROKE);
        gc.setLineWidth(1.5);
        for (Tile tile : previewPaintShape.tiles()) {
            double x = camera.panX() + tile.x() * gridSize;
            double y = camera.panY() + tile.y() * gridSize;
            gc.fillRect(x, y, gridSize, gridSize);
            gc.strokeRect(x, y, gridSize, gridSize);
        }
    }

    private static void drawStairPreview(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            java.util.List<features.world.dungeonmap.model.geometry.CubePoint> previewStairPath,
            int projectionLevel
    ) {
        if (previewStairPath == null || previewStairPath.isEmpty()) {
            return;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setStroke(DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE);
        gc.setFill(DungeonCanvasTheme.PAINT_PREVIEW_FILL);
        gc.setLineWidth(2.0);
        features.world.dungeonmap.model.geometry.CubePoint previous = null;
        for (var node : previewStairPath) {
            if (node.z() == projectionLevel) {
                double x = camera.panX() + node.x() * gridSize;
                double y = camera.panY() + node.y() * gridSize;
                gc.fillRoundRect(x + gridSize * 0.22, y + gridSize * 0.22, gridSize * 0.56, gridSize * 0.56, 10, 10);
                gc.strokeRoundRect(x + gridSize * 0.22, y + gridSize * 0.22, gridSize * 0.56, gridSize * 0.56, 10, 10);
            }
            if (previous != null && previous.z() == projectionLevel && node.z() == projectionLevel) {
                double startX = camera.panX() + (previous.x() + 0.5) * gridSize;
                double startY = camera.panY() + (previous.y() + 0.5) * gridSize;
                double endX = camera.panX() + (node.x() + 0.5) * gridSize;
                double endY = camera.panY() + (node.y() + 0.5) * gridSize;
                gc.strokeLine(startX, startY, endX, endY);
            }
            previous = node;
        }
    }

    private static void drawAxes(GraphicsContext gc, double width, double height, DungeonCanvasCamera camera, boolean editorMode) {
        gc.setStroke(DungeonCanvasTheme.axis(editorMode));
        gc.setLineWidth(DungeonCanvasTheme.axisLineWidth());
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        double axisX = camera.panX();
        double axisY = camera.panY();
        if (axisX >= -gridSize && axisX <= width + gridSize) {
            gc.strokeLine(axisX, 0, axisX, height);
        }
        if (axisY >= -gridSize && axisY <= height + gridSize) {
            gc.strokeLine(0, axisY, width, axisY);
        }
    }

    private static void drawGridReference(
            GraphicsContext gc,
            double width,
            double height,
            DungeonCanvasCamera camera
    ) {
        GridScale scale = GridScale.resolve(camera.zoom());
        int squares = scale.smallestVisibleUnit();
        int feet = squares * 5;
        String label = squares == 1
                ? "Raster: 1 Feld (5 Fu" + '\u00df' + ")"
                : "Raster: " + squares + " Felder (" + feet + " Fu" + '\u00df' + ")";
        double labelWidth = hudLabelWidth(label, DungeonCanvasTheme.HUD_FONT);
        double x = width - labelWidth - 12.0;
        double y = height - 36.0;
        DungeonCanvasTheme.drawHudLabel(gc, label, x, y);
    }

    private static double normalizedOffset(double pan, double gridSize) {
        if (gridSize <= 0.0) {
            return 0.0;
        }
        double offset = pan % gridSize;
        return offset < 0 ? offset + gridSize : offset;
    }

    private static int worldLineIndex(double canvasCoordinate, double pan, double spacing) {
        if (spacing <= 0.0) {
            return 0;
        }
        return (int) Math.round((canvasCoordinate - pan) / spacing);
    }

    private static double hudLabelWidth(String text, Font font) {
        int length = text == null ? 0 : text.length();
        double size = font == null ? 14.0 : font.getSize();
        return length * (size * 0.52) + 16.0;
    }

    private record GridScale(int smallestVisibleUnit, int[] steps) {

        private static final int[] PROGRESSION = {1, 5, 10};

        private static GridScale resolve(double zoom) {
            double pixelsPerSquare = DungeonCanvasTheme.BASE_GRID * zoom;
            int unit = 1;
            while (pixelsPerSquare * unit < DungeonCanvasTheme.GRID_MIN_READABLE_SPACING) {
                unit = nextUnit(unit);
            }
            return new GridScale(unit, nextSteps(unit));
        }

        private static int[] nextSteps(int startUnit) {
            int[] steps = new int[4];
            steps[0] = startUnit;
            for (int i = 1; i < steps.length; i++) {
                steps[i] = nextUnit(steps[i - 1]);
            }
            return steps;
        }

        private static int nextUnit(int value) {
            int index = progressionIndex(value);
            int nextIndex = (index + 1) % PROGRESSION.length;
            int next = PROGRESSION[nextIndex];
            if (nextIndex <= index) {
                next *= magnitudeFactor(value) * 10;
            } else {
                next *= magnitudeFactor(value);
            }
            return next;
        }

        private static int progressionIndex(int value) {
            int normalized = normalizedValue(value);
            int index = Arrays.binarySearch(PROGRESSION, normalized);
            if (index >= 0) {
                return index;
            }
            for (int i = PROGRESSION.length - 1; i >= 0; i--) {
                if (normalized >= PROGRESSION[i]) {
                    return i;
                }
            }
            return 0;
        }

        private static int normalizedValue(int value) {
            int magnitude = magnitudeFactor(value);
            return magnitude == 0 ? value : value / magnitude;
        }

        private static int magnitudeFactor(int value) {
            int magnitude = 1;
            while (value >= magnitude * 10) {
                magnitude *= 10;
            }
            return magnitude;
        }
    }
}
