package features.world.quarantine.dungeonmap.editor.workspace.corridor;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.workspace.pane.AbstractDungeonPane;
import features.world.quarantine.dungeonmap.editor.workspace.pane.DungeonPaneSceneState;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneRenderState;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPreviewState;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPreviewTopologySession;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;

import java.util.List;
import java.util.Objects;

public final class DungeonPaneCorridorHitResolver {

    private final Host host;

    public DungeonPaneCorridorHitResolver(Host host) {
        this.host = Objects.requireNonNull(host, "host");
    }

    public CorridorDoorHit corridorDoorHit(DoorSegment door, Long fallbackCorridorId) {
        if (door == null) {
            return null;
        }
        DungeonLayoutRenderData corridorRenderData = corridorRenderDataForDisplay();
        List<Long> corridorIds = corridorRenderData == null
                ? List.of()
                : corridorRenderData.corridorIdsForDoorFromRoom(door);
        CorridorDoorHit hit = DungeonCorridorDoorHitResolver.resolve(corridorIds, fallbackCorridorId, door.roomId());
        return hit.isEmpty() ? null : hit;
    }

    public CorridorDoorHandle findCorridorDoorHandleAt(double screenX, double screenY) {
        if (host.hasClusterDragPreview()) {
            return null;
        }
        DungeonCorridorDoorProjector.CorridorSelectionContext context = host.selectedCorridorContext();
        if (context == null) {
            return null;
        }
        ScreenPoint screen = new ScreenPoint(screenX, screenY);
        CorridorDoorHandle best = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DoorSegment door : context.geometry().doors()) {
            double distance = host.selectedCorridorDoorHandleDistance(screen, context, door);
            if (!Double.isFinite(distance) || distance >= bestDistance) {
                continue;
            }
            bestDistance = distance;
            best = host.corridorDoorHandleForRoom(door.roomId());
        }
        return best;
    }

    public CorridorWaypointHandle findCorridorWaypointHandleAt(double screenX, double screenY) {
        DungeonCorridorDoorProjector.CorridorSelectionContext context = host.selectedCorridorContext();
        if (context == null) {
            return null;
        }
        ScreenPoint screen = new ScreenPoint(screenX, screenY);
        CorridorWaypointHandle best = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (int index = 0; index < context.geometry().waypointCells().size(); index++) {
            Point2i waypoint = context.geometry().waypointCells().get(index);
            double distance = host.selectedCorridorWaypointHandleDistance(screen, context, waypoint);
            if (!Double.isFinite(distance) || distance >= bestDistance) {
                continue;
            }
            bestDistance = distance;
            best = new CorridorWaypointHandle(context.corridor().corridorId(), index);
        }
        return best;
    }

    public CorridorWaypointHandle findCorridorWaypointRemoveHandleAt(double screenX, double screenY) {
        DungeonCorridorDoorProjector.CorridorSelectionContext context = host.selectedCorridorContext();
        if (context == null || context.geometry().segments().size() <= 1 || context.geometry().waypointCells().isEmpty()) {
            return null;
        }
        ScreenPoint screen = new ScreenPoint(screenX, screenY);
        int segmentIndex = host.corridorSegmentIndexAt(screen);
        CorridorWaypointHandle waypointHandle = findCorridorWaypointHandleAt(screenX, screenY);
        if (waypointHandle != null) {
            return waypointHandle;
        }
        return host.waypointHandleForSegmentRemoval(context, screen, segmentIndex);
    }

    public CorridorEditInteractionController.SegmentInsertHit findCorridorSegmentInsertHitAt(double screenX, double screenY) {
        DungeonCorridorDoorProjector.CorridorSelectionContext context = host.selectedCorridorContext();
        if (context == null || context.geometry().segments().isEmpty()) {
            return null;
        }
        ScreenPoint screen = new ScreenPoint(screenX, screenY);
        int segmentIndex = host.corridorSegmentIndexAt(screen);
        if (segmentIndex < 0) {
            return null;
        }
        return new CorridorEditInteractionController.SegmentInsertHit(
                context.corridor().corridorId(),
                host.insertIndexForSegment(context.corridor().corridorId(), context.geometry(), segmentIndex),
                host.worldPointAt(screen));
    }

    public CorridorGeometry corridorGeometryForSelection(DungeonCorridor corridor) {
        return corridorGeometryForDisplay(corridor);
    }

    public CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null) {
            return null;
        }
        CorridorGeometry previewGeometry = host.previewTopologySession().corridorGeometryOverride(corridor.corridorId());
        if (previewGeometry != null) {
            return previewGeometry;
        }
        DungeonLayoutRenderData corridorRenderData = corridorRenderDataForDisplay();
        return corridorRenderData == null ? null : corridorRenderData.corridorGeometry(corridor.corridorId());
    }

    public CorridorDoorHit findNearestCorridorDoorHit(double screenX, double screenY) {
        if (host.dungeonLayout() == null || corridorRenderDataForDisplay() == null) {
            return null;
        }
        ScreenPoint screen = new ScreenPoint(screenX, screenY);
        CorridorDoorHit bestHit = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : host.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                double distance = host.corridorDoorHitDistance(screen, corridor, geometry, door);
                if (!Double.isFinite(distance) || distance >= bestDistance) {
                    continue;
                }
                bestDistance = distance;
                bestHit = corridorDoorHit(door, corridor.corridorId());
            }
        }
        return bestHit;
    }

    public boolean isSelected(CorridorDoorHandle handle) {
        return handle != null && handle.equals(host.previewState().selectedCorridorDoorHandle());
    }

    private DungeonLayoutRenderData corridorRenderDataForDisplay() {
        return host.renderData();
    }

    public interface Host extends features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext {
        DungeonPreviewState previewState();
        DungeonPreviewTopologySession previewTopologySession();
        boolean hasClusterDragPreview();
        DungeonCorridorDoorProjector.CorridorSelectionContext selectedCorridorContext();
        CorridorDoorHandle corridorDoorHandleForRoom(long roomId);
        double selectedCorridorDoorHandleDistance(
                ScreenPoint screen,
                DungeonCorridorDoorProjector.CorridorSelectionContext context,
                DoorSegment door
        );
        double selectedCorridorWaypointHandleDistance(
                ScreenPoint screen,
                DungeonCorridorDoorProjector.CorridorSelectionContext context,
                Point2i waypoint
        );
        CorridorWaypointHandle waypointHandleForSegmentRemoval(
                DungeonCorridorDoorProjector.CorridorSelectionContext context,
                ScreenPoint screen,
                int segmentIndex
        );
        int insertIndexForSegment(long corridorId, CorridorGeometry geometry, int segmentIndex);
        int corridorSegmentIndexAt(ScreenPoint screen);
        Point2i worldPointAt(ScreenPoint screen);
        double corridorDoorHitDistance(
                ScreenPoint screen,
                DungeonCorridor corridor,
                CorridorGeometry geometry,
                DoorSegment door
        );
    }

    public static Host createHost(
            AbstractDungeonPane pane,
            DungeonPaneRenderState renderState,
            DungeonPanePreviewModel previewModel,
            DungeonCorridorDoorProjector projectionSupport) {
        return new Host() {
            @Override public DungeonLayout dungeonLayout() { return pane.dungeonLayout(); }
            @Override public DungeonLayoutRenderData renderData() { return pane.renderData(); }
            @Override public DungeonCanvasCamera camera() { return pane.camera(); }
            @Override public boolean layoutPresent() { return pane.layoutPresent(); }
            @Override public DungeonPaneSceneState sceneState() { return pane.sceneState(); }
            @Override public DungeonPreviewState previewState() { return renderState.previewState(); }
            @Override public DungeonPreviewTopologySession previewTopologySession() { return renderState.previewTopologySession(); }
            @Override public boolean hasClusterDragPreview() { return previewModel.hasClusterDragPreview(); }
            @Override public DungeonCorridorDoorProjector.CorridorSelectionContext selectedCorridorContext() { return projectionSupport.selectedCorridorContext(); }
            @Override public CorridorDoorHandle corridorDoorHandleForRoom(long roomId) { return projectionSupport.corridorDoorHandleForRoom(roomId); }
            @Override public double selectedCorridorDoorHandleDistance(ScreenPoint screen, DungeonCorridorDoorProjector.CorridorSelectionContext ctx, DoorSegment door) { return pane.hitTestDelegate().selectedCorridorDoorHandleDistance(screen, ctx, door); }
            @Override public double selectedCorridorWaypointHandleDistance(ScreenPoint screen, DungeonCorridorDoorProjector.CorridorSelectionContext ctx, Point2i wp) { return pane.hitTestDelegate().selectedCorridorWaypointHandleDistance(screen, ctx, wp); }
            @Override public CorridorWaypointHandle waypointHandleForSegmentRemoval(DungeonCorridorDoorProjector.CorridorSelectionContext ctx, ScreenPoint screen, int idx) { return projectionSupport.waypointHandleForSegmentRemoval(ctx, screen, idx); }
            @Override public int insertIndexForSegment(long corridorId, CorridorGeometry geo, int segIdx) { return projectionSupport.insertIndexForSegment(corridorId, geo, segIdx); }
            @Override public int corridorSegmentIndexAt(ScreenPoint screen) { return pane.hitTestDelegate().corridorSegmentIndexAt(screen); }
            @Override public Point2i worldPointAt(ScreenPoint screen) { return pane.worldPointAt(screen.x(), screen.y()); }
            @Override public double corridorDoorHitDistance(ScreenPoint screen, DungeonCorridor corridor, CorridorGeometry geo, DoorSegment door) { return pane.hitTestDelegate().corridorDoorHitDistance(screen, corridor, geo, door); }
        };
    }
}
