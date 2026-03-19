package features.world.quarantine.dungeonmap.editor.workspace.corridor;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPreviewGeometryProjector;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonGeometry;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridScreenMath;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;

public final class DungeonCorridorDoorProjector {

    private final DungeonPaneContext paneContext;
    private final Function<DungeonCorridor, CorridorGeometry> corridorGeometryForSelection;
    private final DungeonPreviewGeometryProjector geometry;
    private final Supplier<DungeonEditorTool> editorToolSupplier;

    public DungeonCorridorDoorProjector(
            DungeonPaneContext paneContext,
            Function<DungeonCorridor, CorridorGeometry> corridorGeometryForSelection,
            DungeonPreviewGeometryProjector geometry,
            Supplier<DungeonEditorTool> editorToolSupplier
    ) {
        this.paneContext = Objects.requireNonNull(paneContext, "paneContext");
        this.corridorGeometryForSelection = Objects.requireNonNull(corridorGeometryForSelection, "corridorGeometryForSelection");
        this.geometry = Objects.requireNonNull(geometry, "geometry");
        this.editorToolSupplier = Objects.requireNonNull(editorToolSupplier, "editorToolSupplier");
    }

    public CorridorSelectionContext selectedCorridorContext() {
        DungeonLayout layout = paneContext.dungeonLayout();
        DungeonLayoutRenderData renderData = paneContext.renderData();
        DungeonSelection selectedTarget = paneContext.selectedTarget();
        if (layout == null || renderData == null || !(selectedTarget instanceof DungeonSelection.Corridor selectedCorridor)) {
            return null;
        }
        DungeonCorridor corridor = layout.findCorridor(selectedCorridor.corridorId());
        CorridorGeometry geom = corridorGeometryForSelection.apply(corridor);
        if (corridor == null || geom == null || !geom.routable()) {
            return null;
        }
        return new CorridorSelectionContext(corridor, geom);
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
            ScreenPoint screen,
            CorridorDoorHandle handle,
            double previewHalfLength
    ) {
        CorridorDoorHandle normalizedHandle = normalizeCorridorDoorHandle(handle);
        if (normalizedHandle == null || paneContext.dungeonLayout() == null) {
            return null;
        }
        DoorEdgeProjection projection = nearestCorridorDoorProjection(screen, normalizedHandle);
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

    public int insertIndexForSegment(long corridorId, CorridorGeometry geom, int segmentIndex) {
        List<Integer> waypointPathIndices = corridorWaypointPathIndices(corridorId, geom);
        List<Point2i> path = paneContext.renderData() == null ? List.of() : paneContext.renderData().corridorPath(corridorId);
        if (path.isEmpty() || geom == null || geom.waypointCells().isEmpty()) {
            return geom == null ? 0 : geom.waypointCells().size();
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
            ScreenPoint screen,
            int segmentIndex
    ) {
        if (context == null || segmentIndex < 0 || context.geometry().waypointCells().isEmpty()) {
            return null;
        }
        List<Point2i> path = paneContext.renderData() == null ? List.of() : paneContext.renderData().corridorPath(context.corridor().corridorId());
        List<Integer> waypointPathIndices = corridorWaypointPathIndices(context.corridor().corridorId(), context.geometry());
        if (path.size() < 2 || waypointPathIndices.isEmpty()) {
            return null;
        }
        int segmentStartPathIndex = Math.min(segmentIndex, path.size() - 2);
        int segmentEndPathIndex = segmentStartPathIndex + 1;
        int candidateIndex = resolveNearestWaypointCandidate(
                context.geometry().waypointCells(), waypointPathIndices,
                segmentStartPathIndex, segmentEndPathIndex, screen);
        if (candidateIndex < 0) {
            return null;
        }
        return new CorridorWaypointHandle(context.corridor().corridorId(), candidateIndex);
    }

    public CorridorDoorHandle normalizeCorridorDoorHandle(CorridorDoorHandle handle) {
        if (handle == null || editorToolSupplier.get() != DungeonEditorTool.SELECT) {
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

    private List<Integer> corridorWaypointPathIndices(long corridorId, CorridorGeometry geom) {
        List<Point2i> path = paneContext.renderData() == null ? List.of() : paneContext.renderData().corridorPath(corridorId);
        if (path.isEmpty() || geom == null || geom.waypointCells().isEmpty()) {
            return List.of();
        }
        List<Integer> waypointPathIndices = new ArrayList<>();
        int searchStart = 0;
        for (Point2i waypoint : geom.waypointCells()) {
            int index = findWaypointSegmentIndex(path, waypoint, searchStart);
            waypointPathIndices.add(index);
            searchStart = Math.min(index + 1, path.size() - 1);
        }
        return waypointPathIndices;
    }

    private int findWaypointSegmentIndex(List<Point2i> path, Point2i waypointCell, int searchStart) {
        for (int index = searchStart; index < path.size(); index++) {
            if (path.get(index).equals(waypointCell)) {
                return index;
            }
        }
        int bestIndex = Math.min(searchStart, path.size() - 1);
        int bestDistance = Integer.MAX_VALUE;
        for (int index = searchStart; index < path.size(); index++) {
            Point2i pathPoint = path.get(index);
            int distance = Math.abs(pathPoint.x() - waypointCell.x()) + Math.abs(pathPoint.y() - waypointCell.y());
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        }
        return bestIndex;
    }

    private int resolveNearestWaypointCandidate(
            List<Point2i> waypointCells,
            List<Integer> waypointPathIndices,
            int segmentStartPathIndex,
            int segmentEndPathIndex,
            ScreenPoint screen
    ) {
        Integer prev = null;
        Integer next = null;
        for (int index = 0; index < waypointPathIndices.size(); index++) {
            int pathIndex = waypointPathIndices.get(index);
            if (pathIndex <= segmentStartPathIndex) {
                prev = index;
            }
            if (pathIndex >= segmentEndPathIndex) {
                next = index;
                break;
            }
        }
        if (prev == null && next == null) {
            return -1;
        }
        if (prev == null) {
            return next;
        }
        if (next == null) {
            return prev;
        }
        double prevDistance = geometry.distanceToRoomCell(screen, waypointCells.get(prev));
        double nextDistance = geometry.distanceToRoomCell(screen, waypointCells.get(next));
        return prevDistance <= nextDistance ? prev : next;
    }

    private List<DungeonRoom> doorProjectionRooms(CorridorDoorHandle handle) {
        DungeonLayout layout = paneContext.dungeonLayout();
        if (layout == null || handle == null) {
            return List.of();
        }
        DungeonCorridor corridor = layout.findCorridor(handle.corridorId());
        if (corridor == null) {
            return List.of();
        }
        Set<Long> clusterIds = new LinkedHashSet<>();
        for (Long roomId : corridor.roomIds()) {
            DungeonRoom room = layout.findRoom(roomId);
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
            ScreenPoint screen,
            CorridorDoorHandle handle
    ) {
        DungeonCanvasCamera camera = paneContext.camera();
        double worldX = camera.toWorldX(screen.x());
        double worldY = camera.toWorldY(screen.y());
        DoorEdgeProjection bestProjection = null;
        double bestDistanceSquared = Double.POSITIVE_INFINITY;
        for (DungeonRoom room : doorProjectionRooms(handle)) {
            Set<Point2i> roomCells = geometry.roomCellsFor(room);
            for (Point2i roomCell : roomCells) {
                for (DungeonRoomCluster.EdgeDirection direction : DungeonRoomCluster.EdgeDirection.values()) {
                    Optional<DoorEdgeProjection> candidate = projectDoorOnEdge(roomCell, direction, room.roomId(), roomCells, worldX, worldY);
                    if (candidate.isEmpty()) {
                        continue;
                    }
                    DoorEdgeProjection projection = candidate.get();
                    double distanceSquared = DungeonGridScreenMath.squaredDistance(worldX, worldY, projection.projectedWorldX(), projection.projectedWorldY());
                    if (distanceSquared < bestDistanceSquared) {
                        bestDistanceSquared = distanceSquared;
                        bestProjection = projection;
                    }
                }
            }
        }
        return bestProjection;
    }

    private Optional<DoorEdgeProjection> projectDoorOnEdge(
            Point2i roomCell,
            DungeonRoomCluster.EdgeDirection direction,
            long roomId,
            Set<Point2i> roomCells,
            double worldX,
            double worldY
    ) {
        Point2i outsideCell = roomCell.add(direction.delta());
        if (roomCells.contains(outsideCell) || isOccupiedByOtherRoom(roomId, outsideCell)) {
            return Optional.empty();
        }
        DungeonGeometry.EdgeVertices vertices = DungeonGeometry.edgeVertices(roomCell, direction);
        double projectionT = DungeonGridScreenMath.projectionT(
                worldX,
                worldY,
                vertices.start().x(),
                vertices.start().y(),
                vertices.end().x(),
                vertices.end().y());
        double projectedX = DungeonGridScreenMath.lerp(vertices.start().x(), vertices.end().x(), projectionT);
        double projectedY = DungeonGridScreenMath.lerp(vertices.start().y(), vertices.end().y(), projectionT);
        return Optional.of(new DoorEdgeProjection(roomId, roomCell, direction, vertices, projectionT, projectedX, projectedY));
    }

    private CorridorEditInteractionController.DoorPreviewSegment previewDoorSegment(
            DoorEdgeProjection projection,
            double previewHalfLength
    ) {
        double startT = Math.max(0.0, projection.projectionT() - previewHalfLength);
        double endT = Math.min(1.0, projection.projectionT() + previewHalfLength);
        double startWorldX = DungeonGridScreenMath.lerp(projection.vertices().start().x(), projection.vertices().end().x(), startT);
        double startWorldY = DungeonGridScreenMath.lerp(projection.vertices().start().y(), projection.vertices().end().y(), startT);
        double endWorldX = DungeonGridScreenMath.lerp(projection.vertices().start().x(), projection.vertices().end().x(), endT);
        double endWorldY = DungeonGridScreenMath.lerp(projection.vertices().start().y(), projection.vertices().end().y(), endT);
        return new CorridorEditInteractionController.DoorPreviewSegment(
                startWorldX,
                startWorldY,
                endWorldX,
                endWorldY,
                projection.projectedWorldX(),
                projection.projectedWorldY());
    }

    private boolean isOccupiedByOtherRoom(long roomId, Point2i cell) {
        DungeonLayout layout = paneContext.dungeonLayout();
        if (layout == null || cell == null) return false;
        DungeonRoom occupant = layout.roomAtCell(cell);
        return occupant != null && occupant.roomId() != null && occupant.roomId() != roomId;
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
