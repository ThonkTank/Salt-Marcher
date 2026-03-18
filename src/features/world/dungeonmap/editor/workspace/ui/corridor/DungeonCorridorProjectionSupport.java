package features.world.dungeonmap.editor.workspace.ui.corridor;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonGeometry;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.view.model.DungeonSelection;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorProjectionSupport {

    private final Host host;

    public DungeonCorridorProjectionSupport(Host host) {
        this.host = Objects.requireNonNull(host, "host");
    }

    public CorridorSelectionContext selectedCorridorContext() {
        DungeonLayout layout = host.dungeonLayout();
        DungeonLayoutRenderData renderData = host.renderData();
        DungeonSelection selectedTarget = host.selectedTarget();
        if (layout == null || renderData == null || !(selectedTarget instanceof DungeonSelection.Corridor selectedCorridor)) {
            return null;
        }
        DungeonCorridor corridor = layout.corridorById(selectedCorridor.corridorId());
        CorridorGeometry geometry = host.corridorGeometryForSelection(corridor);
        if (corridor == null || geometry == null || !geometry.routable()) {
            return null;
        }
        return new CorridorSelectionContext(corridor, geometry);
    }

    public CorridorDoorHandle corridorDoorHandleForRoom(long roomId) {
        CorridorSelectionContext context = selectedCorridorContext();
        if (context == null) {
            return null;
        }
        return context.geometry().doors().stream()
                .filter(door -> door.roomId() == roomId)
                .findFirst()
                .map(door -> new CorridorDoorHandle(context.corridor().corridorId(), roomId))
                .orElse(null);
    }

    public CorridorEditInteractionController.DoorDragPreview projectCorridorDoorDragPreview(
            double screenX,
            double screenY,
            CorridorDoorHandle handle,
            double previewHalfLength
    ) {
        CorridorDoorHandle normalizedHandle = normalizeCorridorDoorHandle(handle);
        if (normalizedHandle == null || host.dungeonLayout() == null) {
            return null;
        }
        DoorEdgeProjection projection = nearestCorridorDoorProjection(screenX, screenY, normalizedHandle);
        if (projection == null) {
            return null;
        }
        // Drag previews stay continuous so the door can follow the pointer along the wall;
        // persistence still snaps back to one discrete room edge on release.
        CorridorEditInteractionController.DoorMoveTarget snapTarget = new CorridorEditInteractionController.DoorMoveTarget(
                projection.roomId(),
                projection.roomCell(),
                projection.direction());
        CorridorEditInteractionController.DoorPreviewSegment previewSegment = previewDoorSegment(projection, previewHalfLength);
        return new CorridorEditInteractionController.DoorDragPreview(snapTarget, previewSegment);
    }

    public int insertIndexForSegment(long corridorId, CorridorGeometry geometry, int segmentIndex) {
        List<Integer> waypointPathIndices = corridorWaypointPathIndices(corridorId, geometry);
        List<Point2i> path = host.renderData() == null ? List.of() : host.renderData().corridorPath(corridorId);
        if (path.isEmpty() || geometry == null || geometry.waypointCells().isEmpty()) {
            return geometry == null ? 0 : geometry.waypointCells().size();
        }
        int pathIndexAfterSegment = Math.min(segmentIndex + 1, path.size() - 1);
        int insertIndex = 0;
        while (insertIndex < waypointPathIndices.size() && waypointPathIndices.get(insertIndex) <= pathIndexAfterSegment) {
            insertIndex++;
        }
        return insertIndex;
    }

    public CorridorWaypointHandle waypointHandleForSegmentRemoval(
            CorridorSelectionContext context,
            double screenX,
            double screenY,
            int segmentIndex
    ) {
        List<Point2i> waypointCells = context == null ? List.of() : context.geometry().waypointCells();
        if (context == null || segmentIndex < 0 || waypointCells.isEmpty()) {
            return null;
        }
        List<Point2i> path = host.renderData() == null ? List.of() : host.renderData().corridorPath(context.corridor().corridorId());
        List<Integer> waypointPathIndices = corridorWaypointPathIndices(context.corridor().corridorId(), context.geometry());
        if (path.size() < 2 || waypointPathIndices.isEmpty()) {
            return null;
        }
        int segmentStartPathIndex = Math.min(segmentIndex, path.size() - 2);
        int segmentEndPathIndex = segmentStartPathIndex + 1;
        Integer previousWaypointIndex = null;
        Integer nextWaypointIndex = null;
        for (int index = 0; index < waypointPathIndices.size(); index++) {
            int waypointPathIndex = waypointPathIndices.get(index);
            if (waypointPathIndex <= segmentStartPathIndex) {
                previousWaypointIndex = index;
            }
            if (waypointPathIndex >= segmentEndPathIndex) {
                nextWaypointIndex = index;
                break;
            }
        }
        int candidateIndex;
        if (previousWaypointIndex == null) {
            candidateIndex = nextWaypointIndex == null ? -1 : nextWaypointIndex;
        } else if (nextWaypointIndex == null) {
            candidateIndex = previousWaypointIndex;
        } else {
            Point2i previousWaypoint = waypointCells.get(previousWaypointIndex);
            Point2i nextWaypoint = waypointCells.get(nextWaypointIndex);
            double previousDistance = host.distanceToRoomCell(screenX, screenY, previousWaypoint);
            double nextDistance = host.distanceToRoomCell(screenX, screenY, nextWaypoint);
            candidateIndex = previousDistance <= nextDistance ? previousWaypointIndex : nextWaypointIndex;
        }
        if (candidateIndex < 0) {
            return null;
        }
        return new CorridorWaypointHandle(context.corridor().corridorId(), candidateIndex);
    }

    public CorridorDoorHandle normalizeCorridorDoorHandle(CorridorDoorHandle handle) {
        if (handle == null || host.editorTool() != features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool.SELECT) {
            return null;
        }
        CorridorSelectionContext context = selectedCorridorContext();
        if (context == null || handle.corridorId() != context.corridor().corridorId()) {
            return null;
        }
        return context.geometry().doors().stream()
                .anyMatch(door -> door.roomId() == handle.roomId())
                ? handle
                : null;
    }

    private List<Integer> corridorWaypointPathIndices(long corridorId, CorridorGeometry geometry) {
        List<Point2i> path = host.renderData() == null ? List.of() : host.renderData().corridorPath(corridorId);
        if (path.isEmpty() || geometry == null || geometry.waypointCells().isEmpty()) {
            return List.of();
        }
        List<Integer> waypointPathIndices = new ArrayList<>();
        int searchStartIndex = 0;
        for (Point2i waypoint : geometry.waypointCells()) {
            int exactIndex = -1;
            for (int index = searchStartIndex; index < path.size(); index++) {
                if (path.get(index).equals(waypoint)) {
                    exactIndex = index;
                    break;
                }
            }
            if (exactIndex >= 0) {
                waypointPathIndices.add(exactIndex);
                searchStartIndex = Math.min(exactIndex + 1, path.size() - 1);
                continue;
            }
            int bestIndex = Math.min(searchStartIndex, path.size() - 1);
            int bestDistance = Integer.MAX_VALUE;
            for (int index = searchStartIndex; index < path.size(); index++) {
                Point2i pathPoint = path.get(index);
                int distance = Math.abs(pathPoint.x() - waypoint.x()) + Math.abs(pathPoint.y() - waypoint.y());
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = index;
                }
            }
            waypointPathIndices.add(bestIndex);
            searchStartIndex = Math.min(bestIndex + 1, path.size() - 1);
        }
        return waypointPathIndices;
    }

    private List<DungeonRoom> doorProjectionRooms(CorridorDoorHandle handle) {
        DungeonLayout layout = host.dungeonLayout();
        if (layout == null || handle == null) {
            return List.of();
        }
        DungeonCorridor corridor = layout.corridorById(handle.corridorId());
        if (corridor == null) {
            return List.of();
        }
        Set<Long> clusterIds = new LinkedHashSet<>();
        for (Long roomId : corridor.roomIds()) {
            DungeonRoom room = layout.roomById(roomId);
            if (room != null) {
                clusterIds.add(room.clusterId());
            }
        }
        return layout.rooms().stream()
                .filter(Objects::nonNull)
                .filter(room -> room.roomId() != null)
                .filter(room -> clusterIds.contains(room.clusterId()))
                .toList();
    }

    private DoorEdgeProjection nearestCorridorDoorProjection(
            double screenX,
            double screenY,
            CorridorDoorHandle handle
    ) {
        DungeonCanvasCamera camera = host.camera();
        double worldX = camera.toWorldX(screenX);
        double worldY = camera.toWorldY(screenY);
        DoorEdgeProjection bestProjection = null;
        double bestDistanceSquared = Double.POSITIVE_INFINITY;
        for (DungeonRoom room : doorProjectionRooms(handle)) {
            Set<Point2i> roomCells = host.roomCellsFor(room);
            for (Point2i roomCell : roomCells) {
                for (DungeonRoomCluster.EdgeDirection direction : DungeonRoomCluster.EdgeDirection.values()) {
                    Point2i outsideCell = roomCell.add(direction.delta());
                    if (roomCells.contains(outsideCell) || isOccupiedByOtherRoom(room.roomId(), outsideCell)) {
                        continue;
                    }
                    DungeonGeometry.EdgeVertices vertices = DungeonGeometry.edgeVertices(roomCell, direction);
                    double projectionT = projectionT(
                            worldX,
                            worldY,
                            vertices.start().x(),
                            vertices.start().y(),
                            vertices.end().x(),
                            vertices.end().y());
                    double projectedX = lerp(vertices.start().x(), vertices.end().x(), projectionT);
                    double projectedY = lerp(vertices.start().y(), vertices.end().y(), projectionT);
                    double distanceSquared = squaredDistance(worldX, worldY, projectedX, projectedY);
                    if (distanceSquared < bestDistanceSquared) {
                        bestDistanceSquared = distanceSquared;
                        bestProjection = new DoorEdgeProjection(
                                room.roomId(),
                                roomCell,
                                direction,
                                vertices,
                                projectionT,
                                projectedX,
                                projectedY);
                    }
                }
            }
        }
        return bestProjection;
    }

    private CorridorEditInteractionController.DoorPreviewSegment previewDoorSegment(
            DoorEdgeProjection projection,
            double previewHalfLength
    ) {
        double startT = Math.max(0.0, projection.projectionT() - previewHalfLength);
        double endT = Math.min(1.0, projection.projectionT() + previewHalfLength);
        double startWorldX = lerp(projection.vertices().start().x(), projection.vertices().end().x(), startT);
        double startWorldY = lerp(projection.vertices().start().y(), projection.vertices().end().y(), startT);
        double endWorldX = lerp(projection.vertices().start().x(), projection.vertices().end().x(), endT);
        double endWorldY = lerp(projection.vertices().start().y(), projection.vertices().end().y(), endT);
        return new CorridorEditInteractionController.DoorPreviewSegment(
                startWorldX,
                startWorldY,
                endWorldX,
                endWorldY,
                projection.projectedWorldX(),
                projection.projectedWorldY());
    }

    private boolean isOccupiedByOtherRoom(long roomId, Point2i cell) {
        DungeonLayout layout = host.dungeonLayout();
        if (layout == null || cell == null) return false;
        DungeonRoom occupant = layout.roomAtCell(cell);
        return occupant != null && occupant.roomId() != null && occupant.roomId() != roomId;
    }

    private static double projectionT(double px, double py, double x1, double y1, double x2, double y2) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        double lengthSquared = dx * dx + dy * dy;
        if (lengthSquared == 0) {
            return 0.0;
        }
        return Math.max(0.0, Math.min(1.0, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    }

    private static double squaredDistance(double x1, double y1, double x2, double y2) {
        double dx = x1 - x2;
        double dy = y1 - y2;
        return dx * dx + dy * dy;
    }

    private static double lerp(double start, double end, double t) {
        return start + (end - start) * t;
    }

    public interface Host extends features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneReadContext {
        features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool editorTool();
        CorridorGeometry corridorGeometryForSelection(DungeonCorridor corridor);
        Set<Point2i> roomCellsFor(DungeonRoom room);
        double distanceToRoomCell(double screenX, double screenY, Point2i roomCell);
    }

    public record CorridorSelectionContext(DungeonCorridor corridor, CorridorGeometry geometry) {
    }

    private record DoorEdgeProjection(
            long roomId,
            Point2i roomCell,
            DungeonRoomCluster.EdgeDirection direction,
            DungeonGeometry.EdgeVertices vertices,
            double projectionT,
            double projectedWorldX,
            double projectedWorldY
    ) {
    }
}
