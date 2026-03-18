package features.world.dungeonmap.editor.workspace.ui.graph;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneContext;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonCorridorProjectionSupport;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonPaneCorridorWorkspace;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPanePreviewModel;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.corridors.model.GridSegment;
import features.world.dungeonmap.rooms.model.DungeonGeometry;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.canvas.rendering.DungeonGridScreenMath;
import features.world.dungeonmap.foundation.geometry.Point2i;

import java.util.List;

final class DungeonGraphCorridorGeometrySupport {

    private final DungeonPaneContext context;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;
    private final DungeonGraphCorridorLayoutSupport layoutSupport;

    DungeonGraphCorridorGeometrySupport(
            DungeonPaneContext context,
            DungeonPanePreviewModel previewModel,
            DungeonPaneCorridorWorkspace corridorWorkspace,
            DungeonGraphCorridorLayoutSupport layoutSupport
    ) {
        this.context = context;
        this.previewModel = previewModel;
        this.corridorWorkspace = corridorWorkspace;
        this.layoutSupport = layoutSupport;
    }

    DungeonCorridor findCorridorAt(double screenX, double screenY) {
        if (context.dungeonLayout() == null || context.layoutRenderData() == null) {
            return null;
        }
        DungeonCorridor closest = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : context.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorWorkspace.corridorGeometryForDisplay(corridor);
            if (geometry == null) {
                continue;
            }
            double distance = distanceToGeometry(screenX, screenY, geometry, layoutSupport.displayPath(corridor));
            if (distance < bestDistance && distance <= 14) {
                bestDistance = distance;
                closest = corridor;
            }
        }
        return closest;
    }

    double corridorDoorHitDistance(double screenX, double screenY, DungeonCorridor corridor, DoorSegment door) {
        MarkerPoint marker = markerPoint(door, corridor.corridorId(), layoutSupport.displayPath(corridor));
        double markerDistance = Math.hypot(screenX - marker.x(), screenY - marker.y());
        return markerDistance <= 8 ? markerDistance : Double.POSITIVE_INFINITY;
    }

    double selectedCorridorDoorHandleDistance(
            double screenX,
            double screenY,
            DungeonCorridorProjectionSupport.CorridorSelectionContext selectionContext,
            DoorSegment door
    ) {
        MarkerPoint marker = markerPoint(door, selectionContext.corridor().corridorId(), layoutSupport.displayPath(selectionContext.corridor()));
        double markerDistance = Math.hypot(screenX - marker.x(), screenY - marker.y());
        return markerDistance <= 9 ? markerDistance : Double.POSITIVE_INFINITY;
    }

    int corridorSegmentIndexAt(double screenX, double screenY) {
        DungeonCorridorProjectionSupport.CorridorSelectionContext selectionContext = corridorWorkspace.selectedCorridorContext();
        DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath = selectionContext == null ? null : layoutSupport.displayPath(selectionContext.corridor());
        if (selectionContext == null || displayPath == null || displayPath.segments().isEmpty()) {
            return -1;
        }
        DungeonGraphCorridorLayoutSupport.SegmentKey bestSegmentKey = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonGraphCorridorLayoutSupport.OffsetLine segment : displayPath.segments()) {
            if (segment.canonicalSegment() == null) {
                continue;
            }
            double distance = DungeonGridScreenMath.distanceToSegment(
                    screenX,
                    screenY,
                    segment.x1(),
                    segment.y1(),
                    segment.x2(),
                    segment.y2());
            if (distance <= 10 && distance < bestDistance) {
                bestDistance = distance;
                bestSegmentKey = segment.canonicalSegment();
            }
        }
        return bestSegmentKey == null ? -1 : segmentIndexForKey(selectionContext.geometry(), bestSegmentKey);
    }

    MarkerPoint markerPoint(DoorSegment door, Long corridorId, DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath) {
        double centerX = (context.camera().toScreenX(door.start().x()) + context.camera().toScreenX(door.end().x())) / 2.0;
        double centerY = (context.camera().toScreenY(door.start().y()) + context.camera().toScreenY(door.end().y())) / 2.0;
        List<Long> corridorIds = laneOrderForDoor(door, displayPath);
        if (corridorIds.size() < 2 || corridorId == null) {
            return new MarkerPoint(centerX, centerY);
        }
        int index = corridorIds.indexOf(corridorId);
        if (index < 0) {
            return new MarkerPoint(centerX, centerY);
        }
        double tangentOffset = (index - (corridorIds.size() - 1) / 2.0) * 10.0;
        double doorDx = context.camera().toScreenX(door.end().x()) - context.camera().toScreenX(door.start().x());
        double doorDy = context.camera().toScreenY(door.end().y()) - context.camera().toScreenY(door.start().y());
        double doorLength = Math.hypot(doorDx, doorDy);
        if (doorLength == 0) {
            return new MarkerPoint(centerX, centerY);
        }
        double offsetX = doorDx / doorLength * tangentOffset;
        double offsetY = doorDy / doorLength * tangentOffset;
        return new MarkerPoint(centerX + offsetX, centerY + offsetY);
    }

    MarkerPoint markerPoint(
            CorridorEditInteractionController.DoorDragPreview preview,
            Long corridorId,
            DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath
    ) {
        CorridorEditInteractionController.DoorPreviewSegment segment = preview.previewSegment();
        double centerX = context.camera().toScreenX(segment.centerWorldX());
        double centerY = context.camera().toScreenY(segment.centerWorldY());
        DoorSegment snapDoor = snapDoorSegment(preview);
        List<Long> corridorIds = laneOrderForDoor(snapDoor, displayPath);
        if (corridorIds.size() < 2 || corridorId == null) {
            return new MarkerPoint(centerX, centerY);
        }
        int index = corridorIds.indexOf(corridorId);
        if (index < 0) {
            return new MarkerPoint(centerX, centerY);
        }
        double tangentOffset = (index - (corridorIds.size() - 1) / 2.0) * 10.0;
        double doorDx = context.camera().toScreenX(segment.endWorldX()) - context.camera().toScreenX(segment.startWorldX());
        double doorDy = context.camera().toScreenY(segment.endWorldY()) - context.camera().toScreenY(segment.startWorldY());
        double doorLength = Math.hypot(doorDx, doorDy);
        if (doorLength == 0) {
            return new MarkerPoint(centerX, centerY);
        }
        double offsetX = doorDx / doorLength * tangentOffset;
        double offsetY = doorDy / doorLength * tangentOffset;
        return new MarkerPoint(centerX + offsetX, centerY + offsetY);
    }

    private double distanceToGeometry(double screenX, double screenY, CorridorGeometry geometry, DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath) {
        if (!geometry.routable()) {
            return previewModel.distanceToInvalidCorridorLink(screenX, screenY, geometry);
        }
        double bestDistance = Double.POSITIVE_INFINITY;
        if (displayPath != null) {
            for (DungeonGraphCorridorLayoutSupport.OffsetLine segment : displayPath.segments()) {
                bestDistance = Math.min(bestDistance, DungeonGridScreenMath.distanceToSegment(
                        screenX,
                        screenY,
                        segment.x1(),
                        segment.y1(),
                        segment.x2(),
                        segment.y2()));
            }
        }
        for (DoorSegment door : geometry.doors()) {
            bestDistance = Math.min(bestDistance, previewModel.distanceToDoor(screenX, screenY, door));
        }
        return bestDistance;
    }

    private List<Long> laneOrderForDoor(DoorSegment door, DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath) {
        List<Long> fallback = layoutSupport.corridorIdsByDoorMarker().getOrDefault(
                DungeonGraphCorridorLayoutSupport.DoorMarkerKey.of(door),
                List.of());
        if (fallback.size() < 2) {
            return fallback;
        }
        DungeonGraphCorridorLayoutSupport.SegmentKey nearestSegment = nearestDisplaySegmentForDoor(door, displayPath);
        if (nearestSegment != null) {
            List<Long> laneOrder = layoutSupport.laneOrderBySegment().getOrDefault(nearestSegment, List.of());
            List<Long> filtered = laneOrder.stream().filter(fallback::contains).toList();
            if (filtered.size() == fallback.size()) {
                return filtered;
            }
        }
        return fallback;
    }

    static DoorSegment snapDoorSegment(CorridorEditInteractionController.DoorDragPreview preview) {
        CorridorEditInteractionController.DoorMoveTarget target = preview.snapTarget();
        DungeonGeometry.EdgeVertices vertices = DungeonGeometry.edgeVertices(target.roomCell(), target.direction());
        return new DoorSegment(vertices.start(), vertices.end(), target.roomId(), target.roomCell());
    }

    static DungeonGraphCorridorLayoutSupport.SegmentKey nearestDisplaySegmentForDoor(
            DoorSegment door,
            DungeonGraphCorridorLayoutSupport.CorridorDisplayPath displayPath
    ) {
        if (displayPath == null || displayPath.segments().isEmpty()) {
            return null;
        }
        Point2i outsideCell = outsideCellForDoor(door);
        DungeonGraphCorridorLayoutSupport.SegmentKey bestSegment = null;
        int bestDistance = Integer.MAX_VALUE;
        for (DungeonGraphCorridorLayoutSupport.OffsetLine segment : displayPath.segments()) {
            DungeonGraphCorridorLayoutSupport.SegmentKey canonical = segment.canonicalSegment();
            if (canonical == null) {
                continue;
            }
            int distance = Math.min(outsideCell.distanceTo(canonical.start()), outsideCell.distanceTo(canonical.end()));
            if (distance < bestDistance) {
                bestDistance = distance;
                bestSegment = canonical;
            }
        }
        return bestDistance <= 1 ? bestSegment : null;
    }

    private static Point2i outsideCellForDoor(DoorSegment door) {
        Point2i roomCell = door.roomCell();
        if (door.start().x() == door.end().x()) {
            return roomCell.x() < door.start().x()
                    ? new Point2i(roomCell.x() + 1, roomCell.y())
                    : new Point2i(roomCell.x() - 1, roomCell.y());
        }
        return roomCell.y() < door.start().y()
                ? new Point2i(roomCell.x(), roomCell.y() + 1)
                : new Point2i(roomCell.x(), roomCell.y() - 1);
    }

    private int segmentIndexForKey(CorridorGeometry geometry, DungeonGraphCorridorLayoutSupport.SegmentKey targetKey) {
        if (geometry == null || targetKey == null) {
            return -1;
        }
        for (int index = 0; index < geometry.segments().size(); index++) {
            GridSegment segment = geometry.segments().get(index);
            if (new DungeonGraphCorridorLayoutSupport.SegmentKey(
                    features.world.dungeonmap.canvas.rendering.CorridorRenderKeys.segmentKey(segment.from(), segment.to()))
                    .equals(targetKey)) {
                return index;
            }
        }
        return -1;
    }

    record MarkerPoint(double x, double y) {
    }

}
