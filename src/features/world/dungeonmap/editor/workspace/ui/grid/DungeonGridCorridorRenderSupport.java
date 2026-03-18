package features.world.dungeonmap.editor.workspace.ui.grid;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneContext;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonCorridorProjectionSupport;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonPaneCorridorWorkspace;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPanePreviewModel;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneRenderState;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.canvas.rendering.CorridorMarkerRenderer;
import features.world.dungeonmap.canvas.rendering.CorridorRenderKeys;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.rendering.DungeonGridScreenMath;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

import java.util.LinkedHashSet;
import java.util.Set;

final class DungeonGridCorridorRenderSupport {

    private final DungeonPaneContext context;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;
    private final DungeonPaneRenderState renderState;
    private final DungeonGridRegionRenderSupport regionSupport;

    DungeonGridCorridorRenderSupport(
            DungeonPaneContext context,
            DungeonPanePreviewModel previewModel,
            DungeonPaneCorridorWorkspace corridorWorkspace,
            DungeonPaneRenderState renderState,
            DungeonGridRegionRenderSupport regionSupport
    ) {
        this.context = context;
        this.previewModel = previewModel;
        this.corridorWorkspace = corridorWorkspace;
        this.renderState = renderState;
        this.regionSupport = regionSupport;
    }

    void drawCorridors(GraphicsContext gc, Set<CorridorRenderKeys.CorridorSegmentKey> openSegments, Set<Long> encodedOpenSegments) {
        DungeonLayoutRenderData corridorRenderData = context.layoutRenderData();
        if (corridorRenderData == null) {
            return;
        }
        Set<Point2i> allCorridorCells = displayedCorridorCells(corridorRenderData);
        if (allCorridorCells.isEmpty()) {
            return;
        }
        regionSupport.drawRegion(
                gc,
                allCorridorCells,
                Point2D.ZERO,
                DungeonCanvasTheme.CORRIDOR,
                DungeonCanvasTheme.ROOM_STROKE,
                2,
                openSegments,
                encodedOpenSegments);

        for (DungeonCorridor corridor : context.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorWorkspace.corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable() || geometry.cells().isEmpty()) {
                continue;
            }
            gc.setFill(fillColor(corridor));
            Point2D previewOffset = previewModel.corridorPreviewOffset(corridor);
            for (Point2i cell : geometry.cells()) {
                double x = previewModel.previewScreenX(cell.x(), previewOffset);
                double y = previewModel.previewScreenY(cell.y(), previewOffset);
                double width = previewModel.previewScreenX(cell.x() + 1, previewOffset) - x;
                double height = previewModel.previewScreenY(cell.y() + 1, previewOffset) - y;
                gc.fillRect(x, y, width, height);
            }
        }
    }

    void drawDoors(GraphicsContext gc) {
        if (context.layoutRenderData() == null) {
            return;
        }
        for (DungeonCorridor corridor : context.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorWorkspace.corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            gc.setStroke(doorColor(corridor));
            gc.setLineWidth(context.selectionState().isSelected(corridor) ? DungeonCanvasTheme.GRID_DOOR_LINE_WIDTH_SELECTED : context.selectionState().isHovered(corridor) ? DungeonCanvasTheme.GRID_DOOR_LINE_WIDTH_HOVERED : DungeonCanvasTheme.GRID_DOOR_LINE_WIDTH);
            for (DoorSegment door : geometry.doors()) {
                if (corridorWorkspace.isPreviewDoor(corridor.corridorId(), door.roomId())) {
                    continue;
                }
                Point2D previewOffset = previewModel.doorPreviewOffset(door);
                gc.strokeLine(
                        previewModel.previewScreenX(door.start().x(), previewOffset),
                        previewModel.previewScreenY(door.start().y(), previewOffset),
                        previewModel.previewScreenX(door.end().x(), previewOffset),
                        previewModel.previewScreenY(door.end().y(), previewOffset));
            }
        }
        drawPreviewDoor(gc);
    }

    void drawCorridorEditHandles(GraphicsContext gc) {
        DungeonCorridorProjectionSupport.CorridorSelectionContext selectedContext = corridorWorkspace.selectedCorridorContext();
        CorridorEditInteractionController.PressMode pressMode = corridorWorkspace.corridorPressMode();
        if (!renderState.editable()
                || selectedContext == null
                || renderState.editorTool() != DungeonEditorTool.SELECT
                || pressMode == CorridorEditInteractionController.PressMode.DEFAULT) {
            return;
        }
        Point2D previewOffset = previewModel.corridorPreviewOffset(selectedContext.corridor());
        drawSegmentDoorHandles(gc, selectedContext, pressMode, previewOffset);
        drawWaypointHandles(gc, selectedContext, previewOffset);
    }

    private void drawSegmentDoorHandles(GraphicsContext gc,
            DungeonCorridorProjectionSupport.CorridorSelectionContext selectedContext,
            CorridorEditInteractionController.PressMode pressMode,
            Point2D previewOffset) {
        Color segmentColor = pressMode == CorridorEditInteractionController.PressMode.REMOVE_WAYPOINT
                ? DungeonCanvasTheme.ROOM_SELECTED_STROKE
                : DungeonCanvasTheme.CORRIDOR_SELECTED;
        for (features.world.dungeonmap.corridors.model.GridSegment segment : selectedContext.geometry().segments()) {
            CorridorMarkerRenderer.drawSegmentLine(gc,
                    previewModel.previewScreenX(segment.from().x() + 0.5, previewOffset),
                    previewModel.previewScreenY(segment.from().y() + 0.5, previewOffset),
                    previewModel.previewScreenX(segment.to().x() + 0.5, previewOffset),
                    previewModel.previewScreenY(segment.to().y() + 0.5, previewOffset),
                    4, segmentColor);
        }
        for (DoorSegment door : selectedContext.geometry().doors()) {
            double centerX = (previewModel.previewScreenX(door.start().x(), previewOffset) + previewModel.previewScreenX(door.end().x(), previewOffset)) / 2.0;
            double centerY = (previewModel.previewScreenY(door.start().y(), previewOffset) + previewModel.previewScreenY(door.end().y(), previewOffset)) / 2.0;
            CorridorDoorHandle handle = corridorWorkspace.corridorDoorHandleForRoom(door.roomId());
            boolean handleSelected = corridorWorkspace.isSelected(handle);
            double radius = handleSelected ? DungeonCanvasTheme.DOOR_MARKER_OUTER_RADIUS : DungeonCanvasTheme.DOOR_MARKER_INNER_RADIUS;
            Color handleFill = handleSelected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.DOOR_SELECTED;
            CorridorMarkerRenderer.drawDoorMarker(gc, centerX, centerY, radius, radius, handleFill, DungeonCanvasTheme.MARKER_OUTLINE);
        }
    }

    private void drawWaypointHandles(GraphicsContext gc,
            DungeonCorridorProjectionSupport.CorridorSelectionContext selectedContext,
            Point2D previewOffset) {
        for (Point2i waypoint : selectedContext.geometry().waypointCells()) {
            double centerX = previewModel.previewScreenX(waypoint.x() + 0.5, previewOffset);
            double centerY = previewModel.previewScreenY(waypoint.y() + 0.5, previewOffset);
            CorridorMarkerRenderer.drawWaypointHandle(gc, centerX, centerY,
                    DungeonCanvasTheme.WAYPOINT_HANDLE_RADIUS,
                    DungeonCanvasTheme.CORRIDOR_SELECTED, DungeonCanvasTheme.MARKER_OUTLINE);
        }
    }

    Set<CorridorRenderKeys.CorridorSegmentKey> allDoorSegments() {
        if (context.layoutRenderData() == null || context.dungeonLayout() == null) {
            return Set.of();
        }
        return DungeonGridScreenMath.allDoorSegments(context.dungeonLayout(), corridorWorkspace::corridorGeometryForDisplay);
    }

    private Set<Point2i> displayedCorridorCells(DungeonLayoutRenderData corridorRenderData) {
        if (context.dungeonLayout() == null || !previewModel.hasClusterDragPreview()) {
            return corridorRenderData.corridorCells();
        }
        Set<Point2i> cells = new LinkedHashSet<>();
        for (DungeonCorridor corridor : context.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorWorkspace.corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            cells.addAll(geometry.cells());
        }
        return cells;
    }

    private void drawPreviewDoor(GraphicsContext gc) {
        CorridorEditInteractionController.DoorDragPreview preview = corridorWorkspace.corridorDoorPreview();
        if (preview == null || preview.previewSegment() == null || corridorWorkspace.previewCorridorDoorHandle() == null) {
            return;
        }
        DungeonCorridor corridor = context.dungeonLayout() == null ? null : context.dungeonLayout().corridorById(corridorWorkspace.previewCorridorDoorHandle().corridorId());
        if (corridor == null) {
            return;
        }
        gc.setStroke(doorColor(corridor));
        gc.setLineWidth(context.selectionState().isSelected(corridor) ? DungeonCanvasTheme.GRID_DOOR_LINE_WIDTH_SELECTED : context.selectionState().isHovered(corridor) ? DungeonCanvasTheme.GRID_DOOR_LINE_WIDTH_HOVERED : DungeonCanvasTheme.GRID_DOOR_LINE_WIDTH);
        CorridorEditInteractionController.DoorPreviewSegment segment = preview.previewSegment();
        gc.strokeLine(
                context.camera().toScreenX(segment.startWorldX()),
                context.camera().toScreenY(segment.startWorldY()),
                context.camera().toScreenX(segment.endWorldX()),
                context.camera().toScreenY(segment.endWorldY()));
    }

    private Color fillColor(DungeonCorridor corridor) {
        return DungeonCanvasTheme.resolveCorridorFillColor(
                context.selectionState().isSelected(corridor),
                context.selectionState().isHovered(corridor),
                context.selectionState().isActive(corridor));
    }

    private Color doorColor(DungeonCorridor corridor) {
        return DungeonCanvasTheme.resolveCorridorDoorColor(
                context.selectionState().isSelected(corridor),
                context.selectionState().isHovered(corridor),
                context.selectionState().isActive(corridor));
    }
}
