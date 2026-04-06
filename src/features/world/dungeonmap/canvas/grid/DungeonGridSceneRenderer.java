package features.world.dungeonmap.canvas.grid;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.base.DungeonEditorRenderState;
import features.world.dungeonmap.canvas.base.DungeonRuntimeRenderOverlay;
import features.world.dungeonmap.canvas.base.DungeonSceneFrame;
import features.world.dungeonmap.canvas.base.DungeonSceneRenderer;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.connection.StairConnectionCarrier;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.shell.interaction.DungeonHitSurface;
import features.world.dungeonmap.shell.interaction.DungeonSelectionHighlightResolver;
import features.world.dungeonmap.state.EditorHover;
import features.world.dungeonmap.state.EditorPreview;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.TextAlignment;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonGridSceneRenderer implements DungeonSceneRenderer {

    @Override
    public void render(
            GraphicsContext gc,
            double width,
            double height,
            DungeonSceneFrame frame
    ) {
        DungeonBackdropPass.paint(gc, width, height, frame);
        DungeonStructurePass.paintOverlayLevels(gc, frame);
        DungeonStructurePass.paintCurrentLevel(gc, frame);
        DungeonRuntimeOverlayPass.paint(gc, frame);
        DungeonEditorOverlayPass.paint(gc, frame);
        DungeonHudPass.paint(gc, width, height, frame);
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

    private static Set<GridSegment2x> drawRooms(StructureRenderPass pass) {
        GraphicsContext gc = pass.gc();
        DungeonLayout mapModel = pass.projected();
        gc.setFill(pass.palette().roomFill());
        Set<GridSegment2x> roomBoundarySegments = new LinkedHashSet<>();
        Set<GridSegment2x> selectedRoomBoundarySegments = new LinkedHashSet<>();
        Set<GridSegment2x> roomDoorSegments = new LinkedHashSet<>();
        Set<GridSegment2x> selectedRoomDoorSegments = new LinkedHashSet<>();
        for (RoomCluster cluster : mapModel.clusters()) {
            InteractiveLabelHandle handle = cluster.labelHandle();
            boolean selectedCluster = selectedCluster(pass.selectedRef(), cluster.clusterId());
            for (Room room : cluster.rooms()) {
                WalkableSurface surface = walkableSurface(
                        cluster.roomFloorCellsAtLevel(room, pass.projectionLevel()),
                        cluster.roomBoundaryEdgesAtLevel(room, pass.projectionLevel()),
                        cluster.roomOpeningEdgesAtLevel(room, pass.projectionLevel()));
                boolean selectedRoom = selectedRoom(pass.selectedRef(), room.roomId());
                if (!surface.tiles().isEmpty()) {
                    fillRoomTiles(gc, pass.camera(), pass.gridSize(), surface.tiles());
                    strokeRoomTiles(gc, pass.camera(), pass.gridSize(), surface.tiles(), pass.palette().roomStroke(), 1.0);
                }
                if (surface.tiles().isEmpty() && surface.wallSegments().isEmpty() && surface.doorSegments().isEmpty()) {
                    continue;
                }
                if (selectedCluster || selectedRoom) {
                    selectedRoomBoundarySegments.addAll(surface.wallSegments());
                } else {
                    roomBoundarySegments.addAll(surface.wallSegments());
                }
                if (pass.showRuntimeLabels()) {
                    gc.setFill(pass.palette().roomText());
                    gc.setFont(DungeonCanvasTheme.ROOM_LABEL_FONT);
                    drawRoomLabel(
                            gc,
                            room.name(),
                            pass.camera(),
                            pass.gridSize(),
                            cluster.roomAnchorCellAtLevel(room, pass.projectionLevel()));
                    gc.setFill(pass.palette().roomFill());
                }
                if (selectedCluster || selectedRoom) {
                    selectedRoomDoorSegments.addAll(surface.doorSegments());
                } else {
                    roomDoorSegments.addAll(surface.doorSegments());
                }
            }
        }
        drawDoorSegments(
                gc,
                pass.camera(),
                pass.gridSize(),
                roomDoorSegments,
                pass.palette().doorStroke(),
                pass.palette().doorMarkerFill(),
                pass.palette().doorMarkerStroke(),
                2.6);
        drawDoorSegments(
                gc,
                pass.camera(),
                pass.gridSize(),
                selectedRoomDoorSegments,
                pass.palette().selectedDoorStroke(),
                pass.palette().selectedDoorMarkerFill(),
                pass.palette().selectedDoorMarkerStroke(),
                3.4);
        drawRoomBoundaries(pass, roomBoundarySegments, pass.palette().wallStroke());
        return selectedRoomBoundarySegments;
    }

    private static void fillRoomTiles(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Collection<CellCoord> tiles
    ) {
        for (CellCoord tile : tiles) {
            double x = camera.panX() + tile.x() * gridSize;
            double y = camera.panY() + tile.y() * gridSize;
            gc.fillRect(x, y, gridSize, gridSize);
        }
    }

    private static void strokeRoomTiles(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Collection<CellCoord> tiles,
            javafx.scene.paint.Color stroke,
            double lineWidth
    ) {
        gc.setStroke(stroke);
        gc.setLineWidth(lineWidth);
        for (CellCoord tile : tiles) {
            double x = camera.panX() + tile.x() * gridSize;
            double y = camera.panY() + tile.y() * gridSize;
            gc.strokeRect(x, y, gridSize, gridSize);
        }
    }

    private static void drawRoomBoundaries(StructureRenderPass pass, Set<GridSegment2x> segments, Color stroke) {
        if (segments.isEmpty()) {
            return;
        }
        pass.gc().setStroke(stroke);
        pass.gc().setLineWidth(2.0);
        for (GridSegment2x segment2x : segments) {
            strokeSegment2x(pass.gc(), pass.camera(), pass.gridSize(), segment2x);
        }
    }

    private static void drawSelectedRoomBoundaries(StructureRenderPass pass, Set<GridSegment2x> segments, Color stroke) {
        if (segments.isEmpty()) {
            return;
        }
        pass.gc().setStroke(stroke);
        pass.gc().setLineWidth(2.6);
        for (GridSegment2x segment2x : segments) {
            strokeSegment2x(pass.gc(), pass.camera(), pass.gridSize(), segment2x);
        }
    }

    private static void drawBoundaryPreview(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<GridSegment2x> previewEdges,
            Set<GridSegment2x> skippedEdges,
            GridPoint2x startVertex2x,
            GridPoint2x currentVertex2x,
            boolean deleteMode
    ) {
        if (previewEdges != null && !previewEdges.isEmpty()) {
            gc.setStroke(deleteMode ? DungeonCanvasTheme.BOUNDARY_DELETE_PREVIEW_STROKE : DungeonCanvasTheme.BOUNDARY_PREVIEW_STROKE);
            gc.setLineWidth(3.2);
            for (GridSegment2x segment2x : previewEdges) {
                strokeSegment2x(gc, camera, gridSize, segment2x);
            }
        }
        if (skippedEdges != null && !skippedEdges.isEmpty()) {
            gc.setStroke(DungeonCanvasTheme.BOUNDARY_SKIPPED_PREVIEW_STROKE);
            gc.setLineWidth(2.2);
            gc.setLineDashes(8.0, 5.0);
            for (GridSegment2x segment2x : skippedEdges) {
                strokeSegment2x(gc, camera, gridSize, segment2x);
            }
            gc.setLineDashes();
        }
        if (startVertex2x != null) {
            drawBoundaryVertexMarker(
                    gc,
                    camera,
                    gridSize,
                    startVertex2x,
                    DungeonCanvasTheme.BOUNDARY_START_VERTEX_FILL,
                    DungeonCanvasTheme.BOUNDARY_START_VERTEX_STROKE,
                    currentVertex2x != null && currentVertex2x.equals(startVertex2x) ? 6.0 : 5.0);
        }
        if (currentVertex2x != null && !currentVertex2x.equals(startVertex2x)) {
            drawBoundaryVertexMarker(
                    gc,
                    camera,
                    gridSize,
                    currentVertex2x,
                    DungeonCanvasTheme.BOUNDARY_CURRENT_VERTEX_FILL,
                    DungeonCanvasTheme.BOUNDARY_CURRENT_VERTEX_STROKE,
                    5.0);
        }
    }

    private static void drawBoundaryVertexMarker(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            GridPoint2x vertex2x,
            Color fill,
            Color stroke,
            double radius
    ) {
        double centerX = camera.panX() + (vertex2x.x2() + 1) * gridSize / 2.0;
        double centerY = camera.panY() + (vertex2x.y2() + 1) * gridSize / 2.0;
        double diameter = radius * 2.0;
        gc.setFill(fill);
        gc.fillOval(centerX - radius, centerY - radius, diameter, diameter);
        gc.setStroke(stroke);
        gc.setLineWidth(2.0);
        gc.strokeOval(centerX - radius, centerY - radius, diameter, diameter);
    }

    private static void strokeSegment2x(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            GridSegment2x segment2x
    ) {
        double startX = camera.panX() + (segment2x.start().x2() + 1) * gridSize / 2.0;
        double startY = camera.panY() + (segment2x.start().y2() + 1) * gridSize / 2.0;
        double endX = camera.panX() + (segment2x.end().x2() + 1) * gridSize / 2.0;
        double endY = camera.panY() + (segment2x.end().y2() + 1) * gridSize / 2.0;
        gc.strokeLine(startX, startY, endX, endY);
    }

    private static void drawRoomLabel(
            GraphicsContext gc,
            String roomName,
            DungeonCanvasCamera camera,
            double gridSize,
            CellCoord labelAnchor
    ) {
        if (roomName == null || roomName.isBlank() || labelAnchor == null) {
            return;
        }
        double centerX = camera.panX() + (labelAnchor.x() + 0.15) * gridSize;
        double centerY = camera.panY() + (labelAnchor.y() + 0.55) * gridSize;
        gc.fillText(roomName, centerX, centerY);
    }

    private static void drawInteractiveLabels(StructureRenderPass pass) {
        GraphicsContext gc = pass.gc();
        gc.setFont(DungeonCanvasTheme.HUD_FONT);
        gc.setTextAlign(TextAlignment.CENTER);
        for (RoomCluster cluster : pass.projected().clusters()) {
            InteractiveLabelHandle handle = cluster.labelHandle();
            javafx.geometry.Rectangle2D bounds = DungeonGridInteractiveLabels.bounds(handle, pass.camera(), pass.gridSize());
            boolean selected = selectedCluster(pass.selectedRef(), cluster.clusterId());
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

    private static void drawCorridors(StructureRenderPass pass) {
        GraphicsContext gc = pass.gc();
        DungeonLayout mapModel = pass.projected();
        for (Corridor corridor : mapModel.corridors()) {
            if (corridor == null) {
                continue;
            }
            boolean selected = selectedCorridor(pass.selectedRef(), corridor.corridorId());
            WalkableSurface surface = walkableSurface(corridor.structure(), pass.projectionLevel());
            if (surface.tiles().isEmpty() && surface.doorSegments().isEmpty()) {
                continue;
            }
            gc.setFill(selected ? pass.palette().highlightFill() : pass.palette().corridorFill());
            fillRoomTiles(gc, pass.camera(), pass.gridSize(), surface.tiles());
            strokeRoomTiles(
                    gc,
                    pass.camera(),
                    pass.gridSize(),
                    surface.tiles(),
                    selected ? pass.palette().highlightStroke() : pass.palette().corridorStroke(),
                    selected ? 1.6 : 1.2);
            drawCorridorBoundaries(pass, surface.wallSegments(), selected);
            drawDoorSegments(
                    gc,
                    pass.camera(),
                    pass.gridSize(),
                    surface.doorSegments(),
                    selected ? pass.palette().selectedDoorStroke() : pass.palette().doorStroke(),
                    selected ? pass.palette().selectedDoorMarkerFill() : pass.palette().doorMarkerFill(),
                    selected ? pass.palette().selectedDoorMarkerStroke() : pass.palette().doorMarkerStroke(),
                    selected ? 3.4 : 2.6);
            if (selected && pass.editorMode()) {
                drawCorridorHandles(pass, corridor);
            }
        }
    }

    private static void drawCorridorHandles(StructureRenderPass pass, Corridor corridor) {
        for (CorridorNode node : corridor.persistedManualNodes()) {
            drawCorridorHandle(
                    pass.gc(),
                    pass.camera(),
                    pass.gridSize(),
                    node.point2x(),
                    pass.palette().highlightAccent(),
                    pass.palette().highlightStroke(),
                    Math.max(5.0, pass.gridSize() * 0.16));
        }
        for (StructureObject.PathTrace trace : corridor.structure().pathTracesAtLevel(corridor.levelZ())) {
            for (GridPoint2x corner : trace.cornerPoints2x()) {
                drawCorridorHandle(
                        pass.gc(),
                        pass.camera(),
                        pass.gridSize(),
                        corner,
                        pass.palette().highlightFill(),
                        pass.palette().highlightStroke(),
                        Math.max(4.0, pass.gridSize() * 0.13));
            }
        }
    }

    private static void drawCorridorHandle(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            GridPoint2x point2x,
            Color fill,
            Color stroke,
            double radius
    ) {
        double centerX = camera.panX() + (point2x.x2() + 1) * gridSize / 2.0;
        double centerY = camera.panY() + (point2x.y2() + 1) * gridSize / 2.0;
        double diameter = radius * 2.0;
        gc.setFill(fill);
        gc.fillOval(centerX - radius, centerY - radius, diameter, diameter);
        gc.setStroke(stroke);
        gc.setLineWidth(1.8);
        gc.strokeOval(centerX - radius, centerY - radius, diameter, diameter);
    }

    private static void drawCorridorBoundaries(StructureRenderPass pass, Set<GridSegment2x> segments, boolean selected) {
        if (segments.isEmpty()) {
            return;
        }
        pass.gc().setStroke(selected ? pass.palette().highlightStroke() : pass.palette().wallStroke());
        pass.gc().setLineWidth(selected ? 2.5 : 2.0);
        for (GridSegment2x segment2x : segments) {
            strokeSegment2x(pass.gc(), pass.camera(), pass.gridSize(), segment2x);
        }
    }

    private static void drawHoverSelection(StructureRenderPass pass) {
        EditorHover hovered = pass.hovered();
        if (pass.overlayPass() || hovered == null) {
            return;
        }
        if (hovered.scope().showsTarget()) {
            drawHoveredTarget(pass, hovered.ref());
        }
        if (hovered.scope().showsPart()) {
            drawHighlightSurfaces(
                    pass,
                    DungeonSelectionHighlightResolver.resolvePartSurfaces(
                            pass.projected(),
                            hovered.ref(),
                            pass.projectionLevel()),
                    true);
        }
    }

    private static void drawHoveredTarget(StructureRenderPass pass, DungeonSelectionRef ref) {
        if (ref == null || sameOwner(pass.selectedRef(), ref)) {
            return;
        }
        drawHighlightSurfaces(
                pass,
                DungeonSelectionHighlightResolver.resolveOwnerSurfaces(
                        pass.projected(),
                        ref,
                        pass.projectionLevel()),
                false);
    }

    private static boolean sameOwner(DungeonSelectionRef left, DungeonSelectionRef right) {
        if (left == null || right == null) {
            return false;
        }
        return Objects.equals(left, right) || left.sameOwnerAs(right);
    }

    private static boolean selectedCluster(DungeonSelectionRef selectedRef, Long clusterId) {
        return selectedOwner(selectedRef, clusterOwnerRef(clusterId));
    }

    private static boolean selectedRoom(DungeonSelectionRef selectedRef, Long roomId) {
        return selectedOwner(selectedRef, roomOwnerRef(roomId));
    }

    private static boolean selectedCorridor(DungeonSelectionRef selectedRef, Long corridorId) {
        return selectedOwner(selectedRef, corridorOwnerRef(corridorId));
    }

    private static boolean selectedStair(DungeonSelectionRef selectedRef, Long stairId) {
        return selectedOwner(selectedRef, stairOwnerRef(stairId));
    }

    private static boolean selectedTransition(DungeonSelectionRef selectedRef, Long transitionId) {
        return selectedOwner(selectedRef, transitionOwnerRef(transitionId));
    }

    private static boolean selectedOwner(DungeonSelectionRef selectedRef, DungeonSelectionRef ownerRef) {
        return selectedRef != null && ownerRef != null && selectedRef.sameOwnerAs(ownerRef);
    }

    private static DungeonSelectionRef clusterOwnerRef(Long clusterId) {
        return clusterId == null ? null : new DungeonSelectionRef.ClusterRef(clusterId);
    }

    private static DungeonSelectionRef roomOwnerRef(Long roomId) {
        return roomId == null ? null : new DungeonSelectionRef.RoomRef(roomId);
    }

    private static DungeonSelectionRef corridorOwnerRef(Long corridorId) {
        return corridorId == null ? null : new DungeonSelectionRef.CorridorRef(corridorId);
    }

    private static DungeonSelectionRef stairOwnerRef(Long stairId) {
        return stairId == null ? null : new DungeonSelectionRef.StairRef(stairId);
    }

    private static DungeonSelectionRef transitionOwnerRef(Long transitionId) {
        return transitionId == null ? null : new DungeonSelectionRef.TransitionRef(transitionId);
    }

    private static void drawHighlightSurfaces(
            StructureRenderPass pass,
            List<DungeonHitSurface> surfaces,
            boolean partHighlight
    ) {
        if (pass == null || surfaces == null || surfaces.isEmpty()) {
            return;
        }
        for (DungeonHitSurface surface : surfaces) {
            switch (surface) {
                case DungeonHitSurface.CellSurface cellSurface -> drawHighlightedCells(pass, cellSurface.cells(), partHighlight);
                case DungeonHitSurface.SegmentSurface segmentSurface -> drawHighlightedSegments(pass, segmentSurface.segments2x(), partHighlight);
                case DungeonHitSurface.PointSurface pointSurface -> drawHighlightedPoints(pass, pointSurface.points2x(), partHighlight);
                case DungeonHitSurface.LabelSurface ignored -> {
                }
            }
        }
    }

    private static void drawHighlightedCells(
            StructureRenderPass pass,
            Collection<CellCoord> cells,
            boolean partHighlight
    ) {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        double fillOpacity = partHighlight ? 0.28 : 0.2;
        double strokeOpacity = partHighlight ? 0.95 : 0.75;
        double lineWidth = partHighlight ? 2.0 : 1.6;
        pass.gc().setFill(withOpacity(pass.palette().highlightFill(), fillOpacity));
        fillRoomTiles(pass.gc(), pass.camera(), pass.gridSize(), cells);
        strokeRoomTiles(
                pass.gc(),
                pass.camera(),
                pass.gridSize(),
                cells,
                withOpacity(pass.palette().highlightStroke(), strokeOpacity),
                lineWidth);
    }

    private static void drawHighlightedSegments(
            StructureRenderPass pass,
            Collection<GridSegment2x> segments,
            boolean partHighlight
    ) {
        if (segments == null || segments.isEmpty()) {
            return;
        }
        pass.gc().setStroke(withOpacity(pass.palette().highlightStroke(), partHighlight ? 0.95 : 0.82));
        pass.gc().setLineWidth(partHighlight ? 3.0 : 2.4);
        for (GridSegment2x segment : segments) {
            if (segment != null) {
                strokeSegment2x(pass.gc(), pass.camera(), pass.gridSize(), segment);
            }
        }
    }

    private static void drawHighlightedPoints(
            StructureRenderPass pass,
            Collection<GridPoint2x> points,
            boolean partHighlight
    ) {
        if (points == null || points.isEmpty()) {
            return;
        }
        double radius = partHighlight ? Math.max(5.0, pass.gridSize() * 0.17) : Math.max(4.5, pass.gridSize() * 0.14);
        for (GridPoint2x point : points) {
            if (point != null) {
                drawCorridorHandle(
                        pass.gc(),
                        pass.camera(),
                        pass.gridSize(),
                        point,
                        withOpacity(pass.palette().highlightFill(), partHighlight ? 0.92 : 0.86),
                        withOpacity(pass.palette().highlightStroke(), 1.0),
                        radius);
            }
        }
    }

    private static void drawStairs(StructureRenderPass pass) {
        GraphicsContext gc = pass.gc();
        DungeonLayout mapModel = pass.projected();
        gc.setTextAlign(TextAlignment.CENTER);
        gc.setFont(DungeonCanvasTheme.ROOM_LABEL_FONT);
        for (DungeonStair stair : mapModel.stairs()) {
            if (stair == null) {
                continue;
            }
            boolean selected = selectedStair(pass.selectedRef(), stair.stairId());
            gc.setFill(selected ? pass.palette().highlightFill() : pass.palette().stairFill());
            gc.setStroke(selected ? pass.palette().highlightStroke() : pass.palette().stairStroke());
            gc.setLineWidth(selected ? 2.5 : 1.8);
            for (var node : stair.path()) {
                if (node.z() != pass.projectionLevel()) {
                    continue;
                }
                double x = pass.camera().panX() + node.x() * pass.gridSize();
                double y = pass.camera().panY() + node.y() * pass.gridSize();
                gc.fillRoundRect(x + pass.gridSize() * 0.18, y + pass.gridSize() * 0.18, pass.gridSize() * 0.64, pass.gridSize() * 0.64, 10, 10);
                gc.strokeRoundRect(x + pass.gridSize() * 0.18, y + pass.gridSize() * 0.18, pass.gridSize() * 0.64, pass.gridSize() * 0.64, 10, 10);
            }
            for (var exit : stair.exits()) {
                if (exit.position().z() != pass.projectionLevel()) {
                    continue;
                }
                double centerX = pass.camera().panX() + (exit.position().x() + 0.5) * pass.gridSize();
                double centerY = pass.camera().panY() + (exit.position().y() + 0.5) * pass.gridSize();
                double radius = Math.max(6.0, pass.gridSize() * 0.18);
                gc.setFill(selected ? pass.palette().highlightAccent() : pass.palette().stairExitFill());
                gc.fillOval(centerX - radius, centerY - radius, radius * 2, radius * 2);
                if (pass.editorMode() && !pass.overlayPass()) {
                    gc.setFill(pass.palette().roomText());
                    gc.fillText(Integer.toString(exit.position().z()), centerX, centerY - pass.gridSize() * 0.38);
                }
            }
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private static Set<GridSegment2x> drawStructures(StructureRenderPass pass) {
        Set<GridSegment2x> selectedBoundaryEdges = drawRooms(pass);
        drawCorridors(pass);
        drawStairs(pass);
        drawTransitions(pass);
        return selectedBoundaryEdges;
    }

    private static void drawOverlayLevels(
            GraphicsContext gc,
            DungeonSceneFrame frame
    ) {
        for (OverlayLevel overlay : overlayLevels(frame, false)) {
            drawOverlayLevel(gc, frame, overlay, LayerPalette.below(frame.editorMode()));
        }
        for (OverlayLevel overlay : overlayLevels(frame, true)) {
            drawOverlayLevel(gc, frame, overlay, LayerPalette.above(frame.editorMode()));
        }
    }

    private static void drawOverlayLevel(
            GraphicsContext gc,
            DungeonSceneFrame frame,
            OverlayLevel overlay,
            LayerPalette palette
    ) {
        DungeonLayout projected = frame.layout().projectedToLevel(overlay.level());
        if (projected.clusters().isEmpty()
                && projected.corridors().isEmpty()
                && projected.stairs().isEmpty()
                && projected.transitions().isEmpty()) {
            return;
        }
        gc.save();
        gc.setGlobalAlpha(overlay.opacity());
        StructureRenderPass overlayPass = new StructureRenderPass(
                gc,
                projected,
                frame.camera(),
                frame.editorMode(),
                frame.editor().selectedRef(),
                null,
                overlay.level(),
                palette,
                true);
        Set<GridSegment2x> selectedRoomBoundarySegments = drawStructures(overlayPass);
        drawSelectedRoomBoundaries(overlayPass, selectedRoomBoundarySegments, palette.highlightAccent());
        gc.restore();
    }

    private static List<OverlayLevel> overlayLevels(DungeonSceneFrame frame, boolean aboveCurrent) {
        if (frame == null || frame.layout() == null) {
            return List.of();
        }
        List<Integer> candidateLevels = switch (frame.levelOverlaySettings().mode()) {
            case OFF -> List.of();
            case NEARBY -> frame.layout().reachableLevels().stream()
                    .filter(level -> Math.abs(level - frame.projectionLevel()) <= frame.levelOverlaySettings().levelRange())
                    .toList();
            case SELECTED -> frame.levelOverlaySettings().selectedLevels();
        };
        List<OverlayLevel> result = new ArrayList<>();
        for (Integer candidateLevel : candidateLevels) {
            if (candidateLevel == null || candidateLevel == frame.projectionLevel()) {
                continue;
            }
            int delta = candidateLevel - frame.projectionLevel();
            if ((delta > 0) != aboveCurrent) {
                continue;
            }
            if (!frame.layout().reachableLevels().contains(candidateLevel)) {
                continue;
            }
            result.add(new OverlayLevel(candidateLevel, overlayOpacity(frame.levelOverlaySettings().opacity(), Math.abs(delta))));
        }
        result.sort((left, right) -> Integer.compare(
                Math.abs(right.level() - frame.projectionLevel()),
                Math.abs(left.level() - frame.projectionLevel())));
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
            DungeonCanvasCamera camera,
            DungeonRuntimeRenderOverlay runtime,
            int projectionLevel
    ) {
        if (runtime == null || runtime.navigation() == null || runtime.navigation().cell() == null) {
            return;
        }
        CellCoord activeCell = runtime.navigation().cell();
        if (activeCell == null || runtime.navigation().levelZ() != projectionLevel) {
            return;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        double centerX = camera.panX() + (activeCell.x() + 0.5) * gridSize;
        double centerY = camera.panY() + (activeCell.y() + 0.5) * gridSize;
        double outerRadius = Math.max(7.5, gridSize * 0.26);
        double innerRadius = Math.max(3.2, outerRadius * 0.42);
        CardinalDirection resolvedHeading = runtime.navigation().heading();
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

    private static void drawTransitions(StructureRenderPass pass) {
        GraphicsContext gc = pass.gc();
        gc.setTextAlign(TextAlignment.CENTER);
        gc.setFont(Font.font(Math.max(10.0, pass.gridSize() * 0.35)));
        for (DungeonTransition transition : pass.projected().transitions()) {
            if (transition == null || !transition.isPlaced()) {
                continue;
            }
            boolean selected = selectedTransition(pass.selectedRef(), transition.transitionId());
            if (transition.localConnection() != null && transition.localConnection().doorCarrier() != null) {
                drawDoorTransition(pass, transition, selected);
                continue;
            }
            drawStairTransition(pass, transition, selected);
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private static void drawDoorTransition(StructureRenderPass pass, DungeonTransition transition, boolean selected) {
        if (transition.localConnection() == null
                || transition.localConnection().doorCarrier() == null
                || transition.localConnection().levelZ() != pass.projectionLevel()) {
            return;
        }
        GraphicsContext gc = pass.gc();
        GridSegment2x segment2x = transition.localConnection().anchorSegment2x();
        double centerX = pass.camera().panX() + (segment2x.midpoint().x2() + 1) * pass.gridSize() / 2.0;
        double centerY = pass.camera().panY() + (segment2x.midpoint().y2() + 1) * pass.gridSize() / 2.0;
        double radius = Math.max(7.0, pass.gridSize() * 0.18);
        gc.setFill(selected ? pass.palette().highlightAccent() : pass.palette().transitionFill());
        gc.fillRoundRect(centerX - radius, centerY - radius, radius * 2, radius * 2, 8, 8);
        gc.setStroke(selected ? pass.palette().highlightStroke() : pass.palette().transitionStroke());
        gc.setLineWidth(selected ? 2.2 : 1.6);
        gc.strokeRoundRect(centerX - radius, centerY - radius, radius * 2, radius * 2, 8, 8);
        gc.setFill(DungeonCanvasTheme.LABEL_TEXT);
        gc.fillText("→", centerX, centerY + 4.0);
    }

    private static void drawStairTransition(StructureRenderPass pass, DungeonTransition transition, boolean selected) {
        StairConnectionCarrier stairPlacement = transition.localConnection() == null
                ? null
                : transition.localConnection().stairCarrier();
        if (stairPlacement == null) {
            return;
        }
        GraphicsContext gc = pass.gc();
        gc.setFill(selected ? pass.palette().highlightFill() : pass.palette().transitionFill());
        gc.setStroke(selected ? pass.palette().highlightStroke() : pass.palette().transitionStroke());
        gc.setLineWidth(selected ? 2.5 : 1.8);
        for (CubePoint node : stairPlacement.path()) {
            if (node == null || node.z() != pass.projectionLevel()) {
                continue;
            }
            double x = pass.camera().panX() + node.x() * pass.gridSize();
            double y = pass.camera().panY() + node.y() * pass.gridSize();
            gc.fillRoundRect(x + pass.gridSize() * 0.18, y + pass.gridSize() * 0.18, pass.gridSize() * 0.64, pass.gridSize() * 0.64, 10, 10);
            gc.strokeRoundRect(x + pass.gridSize() * 0.18, y + pass.gridSize() * 0.18, pass.gridSize() * 0.64, pass.gridSize() * 0.64, 10, 10);
        }
        for (Integer stopLevel : stairPlacement.stopLevels().stream().sorted().toList()) {
            CubePoint exitPoint = stairPlacement.path().stream()
                    .filter(point -> point != null && point.z() == stopLevel)
                    .findFirst()
                    .orElse(null);
            if (exitPoint == null || exitPoint.z() != pass.projectionLevel()) {
                continue;
            }
            double centerX = pass.camera().panX() + (exitPoint.x() + 0.5) * pass.gridSize();
            double centerY = pass.camera().panY() + (exitPoint.y() + 0.5) * pass.gridSize();
            double radius = Math.max(6.0, pass.gridSize() * 0.18);
            gc.setFill(selected ? pass.palette().highlightAccent() : pass.palette().transitionStroke());
            gc.fillOval(centerX - radius, centerY - radius, radius * 2, radius * 2);
            if (pass.editorMode() && !pass.overlayPass()) {
                gc.setFill(pass.palette().roomText());
                gc.fillText(Integer.toString(stopLevel), centerX, centerY - pass.gridSize() * 0.38);
            }
        }
    }

    private static void drawDoorNumbers(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            DungeonRuntimeRenderOverlay runtime
    ) {
        if (runtime == null || runtime.exitMarkers().isEmpty()) {
            return;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        for (DungeonRuntimeRenderOverlay.ExitMarker doorNumber : runtime.exitMarkers()) {
            drawDoorNumber(gc, camera, gridSize, doorNumber);
        }
    }

    private static void drawDoorNumber(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            DungeonRuntimeRenderOverlay.ExitMarker doorNumber
    ) {
        if (doorNumber == null || doorNumber.anchorSegment2x() == null) {
            return;
        }
        GridSegment2x segment2x = doorNumber.anchorSegment2x();
        GridPoint2x midpoint = segment2x.midpoint();
        double centerX = camera.panX() + (midpoint.x2() + 1) * gridSize / 2.0;
        double centerY = camera.panY() + (midpoint.y2() + 1) * gridSize / 2.0;
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
        gc.fillText(Integer.toString(doorNumber.number()), centerX, centerY + 4.0);
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private static void drawDoorSegments(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Collection<GridSegment2x> segments,
            Color stroke,
            Color markerFill,
            Color markerStroke,
            double lineWidth
    ) {
        if (segments == null || segments.isEmpty()) {
            return;
        }
        gc.setStroke(stroke);
        gc.setLineWidth(lineWidth);
        for (GridSegment2x segment2x : segments) {
            if (segment2x == null) {
                continue;
            }
            strokeSegment2x(gc, camera, gridSize, segment2x);
            drawDoorMarker(gc, camera, gridSize, segment2x, markerFill, markerStroke, lineWidth);
        }
    }

    private static void drawDoorMarker(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            GridSegment2x segment2x,
            Color fill,
            Color stroke,
            double edgeLineWidth
    ) {
        if (segment2x == null) {
            return;
        }
        GridPoint2x midpoint = segment2x.midpoint();
        double centerX = camera.panX() + (midpoint.x2() + 1) * gridSize / 2.0;
        double centerY = camera.panY() + (midpoint.y2() + 1) * gridSize / 2.0;
        boolean vertical = segment2x.isVertical();
        double width = vertical ? Math.max(8.0, gridSize * 0.18) : Math.max(13.0, gridSize * 0.44);
        double height = vertical ? Math.max(13.0, gridSize * 0.44) : Math.max(8.0, gridSize * 0.18);
        gc.setFill(fill);
        gc.fillRoundRect(centerX - width / 2.0, centerY - height / 2.0, width, height, 8, 8);
        gc.setStroke(stroke);
        gc.setLineWidth(Math.max(1.2, edgeLineWidth * 0.5));
        gc.strokeRoundRect(centerX - width / 2.0, centerY - height / 2.0, width, height, 8, 8);
    }

    private static WalkableSurface walkableSurface(
            StructureObject structure,
            int levelZ
    ) {
        if (structure == null) {
            return WalkableSurface.empty();
        }
        return walkableSurface(
                structure.floorCellCoordsAtLevel(levelZ),
                structure.boundaryEdgesAtLevel(levelZ),
                structure.openingEdgesAtLevel(levelZ));
    }

    private static WalkableSurface walkableSurface(
            Set<CellCoord> tiles,
            Set<GridSegment2x> boundarySegments,
            Set<GridSegment2x> doorSegments
    ) {
        if ((boundarySegments == null || boundarySegments.isEmpty()) && (tiles == null || tiles.isEmpty())) {
            return WalkableSurface.empty();
        }
        Set<CellCoord> resolvedTiles = tiles == null ? Set.of() : Set.copyOf(tiles);
        Set<GridSegment2x> resolvedDoors = doorSegments == null ? Set.of() : Set.copyOf(doorSegments);
        Set<GridSegment2x> wallSegments = new LinkedHashSet<>(boundarySegments == null ? Set.<GridSegment2x>of() : boundarySegments);
        wallSegments.removeAll(resolvedDoors);
        return new WalkableSurface(resolvedTiles, Set.copyOf(wallSegments), resolvedDoors);
    }

    private static void drawPaintPreview(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            Set<CellCoord> previewCells,
            boolean deleteMode
    ) {
        if (previewCells == null || previewCells.isEmpty()) {
            return;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setFill(deleteMode ? DungeonCanvasTheme.DELETE_PREVIEW_FILL : DungeonCanvasTheme.PAINT_PREVIEW_FILL);
        gc.setStroke(deleteMode ? DungeonCanvasTheme.DELETE_PREVIEW_STROKE : DungeonCanvasTheme.PAINT_PREVIEW_STROKE);
        gc.setLineWidth(1.5);
        for (CellCoord tile : previewCells) {
            double x = camera.panX() + tile.x() * gridSize;
            double y = camera.panY() + tile.y() * gridSize;
            gc.fillRect(x, y, gridSize, gridSize);
            gc.strokeRect(x, y, gridSize, gridSize);
        }
    }

    private record OverlayLevel(int level, double opacity) {
    }

    private record WalkableSurface(
            Set<CellCoord> tiles,
            Set<GridSegment2x> wallSegments,
            Set<GridSegment2x> doorSegments
    ) {
        private WalkableSurface {
            tiles = tiles == null ? Set.of() : Set.copyOf(tiles);
            wallSegments = wallSegments == null ? Set.of() : Set.copyOf(wallSegments);
            doorSegments = doorSegments == null ? Set.of() : Set.copyOf(doorSegments);
        }

        private static WalkableSurface empty() {
            return new WalkableSurface(Set.of(), Set.of(), Set.of());
        }
    }

    private record StructureRenderPass(
            GraphicsContext gc,
            DungeonLayout projected,
            DungeonCanvasCamera camera,
            double gridSize,
            boolean editorMode,
            DungeonSelectionRef selectedRef,
            EditorHover hovered,
            int projectionLevel,
            LayerPalette palette,
            boolean overlayPass
    ) {
        private StructureRenderPass(
                GraphicsContext gc,
                DungeonLayout projected,
                DungeonCanvasCamera camera,
                boolean editorMode,
                DungeonSelectionRef selectedRef,
                EditorHover hovered,
                int projectionLevel,
                LayerPalette palette,
                boolean overlayPass
        ) {
            this(
                    gc,
                    projected,
                    camera,
                    DungeonCanvasTheme.BASE_GRID * camera.zoom(),
                    editorMode,
                    selectedRef,
                    hovered,
                    projectionLevel,
                    palette,
                    overlayPass);
        }

        private boolean showRuntimeLabels() {
            return !editorMode && !overlayPass;
        }
    }

    private record LayerPalette(
            Color roomFill,
            Color roomStroke,
            Color wallStroke,
            Color highlightAccent,
            Color corridorFill,
            Color highlightFill,
            Color corridorStroke,
            Color highlightStroke,
            Color doorStroke,
            Color selectedDoorStroke,
            Color doorMarkerFill,
            Color selectedDoorMarkerFill,
            Color doorMarkerStroke,
            Color selectedDoorMarkerStroke,
            Color stairFill,
            Color stairStroke,
            Color stairExitFill,
            Color transitionFill,
            Color transitionStroke,
            Color roomText
    ) {
        private static LayerPalette current(boolean editorMode) {
            return new LayerPalette(
                    DungeonCanvasTheme.CELL_FILL,
                    DungeonCanvasTheme.grid(editorMode),
                    DungeonCanvasTheme.WALL_STROKE,
                    DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE,
                    DungeonCanvasTheme.CORRIDOR_FILL,
                    DungeonCanvasTheme.CORRIDOR_SELECTED_FILL,
                    DungeonCanvasTheme.CORRIDOR_STROKE,
                    DungeonCanvasTheme.CORRIDOR_SELECTED_STROKE,
                    DungeonCanvasTheme.DOOR_EDGE_STROKE,
                    DungeonCanvasTheme.DOOR_EDGE_SELECTED_STROKE,
                    DungeonCanvasTheme.DOOR_MARKER_FILL,
                    DungeonCanvasTheme.DOOR_MARKER_SELECTED_FILL,
                    DungeonCanvasTheme.DOOR_MARKER_STROKE,
                    DungeonCanvasTheme.DOOR_MARKER_SELECTED_STROKE,
                    DungeonCanvasTheme.CORRIDOR_FILL,
                    DungeonCanvasTheme.CORRIDOR_STROKE,
                    DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE,
                    DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE,
                    DungeonCanvasTheme.CORRIDOR_STROKE,
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
                    blend(DungeonCanvasTheme.DOOR_EDGE_STROKE, tint, 0.48),
                    blend(DungeonCanvasTheme.DOOR_EDGE_SELECTED_STROKE, tint, 0.34),
                    blend(DungeonCanvasTheme.DOOR_MARKER_FILL, tint, 0.42),
                    blend(DungeonCanvasTheme.DOOR_MARKER_SELECTED_FILL, tint, 0.34),
                    blend(DungeonCanvasTheme.DOOR_MARKER_STROKE, tint, 0.48),
                    blend(DungeonCanvasTheme.DOOR_MARKER_SELECTED_STROKE, tint, 0.34),
                    blend(DungeonCanvasTheme.CORRIDOR_FILL, tint, 0.45),
                    blend(DungeonCanvasTheme.CORRIDOR_STROKE, tint, 0.55),
                    blend(DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE, tint, 0.5),
                    blend(DungeonCanvasTheme.ROOM_SELECTED_WALL_STROKE, tint, 0.5),
                    blend(DungeonCanvasTheme.CORRIDOR_STROKE, tint, 0.55),
                    blend(DungeonCanvasTheme.text(editorMode), tint, 0.24));
        }
    }

    static final class DungeonBackdropPass {

        private DungeonBackdropPass() {
        }

        static void paint(GraphicsContext gc, double width, double height, DungeonSceneFrame frame) {
            fillBackground(gc, width, height, frame.editorMode());
            drawGrid(gc, width, height, frame.camera(), frame.editorMode());
        }
    }

    static final class DungeonStructurePass {

        private DungeonStructurePass() {
        }

        static void paintOverlayLevels(GraphicsContext gc, DungeonSceneFrame frame) {
            drawOverlayLevels(gc, frame);
        }

        static void paintCurrentLevel(GraphicsContext gc, DungeonSceneFrame frame) {
            StructureRenderPass renderPass = new StructureRenderPass(
                    gc,
                    frame.projectedLayout(),
                    frame.camera(),
                    frame.editorMode(),
                    frame.editor().selectedRef(),
                    frame.editor().hovered(),
                    frame.projectionLevel(),
                    LayerPalette.current(frame.editorMode()),
                    false);
            Set<GridSegment2x> selectedRoomBoundarySegments = drawStructures(renderPass);
            drawSelectedRoomBoundaries(renderPass, selectedRoomBoundarySegments, renderPass.palette().highlightAccent());
            if (frame.editorMode()) {
                drawHoverSelection(renderPass);
                drawInteractiveLabels(renderPass);
            }
        }
    }

    static final class DungeonRuntimeOverlayPass {

        private DungeonRuntimeOverlayPass() {
        }

        static void paint(GraphicsContext gc, DungeonSceneFrame frame) {
            DungeonRuntimeRenderOverlay runtime = frame.runtime();
            drawPartyToken(gc, frame.camera(), runtime, frame.projectionLevel());
            if (!frame.editorMode()) {
                drawDoorNumbers(gc, frame.camera(), runtime);
            }
        }
    }

    static final class DungeonEditorOverlayPass {

        private DungeonEditorOverlayPass() {
        }

        static void paint(GraphicsContext gc, DungeonSceneFrame frame) {
            if (!frame.editorMode()) {
                return;
            }
            DungeonEditorRenderState editor = frame.editor();
            if (editor.preview() instanceof EditorPreview.PaintPreview paintPreview) {
                drawPaintPreview(
                        gc,
                        frame.camera(),
                        paintPreview.cells(),
                        paintPreview.deleteMode());
            }
            if (editor.preview() instanceof EditorPreview.BoundaryPreview boundaryPreview) {
                drawBoundaryPreview(
                        gc,
                        frame.camera(),
                        DungeonCanvasTheme.BASE_GRID * frame.camera().zoom(),
                        boundaryPreview.edges(),
                        boundaryPreview.skippedConnectionEdges(),
                        boundaryPreview.startVertex2x(),
                        boundaryPreview.currentVertex2x(),
                        boundaryPreview.deleteMode());
            }
        }
    }

    static final class DungeonHudPass {

        private DungeonHudPass() {
        }

        static void paint(GraphicsContext gc, double width, double height, DungeonSceneFrame frame) {
            drawAxes(gc, width, height, frame.camera(), frame.editorMode());
            drawGridReference(gc, width, height, frame.camera());
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

    private static Color withOpacity(Color color, double opacity) {
        Color resolved = color == null ? Color.TRANSPARENT : color;
        return Color.color(
                resolved.getRed(),
                resolved.getGreen(),
                resolved.getBlue(),
                Math.max(0.0, Math.min(1.0, opacity)));
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
