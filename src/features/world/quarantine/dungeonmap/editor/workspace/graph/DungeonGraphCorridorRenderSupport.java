package features.world.quarantine.dungeonmap.editor.workspace.graph;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorEditInteractionController;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonPaneCorridorWorkspace;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneRenderState;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import features.world.quarantine.dungeonmap.canvas.CorridorColorResolver;
import features.world.quarantine.dungeonmap.canvas.grid.CorridorMarkerRenderer;
import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

import java.util.List;

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
            CorridorGeometry geometry = corridorWorkspace.routableGeometryForDisplay(corridor);
            if (geometry == null) continue;
            if (!geometry.routable()) {
                drawInvalidCorridor(gc, corridor, geometry);
                continue;
            }
            Point2D previewOffset = previewModel.geometry().corridorPreviewOffset(corridor);
            DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath = layoutSupport.displayPath(corridor);
            gc.setStroke(strokeColorFor(corridor));
            gc.setLineWidth(context.sceneState().isSelected(corridor) ? DungeonCanvasTheme.Corridor.CORRIDOR_SELECTED_LINE_WIDTH : context.sceneState().isHovered(corridor) ? DungeonCanvasTheme.Corridor.CORRIDOR_PREVIEW_LINE_WIDTH : DungeonCanvasTheme.Corridor.CORRIDOR_LINE_WIDTH);
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
        CorridorMarkerRenderer.drawDoorSegments(
                gc,
                geometry.doors(),
                corridor.corridorId(),
                door -> corridorWorkspace.dragPreviewManager().isPreviewDoor(corridor.corridorId(), door.roomId()),
                door -> {
                    Point2D previewOffset = previewModel.geometry().doorPreviewOffset(door);
                    return new CorridorMarkerRenderer.DoorScreenCoords(
                            previewModel.geometry().previewScreenX(door.start().x(), previewOffset),
                            previewModel.geometry().previewScreenY(door.start().y(), previewOffset),
                            previewModel.geometry().previewScreenX(door.end().x(), previewOffset),
                            previewModel.geometry().previewScreenY(door.end().y(), previewOffset));
                });
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
                || !context.sceneState().isSelected(corridor)
                || displayPath == null
                || pressMode == DungeonGraphPane.CorridorPressMode.DEFAULT) {
            return;
        }
        Color segmentColor = pressMode == DungeonGraphPane.CorridorPressMode.REMOVE_WAYPOINT
                ? DungeonCanvasTheme.Corridor.HANDLE_REMOVE
                : DungeonCanvasTheme.Corridor.HANDLE_INSERT;
        List<CorridorMarkerRenderer.SegmentScreenCoords> segCoords = displayPath.segments().stream()
                .filter(seg -> seg.canonicalSegment() != null)
                .map(seg -> new CorridorMarkerRenderer.SegmentScreenCoords(
                        seg.x1() + screenDeltaX(previewOffset),
                        seg.y1() + screenDeltaY(previewOffset),
                        seg.x2() + screenDeltaX(previewOffset),
                        seg.y2() + screenDeltaY(previewOffset)))
                .toList();
        CorridorMarkerRenderer.drawSegmentLines(gc, segCoords,
                DungeonCanvasTheme.Corridor.GRAPH_SEGMENT_HANDLE_RENDER_RADIUS, segmentColor);
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
                && context.sceneState().isSelected(corridor);
        if (!showDeleteMarkers && !showSelectionMarkers) {
            return;
        }
        Color markerColor = strokeColorFor(corridor);
        CorridorMarkerRenderer.drawDoorMarkers(gc, geometry.doors(),
                door -> corridorWorkspace.dragPreviewManager().isPreviewDoor(corridor.corridorId(), door.roomId()),
                door -> {
                    DungeonGraphCorridorGeometrySupport.MarkerPoint marker = geometrySupport.markerPoint(door, corridor.corridorId(), displayPath);
                    Point2D doorPreviewOffset = previewModel.geometry().doorPreviewOffset(door);
                    return new ScreenPoint(marker.x() + screenDeltaX(doorPreviewOffset), marker.y() + screenDeltaY(doorPreviewOffset));
                },
                door -> {
                    CorridorDoorHandle handle = corridorWorkspace.corridorProjectionSupport().corridorDoorHandleForRoom(door.roomId());
                    boolean handleSelected = corridorWorkspace.corridorInteractionSupport().isSelected(handle);
                    double radius = handleSelected ? DungeonCanvasTheme.Corridor.DOOR_MARKER_OUTER_RADIUS : DungeonCanvasTheme.Corridor.DOOR_MARKER_INNER_RADIUS;
                    Color handleFill = handleSelected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : markerColor;
                    return new CorridorMarkerRenderer.DoorMarkerStyle(radius, handleFill);
                });
        drawPreviewDoorMarker(gc, corridor, markerColor, displayPath, previewOffset);
    }

    private void drawCorridorWaypointMarkers(GraphicsContext gc, DungeonCorridor corridor, CorridorGeometry geometry, Point2D previewOffset) {
        if (!renderState.editable() || renderState.editorTool() != DungeonEditorTool.SELECT || !context.sceneState().isSelected(corridor)) {
            return;
        }
        CorridorMarkerRenderer.drawWaypointHandles(gc, geometry.waypointCells(),
                waypoint -> new ScreenPoint(
                        previewModel.geometry().previewScreenX(waypoint.x() + 0.5, previewOffset),
                        previewModel.geometry().previewScreenY(waypoint.y() + 0.5, previewOffset)),
                DungeonCanvasTheme.Corridor.WAYPOINT_HANDLE_RADIUS,
                strokeColorFor(corridor), DungeonCanvasTheme.Corridor.MARKER_OUTLINE);
    }

    private record PreviewDoorContext(
            CorridorEditInteractionController.DoorDragPreview preview,
            CorridorDoorHandle handle
    ) {}

    private PreviewDoorContext previewDoorForCorridor(DungeonCorridor corridor) {
        if (corridor == null) return null;
        CorridorEditInteractionController.DoorDragPreview preview = corridorWorkspace.dragPreviewManager().corridorDoorPreview();
        if (preview == null || preview.previewSegment() == null) return null;
        CorridorDoorHandle handle = corridorWorkspace.dragPreviewManager().previewCorridorDoorHandle();
        if (handle == null || handle.corridorId() != corridor.corridorId()) return null;
        return new PreviewDoorContext(preview, handle);
    }

    private void drawPreviewDoor(GraphicsContext gc, DungeonCorridor corridor) {
        PreviewDoorContext ctx = previewDoorForCorridor(corridor);
        if (ctx == null) return;
        CorridorEditInteractionController.DoorPreviewSegment segment = ctx.preview().previewSegment();
        Point2D previewOffset = previewModel.geometry().corridorPreviewOffset(corridor);
        gc.strokeLine(
                previewModel.geometry().previewScreenX(segment.startWorldX(), previewOffset),
                previewModel.geometry().previewScreenY(segment.startWorldY(), previewOffset),
                previewModel.geometry().previewScreenX(segment.endWorldX(), previewOffset),
                previewModel.geometry().previewScreenY(segment.endWorldY(), previewOffset));
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
        boolean previewSelected = corridorWorkspace.corridorInteractionSupport().isSelected(previewHandle);
        double radius = previewSelected ? DungeonCanvasTheme.Corridor.DOOR_MARKER_OUTER_RADIUS : DungeonCanvasTheme.Corridor.DOOR_MARKER_INNER_RADIUS;
        Color previewFill = previewSelected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : markerColor;
        CorridorMarkerRenderer.drawDoorMarker(gc,
                marker.x() + screenDeltaX(previewOffset),
                marker.y() + screenDeltaY(previewOffset),
                radius, radius, previewFill, DungeonCanvasTheme.Corridor.MARKER_OUTLINE);
    }

    private void drawInvalidCorridor(GraphicsContext gc, DungeonCorridor corridor, CorridorGeometry geometry) {
        if (!previewModel.geometry().hasInvalidCorridorLink(geometry)) {
            return;
        }
        gc.setStroke(strokeColorFor(corridor));
        gc.setLineWidth(context.sceneState().isSelected(corridor) ? 3 : context.sceneState().isHovered(corridor) ? 2.5 : 2);
        previewModel.geometry().strokeInvalidCorridorLink(gc, geometry);
        gc.setLineDashes(null);
    }

    private Color strokeColorFor(DungeonCorridor corridor) {
        Long corridorId = corridor.corridorId();
        Long selectedId = selectedCorridorId();
        Long hoveredId = hoveredOrActiveId(corridor);
        boolean highlighted = corridorId != null && (corridorId.equals(selectedId) || corridorId.equals(hoveredId));
        if (!highlighted) {
            return DungeonGraphPane.graphGroupColorFor(corridorId == null ? 0L : corridorId);
        }
        return CorridorColorResolver.doorColor(corridorId, selectedId, hoveredId);
    }

    private Long selectedCorridorId() {
        return context.selectedTarget() instanceof DungeonSelection.Corridor c ? c.corridorId() : null;
    }

    private Long hoveredOrActiveId(DungeonCorridor corridor) {
        return (context.sceneState().isHovered(corridor) || context.sceneState().isActive(corridor))
                ? corridor.corridorId() : null;
    }

    private DungeonGraphPane.CorridorPressMode corridorPressMode() {
        return DungeonGraphPane.CorridorPressMode.from(corridorWorkspace.corridorPressMode());
    }

    private double screenDeltaX(Point2D previewOffset) {
        return previewModel.geometry().previewScreenX(0.0, previewOffset) - context.camera().toScreenX(0.0);
    }

    private double screenDeltaY(Point2D previewOffset) {
        return previewModel.geometry().previewScreenY(0.0, previewOffset) - context.camera().toScreenY(0.0);
    }
}
