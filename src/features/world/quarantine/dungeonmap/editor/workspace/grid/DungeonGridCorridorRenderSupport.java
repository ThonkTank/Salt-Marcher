package features.world.quarantine.dungeonmap.editor.workspace.grid;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorEditInteractionController;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonCorridorDoorProjector;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonPaneCorridorWorkspace;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneRenderState;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import features.world.quarantine.dungeonmap.canvas.grid.CorridorMarkerRenderer;
import features.world.quarantine.dungeonmap.canvas.state.CorridorRenderKeys;
import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.canvas.CorridorColorResolver;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridScreenMath;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

import java.util.LinkedHashSet;
import java.util.List;
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
        DungeonLayoutRenderData corridorRenderData = context.renderData();
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
                DungeonCanvasTheme.Corridor.CORRIDOR,
                DungeonCanvasTheme.ROOM_STROKE,
                2,
                openSegments,
                encodedOpenSegments);

        for (DungeonCorridor corridor : context.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorWorkspace.routableGeometryForDisplay(corridor);
            if (geometry == null) continue;
            if (!geometry.routable()) {
                drawInvalidCorridor(gc, corridor, geometry);
                continue;
            }
            if (geometry.cells().isEmpty()) continue;
            gc.setFill(CorridorColorResolver.fillColor(corridor.corridorId(), selectedCorridorId(), hoveredOrActiveId(corridor)));
            Point2D previewOffset = previewModel.geometry().corridorPreviewOffset(corridor);
            for (Point2i cell : geometry.cells()) {
                double x = previewModel.geometry().previewScreenX(cell.x(), previewOffset);
                double y = previewModel.geometry().previewScreenY(cell.y(), previewOffset);
                double width = previewModel.geometry().previewScreenX(cell.x() + 1, previewOffset) - x;
                double height = previewModel.geometry().previewScreenY(cell.y() + 1, previewOffset) - y;
                gc.fillRect(x, y, width, height);
            }
        }
    }

    void drawDoors(GraphicsContext gc) {
        if (context.renderData() == null) {
            return;
        }
        for (DungeonCorridor corridor : context.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorWorkspace.routableGeometryForDisplay(corridor);
            if (geometry == null) continue;
            gc.setStroke(CorridorColorResolver.doorColor(corridor.corridorId(), selectedCorridorId(), hoveredOrActiveId(corridor)));
            gc.setLineWidth(context.sceneState().isSelected(corridor) ? DungeonCanvasTheme.Corridor.GRID_DOOR_LINE_WIDTH_SELECTED : context.sceneState().isHovered(corridor) ? DungeonCanvasTheme.Corridor.GRID_DOOR_LINE_WIDTH_HOVERED : DungeonCanvasTheme.Corridor.GRID_DOOR_LINE_WIDTH);
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
        }
        drawPreviewDoor(gc);
    }

    void drawCorridorEditHandles(GraphicsContext gc) {
        DungeonCorridorDoorProjector.CorridorSelectionContext selectedContext = corridorWorkspace.corridorProjectionSupport().selectedCorridorContext();
        CorridorEditInteractionController.PressMode pressMode = corridorWorkspace.corridorPressMode();
        if (!renderState.editable()
                || selectedContext == null
                || renderState.editorTool() != DungeonEditorTool.SELECT
                || pressMode == CorridorEditInteractionController.PressMode.DEFAULT) {
            return;
        }
        Point2D previewOffset = previewModel.geometry().corridorPreviewOffset(selectedContext.corridor());
        drawSegmentDoorHandles(gc, selectedContext, pressMode, previewOffset);
        drawWaypointHandles(gc, selectedContext, previewOffset);
    }

    private void drawSegmentDoorHandles(GraphicsContext gc,
            DungeonCorridorDoorProjector.CorridorSelectionContext selectedContext,
            CorridorEditInteractionController.PressMode pressMode,
            Point2D previewOffset) {
        Color segmentColor = pressMode == CorridorEditInteractionController.PressMode.REMOVE_WAYPOINT
                ? DungeonCanvasTheme.ROOM_SELECTED_STROKE
                : DungeonCanvasTheme.Corridor.CORRIDOR_SELECTED;
        List<CorridorMarkerRenderer.SegmentScreenCoords> segCoords = selectedContext.geometry().segments().stream()
                .map(segment -> new CorridorMarkerRenderer.SegmentScreenCoords(
                        previewModel.geometry().previewScreenX(segment.from().x() + 0.5, previewOffset),
                        previewModel.geometry().previewScreenY(segment.from().y() + 0.5, previewOffset),
                        previewModel.geometry().previewScreenX(segment.to().x() + 0.5, previewOffset),
                        previewModel.geometry().previewScreenY(segment.to().y() + 0.5, previewOffset)))
                .toList();
        CorridorMarkerRenderer.drawSegmentLines(gc, segCoords, 4, segmentColor);
        CorridorMarkerRenderer.drawDoorMarkers(gc, selectedContext.geometry().doors(),
                door -> false,
                door -> {
                    double centerX = (previewModel.geometry().previewScreenX(door.start().x(), previewOffset)
                            + previewModel.geometry().previewScreenX(door.end().x(), previewOffset)) / 2.0;
                    double centerY = (previewModel.geometry().previewScreenY(door.start().y(), previewOffset)
                            + previewModel.geometry().previewScreenY(door.end().y(), previewOffset)) / 2.0;
                    return new ScreenPoint(centerX, centerY);
                },
                door -> {
                    CorridorDoorHandle handle = corridorWorkspace.corridorProjectionSupport().corridorDoorHandleForRoom(door.roomId());
                    boolean handleSelected = corridorWorkspace.corridorInteractionSupport().isSelected(handle);
                    double radius = handleSelected ? DungeonCanvasTheme.Corridor.DOOR_MARKER_OUTER_RADIUS : DungeonCanvasTheme.Corridor.DOOR_MARKER_INNER_RADIUS;
                    Color handleFill = handleSelected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.Corridor.DOOR_SELECTED;
                    return new CorridorMarkerRenderer.DoorMarkerStyle(radius, handleFill);
                });
    }

    private void drawWaypointHandles(GraphicsContext gc,
            DungeonCorridorDoorProjector.CorridorSelectionContext selectedContext,
            Point2D previewOffset) {
        CorridorMarkerRenderer.drawWaypointHandles(gc, selectedContext.geometry().waypointCells(),
                waypoint -> new ScreenPoint(
                        previewModel.geometry().previewScreenX(waypoint.x() + 0.5, previewOffset),
                        previewModel.geometry().previewScreenY(waypoint.y() + 0.5, previewOffset)),
                DungeonCanvasTheme.Corridor.WAYPOINT_HANDLE_RADIUS,
                DungeonCanvasTheme.Corridor.CORRIDOR_SELECTED, DungeonCanvasTheme.Corridor.MARKER_OUTLINE);
    }

    Set<CorridorRenderKeys.CorridorSegmentKey> allDoorSegments() {
        if (context.renderData() == null || context.dungeonLayout() == null) {
            return Set.of();
        }
        return DungeonGridScreenMath.allDoorSegments(context.dungeonLayout(), corridorWorkspace.corridorInteractionSupport()::corridorGeometryForDisplay);
    }

    private Set<Point2i> displayedCorridorCells(DungeonLayoutRenderData corridorRenderData) {
        if (context.dungeonLayout() == null || !previewModel.hasClusterDragPreview()) {
            return corridorRenderData.corridorCells();
        }
        Set<Point2i> cells = new LinkedHashSet<>();
        for (DungeonCorridor corridor : context.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorWorkspace.routableGeometryForDisplay(corridor);
            if (geometry == null) continue;
            cells.addAll(geometry.cells());
        }
        return cells;
    }

    private void drawPreviewDoor(GraphicsContext gc) {
        CorridorEditInteractionController.DoorDragPreview preview = corridorWorkspace.dragPreviewManager().corridorDoorPreview();
        if (preview == null || preview.previewSegment() == null || corridorWorkspace.dragPreviewManager().previewCorridorDoorHandle() == null) {
            return;
        }
        DungeonCorridor corridor = context.dungeonLayout() == null ? null : context.dungeonLayout().findCorridor(corridorWorkspace.dragPreviewManager().previewCorridorDoorHandle().corridorId());
        if (corridor == null) {
            return;
        }
        gc.setStroke(CorridorColorResolver.doorColor(corridor.corridorId(), selectedCorridorId(), hoveredOrActiveId(corridor)));
        gc.setLineWidth(context.sceneState().isSelected(corridor) ? DungeonCanvasTheme.Corridor.GRID_DOOR_LINE_WIDTH_SELECTED : context.sceneState().isHovered(corridor) ? DungeonCanvasTheme.Corridor.GRID_DOOR_LINE_WIDTH_HOVERED : DungeonCanvasTheme.Corridor.GRID_DOOR_LINE_WIDTH);
        CorridorEditInteractionController.DoorPreviewSegment segment = preview.previewSegment();
        gc.strokeLine(
                context.camera().toScreenX(segment.startWorldX()),
                context.camera().toScreenY(segment.startWorldY()),
                context.camera().toScreenX(segment.endWorldX()),
                context.camera().toScreenY(segment.endWorldY()));
    }

    private void drawInvalidCorridor(GraphicsContext gc, DungeonCorridor corridor, CorridorGeometry geometry) {
        if (!previewModel.geometry().hasInvalidCorridorLink(geometry)) {
            return;
        }
        gc.setStroke(CorridorColorResolver.strokeColor(corridor.corridorId(), selectedCorridorId(), hoveredOrActiveId(corridor)));
        gc.setLineWidth(context.sceneState().isSelected(corridor) ? 4 : context.sceneState().isHovered(corridor) ? 3 : 2.5);
        previewModel.geometry().strokeInvalidCorridorLink(gc, geometry);
    }

    private Long selectedCorridorId() {
        return context.selectedTarget() instanceof DungeonSelection.Corridor c ? c.corridorId() : null;
    }

    private Long hoveredOrActiveId(DungeonCorridor corridor) {
        return (context.sceneState().isHovered(corridor) || context.sceneState().isActive(corridor))
                ? corridor.corridorId() : null;
    }
}
