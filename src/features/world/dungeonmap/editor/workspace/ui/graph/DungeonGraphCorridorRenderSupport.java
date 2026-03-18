package features.world.dungeonmap.editor.workspace.ui.graph;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneContext;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonPaneCorridorWorkspace;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPanePreviewModel;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneRenderState;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.canvas.rendering.CorridorMarkerRenderer;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasTheme;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

final class DungeonGraphCorridorRenderSupport {

    private final DungeonPaneContext context;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;
    private final DungeonPaneRenderState renderState;
    private final DungeonGraphCorridorLayoutSupport layoutSupport;
    private final DungeonGraphCorridorGeometrySupport geometrySupport;

    DungeonGraphCorridorRenderSupport(
            DungeonPaneContext context,
            DungeonPanePreviewModel previewModel,
            DungeonPaneCorridorWorkspace corridorWorkspace,
            DungeonPaneRenderState renderState,
            DungeonGraphCorridorLayoutSupport layoutSupport,
            DungeonGraphCorridorGeometrySupport geometrySupport
    ) {
        this.context = context;
        this.previewModel = previewModel;
        this.corridorWorkspace = corridorWorkspace;
        this.renderState = renderState;
        this.layoutSupport = layoutSupport;
        this.geometrySupport = geometrySupport;
    }

    void renderCorridors(GraphicsContext gc) {
        if (context.dungeonLayout() == null) {
            return;
        }
        for (DungeonCorridor corridor : context.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorWorkspace.corridorGeometryForDisplay(corridor);
            if (geometry == null) {
                continue;
            }
            if (!geometry.routable()) {
                drawInvalidCorridor(gc, corridor, geometry);
                continue;
            }
            Point2D previewOffset = previewModel.corridorPreviewOffset(corridor);
            DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath = layoutSupport.displayPath(corridor);
            gc.setStroke(strokeColorFor(corridor));
            gc.setLineWidth(context.selectionState().isSelected(corridor) ? DungeonCanvasTheme.CORRIDOR_SELECTED_LINE_WIDTH : context.selectionState().isHovered(corridor) ? DungeonCanvasTheme.CORRIDOR_PREVIEW_LINE_WIDTH : DungeonCanvasTheme.CORRIDOR_LINE_WIDTH);
            gc.setLineDashes(null);
            drawCorridorPath(gc, displayPath, previewOffset);
            drawCorridorDoors(gc, corridor, geometry);
            drawCorridorSegmentHandles(gc, displayPath, corridor, previewOffset);
            drawCorridorDoorMarkers(gc, corridor, geometry, displayPath, previewOffset);
            drawCorridorWaypointMarkers(gc, corridor, geometry, previewOffset);
        }
    }

    private void drawCorridorPath(GraphicsContext gc, DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath, Point2D previewOffset) {
        if (displayPath == null || displayPath.segments().isEmpty()) {
            return;
        }
        for (DungeonGraphCorridorLayoutSupport.OffsetLine offsetLine : displayPath.segments()) {
            gc.strokeLine(
                    offsetLine.x1() + screenDeltaX(previewOffset),
                    offsetLine.y1() + screenDeltaY(previewOffset),
                    offsetLine.x2() + screenDeltaX(previewOffset),
                    offsetLine.y2() + screenDeltaY(previewOffset));
        }
    }

    private void drawCorridorDoors(GraphicsContext gc, DungeonCorridor corridor, CorridorGeometry geometry) {
        gc.setLineWidth(2);
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
        drawPreviewDoor(gc, corridor);
    }

    private void drawCorridorSegmentHandles(
            GraphicsContext gc,
            DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath,
            DungeonCorridor corridor,
            Point2D previewOffset
    ) {
        DungeonGraphPane.CorridorPressMode pressMode = corridorPressMode();
        if (!renderState.editable()
                || renderState.editorTool() != DungeonEditorTool.SELECT
                || !context.selectionState().isSelected(corridor)
                || displayPath == null
                || pressMode == DungeonGraphPane.CorridorPressMode.DEFAULT) {
            return;
        }
        Color segmentColor = pressMode == DungeonGraphPane.CorridorPressMode.REMOVE_WAYPOINT
                ? DungeonCanvasTheme.HANDLE_REMOVE
                : DungeonCanvasTheme.HANDLE_INSERT;
        for (DungeonGraphCorridorLayoutSupport.OffsetLine segment : displayPath.segments()) {
            if (segment.canonicalSegment() == null) {
                continue;
            }
            CorridorMarkerRenderer.drawSegmentLine(gc,
                    segment.x1() + screenDeltaX(previewOffset),
                    segment.y1() + screenDeltaY(previewOffset),
                    segment.x2() + screenDeltaX(previewOffset),
                    segment.y2() + screenDeltaY(previewOffset),
                    7, segmentColor);
        }
    }

    private void drawCorridorDoorMarkers(
            GraphicsContext gc,
            DungeonCorridor corridor,
            CorridorGeometry geometry,
            DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath,
            Point2D previewOffset
    ) {
        boolean showDeleteMarkers = renderState.editable() && renderState.editorTool() == DungeonEditorTool.CORRIDOR_DELETE;
        boolean showSelectionMarkers = renderState.editable()
                && renderState.editorTool() == DungeonEditorTool.SELECT
                && context.selectionState().isSelected(corridor);
        if (!showDeleteMarkers && !showSelectionMarkers) {
            return;
        }
        Color markerColor = strokeColorFor(corridor);
        for (DoorSegment door : geometry.doors()) {
            if (corridorWorkspace.isPreviewDoor(corridor.corridorId(), door.roomId())) {
                continue;
            }
            DungeonGraphCorridorGeometrySupport.MarkerPoint marker = geometrySupport.markerPoint(door, corridor.corridorId(), displayPath);
            CorridorDoorHandle handle = corridorWorkspace.corridorDoorHandleForRoom(door.roomId());
            Point2D doorPreviewOffset = previewModel.doorPreviewOffset(door);
            boolean handleSelected = corridorWorkspace.isSelected(handle);
            double radius = handleSelected ? DungeonCanvasTheme.DOOR_MARKER_OUTER_RADIUS : DungeonCanvasTheme.DOOR_MARKER_INNER_RADIUS;
            Color handleFill = handleSelected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : markerColor;
            CorridorMarkerRenderer.drawDoorMarker(gc,
                    marker.x() + screenDeltaX(doorPreviewOffset),
                    marker.y() + screenDeltaY(doorPreviewOffset),
                    radius, radius, handleFill, DungeonCanvasTheme.MARKER_OUTLINE);
        }
        drawPreviewDoorMarker(gc, corridor, markerColor, displayPath, previewOffset);
    }

    private void drawCorridorWaypointMarkers(GraphicsContext gc, DungeonCorridor corridor, CorridorGeometry geometry, Point2D previewOffset) {
        if (!renderState.editable() || renderState.editorTool() != DungeonEditorTool.SELECT || !context.selectionState().isSelected(corridor)) {
            return;
        }
        for (Point2i waypoint : geometry.waypointCells()) {
            double centerX = previewModel.previewScreenX(waypoint.x() + 0.5, previewOffset);
            double centerY = previewModel.previewScreenY(waypoint.y() + 0.5, previewOffset);
            CorridorMarkerRenderer.drawWaypointHandle(gc, centerX, centerY,
                    DungeonCanvasTheme.WAYPOINT_HANDLE_RADIUS,
                    strokeColorFor(corridor), DungeonCanvasTheme.MARKER_OUTLINE);
        }
    }

    private record PreviewDoorContext(
            CorridorEditInteractionController.DoorDragPreview preview,
            CorridorDoorHandle handle
    ) {}

    private PreviewDoorContext previewDoorForCorridor(DungeonCorridor corridor) {
        if (corridor == null) return null;
        CorridorEditInteractionController.DoorDragPreview preview = corridorWorkspace.corridorDoorPreview();
        if (preview == null || preview.previewSegment() == null) return null;
        CorridorDoorHandle handle = corridorWorkspace.previewCorridorDoorHandle();
        if (handle == null || handle.corridorId() != corridor.corridorId()) return null;
        return new PreviewDoorContext(preview, handle);
    }

    private void drawPreviewDoor(GraphicsContext gc, DungeonCorridor corridor) {
        PreviewDoorContext ctx = previewDoorForCorridor(corridor);
        if (ctx == null) return;
        CorridorEditInteractionController.DoorPreviewSegment segment = ctx.preview().previewSegment();
        Point2D previewOffset = previewModel.corridorPreviewOffset(corridor);
        gc.strokeLine(
                previewModel.previewScreenX(segment.startWorldX(), previewOffset),
                previewModel.previewScreenY(segment.startWorldY(), previewOffset),
                previewModel.previewScreenX(segment.endWorldX(), previewOffset),
                previewModel.previewScreenY(segment.endWorldY(), previewOffset));
    }

    private void drawPreviewDoorMarker(
            GraphicsContext gc,
            DungeonCorridor corridor,
            Color markerColor,
            DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath,
            Point2D previewOffset
    ) {
        PreviewDoorContext ctx = previewDoorForCorridor(corridor);
        if (ctx == null) return;
        DungeonGraphCorridorGeometrySupport.MarkerPoint marker = geometrySupport.markerPoint(ctx.preview(), corridor.corridorId(), displayPath);
        CorridorDoorHandle previewHandle = ctx.handle();
        boolean previewSelected = corridorWorkspace.isSelected(previewHandle);
        double radius = previewSelected ? DungeonCanvasTheme.DOOR_MARKER_OUTER_RADIUS : DungeonCanvasTheme.DOOR_MARKER_INNER_RADIUS;
        Color previewFill = previewSelected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : markerColor;
        CorridorMarkerRenderer.drawDoorMarker(gc,
                marker.x() + screenDeltaX(previewOffset),
                marker.y() + screenDeltaY(previewOffset),
                radius, radius, previewFill, DungeonCanvasTheme.MARKER_OUTLINE);
    }

    private void drawInvalidCorridor(GraphicsContext gc, DungeonCorridor corridor, CorridorGeometry geometry) {
        if (!previewModel.hasInvalidCorridorLink(geometry)) {
            return;
        }
        gc.setStroke(context.selectionState().isSelected(corridor)
                ? DungeonCanvasTheme.CORRIDOR_SELECTED
                : context.selectionState().isHovered(corridor) ? DungeonCanvasTheme.CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.9)
                : context.selectionState().isActive(corridor) ? DungeonCanvasTheme.CORRIDOR_ACTIVE : DungeonCanvasTheme.ROOM_STROKE);
        gc.setLineWidth(context.selectionState().isSelected(corridor) ? 3 : context.selectionState().isHovered(corridor) ? 2.5 : 2);
        gc.setLineDashes(8, 6);
        previewModel.strokeInvalidCorridorLink(gc, geometry);
        gc.setLineDashes(null);
    }

    private Color strokeColorFor(DungeonCorridor corridor) {
        boolean selected = context.selectionState().isSelected(corridor);
        boolean hovered = context.selectionState().isHovered(corridor);
        boolean active = context.selectionState().isActive(corridor);
        if (selected || hovered || active) {
            return DungeonCanvasTheme.resolveCorridorDoorColor(selected, hovered, active);
        }
        long corridorId = corridor.corridorId() == null ? 0L : corridor.corridorId();
        return DungeonGraphPane.graphGroupColorFor(corridorId);
    }

    private DungeonGraphPane.CorridorPressMode corridorPressMode() {
        return DungeonGraphPane.CorridorPressMode.from(corridorWorkspace.corridorPressMode());
    }

    private double screenDeltaX(Point2D previewOffset) {
        return previewModel.previewScreenX(0.0, previewOffset) - context.camera().toScreenX(0.0);
    }

    private double screenDeltaY(Point2D previewOffset) {
        return previewModel.previewScreenY(0.0, previewOffset) - context.camera().toScreenY(0.0);
    }
}
