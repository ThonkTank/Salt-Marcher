package features.world.dungeonmap.canvas.grid;

import features.world.dungeonmap.application.runtime.DungeonHeading;
import features.world.dungeonmap.application.runtime.DungeonRuntimeDoorDescriptor;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLocationTileResolver;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurface;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurfaceResolver;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonRenderState;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.base.DungeonSceneRenderer;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.Tile;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.TextAlignment;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
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
        drawOverlayLevels(gc, mapModel, camera, editorMode, renderState);
        DungeonLayout projectedMap = mapModel.projectedToLevel(renderState.projectionLevel());
        if (editorMode) {
            drawPaintPreview(gc, camera, renderState.previewPaintShape(), renderState.previewPaintDeleteMode());
        }
        LayerPalette currentPalette = LayerPalette.current(editorMode);
        Set<VertexEdge> selectedRoomBoundaryEdges = drawRooms(
                gc,
                projectedMap,
                camera,
                editorMode,
                renderState.selectedTargetKey(),
                currentPalette,
                !editorMode);
        drawCorridors(gc, projectedMap, camera, renderState.selectedTargetKey(), renderState.projectionLevel(), currentPalette);
        drawStairs(
                gc,
                projectedMap,
                camera,
                editorMode,
                renderState.selectedTargetKey(),
                renderState.projectionLevel(),
                currentPalette,
                false);
        drawTransitions(gc, projectedMap, camera, renderState.selectedTargetKey(), currentPalette);
        drawPartyToken(gc, mapModel, camera, renderState.activeLocation(), renderState.heading(), renderState.projectionLevel());
        if (!editorMode) {
            drawDoorNumbers(gc, projectedMap, camera, renderState.activeLocation(), renderState.heading());
        }
        if (editorMode) {
            drawBoundaryPreview(
                    gc,
                    camera,
                    DungeonCanvasTheme.BASE_GRID * camera.zoom(),
                    renderState.previewBoundaryEdges(),
                    renderState.previewBoundarySkippedEdges(),
                    renderState.previewBoundaryStartVertex(),
                    renderState.previewBoundaryCurrentVertex(),
                    renderState.previewBoundaryDeleteMode());
        }
        drawSelectedRoomBoundaries(
                gc,
                camera,
                DungeonCanvasTheme.BASE_GRID * camera.zoom(),
                selectedRoomBoundaryEdges,
                currentPalette.selectedWallStroke());
        if (editorMode) {
            drawInteractiveLabels(gc, projectedMap, camera, renderState.selectedTargetKey());
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
            String selectedTargetKey,
            LayerPalette palette,
            boolean showRuntimeLabels
    ) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setFill(palette.roomFill());
        Set<VertexEdge> roomBoundaryEdges = new LinkedHashSet<>();
        Set<VertexEdge> selectedRoomBoundaryEdges = new LinkedHashSet<>();
        for (RoomCluster cluster : mapModel.clusters()) {
            InteractiveLabelHandle handle = cluster.labelHandle();
            boolean selectedCluster = handle != null && java.util.Objects.equals(handle.key(), selectedTargetKey);
            for (Room room : cluster.rooms()) {
                boolean selectedRoom = Room.isTargetKey(selectedTargetKey)
                        && java.util.Objects.equals(room.roomId(), Room.roomIdFromKey(selectedTargetKey));
                Set<Tile> tiles = room.floor().shape().tiles();
                fillRoomTiles(gc, camera, gridSize, tiles);
                strokeRoomTiles(gc, camera, gridSize, tiles, palette.roomStroke(), 1.0);
                Set<VertexEdge> doorEdges = room.roomId() == null
                        ? Set.of()
                        : boundaryEdges(mapModel.doorsForRoom(room.roomId()));
                room.walls().forEach(wall -> {
                    Set<VertexEdge> wallEdges = new LinkedHashSet<>(wall.edges());
                    wallEdges.removeAll(doorEdges);
                    if (selectedCluster || selectedRoom) {
                        selectedRoomBoundaryEdges.addAll(wallEdges);
                    } else {
                        roomBoundaryEdges.addAll(wallEdges);
                    }
                });
                if (showRuntimeLabels) {
                    gc.setFill(palette.roomText());
                    gc.setFont(DungeonCanvasTheme.ROOM_LABEL_FONT);
                    drawRoomLabel(gc, room.name(), camera, gridSize, room);
                    gc.setFill(palette.roomFill());
                }
            }
        }
        drawRoomBoundaries(gc, camera, gridSize, roomBoundaryEdges, palette.wallStroke());
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
            Set<VertexEdge> edges,
            Color stroke
    ) {
        if (edges.isEmpty()) {
            return;
        }
        gc.setStroke(stroke);
        gc.setLineWidth(2.0);
        for (VertexEdge edge : edges) {
            strokeEdge(gc, camera, gridSize, edge);
        }
    }

    private static void drawSelectedRoomBoundaries(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<VertexEdge> edges,
            Color stroke
    ) {
        if (edges.isEmpty()) {
            return;
        }
        gc.setStroke(stroke);
        gc.setLineWidth(2.6);
        for (VertexEdge edge : edges) {
            strokeEdge(gc, camera, gridSize, edge);
        }
    }

    private static void drawBoundaryPreview(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<VertexEdge> previewEdges,
            Set<VertexEdge> skippedEdges,
            Point2i startVertex,
            Point2i currentVertex,
            boolean deleteMode
    ) {
        if (previewEdges != null && !previewEdges.isEmpty()) {
            gc.setStroke(deleteMode ? DungeonCanvasTheme.BOUNDARY_DELETE_PREVIEW_STROKE : DungeonCanvasTheme.BOUNDARY_PREVIEW_STROKE);
            gc.setLineWidth(3.2);
            for (VertexEdge edge : previewEdges) {
                strokeEdge(gc, camera, gridSize, edge);
            }
        }
        if (skippedEdges != null && !skippedEdges.isEmpty()) {
            gc.setStroke(DungeonCanvasTheme.BOUNDARY_SKIPPED_PREVIEW_STROKE);
            gc.setLineWidth(2.2);
            gc.setLineDashes(8.0, 5.0);
            for (VertexEdge edge : skippedEdges) {
                strokeEdge(gc, camera, gridSize, edge);
            }
            gc.setLineDashes();
        }
        if (startVertex != null) {
            drawBoundaryVertexMarker(
                    gc,
                    camera,
                    gridSize,
                    startVertex,
                    DungeonCanvasTheme.BOUNDARY_START_VERTEX_FILL,
                    DungeonCanvasTheme.BOUNDARY_START_VERTEX_STROKE,
                    currentVertex != null && currentVertex.equals(startVertex) ? 6.0 : 5.0);
        }
        if (currentVertex != null && !currentVertex.equals(startVertex)) {
            drawBoundaryVertexMarker(
                    gc,
                    camera,
                    gridSize,
                    currentVertex,
                    DungeonCanvasTheme.BOUNDARY_CURRENT_VERTEX_FILL,
                    DungeonCanvasTheme.BOUNDARY_CURRENT_VERTEX_STROKE,
                    5.0);
        }
    }

    private static void drawBoundaryVertexMarker(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Point2i vertex,
            Color fill,
            Color stroke,
            double radius
    ) {
        double centerX = camera.panX() + vertex.x() * gridSize;
        double centerY = camera.panY() + vertex.y() * gridSize;
        double diameter = radius * 2.0;
        gc.setFill(fill);
        gc.fillOval(centerX - radius, centerY - radius, diameter, diameter);
        gc.setStroke(stroke);
        gc.setLineWidth(2.0);
        gc.strokeOval(centerX - radius, centerY - radius, diameter, diameter);
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
            String selectedTargetKey,
            int projectionLevel,
            LayerPalette palette
    ) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        for (Corridor corridor : mapModel.corridors()) {
            if (corridor == null || corridor.path() == null) {
                continue;
            }
            boolean selected = java.util.Objects.equals(corridor.targetKey(), selectedTargetKey);
            Set<Tile> corridorTiles = corridor.path().floorAtLevel(projectionLevel).shape().tiles();
            Set<VertexEdge> levelDoorEdges = corridor.corridorId() == null
                    ? Set.of()
                    : mapModel.doorEdgesForCorridorAtLevel(corridor.corridorId(), projectionLevel);
            if (corridorTiles.isEmpty() && levelDoorEdges.isEmpty()) {
                continue;
            }
            gc.setFill(selected ? palette.corridorSelectedFill() : palette.corridorFill());
            fillRoomTiles(gc, camera, gridSize, corridorTiles);
            strokeRoomTiles(gc, camera, gridSize, corridorTiles, palette.roomStroke(), 1.0);

            Set<VertexEdge> wallEdges = new LinkedHashSet<>(corridor.path().floorAtLevel(projectionLevel).shape().boundaryEdges());
            wallEdges.removeAll(levelDoorEdges);
            drawCorridorBoundaries(gc, camera, gridSize, wallEdges, selected, palette);

            for (Door door : corridor.corridorId() == null ? List.<Door>of() : mapModel.doorsForCorridor(corridor.corridorId())) {
                if (door == null || java.util.Collections.disjoint(door.edges(), levelDoorEdges)) {
                    continue;
                }
                gc.setStroke(selected ? palette.corridorSelectedStroke() : palette.corridorStroke());
                gc.setLineWidth(selected ? 3.0 : 2.0);
                for (VertexEdge edge : door.edges()) {
                    strokeEdge(gc, camera, gridSize, edge);
                }
            }
        }
    }

    private static void drawCorridorBoundaries(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<VertexEdge> edges,
            boolean selected,
            LayerPalette palette
    ) {
        if (edges.isEmpty()) {
            return;
        }
        gc.setStroke(selected ? palette.corridorSelectedStroke() : palette.wallStroke());
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
            String selectedTargetKey,
            int projectionLevel,
            LayerPalette palette,
            boolean overlayPass
    ) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setTextAlign(TextAlignment.CENTER);
        gc.setFont(DungeonCanvasTheme.ROOM_LABEL_FONT);
        for (DungeonStair stair : mapModel.stairs()) {
            if (stair == null) {
                continue;
            }
            boolean selected = java.util.Objects.equals(stair.targetKey(), selectedTargetKey);
            gc.setFill(selected ? palette.corridorSelectedFill() : palette.stairFill());
            gc.setStroke(selected ? palette.corridorSelectedStroke() : palette.stairStroke());
            gc.setLineWidth(selected ? 2.5 : 1.8);
            for (var node : stair.path()) {
                if (node.z() != projectionLevel) {
                    continue;
                }
                double x = camera.panX() + node.x() * gridSize;
                double y = camera.panY() + node.y() * gridSize;
                gc.fillRoundRect(x + gridSize * 0.18, y + gridSize * 0.18, gridSize * 0.64, gridSize * 0.64, 10, 10);
                gc.strokeRoundRect(x + gridSize * 0.18, y + gridSize * 0.18, gridSize * 0.64, gridSize * 0.64, 10, 10);
            }
            for (var exit : stair.exits()) {
                if (exit.position().z() != projectionLevel) {
                    continue;
                }
                double centerX = camera.panX() + (exit.position().x() + 0.5) * gridSize;
                double centerY = camera.panY() + (exit.position().y() + 0.5) * gridSize;
                double radius = Math.max(6.0, gridSize * 0.18);
                gc.setFill(selected ? palette.selectedWallStroke() : palette.stairExitFill());
                gc.fillOval(centerX - radius, centerY - radius, radius * 2, radius * 2);
                if (editorMode && !overlayPass) {
                    gc.setFill(palette.roomText());
                    gc.fillText(Integer.toString(exit.position().z()), centerX, centerY - gridSize * 0.38);
                }
            }
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private static void drawOverlayLevels(
            GraphicsContext gc,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            boolean editorMode,
            DungeonRenderState renderState
    ) {
        for (OverlayLevel overlay : overlayLevels(mapModel, renderState, false)) {
            drawOverlayLevel(gc, mapModel, camera, editorMode, renderState, overlay, LayerPalette.below(editorMode));
        }
        for (OverlayLevel overlay : overlayLevels(mapModel, renderState, true)) {
            drawOverlayLevel(gc, mapModel, camera, editorMode, renderState, overlay, LayerPalette.above(editorMode));
        }
    }

    private static void drawOverlayLevel(
            GraphicsContext gc,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            boolean editorMode,
            DungeonRenderState renderState,
            OverlayLevel overlay,
            LayerPalette palette
    ) {
        DungeonLayout projected = mapModel.projectedToLevel(overlay.level());
        if (projected.rooms().isEmpty() && projected.corridors().isEmpty() && projected.stairs().isEmpty()) {
            return;
        }
        gc.save();
        gc.setGlobalAlpha(overlay.opacity());
        Set<VertexEdge> selectedRoomBoundaryEdges = drawRooms(
                gc,
                projected,
                camera,
                editorMode,
                renderState.selectedTargetKey(),
                palette,
                false);
        drawCorridors(gc, projected, camera, renderState.selectedTargetKey(), overlay.level(), palette);
        drawStairs(gc, projected, camera, editorMode, renderState.selectedTargetKey(), overlay.level(), palette, true);
        drawTransitions(gc, projected, camera, renderState.selectedTargetKey(), palette);
        drawSelectedRoomBoundaries(
                gc,
                camera,
                DungeonCanvasTheme.BASE_GRID * camera.zoom(),
                selectedRoomBoundaryEdges,
                palette.selectedWallStroke());
        gc.restore();
    }

    private static List<OverlayLevel> overlayLevels(DungeonLayout mapModel, DungeonRenderState renderState, boolean aboveCurrent) {
        if (mapModel == null || renderState == null) {
            return List.of();
        }
        List<Integer> candidateLevels = switch (renderState.levelOverlaySettings().mode()) {
            case OFF -> List.of();
            case NEARBY -> mapModel.reachableLevels().stream()
                    .filter(level -> Math.abs(level - renderState.projectionLevel()) <= renderState.levelOverlaySettings().levelRange())
                    .toList();
            case SELECTED -> renderState.levelOverlaySettings().selectedLevels();
        };
        List<OverlayLevel> result = new ArrayList<>();
        for (Integer candidateLevel : candidateLevels) {
            if (candidateLevel == null || candidateLevel == renderState.projectionLevel()) {
                continue;
            }
            int delta = candidateLevel - renderState.projectionLevel();
            if ((delta > 0) != aboveCurrent) {
                continue;
            }
            if (!mapModel.reachableLevels().contains(candidateLevel)) {
                continue;
            }
            result.add(new OverlayLevel(candidateLevel, overlayOpacity(renderState.levelOverlaySettings().opacity(), Math.abs(delta))));
        }
        result.sort((left, right) -> Integer.compare(
                Math.abs(right.level() - renderState.projectionLevel()),
                Math.abs(left.level() - renderState.projectionLevel())));
        return result;
    }

    private static double overlayOpacity(double baseOpacity, int distance) {
        if (distance <= 0) {
            return baseOpacity;
        }
        return Math.max(0.08, Math.min(0.95, baseOpacity / Math.sqrt(distance)));
    }

    private static void drawPartyToken(
            GraphicsContext gc,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            DungeonRuntimeLocation activeLocation,
            DungeonHeading heading,
            int projectionLevel
    ) {
        if (mapModel == null || activeLocation == null) {
            return;
        }
        CubePoint activeTile = DungeonRuntimeLocationTileResolver.resolve(mapModel, activeLocation);
        if (activeTile == null || activeTile.z() != projectionLevel) {
            return;
        }
        var centerCell = activeTile.projectedCell();
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

    private static void drawTransitions(
            GraphicsContext gc,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            String selectedTargetKey,
            LayerPalette palette
    ) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setTextAlign(TextAlignment.CENTER);
        gc.setFont(Font.font(Math.max(10.0, gridSize * 0.35)));
        for (DungeonTransition transition : mapModel.transitions()) {
            if (transition == null || !transition.isPlaced()) {
                continue;
            }
            double centerX = camera.panX() + (transition.anchor().x() + 0.5) * gridSize;
            double centerY = camera.panY() + (transition.anchor().y() + 0.5) * gridSize;
            double radius = Math.max(8.0, gridSize * 0.24);
            boolean selected = java.util.Objects.equals(transition.targetKey(), selectedTargetKey);
            gc.setFill(selected ? palette.selectedWallStroke() : palette.stairExitFill());
            gc.fillRoundRect(centerX - radius, centerY - radius, radius * 2, radius * 2, 8, 8);
            gc.setStroke(selected ? palette.corridorSelectedStroke() : palette.stairStroke());
            gc.setLineWidth(selected ? 2.2 : 1.5);
            gc.strokeRoundRect(centerX - radius, centerY - radius, radius * 2, radius * 2, 8, 8);
            gc.setFill(DungeonCanvasTheme.LABEL_TEXT);
            gc.fillText("→", centerX, centerY + 4.0);
        }
        gc.setTextAlign(TextAlignment.LEFT);
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

    private record OverlayLevel(int level, double opacity) {
    }

    private record LayerPalette(
            Color roomFill,
            Color roomStroke,
            Color wallStroke,
            Color selectedWallStroke,
            Color corridorFill,
            Color corridorSelectedFill,
            Color corridorStroke,
            Color corridorSelectedStroke,
            Color stairFill,
            Color stairStroke,
            Color stairExitFill,
            Color roomText
    ) {
        private static LayerPalette current(boolean editorMode) {
            return new LayerPalette(
                    DungeonCanvasTheme.CELL_FILL,
                    DungeonCanvasTheme.grid(editorMode),
                    DungeonCanvasTheme.WALL_STROKE,
                    DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE,
                    DungeonCanvasTheme.CELL_FILL,
                    DungeonCanvasTheme.CORRIDOR_SELECTED_FILL,
                    DungeonCanvasTheme.CORRIDOR_STROKE,
                    DungeonCanvasTheme.CORRIDOR_SELECTED_STROKE,
                    DungeonCanvasTheme.CORRIDOR_FILL,
                    DungeonCanvasTheme.CORRIDOR_STROKE,
                    DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE,
                    DungeonCanvasTheme.text(editorMode));
        }

        private static LayerPalette above(boolean editorMode) {
            return tinted(DungeonCanvasTheme.OVERLAY_ABOVE_TINT, editorMode);
        }

        private static LayerPalette below(boolean editorMode) {
            return tinted(DungeonCanvasTheme.OVERLAY_BELOW_TINT, editorMode);
        }

        private static LayerPalette tinted(Color tint, boolean editorMode) {
            return new LayerPalette(
                    blend(DungeonCanvasTheme.CELL_FILL, tint, 0.58),
                    blend(DungeonCanvasTheme.grid(editorMode), tint, 0.42),
                    blend(DungeonCanvasTheme.WALL_STROKE, tint, 0.68),
                    blend(DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE, tint, 0.34),
                    blend(DungeonCanvasTheme.CORRIDOR_FILL, tint, 0.54),
                    blend(DungeonCanvasTheme.CORRIDOR_SELECTED_FILL, tint, 0.44),
                    blend(DungeonCanvasTheme.CORRIDOR_STROKE, tint, 0.62),
                    blend(DungeonCanvasTheme.CORRIDOR_SELECTED_STROKE, tint, 0.38),
                    blend(DungeonCanvasTheme.CORRIDOR_FILL, tint, 0.45),
                    blend(DungeonCanvasTheme.CORRIDOR_STROKE, tint, 0.55),
                    blend(DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE, tint, 0.5),
                    blend(DungeonCanvasTheme.text(editorMode), tint, 0.24));
        }
    }

    private static Color blend(Color base, Color tint, double tintRatio) {
        double ratio = Math.max(0.0, Math.min(1.0, tintRatio));
        double baseRatio = 1.0 - ratio;
        return Color.color(
                base.getRed() * baseRatio + tint.getRed() * ratio,
                base.getGreen() * baseRatio + tint.getGreen() * ratio,
                base.getBlue() * baseRatio + tint.getBlue() * ratio);
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
