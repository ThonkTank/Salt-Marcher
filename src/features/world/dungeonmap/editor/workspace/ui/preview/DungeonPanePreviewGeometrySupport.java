package features.world.dungeonmap.editor.workspace.ui.preview;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.rooms.model.DungeonRoomGeometry;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.rooms.model.RoomShape;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneReadContext;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonGridScreenMath;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonPanePreviewGeometrySupport {

    private static final Point2i ZERO = new Point2i(0, 0);

    private final Host host;

    public DungeonPanePreviewGeometrySupport(Host host) {
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
        Point2D resolvedOffset = null;
        boolean conflictingOffset = false;
        for (Long roomId : corridor.roomIds()) {
            DungeonRoom room = layout.roomById(roomId);
            Point2D roomOffset = room == null ? Point2D.ZERO : previewOffset(room.clusterId());
            if (!isZeroOffset(roomOffset)) {
                if (resolvedOffset == null || resolvedOffset.equals(roomOffset)) {
                    resolvedOffset = roomOffset;
                } else {
                    conflictingOffset = true;
                }
            }
        }
        for (var waypoint : corridor.waypoints()) {
            Point2D waypointOffset = previewOffset(waypoint.clusterId());
            if (!isZeroOffset(waypointOffset)) {
                if (resolvedOffset == null || resolvedOffset.equals(waypointOffset)) {
                    resolvedOffset = waypointOffset;
                } else {
                    conflictingOffset = true;
                }
            }
        }
        for (var override : corridor.doorOverrides()) {
            Point2D overrideOffset = previewOffset(override.clusterId());
            if (!isZeroOffset(overrideOffset)) {
                if (resolvedOffset == null || resolvedOffset.equals(overrideOffset)) {
                    resolvedOffset = overrideOffset;
                } else {
                    conflictingOffset = true;
                }
            }
        }
        if (conflictingOffset || resolvedOffset == null) {
            return Point2D.ZERO;
        }
        return resolvedOffset;
    }

    public Point2D doorPreviewOffset(DoorSegment door) {
        DungeonLayout layout = host.dungeonLayout();
        if (door == null || layout == null) {
            return Point2D.ZERO;
        }
        DungeonRoom room = layout.roomById(door.roomId());
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
        return translateCells(layout.roomCells(room.roomId()), delta);
    }

    public List<List<Point2i>> roomLoopsFor(DungeonRoom room) {
        if (room == null) {
            return List.of();
        }
        Point2i center = previewCenter(room);
        return DungeonRoomGeometry.absoluteLoops(DungeonRoomGeometry.roomShapeForCells(roomCellsFor(room), center));
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
        return translateCells(layout.clusterCells(cluster.clusterId()), delta);
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
        DungeonRoomCluster cluster = layout.clusterById(clusterId);
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

    public double distanceToDoor(double screenX, double screenY, DoorSegment door) {
        return DungeonGridScreenMath.distanceToDoor(screenX, screenY, door, screenResolver());
    }

    public double distanceToSegment(double screenX, double screenY, Point2i from, Point2i to) {
        return DungeonGridScreenMath.distanceToSegment(screenX, screenY, from, to, screenResolver());
    }

    public double distanceToRoomCell(double screenX, double screenY, Point2i roomCell) {
        return DungeonGridScreenMath.distanceToRoomCell(screenX, screenY, roomCell, screenResolver());
    }

    public double distanceToInvalidCorridorLink(double screenX, double screenY, CorridorGeometry geometry) {
        return DungeonGridScreenMath.distanceToInvalidCorridorLink(
                screenX,
                screenY,
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

    private Set<Point2i> translateCells(Set<Point2i> cells, Point2i delta) {
        Set<Point2i> translated = new LinkedHashSet<>();
        for (Point2i cell : cells) {
            translated.add(cell.add(delta));
        }
        return translated;
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

    public interface Host extends DungeonPaneReadContext {
        DungeonPreviewState previewState();
        DungeonPreviewTopologySession previewTopologySession();
        boolean hasClusterDragPreview();
    }
}
