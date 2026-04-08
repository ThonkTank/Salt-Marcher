package features.world.dungeon.canvas.grid;

import features.world.dungeon.canvas.base.DungeonCanvasCamera;
import features.world.dungeon.canvas.base.DungeonCanvasTheme;
import features.world.dungeon.canvas.base.DungeonEditorRenderState;
import features.world.dungeon.canvas.base.DungeonRuntimeRenderOverlay;
import features.world.dungeon.canvas.base.DungeonSceneFrame;
import features.world.dungeon.canvas.base.DungeonSceneRenderer;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridSegmentPath;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.model.interaction.InteractiveLabelHandle;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.model.structures.connection.StairConnectionCarrier;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorNode;
import features.world.dungeon.dungeonmap.corridor.model.CorridorPathTrace;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.model.structures.stair.DungeonStair;
import features.world.dungeon.model.structures.transition.DungeonTransition;
import features.world.dungeon.shell.interaction.DungeonHitSurface;
import features.world.dungeon.shell.interaction.DungeonSelectionHighlightResolver;
import features.world.dungeon.state.EditorHover;
import features.world.dungeon.state.EditorPreview;
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

    private static Set<GridSegment> drawRooms(StructureRenderPass pass) {
        GraphicsContext gc = pass.gc();
        DungeonMap mapModel = pass.projected();
        gc.setFill(pass.palette().roomFill());
        Set<GridSegment> roomBoundarySegments = new LinkedHashSet<>();
        Set<GridSegment> selectedRoomBoundarySegments = new LinkedHashSet<>();
        Set<GridSegment> roomDoorSegments = new LinkedHashSet<>();
        Set<GridSegment> selectedRoomDoorSegments = new LinkedHashSet<>();
        for (Cluster cluster : mapModel.clusters()) {
            InteractiveLabelHandle handle = cluster.labelHandle();
            boolean selectedCluster = selectedCluster(pass.projected(), pass.selectedRef(), cluster.clusterId());
            for (Room room : cluster.roomTopology().rooms()) {
                Structure roomStructure = cluster.roomTopology().structureFor(room);
                var boundary = roomStructure.boundaryAtLevel(pass.projectionLevel());
                WalkableSurface surface = walkableSurface(
                        roomStructure.surfaceAtLevel(pass.projectionLevel()).floor().cellFootprint().cells(),
                        boundary.boundary().segments(),
                        boundary.doorBoundary().segments());
                boolean selectedRoom = selectedRoom(pass.projected(), pass.selectedRef(), room.roomId());
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
                            roomStructure.surfaceAtLevel(pass.projectionLevel()).surface().anchorCell());
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
            Collection<GridPoint> tiles
    ) {
        for (GridPoint tile : tiles) {
            double x = camera.panX() + cellX(tile) * gridSize;
            double y = camera.panY() + cellY(tile) * gridSize;
            gc.fillRect(x, y, gridSize, gridSize);
        }
    }

    private static void strokeRoomTiles(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Collection<GridPoint> tiles,
            javafx.scene.paint.Color stroke,
            double lineWidth
    ) {
        gc.setStroke(stroke);
        gc.setLineWidth(lineWidth);
        for (GridPoint tile : tiles) {
            double x = camera.panX() + cellX(tile) * gridSize;
            double y = camera.panY() + cellY(tile) * gridSize;
            gc.strokeRect(x, y, gridSize, gridSize);
        }
    }

    private static void drawRoomBoundaries(StructureRenderPass pass, Set<GridSegment> segments, Color stroke) {
        if (segments.isEmpty()) {
            return;
        }
        pass.gc().setStroke(stroke);
        pass.gc().setLineWidth(2.0);
        for (GridSegment segment2x : segments) {
            strokeSegment2x(pass.gc(), pass.camera(), pass.gridSize(), segment2x);
        }
    }

    private static void drawSelectedRoomBoundaries(StructureRenderPass pass, Set<GridSegment> segments, Color stroke) {
        if (segments.isEmpty()) {
            return;
        }
        pass.gc().setStroke(stroke);
        pass.gc().setLineWidth(2.6);
        for (GridSegment segment2x : segments) {
            strokeSegment2x(pass.gc(), pass.camera(), pass.gridSize(), segment2x);
        }
    }

    private static void drawBoundaryPreview(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            GridSegmentPath previewPath,
            GridPoint startVertex,
            GridPoint currentVertex,
            boolean deleteMode
    ) {
        if (previewPath != null && !previewPath.isEmpty()) {
            gc.setStroke(deleteMode ? DungeonCanvasTheme.BOUNDARY_DELETE_PREVIEW_STROKE : DungeonCanvasTheme.BOUNDARY_PREVIEW_STROKE);
            gc.setLineWidth(3.2);
            for (GridSegment segment2x : previewPath.segments()) {
                strokeSegment2x(gc, camera, gridSize, segment2x);
            }
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
            GridPoint vertex2x,
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
            GridSegment segment2x
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
            GridPoint labelAnchor
    ) {
        if (roomName == null || roomName.isBlank() || labelAnchor == null) {
            return;
        }
        double centerX = camera.panX() + (labelAnchor.x2() / 2.0 + 0.15) * gridSize;
        double centerY = camera.panY() + (labelAnchor.y2() / 2.0 + 0.55) * gridSize;
        gc.fillText(roomName, centerX, centerY);
    }

    private static void drawInteractiveLabels(StructureRenderPass pass) {
        GraphicsContext gc = pass.gc();
        gc.setFont(DungeonCanvasTheme.HUD_FONT);
        gc.setTextAlign(TextAlignment.CENTER);
        for (Cluster cluster : pass.projected().clusters()) {
            InteractiveLabelHandle handle = cluster.labelHandle();
            javafx.geometry.Rectangle2D bounds = DungeonGridInteractiveLabels.bounds(handle, pass.camera(), pass.gridSize());
            boolean selected = selectedCluster(pass.projected(), pass.selectedRef(), cluster.clusterId());
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
        DungeonMap mapModel = pass.projected();
        for (Corridor corridor : mapModel.corridors()) {
            if (corridor == null) {
                continue;
            }
            boolean selected = selectedCorridor(pass.projected(), pass.selectedRef(), corridor.corridorId());
            WalkableSurface surface = walkableSurface(
                    corridor.surfaceAtLevel(pass.projectionLevel()).floor().cellFootprint().cells(),
                    corridor.boundaryAtLevel(pass.projectionLevel()).boundary().segments(),
                    corridor.boundaryDoorBoundary().segments());
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
        for (var node : corridor.fixedNodes()) {
            drawCorridorHandle(
                    pass.gc(),
                    pass.camera(),
                    pass.gridSize(),
                    node.fixedPoint(),
                    pass.palette().highlightAccent(),
                    pass.palette().highlightStroke(),
                    Math.max(5.0, pass.gridSize() * 0.16));
        }
        for (CorridorPathTrace trace : corridor.pathTraces()) {
            for (GridPoint corner : corridorTurnPoints(trace.segmentPath())) {
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

    private static List<GridPoint> corridorTurnPoints(GridSegmentPath path) {
        if (path == null || path.segments().size() < 2) {
            return List.of();
        }
        ArrayList<GridPoint> result = new ArrayList<>();
        List<GridSegment> segments = path.segments();
        for (int index = 1; index < segments.size(); index++) {
            GridSegment previous = segments.get(index - 1);
            GridSegment current = segments.get(index);
            if (previous.orientation() != current.orientation()) {
                result.add(current.start());
            }
        }
        return List.copyOf(result);
    }

    private static void drawCorridorHandle(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            GridPoint point2x,
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

    private static void drawCorridorBoundaries(StructureRenderPass pass, Set<GridSegment> segments, boolean selected) {
        if (segments.isEmpty()) {
            return;
        }
        pass.gc().setStroke(selected ? pass.palette().highlightStroke() : pass.palette().wallStroke());
        pass.gc().setLineWidth(selected ? 2.5 : 2.0);
        for (GridSegment segment2x : segments) {
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
        if (ref == null || sameOwner(pass.projected(), pass.selectedRef(), ref)) {
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

    private static boolean sameOwner(DungeonMap layout, DungeonSelectionRef left, DungeonSelectionRef right) {
        if (left == null || right == null) {
            return false;
        }
        DungeonSelectionRef leftOwner = layout == null ? null : layout.ownerRef(left);
        DungeonSelectionRef rightOwner = layout == null ? null : layout.ownerRef(right);
        return Objects.equals(left, right) || leftOwner != null && Objects.equals(leftOwner, rightOwner);
    }

    private static boolean selectedCluster(DungeonMap layout, DungeonSelectionRef selectedRef, Long clusterId) {
        return selectedOwner(layout, selectedRef, clusterOwnerRef(clusterId));
    }

    private static boolean selectedRoom(DungeonMap layout, DungeonSelectionRef selectedRef, Long roomId) {
        return selectedOwner(layout, selectedRef, roomOwnerRef(roomId));
    }

    private static boolean selectedCorridor(DungeonMap layout, DungeonSelectionRef selectedRef, Long corridorId) {
        return selectedOwner(layout, selectedRef, corridorOwnerRef(corridorId));
    }

    private static boolean selectedStair(DungeonMap layout, DungeonSelectionRef selectedRef, Long stairId) {
        return selectedOwner(layout, selectedRef, stairOwnerRef(stairId));
    }

    private static boolean selectedTransition(DungeonMap layout, DungeonSelectionRef selectedRef, Long transitionId) {
        return selectedOwner(layout, selectedRef, transitionOwnerRef(transitionId));
    }

    private static boolean selectedOwner(DungeonMap layout, DungeonSelectionRef selectedRef, DungeonSelectionRef ownerRef) {
        if (layout == null || selectedRef == null || ownerRef == null) {
            return false;
        }
        DungeonSelectionRef selectedOwner = layout.ownerRef(selectedRef);
        return selectedOwner != null && Objects.equals(selectedOwner, ownerRef);
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
                case DungeonHitSurface.SegmentSurface segmentSurface -> drawHighlightedSegments(pass, segmentSurface.segments(), partHighlight);
                case DungeonHitSurface.PointSurface pointSurface -> drawHighlightedPoints(pass, pointSurface.points(), partHighlight);
                case DungeonHitSurface.LabelSurface ignored -> {
                }
            }
        }
    }

    private static void drawHighlightedCells(
            StructureRenderPass pass,
            Collection<GridPoint> cells,
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
            Collection<GridSegment> segments,
            boolean partHighlight
    ) {
        if (segments == null || segments.isEmpty()) {
            return;
        }
        pass.gc().setStroke(withOpacity(pass.palette().highlightStroke(), partHighlight ? 0.95 : 0.82));
        pass.gc().setLineWidth(partHighlight ? 3.0 : 2.4);
        for (GridSegment segment : segments) {
            if (segment != null) {
                strokeSegment2x(pass.gc(), pass.camera(), pass.gridSize(), segment);
            }
        }
    }

    private static void drawHighlightedPoints(
            StructureRenderPass pass,
            Collection<GridPoint> points,
            boolean partHighlight
    ) {
        if (points == null || points.isEmpty()) {
            return;
        }
        double radius = partHighlight ? Math.max(5.0, pass.gridSize() * 0.17) : Math.max(4.5, pass.gridSize() * 0.14);
        for (GridPoint point : points) {
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
        DungeonMap mapModel = pass.projected();
        gc.setTextAlign(TextAlignment.CENTER);
        gc.setFont(DungeonCanvasTheme.ROOM_LABEL_FONT);
        for (DungeonStair stair : mapModel.stairs()) {
            if (stair == null) {
                continue;
            }
            boolean selected = selectedStair(pass.projected(), pass.selectedRef(), stair.stairId());
            gc.setFill(selected ? pass.palette().highlightFill() : pass.palette().stairFill());
            gc.setStroke(selected ? pass.palette().highlightStroke() : pass.palette().stairStroke());
            gc.setLineWidth(selected ? 2.5 : 1.8);
            for (var node : stair.gridPath().points()) {
                if (node.z() != pass.projectionLevel()) {
                    continue;
                }
                double x = pass.camera().panX() + cellX(node) * pass.gridSize();
                double y = pass.camera().panY() + cellY(node) * pass.gridSize();
                gc.fillRoundRect(x + pass.gridSize() * 0.18, y + pass.gridSize() * 0.18, pass.gridSize() * 0.64, pass.gridSize() * 0.64, 10, 10);
                gc.strokeRoundRect(x + pass.gridSize() * 0.18, y + pass.gridSize() * 0.18, pass.gridSize() * 0.64, pass.gridSize() * 0.64, 10, 10);
            }
            for (var exit : stair.exits()) {
                if (exit.cell().z() != pass.projectionLevel()) {
                    continue;
                }
                double centerX = pass.camera().panX() + (cellX(exit.cell()) + 0.5) * pass.gridSize();
                double centerY = pass.camera().panY() + (cellY(exit.cell()) + 0.5) * pass.gridSize();
                double radius = Math.max(6.0, pass.gridSize() * 0.18);
                gc.setFill(selected ? pass.palette().highlightAccent() : pass.palette().stairExitFill());
                gc.fillOval(centerX - radius, centerY - radius, radius * 2, radius * 2);
                if (pass.editorMode() && !pass.overlayPass()) {
                    gc.setFill(pass.palette().roomText());
                    gc.fillText(Integer.toString(exit.cell().z()), centerX, centerY - pass.gridSize() * 0.38);
                }
            }
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private static Set<GridSegment> drawStructures(StructureRenderPass pass) {
        Set<GridSegment> selectedBoundaryEdges = drawRooms(pass);
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
        DungeonMap projected = frame.layout().projectedToLevel(overlay.level());
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
        Set<GridSegment> selectedRoomBoundarySegments = drawStructures(overlayPass);
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
        GridPoint activeCell = runtime.navigation().cell();
        if (activeCell == null || runtime.navigation().levelZ() != projectionLevel) {
            return;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        double centerX = camera.panX() + (cellX(activeCell) + 0.5) * gridSize;
        double centerY = camera.panY() + (cellY(activeCell) + 0.5) * gridSize;
        double outerRadius = Math.max(7.5, gridSize * 0.26);
        double innerRadius = Math.max(3.2, outerRadius * 0.42);
        CardinalDirection resolvedHeading = runtime.navigation().heading();
        double forwardX = resolvedHeading.dxCells();
        double forwardY = resolvedHeading.dyCells();
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
            boolean selected = selectedTransition(pass.projected(), pass.selectedRef(), transition.transitionId());
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
        GridSegment segment = transition.localConnection().anchorSegment(pass.projected());
        if (segment == null) {
            return;
        }
        double centerX = pass.camera().panX() + (segment.midpoint().x2() + 1) * pass.gridSize() / 2.0;
        double centerY = pass.camera().panY() + (segment.midpoint().y2() + 1) * pass.gridSize() / 2.0;
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
        for (GridPoint node : stairPlacement.stair().gridPath().points()) {
            if (node == null || node.z() != pass.projectionLevel()) {
                continue;
            }
            double x = pass.camera().panX() + cellX(node) * pass.gridSize();
            double y = pass.camera().panY() + cellY(node) * pass.gridSize();
            gc.fillRoundRect(x + pass.gridSize() * 0.18, y + pass.gridSize() * 0.18, pass.gridSize() * 0.64, pass.gridSize() * 0.64, 10, 10);
            gc.strokeRoundRect(x + pass.gridSize() * 0.18, y + pass.gridSize() * 0.18, pass.gridSize() * 0.64, pass.gridSize() * 0.64, 10, 10);
        }
        for (Integer stopLevel : stairPlacement.stair().stopLevels().stream().sorted().toList()) {
            GridPoint exitPoint = stairPlacement.stair().gridPath().points().stream()
                    .filter(point -> point != null && point.z() == stopLevel)
                    .findFirst()
                    .orElse(null);
            if (exitPoint == null || exitPoint.z() != pass.projectionLevel()) {
                continue;
            }
            double centerX = pass.camera().panX() + (cellX(exitPoint) + 0.5) * pass.gridSize();
            double centerY = pass.camera().panY() + (cellY(exitPoint) + 0.5) * pass.gridSize();
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
            DungeonRuntimeRenderOverlay runtime,
            DungeonSceneFrame frame
    ) {
        if (runtime == null || runtime.exitMarkers().isEmpty()) {
            return;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        for (DungeonRuntimeRenderOverlay.ExitMarker doorNumber : runtime.exitMarkers()) {
            drawDoorNumber(gc, camera, gridSize, doorNumber, frame);
        }
    }

    private static void drawDoorNumber(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            DungeonRuntimeRenderOverlay.ExitMarker doorNumber,
            DungeonSceneFrame frame
    ) {
        if (doorNumber == null || doorNumber.doorRef() == null || frame == null || frame.layout() == null) {
            return;
        }
        var description = frame.layout().describeDoor(doorNumber.doorRef());
        GridSegment segment2x = description == null ? null : description.anchorSegment();
        if (segment2x == null) {
            return;
        }
        GridPoint midpoint = segment2x.midpoint();
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
            Collection<GridSegment> segments,
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
        for (GridSegment segment2x : segments) {
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
            GridSegment segment2x,
            Color fill,
            Color stroke,
            double edgeLineWidth
    ) {
        if (segment2x == null) {
            return;
        }
        GridPoint midpoint = segment2x.midpoint();
        double centerX = camera.panX() + (midpoint.x2() + 1) * gridSize / 2.0;
        double centerY = camera.panY() + (midpoint.y2() + 1) * gridSize / 2.0;
        boolean vertical = segment2x.orientation() == GridSegment.Orientation.VERTICAL;
        double width = vertical ? Math.max(8.0, gridSize * 0.18) : Math.max(13.0, gridSize * 0.44);
        double height = vertical ? Math.max(13.0, gridSize * 0.44) : Math.max(8.0, gridSize * 0.18);
        gc.setFill(fill);
        gc.fillRoundRect(centerX - width / 2.0, centerY - height / 2.0, width, height, 8, 8);
        gc.setStroke(stroke);
        gc.setLineWidth(Math.max(1.2, edgeLineWidth * 0.5));
        gc.strokeRoundRect(centerX - width / 2.0, centerY - height / 2.0, width, height, 8, 8);
    }

    private static WalkableSurface walkableSurface(
            Structure structure,
            int levelZ
    ) {
        if (structure == null) {
            return WalkableSurface.empty();
        }
        return walkableSurface(
                structure.surfaceAtLevel(levelZ).floor().cellFootprint().cells(),
                structure.boundaryAtLevel(levelZ).boundary().segments(),
                structure.boundaryAtLevel(levelZ).doorBoundary().segments());
    }

    private static WalkableSurface walkableSurface(
            Set<GridPoint> tiles,
            Set<GridSegment> boundarySegments,
            Set<GridSegment> doorSegments
    ) {
        if ((boundarySegments == null || boundarySegments.isEmpty()) && (tiles == null || tiles.isEmpty())) {
            return WalkableSurface.empty();
        }
        Set<GridPoint> resolvedTiles = tiles == null ? Set.of() : Set.copyOf(tiles);
        Set<GridSegment> resolvedDoors = doorSegments == null ? Set.of() : Set.copyOf(doorSegments);
        Set<GridSegment> resolvedBoundaries = boundarySegments == null ? Set.of() : Set.copyOf(boundarySegments);
        return new WalkableSurface(resolvedTiles, resolvedBoundaries, resolvedDoors);
    }

    private static void drawPaintPreview(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            GridArea previewArea,
            boolean deleteMode
    ) {
        if (previewArea == null || previewArea.isEmpty()) {
            return;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setFill(deleteMode ? DungeonCanvasTheme.DELETE_PREVIEW_FILL : DungeonCanvasTheme.PAINT_PREVIEW_FILL);
        gc.setStroke(deleteMode ? DungeonCanvasTheme.DELETE_PREVIEW_STROKE : DungeonCanvasTheme.PAINT_PREVIEW_STROKE);
        gc.setLineWidth(1.5);
        for (GridPoint tile : previewArea.cells()) {
            double x = camera.panX() + cellX(tile) * gridSize;
            double y = camera.panY() + cellY(tile) * gridSize;
            gc.fillRect(x, y, gridSize, gridSize);
            gc.strokeRect(x, y, gridSize, gridSize);
        }
    }

    private record OverlayLevel(int level, double opacity) {
    }

    private record WalkableSurface(
            Set<GridPoint> tiles,
            Set<GridSegment> wallSegments,
            Set<GridSegment> doorSegments
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
            DungeonMap projected,
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
                DungeonMap projected,
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
            Set<GridSegment> selectedRoomBoundarySegments = drawStructures(renderPass);
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
                drawDoorNumbers(gc, frame.camera(), runtime, frame);
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
                        paintPreview.area(),
                        paintPreview.deleteMode());
            }
            if (editor.preview() instanceof EditorPreview.BoundaryPreview boundaryPreview) {
                drawBoundaryPreview(
                        gc,
                        frame.camera(),
                        DungeonCanvasTheme.BASE_GRID * frame.camera().zoom(),
                        boundaryPreview.path(),
                        boundaryPreview.startVertex(),
                        boundaryPreview.currentVertex(),
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

    private static int cellX(GridPoint point) {
        return point.x2() / 2;
    }

    private static int cellY(GridPoint point) {
        return point.y2() / 2;
    }
}
