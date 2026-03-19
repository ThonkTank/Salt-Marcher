package features.world.quarantine.dungeonmap.editor.workspace.graph;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonPaneCorridorWorkspace;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorComponent;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.rooms.model.DungeonCellPolygonMath;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomGeometry;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;
import features.world.quarantine.dungeonmap.canvas.state.ClusterAnchorLayout;
import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

final class DungeonGraphNodeSupport {
    private static final double NODE_RADIUS = 16;
    private static final double NODE_CENTER_RADIUS = 3;

    private final DungeonPaneContext context;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;
    private Map<Long, ClusterAnchorLayout> cachedAnchorLayouts = new HashMap<>();

    DungeonGraphNodeSupport(
            DungeonPaneContext context,
            DungeonPanePreviewModel previewModel,
            DungeonPaneCorridorWorkspace corridorWorkspace
    ) {
        this.context = context;
        this.previewModel = previewModel;
        this.corridorWorkspace = corridorWorkspace;
    }

    void renderBackdrop(GraphicsContext gc) {
        drawRoomOutlines(gc);
        drawCorridorComponentOutlines(gc);
    }

    void renderClusterNodes(GraphicsContext gc) {
        cachedAnchorLayouts = new HashMap<>();
        for (DungeonRoomCluster cluster : context.dungeonLayout().clusters()) {
            if (cluster.clusterId() == null) {
                continue;
            }
            ClusterAnchorLayout anchorLayout = anchorLayout(cachedAnchorLayouts, cluster);
            ClusterAnchorLayout.AnchorPosition clusterAnchor = clusterAnchorPosition(cluster, anchorLayout);
            double screenX = clusterAnchor.x();
            double screenY = clusterAnchor.y();
            boolean active = context.sceneState().isActive(cluster);
            boolean selected = context.sceneState().isSelected(cluster);
            gc.setFill(active ? DungeonCanvasTheme.GRAPH_NODE_ACTIVE_FILL : DungeonCanvasTheme.GRAPH_NODE_FILL);
            gc.fillOval(screenX - NODE_RADIUS, screenY - NODE_RADIUS, NODE_RADIUS * 2, NODE_RADIUS * 2);
            gc.setStroke(selected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.ROOM_STROKE);
            gc.setLineWidth(selected ? 3 : 2);
            gc.strokeOval(screenX - NODE_RADIUS, screenY - NODE_RADIUS, NODE_RADIUS * 2, NODE_RADIUS * 2);
            gc.setFill(DungeonCanvasTheme.ROOM_CENTER);
            gc.fillOval(
                    screenX - NODE_CENTER_RADIUS,
                    screenY - NODE_CENTER_RADIUS,
                    NODE_CENTER_RADIUS * 2,
                    NODE_CENTER_RADIUS * 2);
            DungeonCanvasTheme.Label.drawCenteredLabel(gc, "Cluster " + cluster.clusterId(), screenX, screenY);
            drawRoomSubNodes(gc, cluster, anchorLayout);
        }
    }

    DungeonRoomCluster findClusterAt(double screenX, double screenY) {
        DungeonRoomCluster closest = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonRoomCluster cluster : context.dungeonLayout().clusters()) {
            ClusterAnchorLayout anchorLayout = anchorLayout(cachedAnchorLayouts, cluster);
            ClusterAnchorLayout.AnchorPosition anchor = clusterAnchorPosition(cluster, anchorLayout);
            double distance = Math.hypot(anchor.x() - screenX, anchor.y() - screenY);
            if (distance < bestDistance && distance <= NODE_RADIUS) {
                bestDistance = distance;
                closest = cluster;
            }
        }
        return closest;
    }

    DungeonRoom findRoomAt(double screenX, double screenY) {
        DungeonRoom closest = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonRoom room : context.dungeonLayout().rooms()) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            DungeonRoomCluster cluster = context.dungeonLayout().findCluster(room.clusterId());
            if (cluster == null) {
                continue;
            }
            ClusterAnchorLayout anchorLayout = anchorLayout(cachedAnchorLayouts, cluster);
            ClusterAnchorLayout.AnchorPosition anchor = roomAnchorPosition(anchorLayout, room);
            double distance = Math.hypot(anchor.x() - screenX, anchor.y() - screenY);
            if (distance < bestDistance && distance <= DungeonCanvasTheme.HitTest.GRAPH_ROOM_SUBNODE_RADIUS) {
                bestDistance = distance;
                closest = room;
            }
        }
        return closest;
    }

    boolean canCreateGraphRoomAt(Point2i world) {
        if (world == null || context.dungeonLayout() == null) {
            return false;
        }
        for (DungeonRoomCluster cluster : context.dungeonLayout().clusters()) {
            for (Point2i cell : DungeonRoomGeometry.graphRoomCells(world)) {
                if (previewModel.geometry().clusterCellsFor(cluster).contains(cell)) {
                    return false;
                }
            }
        }
        return true;
    }

    private void drawRoomOutlines(GraphicsContext gc) {
        if (context.dungeonLayout() == null || context.renderData() == null) {
            return;
        }
        for (DungeonRoomCluster cluster : context.dungeonLayout().clusters()) {
            gc.setStroke(context.sceneState().isSelected(cluster)
                    ? DungeonCanvasTheme.GRAPH_ROOM_OUTLINE_SELECTED
                    : DungeonCanvasTheme.GRAPH_ROOM_OUTLINE);
            double strokeWidth = context.sceneState().isSelected(cluster)
                    ? DungeonCanvasTheme.Corridor.GRAPH_SELECTED_STROKE_WIDTH
                    : DungeonCanvasTheme.Corridor.GRAPH_DEFAULT_STROKE_WIDTH;
            gc.setLineWidth(strokeWidth);
            for (List<Point2i> loop : previewModel.geometry().clusterLoopsFor(cluster)) {
                if (loop.isEmpty()) {
                    continue;
                }
                double[] xs = new double[loop.size()];
                double[] ys = new double[loop.size()];
                Point2D previewOffset = previewModel.geometry().previewOffset(cluster.clusterId());
                for (int i = 0; i < loop.size(); i++) {
                    xs[i] = previewModel.geometry().previewScreenX(loop.get(i).x(), previewOffset);
                    ys[i] = previewModel.geometry().previewScreenY(loop.get(i).y(), previewOffset);
                }
                gc.strokePolygon(xs, ys, loop.size());
            }
        }
    }

    private void drawRoomSubNodes(GraphicsContext gc, DungeonRoomCluster cluster, ClusterAnchorLayout anchorLayout) {
        for (DungeonRoom room : context.dungeonLayout().rooms()) {
            if (!Objects.equals(room.clusterId(), cluster.clusterId())) {
                continue;
            }
            ClusterAnchorLayout.AnchorPosition clusterAnchor = clusterAnchorPosition(cluster, anchorLayout);
            ClusterAnchorLayout.AnchorPosition roomAnchor = roomAnchorPosition(anchorLayout, room);
            gc.setStroke(DungeonCanvasTheme.GRAPH_ROOM_OUTLINE);
            gc.setLineWidth(1);
            gc.strokeLine(clusterAnchor.x(), clusterAnchor.y(), roomAnchor.x(), roomAnchor.y());
            double r = DungeonCanvasTheme.HitTest.GRAPH_ROOM_SUBNODE_RADIUS;
            double rx = roomAnchor.x();
            double ry = roomAnchor.y();
            gc.setFill(DungeonCanvasTheme.GRAPH_NODE_FILL.deriveColor(0, 1, 1, DungeonCanvasTheme.Corridor.GRAPH_PREVIEW_FILL_OPACITY));
            gc.fillOval(rx - r, ry - r, r * 2, r * 2);
            gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
            gc.setLineWidth(DungeonCanvasTheme.Corridor.GRAPH_DEFAULT_STROKE_WIDTH);
            gc.strokeOval(rx - r, ry - r, r * 2, r * 2);
            DungeonCanvasTheme.Label.drawCenteredLabel(gc, room.name(), roomAnchor.x(), roomAnchor.y());
        }
    }

    private ClusterAnchorLayout anchorLayout(Map<Long, ClusterAnchorLayout> cache, DungeonRoomCluster cluster) {
        return cache.computeIfAbsent(
                cluster.clusterId(),
                ignored -> ClusterAnchorLayout.forCluster(
                        context.dungeonLayout(),
                        cluster,
                        roomCluster -> previewModel.geometry().previewCenter(roomCluster),
                        room -> previewModel.geometry().previewCenter(room)));
    }

    private ClusterAnchorLayout.AnchorPosition clusterAnchorPosition(DungeonRoomCluster cluster, ClusterAnchorLayout anchorLayout) {
        Point2i center = anchorLayout.clusterCenter();
        double x = previewModel.geometry().previewScreenX(center.x() + 0.5, cluster.clusterId());
        double y = previewModel.geometry().previewScreenY(center.y() + 0.5, cluster.clusterId());
        return new ClusterAnchorLayout.AnchorPosition(x, anchorLayout.clusterOverlapsRoom() ? y - 12 : y);
    }

    private ClusterAnchorLayout.AnchorPosition roomAnchorPosition(ClusterAnchorLayout anchorLayout, DungeonRoom room) {
        ClusterAnchorLayout.RoomAnchorGroup roomGroup = anchorLayout.roomGroup(room);
        Point2i center = roomGroup.center();
        double x = previewModel.geometry().previewScreenX(center.x() + 0.5, room.clusterId());
        double y = previewModel.geometry().previewScreenY(center.y() + 0.5, room.clusterId());
        double stackOffset = roomGroup.count() <= 1 ? 0 : (roomGroup.index() - (roomGroup.count() - 1) / 2.0) * 16.0;
        if (roomGroup.overlapsCluster(anchorLayout.clusterCenter())) {
            stackOffset += 14;
        }
        return new ClusterAnchorLayout.AnchorPosition(x, y + stackOffset);
    }

    private void drawCorridorComponentOutlines(GraphicsContext gc) {
        if (context.renderData() == null) {
            return;
        }
        for (CorridorComponent component : displayedCorridorComponents()) {
            List<Point2i> outline = component.outlineVertices();
            if (outline.isEmpty()) {
                continue;
            }
            gc.setStroke(isComponentActive(component.componentId())
                    ? DungeonCanvasTheme.Corridor.CORRIDOR_ACTIVE
                    : DungeonCanvasTheme.GRAPH_ROOM_OUTLINE);
            gc.setLineWidth(2);
            strokeOutline(gc, outline);
        }
    }

    private boolean isComponentActive(String componentId) {
        return context.sceneState().activeLocation() instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent
                && Objects.equals(corridorComponent.componentId(), componentId);
    }

    private List<CorridorComponent> displayedCorridorComponents() {
        DungeonLayoutRenderData renderData = context.renderData();
        if (context.dungeonLayout() == null || renderData == null) {
            return List.of();
        }
        if (previewModel.hasClusterDragPreview()) {
            return previewCorridorComponents();
        }
        return renderData.corridorTopology().componentsById().values().stream()
                .sorted(Comparator.comparing(CorridorComponent::componentId))
                .toList();
    }

    private List<CorridorComponent> previewCorridorComponents() {
        long mapId = context.dungeonLayout().map().mapId();
        Map<String, List<CorridorGeometry>> grouped = new LinkedHashMap<>();
        for (DungeonCorridor corridor : context.dungeonLayout().corridors()) {
            CorridorGeometry geometry = corridorWorkspace.routableGeometryForDisplay(corridor);
            if (geometry == null) continue;
            String componentId = geometry.componentId() == null
                    ? "preview-corridor:" + corridor.corridorId()
                    : geometry.componentId();
            grouped.computeIfAbsent(componentId, ignored -> new ArrayList<>()).add(geometry);
        }
        return CorridorComponent.fromGeometries(mapId, grouped);
    }

    private void strokeOutline(GraphicsContext gc, List<Point2i> outline) {
        Point2i start = null;
        Point2i previous = null;
        for (Point2i point : outline) {
            if (point.equals(DungeonCellPolygonMath.LOOP_SEPARATOR)) {
                if (start != null && previous != null) {
                    gc.strokeLine(
                            context.camera().toScreenX(previous.x()),
                            context.camera().toScreenY(previous.y()),
                            context.camera().toScreenX(start.x()),
                            context.camera().toScreenY(start.y()));
                }
                start = null;
                previous = null;
                continue;
            }
            if (start == null) {
                start = point;
            } else {
                gc.strokeLine(
                        context.camera().toScreenX(previous.x()),
                        context.camera().toScreenY(previous.y()),
                        context.camera().toScreenX(point.x()),
                        context.camera().toScreenY(point.y()));
            }
            previous = point;
        }
        if (start != null && previous != null && !start.equals(previous)) {
            gc.strokeLine(
                    context.camera().toScreenX(previous.x()),
                    context.camera().toScreenY(previous.y()),
                    context.camera().toScreenX(start.x()),
                    context.camera().toScreenY(start.y()));
        }
    }
}
