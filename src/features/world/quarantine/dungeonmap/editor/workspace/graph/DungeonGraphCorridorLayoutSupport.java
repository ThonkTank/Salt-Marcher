package features.world.quarantine.dungeonmap.editor.workspace.graph;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonPaneCorridorWorkspace;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.primitives.GridSegment;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.canvas.state.CorridorRenderKeys;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class DungeonGraphCorridorLayoutSupport {

    private final DungeonPaneContext context;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;
    private CorridorLayoutCache cache;

    DungeonGraphCorridorLayoutSupport(
            DungeonPaneContext context,
            DungeonPanePreviewModel previewModel,
            DungeonPaneCorridorWorkspace corridorWorkspace
    ) {
        this.context = context;
        this.previewModel = previewModel;
        this.corridorWorkspace = corridorWorkspace;
    }

    CorridorDisplayPath displayPath(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null) {
            return null;
        }
        CorridorDisplayPath displayPath = corridorRenderState().displayPaths().get(corridor.corridorId());
        if (displayPath == null
                || displayPath.segments().isEmpty()
                || corridorWorkspace.dragPreviewManager().previewCorridorDoorHandle() == null
                || corridorWorkspace.dragPreviewManager().corridorDoorPreview() == null
                || corridorWorkspace.dragPreviewManager().previewCorridorDoorHandle().corridorId() != corridor.corridorId()) {
            return displayPath;
        }
        DoorSegment snapDoor = DungeonGraphCorridorGeometrySupport.snapDoorSegment(corridorWorkspace.dragPreviewManager().corridorDoorPreview());
        SegmentKey doorSegmentKey = DungeonGraphCorridorGeometrySupport.nearestDisplaySegmentForDoor(snapDoor, displayPath);
        if (doorSegmentKey == null) {
            return displayPath;
        }
        var previewSegment = corridorWorkspace.dragPreviewManager().corridorDoorPreview().previewSegment();
        double previewX = context.camera().toScreenX(previewSegment.centerWorldX());
        double previewY = context.camera().toScreenY(previewSegment.centerWorldY());
        List<OffsetLine> adjustedSegments = new ArrayList<>(displayPath.segments());
        for (int index = 0; index < adjustedSegments.size(); index++) {
            OffsetLine segment = adjustedSegments.get(index);
            if (!doorSegmentKey.equals(segment.canonicalSegment())) {
                continue;
            }
            double startDistance = Math.hypot(segment.x1() - previewX, segment.y1() - previewY);
            double endDistance = Math.hypot(segment.x2() - previewX, segment.y2() - previewY);
            adjustedSegments.set(index, startDistance <= endDistance
                    ? new OffsetLine(previewX, previewY, segment.x2(), segment.y2(), segment.canonicalSegment())
                    : new OffsetLine(segment.x1(), segment.y1(), previewX, previewY, segment.canonicalSegment()));
            return new CorridorDisplayPath(adjustedSegments);
        }
        return displayPath;
    }

    Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker() {
        return corridorRenderState().corridorIdsByDoorMarker();
    }

    Map<SegmentKey, List<Long>> laneOrderBySegment() {
        return corridorRenderState().laneOrderBySegment();
    }

    private CorridorRenderState corridorRenderState() {
        DungeonLayoutRenderData renderData = context.renderData();
        Map<Long, Point2i> previewCenters = Map.copyOf(previewModel.geometry().previewClusterCenters());
        long cameraVersion = context.camera().projectionVersion();
        if (cache == null
                || cache.layout() != context.dungeonLayout()
                || cache.renderData() != renderData
                || !cache.previewCenters().equals(previewCenters)
                || cache.cameraVersion() != cameraVersion) {
            CorridorLayoutState layoutState = corridorLayoutState();
            CorridorRenderState renderState = new CorridorRenderState(
                    layoutState.laneOrderBySegment(),
                    layoutState.corridorIdsByDoorMarker(),
                    corridorDisplayPaths(layoutState.laneOrderBySegment()));
            cache = new CorridorLayoutCache(
                    context.dungeonLayout(),
                    renderData,
                    previewCenters,
                    cameraVersion,
                    renderState);
        }
        return cache.renderState();
    }

    private CorridorLayoutState corridorLayoutState() {
        Map<SegmentKey, List<Long>> corridorIdsBySegment = corridorIdsBySegment();
        return new CorridorLayoutState(
                CorridorLaneCalculator.laneOrderBySegment(corridorIdsBySegment),
                corridorIdsByDoorMarkerInternal());
    }

    private Map<SegmentKey, List<Long>> corridorIdsBySegment() {
        DungeonLayoutRenderData renderData = context.renderData();
        if (!previewModel.hasClusterDragPreview() && renderData != null) {
            Map<SegmentKey, List<Long>> result = new HashMap<>();
            for (Map.Entry<CorridorRenderKeys.CorridorSegmentKey, List<Long>> entry : renderData.corridorIdsBySegment().entrySet()) {
                result.put(new SegmentKey(entry.getKey()), entry.getValue());
            }
            return result;
        }
        Map<SegmentKey, List<Long>> result = new HashMap<>();
        if (renderData == null || context.dungeonLayout() == null) {
            return result;
        }
        for (DungeonCorridor corridor : context.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorWorkspace.routableGeometryForDisplay(corridor);
            if (geometry == null) continue;
            for (GridSegment segment : geometry.segments()) {
                result.computeIfAbsent(SegmentKey.of(segment.from(), segment.to()), ignored -> new ArrayList<>()).add(corridor.corridorId());
            }
        }
        for (List<Long> corridorIds : result.values()) {
            corridorIds.sort(Long::compareTo);
        }
        return result;
    }

    private Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarkerInternal() {
        DungeonLayoutRenderData renderData = context.renderData();
        if (!previewModel.hasClusterDragPreview() && renderData != null) {
            Map<DoorMarkerKey, List<Long>> result = new HashMap<>();
            for (Map.Entry<CorridorRenderKeys.CorridorDoorMarkerKey, List<Long>> entry : renderData.corridorIdsByDoorMarker().entrySet()) {
                result.put(new DoorMarkerKey(entry.getKey()), entry.getValue());
            }
            return result;
        }
        Map<DoorMarkerKey, List<Long>> result = new HashMap<>();
        if (renderData == null || context.dungeonLayout() == null) {
            return result;
        }
        for (DungeonCorridor corridor : context.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorWorkspace.routableGeometryForDisplay(corridor);
            if (geometry == null) continue;
            for (var door : geometry.doors()) {
                result.computeIfAbsent(DoorMarkerKey.of(door), ignored -> new ArrayList<>()).add(corridor.corridorId());
            }
        }
        for (List<Long> corridorIds : result.values()) {
            corridorIds.sort(Long::compareTo);
        }
        return result;
    }

    private Map<Long, CorridorDisplayPath> corridorDisplayPaths(Map<SegmentKey, List<Long>> laneOrderBySegment) {
        if (context.dungeonLayout() == null || context.renderData() == null) {
            return Map.of();
        }
        return CorridorLaneCalculator.corridorDisplayPaths(
                context.dungeonLayout().corridors(),
                corridorWorkspace.corridorInteractionSupport()::corridorGeometryForDisplay,
                context.camera(),
                laneOrderBySegment);
    }

    record SegmentKey(CorridorRenderKeys.CorridorSegmentKey key) {
        static SegmentKey of(Point2i a, Point2i b) {
            return new SegmentKey(CorridorRenderKeys.segmentKey(a, b));
        }

        boolean touches(SegmentKey other) {
            return key.touches(other.key);
        }

        Point2i start() {
            return key.start();
        }

        Point2i end() {
            return key.end();
        }
    }

    record OffsetLine(double x1, double y1, double x2, double y2, SegmentKey canonicalSegment) {
    }

    record DoorMarkerKey(CorridorRenderKeys.CorridorDoorMarkerKey key) {
        static DoorMarkerKey of(features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment door) {
            return new DoorMarkerKey(CorridorRenderKeys.doorMarkerKey(door));
        }
    }

    record CorridorDisplayPath(List<OffsetLine> segments) {
        CorridorDisplayPath {
            segments = List.copyOf(segments);
        }
    }

    private record CorridorLayoutCache(
            DungeonLayout layout,
            DungeonLayoutRenderData renderData,
            Map<Long, Point2i> previewCenters,
            long cameraVersion,
            CorridorRenderState renderState
    ) {
    }

    private record CorridorRenderState(
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker,
            Map<Long, CorridorDisplayPath> displayPaths
    ) {
    }

    private record CorridorLayoutState(
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker
    ) {
    }

}
