package features.world.quarantine.dungeonmap.editor.workspace.preview;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.rooms.model.DungeonCellPolygonMath;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomGeometry;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.rooms.model.RoomShape;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridScreenMath;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonPreviewGeometryProjector {

    private static final Point2i ZERO = new Point2i(0, 0);

    private final Host host;

    public DungeonPreviewGeometryProjector(Host host) {
        this.host = Objects.requireNonNull(host, "host");
    }

    public Point2i previewCenter(DungeonRoom room) {
        RoomShape shape = Objects.requireNonNull(host.dungeonLayout(), "layout").roomShape(room.roomId());
        Point2i center = Objects.requireNonNull(shape, "shape").center();
        return center.add(previewDelta(room.clusterId()));
    }

    public Point2i previewCenter(DungeonRoomCluster cluster) {
        return Objects.requireNonNull(cluster, "cluster").center().add(previewDelta(cluster.clusterId()));
    }

    public Point2i previewClusterCell(DungeonRoomCluster cluster, Point2i relativeCell) {
        return previewCenter(cluster).add(relativeCell);
    }

    public Point2D previewOffset(Long clusterId) {
        if (clusterId == null) {
            return Point2D.ZERO;
        }
        Point2D offset = host.previewState().clusterOffsets().get(clusterId);
        return offset == null ? Point2D.ZERO : offset;
    }

    public Map<Long, Point2i> previewClusterCenters() {
        return host.previewState().clusterCenters();
    }

    public double previewScreenX(double worldX, Long clusterId) {
        return previewScreenX(worldX, previewOffset(clusterId));
    }

    public double previewScreenY(double worldY, Long clusterId) {
        return previewScreenY(worldY, previewOffset(clusterId));
    }

    public double previewScreenX(double worldX, Point2D offset) {
        return host.camera().toScreenX(worldX + (offset == null ? 0.0 : offset.getX()));
    }

    public double previewScreenY(double worldY, Point2D offset) {
        return host.camera().toScreenY(worldY + (offset == null ? 0.0 : offset.getY()));
    }

    public Point2D corridorPreviewOffset(DungeonCorridor corridor) {
        DungeonLayout layout = host.dungeonLayout();
        if (corridor == null || corridor.corridorId() == null || layout == null) {
            return Point2D.ZERO;
        }
        if (host.hasClusterDragPreview()) {
            return Point2D.ZERO;
        }
        if (!hasSmoothClusterDragPreview()) {
            return Point2D.ZERO;
        }
        return resolveUniformOffset(collectCorridorClusterIds(corridor, layout));
    }

    private List<Long> collectCorridorClusterIds(DungeonCorridor corridor, DungeonLayout layout) {
        List<Long> clusterIds = new ArrayList<>();
        for (Long roomId : corridor.roomIds()) {
            DungeonRoom room = layout.findRoom(roomId);
            if (room != null) {
                clusterIds.add(room.clusterId());
            }
        }
        for (var waypoint : corridor.waypoints()) {
            clusterIds.add(waypoint.clusterId());
        }
        for (var override : corridor.doorOverrides()) {
            clusterIds.add(override.clusterId());
        }
        return clusterIds;
    }

    private Point2D resolveUniformOffset(List<Long> clusterIds) {
        Point2D resolvedOffset = null;
        for (Long clusterId : clusterIds) {
            Point2D offset = previewOffset(clusterId);
            if (!isZeroOffset(offset)) {
                if (resolvedOffset == null || resolvedOffset.equals(offset)) {
                    resolvedOffset = offset;
                } else {
                    return Point2D.ZERO;
                }
            }
        }
        return resolvedOffset == null ? Point2D.ZERO : resolvedOffset;
    }

    public Point2D doorPreviewOffset(DoorSegment door) {
        DungeonLayout layout = host.dungeonLayout();
        if (door == null || layout == null) {
            return Point2D.ZERO;
        }
        DungeonRoom room = layout.findRoom(door.roomId());
        return room == null ? Point2D.ZERO : previewOffset(room.clusterId());
    }

    public boolean hasSmoothClusterDragPreview() {
        return host.previewState().clusterOffsets().values().stream()
                .anyMatch(offset -> offset != null && (!isZero(offset.getX()) || !isZero(offset.getY())));
    }

    public Set<Point2i> roomCellsFor(DungeonRoom room) {
        DungeonLayout layout = host.dungeonLayout();
        if (room == null || layout == null) {
            return Set.of();
        }
        Point2i delta = previewDelta(room.clusterId());
        if (delta.equals(ZERO) && host.renderData() != null) {
            return layout.roomCells(room.roomId());
        }
        return Point2i.translateAll(layout.roomCells(room.roomId()), delta);
    }

    public List<List<Point2i>> roomLoopsFor(DungeonRoom room) {
        if (room == null) {
            return List.of();
        }
        Point2i center = previewCenter(room);
        return DungeonCellPolygonMath.absoluteLoops(DungeonRoomGeometry.roomShapeForCells(roomCellsFor(room), center));
    }

    public Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
        DungeonLayout layout = host.dungeonLayout();
        if (cluster == null || cluster.clusterId() == null || layout == null) {
            return Set.of();
        }
        Point2i delta = previewDelta(cluster.clusterId());
        if (delta.equals(ZERO)) {
            return layout.clusterCells(cluster.clusterId());
        }
        return Point2i.translateAll(layout.clusterCells(cluster.clusterId()), delta);
    }

    public List<List<Point2i>> clusterLoopsFor(DungeonRoomCluster cluster) {
        DungeonLayout layout = host.dungeonLayout();
        if (cluster == null || cluster.clusterId() == null || layout == null) {
            return List.of();
        }
        Point2i delta = previewDelta(cluster.clusterId());
        if (delta.equals(ZERO)) {
            return layout.clusterLoops(cluster.clusterId());
        }
        return translateLoops(layout.clusterLoops(cluster.clusterId()), delta);
    }

    public Point2i previewDelta(Long clusterId) {
        DungeonLayout layout = host.dungeonLayout();
        if (clusterId == null || layout == null) {
            return ZERO;
        }
        DungeonRoomCluster cluster = layout.findCluster(clusterId);
        Point2i previewCenter = host.previewState().clusterCenters().get(clusterId);
        if (cluster == null || previewCenter == null) {
            return ZERO;
        }
        return previewCenter.subtract(cluster.center());
    }

    public DungeonRoom previewRoomAtCell(Point2i cell) {
        return host.previewTopologySession().roomAtCell(cell);
    }

    public DungeonRoomCluster previewClusterAtCell(Point2i cell) {
        return host.previewTopologySession().clusterAtCell(cell);
    }

    public boolean sameDoorSegment(DoorSegment left, DoorSegment right) {
        return (left.start().equals(right.start()) && left.end().equals(right.end()))
                || (left.start().equals(right.end()) && left.end().equals(right.start()));
    }

    public double distanceToDoor(ScreenPoint screen, DoorSegment door) {
        return DungeonGridScreenMath.distanceToDoor(screen, door, screenResolver());
    }

    public double distanceToSegment(ScreenPoint screen, Point2i from, Point2i to) {
        return DungeonGridScreenMath.distanceToSegment(screen, from, to, screenResolver());
    }

    public double distanceToRoomCell(ScreenPoint screen, Point2i roomCell) {
        return DungeonGridScreenMath.distanceToRoomCell(screen, roomCell, screenResolver());
    }

    public double distanceToInvalidCorridorLink(ScreenPoint screen, CorridorGeometry geometry) {
        return DungeonGridScreenMath.distanceToInvalidCorridorLink(
                screen,
                geometry,
                host.dungeonLayout(),
                host.renderData() != null,
                this::previewCenter,
                screenResolver());
    }

    public void strokeInvalidCorridorLink(GraphicsContext gc, CorridorGeometry geometry) {
        DungeonGridScreenMath.InvalidCorridorLink link = DungeonGridScreenMath.invalidCorridorLink(
                geometry,
                host.dungeonLayout(),
                host.renderData() != null);
        if (link == null) {
            return;
        }
        gc.strokeLine(
                host.camera().toScreenX(previewCenter(link.from()).x() + 0.5),
                host.camera().toScreenY(previewCenter(link.from()).y() + 0.5),
                host.camera().toScreenX(previewCenter(link.to()).x() + 0.5),
                host.camera().toScreenY(previewCenter(link.to()).y() + 0.5));
    }

    public boolean hasInvalidCorridorLink(CorridorGeometry geometry) {
        return DungeonGridScreenMath.invalidCorridorLink(
                geometry,
                host.dungeonLayout(),
                host.renderData() != null) != null;
    }


    private List<List<Point2i>> translateLoops(List<List<Point2i>> loops, Point2i delta) {
        return loops.stream()
                .map(loop -> loop.stream().map(point -> point.add(delta)).toList())
                .toList();
    }

    private boolean isZeroOffset(Point2D offset) {
        return offset == null || offset.equals(Point2D.ZERO);
    }

    private static boolean isZero(double value) {
        return Math.abs(value) < 0.000001;
    }

    private DungeonGridScreenMath.ScreenPointResolver screenResolver() {
        return new DungeonGridScreenMath.ScreenPointResolver() {
            @Override
            public double screenX(double worldX) {
                return host.camera().toScreenX(worldX);
            }

            @Override
            public double screenY(double worldY) {
                return host.camera().toScreenY(worldY);
            }
        };
    }

    public interface Host extends DungeonPaneContext {
        DungeonPreviewState previewState();
        DungeonPreviewTopologySession previewTopologySession();
        boolean hasClusterDragPreview();
    }
}
