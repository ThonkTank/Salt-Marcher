package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.CorridorComponent;
import features.world.dungeonmap.model.CorridorGeometry;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DoorSegment;
import features.world.dungeonmap.model.GridSegment;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomGeometry;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.DungeonRuntimeLocation;
import features.world.dungeonmap.model.Point2i;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonGraphPane extends AbstractDungeonPane {

    private static final double NODE_RADIUS = 16;
    private static final double NODE_CENTER_RADIUS = 3;
    private static final double SHARED_SEGMENT_OFFSET = 7.0;
    private static final double MAX_SHARED_OFFSET = 20.0;
    private static final Color[] GRAPH_GROUP_COLORS = {
            Color.web("#e56b6f"),
            Color.web("#4fb286"),
            Color.web("#6c8cff"),
            Color.web("#f4a259"),
            Color.web("#d17dd7"),
            Color.web("#5cc8d7"),
            Color.web("#d8c15c"),
            Color.web("#e07a5f")
    };
    private DungeonLayout cachedRenderStateLayout;
    private DungeonLayoutRenderData cachedRenderStateData;
    private CorridorRenderState cachedCorridorRenderState;

    public DungeonGraphPane(DungeonCanvasCamera camera) {
        super(camera);
    }

    @Override
    protected void renderContent(GraphicsContext gc) {
        CorridorRenderState corridorRenderState = corridorRenderState();
        drawRoomOutlines(gc);
        drawCorridorComponentOutlines(gc);
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = renderData == null ? null : renderData.corridorGeometry(corridor.corridorId());
            if (geometry == null) {
                continue;
            }
            if (geometry.routable()) {
                gc.setStroke(strokeColor(corridor));
                gc.setLineWidth(isSelected(corridor) ? 4 : 3);
                gc.setLineDashes(null);
                drawCorridorPath(gc, corridorRenderState.displayPaths().get(corridor.corridorId()));
                drawCorridorDoors(gc, geometry);
                drawCorridorDoorMarkers(
                        gc,
                        corridor,
                        geometry,
                        corridorRenderState.corridorIdsByDoorMarker(),
                        corridorRenderState.laneOrderBySegment(),
                        corridorRenderState.displayPaths().get(corridor.corridorId()));
            } else {
                drawInvalidCorridor(gc, corridor, geometry);
            }
        }
        for (DungeonRoomCluster cluster : layout.clusters()) {
            if (cluster.clusterId() == null) {
                continue;
            }
            Point2i center = cluster.center();
            double screenX = camera.toScreenX(center.x() + 0.5);
            double screenY = camera.toScreenY(center.y() + 0.5);
            boolean active = isActive(cluster);
            boolean selected = isSelected(cluster);
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
            DungeonCanvasTheme.drawCenteredLabel(gc, "Cluster " + cluster.clusterId(), screenX, screenY);
            drawRoomSubNodes(gc, cluster);
        }
    }

    @Override
    protected Point2i worldPointAt(double screenX, double screenY) {
        int x = (int) Math.round(camera.toWorldX(screenX));
        int y = (int) Math.round(camera.toWorldY(screenY));
        return new Point2i(x, y);
    }

    @Override
    protected DungeonRoomCluster findClusterAt(double screenX, double screenY) {
        DungeonRoomCluster closest = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonRoomCluster cluster : layout.clusters()) {
            double centerX = camera.toScreenX(cluster.center().x() + 0.5);
            double centerY = camera.toScreenY(cluster.center().y() + 0.5);
            double distance = Math.hypot(centerX - screenX, centerY - screenY);
            if (distance < bestDistance && distance <= NODE_RADIUS) {
                bestDistance = distance;
                closest = cluster;
            }
        }
        return closest;
    }

    @Override
    protected DungeonRoom findRoomAt(double screenX, double screenY) {
        DungeonRoom closest = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonRoom room : layout.rooms()) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            Point2i center = layout.roomShape(room.roomId()).center();
            double centerX = camera.toScreenX(center.x() + 0.5);
            double centerY = camera.toScreenY(center.y() + 0.5);
            double distance = Math.hypot(centerX - screenX, centerY - screenY);
            if (distance < bestDistance && distance <= 7) {
                bestDistance = distance;
                closest = room;
            }
        }
        return closest;
    }

    @Override
    protected DungeonCorridor findCorridorAt(double screenX, double screenY) {
        if (layout == null || renderData == null) {
            return null;
        }
        CorridorRenderState corridorRenderState = corridorRenderState();
        DungeonCorridor closest = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = renderData.corridorGeometry(corridor.corridorId());
            if (geometry == null) {
                continue;
            }
            double distance = distanceToGeometry(screenX, screenY, geometry, corridorRenderState.displayPaths().get(corridor.corridorId()));
            if (distance < bestDistance && distance <= 10) {
                bestDistance = distance;
                closest = corridor;
            }
        }
        return closest;
    }

    @Override
    protected CorridorDoorHit findCorridorDoorHitAt(double screenX, double screenY) {
        if (layout == null || renderData == null) {
            return null;
        }
        CorridorRenderState corridorRenderState = corridorRenderState();
        CorridorDoorHit bestHit = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = renderData.corridorGeometry(corridor.corridorId());
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                MarkerPoint marker = markerPoint(
                        door,
                        corridor.corridorId(),
                        corridorRenderState.corridorIdsByDoorMarker(),
                        corridorRenderState.laneOrderBySegment(),
                        corridorRenderState.displayPaths().get(corridor.corridorId()));
                double markerDistance = Math.hypot(screenX - marker.x(), screenY - marker.y());
                if (markerDistance > 8) {
                    continue;
                }
                if (markerDistance < bestDistance) {
                    bestDistance = markerDistance;
                    bestHit = new CorridorDoorHit(List.of(corridor.corridorId()), door.roomId());
                }
            }
        }
        return bestHit;
    }

    @Override
    protected EditorSurface surface() {
        return EditorSurface.GRAPH;
    }

    @Override
    protected boolean canCreateGraphRoomAt(Point2i world) {
        if (world == null || layout == null) {
            return false;
        }
        for (DungeonRoomCluster cluster : layout.clusters()) {
            for (Point2i cell : DungeonRoomGeometry.graphRoomCells(world)) {
                if (layout.clusterCells(cluster.clusterId()).contains(cell)) {
                    return false;
                }
            }
        }
        return true;
    }

    private CorridorRenderState corridorRenderState() {
        if (cachedCorridorRenderState == null || cachedRenderStateLayout != layout || cachedRenderStateData != renderData) {
            cachedRenderStateLayout = layout;
            cachedRenderStateData = renderData;
            Map<SegmentKey, List<Long>> corridorIdsBySegment = corridorIdsBySegment();
            Map<SegmentKey, List<Long>> laneOrderBySegment = laneOrderBySegment(corridorIdsBySegment);
            cachedCorridorRenderState = new CorridorRenderState(
                    laneOrderBySegment,
                    corridorIdsByDoorMarker(),
                    corridorDisplayPaths(laneOrderBySegment));
        }
        return cachedCorridorRenderState;
    }

    private void drawRoomOutlines(GraphicsContext gc) {
        if (layout == null || renderData == null) {
            return;
        }
        for (DungeonRoomCluster cluster : layout.clusters()) {
            gc.setStroke(isSelected(cluster)
                    ? DungeonCanvasTheme.GRAPH_ROOM_OUTLINE_SELECTED
                    : DungeonCanvasTheme.GRAPH_ROOM_OUTLINE);
            gc.setLineWidth(isSelected(cluster) ? 2.5 : 1.5);
            for (List<Point2i> loop : layout.clusterLoops(cluster.clusterId())) {
                if (loop.isEmpty()) {
                    continue;
                }
                double[] xs = new double[loop.size()];
                double[] ys = new double[loop.size()];
                for (int i = 0; i < loop.size(); i++) {
                    xs[i] = camera.toScreenX(loop.get(i).x());
                    ys[i] = camera.toScreenY(loop.get(i).y());
                }
                gc.strokePolygon(xs, ys, loop.size());
            }
        }
    }

    private void drawRoomSubNodes(GraphicsContext gc, DungeonRoomCluster cluster) {
        for (DungeonRoom room : layout.rooms()) {
            if (!Objects.equals(room.clusterId(), cluster.clusterId())) {
                continue;
            }
            double clusterX = camera.toScreenX(cluster.center().x() + 0.5);
            double clusterY = camera.toScreenY(cluster.center().y() + 0.5);
            Point2i roomCenter = layout.roomShape(room.roomId()).center();
            double roomX = camera.toScreenX(roomCenter.x() + 0.5);
            double roomY = camera.toScreenY(roomCenter.y() + 0.5);
            gc.setStroke(DungeonCanvasTheme.GRAPH_ROOM_OUTLINE);
            gc.setLineWidth(1);
            gc.strokeLine(clusterX, clusterY, roomX, roomY);
            gc.setFill(DungeonCanvasTheme.GRAPH_NODE_FILL.deriveColor(0, 1, 1, 0.65));
            gc.fillOval(roomX - 7, roomY - 7, 14, 14);
            gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
            gc.setLineWidth(1.5);
            gc.strokeOval(roomX - 7, roomY - 7, 14, 14);
        }
    }

    private void drawCorridorComponentOutlines(GraphicsContext gc) {
        if (renderData == null) {
            return;
        }
        for (CorridorComponent component : renderData.corridorTopology().componentsById().values()) {
            List<Point2i> outline = component.outlineVertices();
            if (outline.isEmpty()) {
                continue;
            }
            gc.setStroke(isComponentSelected(component.componentId())
                    ? DungeonCanvasTheme.CORRIDOR_SELECTED
                    : isComponentActive(component.componentId()) ? DungeonCanvasTheme.CORRIDOR_ACTIVE : DungeonCanvasTheme.GRAPH_ROOM_OUTLINE);
            gc.setLineWidth(isComponentSelected(component.componentId()) ? 3 : 2);
            strokeOutline(gc, outline);
        }
    }

    private void drawCorridorPath(
            GraphicsContext gc,
            CorridorDisplayPath displayPath
    ) {
        if (displayPath == null || displayPath.segments().isEmpty()) {
            return;
        }
        for (OffsetLine offsetLine : displayPath.segments()) {
            gc.strokeLine(
                    offsetLine.x1(),
                    offsetLine.y1(),
                    offsetLine.x2(),
                    offsetLine.y2());
        }
    }

    private void drawCorridorDoors(GraphicsContext gc, CorridorGeometry geometry) {
        if (!geometry.routable()) {
            return;
        }
        gc.setLineWidth(2);
        for (DoorSegment door : geometry.doors()) {
            gc.strokeLine(
                    camera.toScreenX(door.start().x()),
                    camera.toScreenY(door.start().y()),
                    camera.toScreenX(door.end().x()),
                    camera.toScreenY(door.end().y()));
        }
    }

    private void drawCorridorDoorMarkers(
            GraphicsContext gc,
            DungeonCorridor corridor,
            CorridorGeometry geometry,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker,
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            CorridorDisplayPath displayPath
    ) {
        if (!editable || editorTool != features.world.dungeonmap.ui.workspace.DungeonEditorTool.CORRIDOR_DELETE) {
            return;
        }
        Color markerColor = strokeColor(corridor);
        for (DoorSegment door : geometry.doors()) {
            MarkerPoint marker = markerPoint(door, corridor.corridorId(), corridorIdsByDoorMarker, laneOrderBySegment, displayPath);
            gc.setFill(markerColor);
            gc.fillOval(marker.x() - 4.5, marker.y() - 4.5, 9, 9);
            gc.setStroke(Color.rgb(18, 24, 28, 0.95));
            gc.setLineWidth(1.5);
            gc.strokeOval(marker.x() - 4.5, marker.y() - 4.5, 9, 9);
        }
    }

    private void strokeOutline(GraphicsContext gc, List<Point2i> outline) {
        Point2i start = null;
        Point2i previous = null;
        for (Point2i point : outline) {
            if (point.equals(new Point2i(Integer.MIN_VALUE, Integer.MIN_VALUE))) {
                if (start != null && previous != null) {
                    gc.strokeLine(camera.toScreenX(previous.x()), camera.toScreenY(previous.y()),
                            camera.toScreenX(start.x()), camera.toScreenY(start.y()));
                }
                start = null;
                previous = null;
                continue;
            }
            if (start == null) {
                start = point;
            } else {
                gc.strokeLine(
                        camera.toScreenX(previous.x()),
                        camera.toScreenY(previous.y()),
                        camera.toScreenX(point.x()),
                        camera.toScreenY(point.y()));
            }
            previous = point;
        }
        if (start != null && previous != null && !start.equals(previous)) {
            gc.strokeLine(camera.toScreenX(previous.x()), camera.toScreenY(previous.y()),
                    camera.toScreenX(start.x()), camera.toScreenY(start.y()));
        }
    }

    private void drawInvalidCorridor(GraphicsContext gc, DungeonCorridor corridor, CorridorGeometry geometry) {
        if (invalidCorridorLink(geometry) == null) {
            return;
        }
        gc.setStroke(isSelected(corridor)
                ? DungeonCanvasTheme.CORRIDOR_SELECTED
                : isActive(corridor) ? DungeonCanvasTheme.CORRIDOR_ACTIVE : DungeonCanvasTheme.ROOM_STROKE);
        gc.setLineWidth(isSelected(corridor) ? 3 : 2);
        gc.setLineDashes(8, 6);
        strokeInvalidCorridorLink(gc, geometry);
        gc.setLineDashes(null);
    }

    private boolean isComponentSelected(String componentId) {
        return false;
    }

    private boolean isComponentActive(String componentId) {
        return activeLocation instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent
                && java.util.Objects.equals(corridorComponent.componentId(), componentId);
    }

    private double distanceToGeometry(double screenX, double screenY, CorridorGeometry geometry, CorridorDisplayPath displayPath) {
        if (!geometry.routable()) {
            return distanceToInvalidCorridorLink(screenX, screenY, geometry);
        }
        double bestDistance = Double.POSITIVE_INFINITY;
        if (displayPath != null) {
            for (OffsetLine segment : displayPath.segments()) {
                bestDistance = Math.min(bestDistance, distanceToSegment(screenX, screenY, segment.x1(), segment.y1(), segment.x2(), segment.y2()));
            }
        }
        for (DoorSegment door : geometry.doors()) {
            bestDistance = Math.min(bestDistance, distanceToDoor(screenX, screenY, door));
        }
        return bestDistance;
    }

    private Color strokeColor(DungeonCorridor corridor) {
        if (isSelected(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_SELECTED;
        }
        if (isActive(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_ACTIVE;
        }
        long corridorId = corridor.corridorId() == null ? 0L : corridor.corridorId();
        return GRAPH_GROUP_COLORS[(int) Math.floorMod(corridorId, GRAPH_GROUP_COLORS.length)];
    }

    private Map<SegmentKey, List<Long>> corridorIdsBySegment() {
        Map<SegmentKey, List<Long>> result = new HashMap<>();
        if (renderData == null || layout == null) {
            return result;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = renderData.corridorGeometry(corridor.corridorId());
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (GridSegment segment : geometry.segments()) {
                result.computeIfAbsent(SegmentKey.of(segment.from(), segment.to()), ignored -> new ArrayList<>()).add(corridor.corridorId());
            }
        }
        for (List<Long> corridorIds : result.values()) {
            corridorIds.sort(Long::compareTo);
        }
        return result;
    }

    private Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker() {
        Map<DoorMarkerKey, List<Long>> result = new HashMap<>();
        if (renderData == null || layout == null) {
            return result;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = renderData.corridorGeometry(corridor.corridorId());
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                result.computeIfAbsent(DoorMarkerKey.of(door), ignored -> new ArrayList<>()).add(corridor.corridorId());
            }
        }
        for (List<Long> corridorIds : result.values()) {
            corridorIds.sort(Long::compareTo);
        }
        return result;
    }

    private Map<Long, CorridorDisplayPath> corridorDisplayPaths(Map<SegmentKey, List<Long>> laneOrderBySegment) {
        Map<Long, CorridorDisplayPath> result = new HashMap<>();
        if (layout == null || renderData == null) {
            return result;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = renderData.corridorGeometry(corridor.corridorId());
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            List<OffsetLine> displaySegments = new ArrayList<>();
            OffsetLine previous = null;
            for (GridSegment segment : geometry.segments()) {
                OffsetLine current = offsetLine(segment, corridor.corridorId(), laneOrderBySegment);
                if (previous != null && !samePoint(previous.x2(), previous.y2(), current.x1(), current.y1())) {
                    displaySegments.add(new OffsetLine(previous.x2(), previous.y2(), current.x1(), current.y1(), null));
                }
                displaySegments.add(current);
                previous = current;
            }
            result.put(corridor.corridorId(), new CorridorDisplayPath(List.copyOf(displaySegments)));
        }
        return result;
    }

    private Map<SegmentKey, List<Long>> laneOrderBySegment(Map<SegmentKey, List<Long>> corridorIdsBySegment) {
        Map<SegmentKey, List<Long>> result = new HashMap<>();
        List<SharedSegmentChain> chains = sharedSegmentChains(corridorIdsBySegment);
        Map<Point2i, List<SharedSegmentChain>> chainsByPoint = new HashMap<>();
        for (SharedSegmentChain chain : chains) {
            for (SegmentKey segment : chain.segments()) {
                chainsByPoint.computeIfAbsent(segment.start(), ignored -> new ArrayList<>()).add(chain);
                chainsByPoint.computeIfAbsent(segment.end(), ignored -> new ArrayList<>()).add(chain);
            }
        }

        List<SharedSegmentChain> sortedChains = new ArrayList<>(chains);
        sortedChains.sort(Comparator
                .comparingInt((SharedSegmentChain chain) -> -chain.corridorIds().size())
                .thenComparing(chain -> chain.sortKey().x())
                .thenComparing(chain -> chain.sortKey().y()));

        Map<SharedSegmentChain, List<Long>> resolvedOrder = new LinkedHashMap<>();
        for (SharedSegmentChain chain : sortedChains) {
            List<Long> inheritedOrder = inheritedLaneOrder(chain, chainsByPoint, resolvedOrder);
            List<Long> laneOrder = inheritedOrder == null ? chain.corridorIds() : inheritedOrder;
            resolvedOrder.put(chain, laneOrder);
            for (SegmentKey segment : chain.segments()) {
                result.put(segment, laneOrder);
            }
        }

        for (Map.Entry<SegmentKey, List<Long>> entry : corridorIdsBySegment.entrySet()) {
            result.putIfAbsent(entry.getKey(), entry.getValue());
        }
        return result;
    }

    private List<SharedSegmentChain> sharedSegmentChains(Map<SegmentKey, List<Long>> corridorIdsBySegment) {
        Map<CorridorSetKey, List<SegmentKey>> segmentsByCorridorSet = new LinkedHashMap<>();
        for (Map.Entry<SegmentKey, List<Long>> entry : corridorIdsBySegment.entrySet()) {
            if (entry.getValue().size() < 2) {
                continue;
            }
            segmentsByCorridorSet.computeIfAbsent(new CorridorSetKey(entry.getValue()), ignored -> new ArrayList<>()).add(entry.getKey());
        }

        List<SharedSegmentChain> result = new ArrayList<>();
        for (Map.Entry<CorridorSetKey, List<SegmentKey>> entry : segmentsByCorridorSet.entrySet()) {
            Set<SegmentKey> unvisited = new LinkedHashSet<>(entry.getValue());
            while (!unvisited.isEmpty()) {
                SegmentKey seed = unvisited.iterator().next();
                Set<SegmentKey> component = new LinkedHashSet<>();
                List<SegmentKey> queue = new ArrayList<>();
                queue.add(seed);
                unvisited.remove(seed);
                for (int index = 0; index < queue.size(); index++) {
                    SegmentKey current = queue.get(index);
                    component.add(current);
                    List<SegmentKey> neighbors = touchingSegments(current, unvisited);
                    for (SegmentKey neighbor : neighbors) {
                        if (unvisited.remove(neighbor)) {
                            queue.add(neighbor);
                        }
                    }
                }
                Point2i sortKey = component.stream()
                        .flatMap(segment -> java.util.stream.Stream.of(segment.start(), segment.end()))
                        .min(Comparator.comparingInt(Point2i::x).thenComparingInt(Point2i::y))
                        .orElse(new Point2i(0, 0));
                result.add(new SharedSegmentChain(List.copyOf(entry.getKey().corridorIds()), Set.copyOf(component), sortKey));
            }
        }
        return result;
    }

    private List<SegmentKey> touchingSegments(SegmentKey anchor, Set<SegmentKey> candidates) {
        List<SegmentKey> result = new ArrayList<>();
        for (SegmentKey candidate : candidates) {
            if (anchor.touches(candidate)) {
                result.add(candidate);
            }
        }
        return result;
    }

    private List<Long> inheritedLaneOrder(
            SharedSegmentChain chain,
            Map<Point2i, List<SharedSegmentChain>> chainsByPoint,
            Map<SharedSegmentChain, List<Long>> resolvedOrder
    ) {
        List<Long> best = null;
        int bestSourceSize = -1;
        for (SegmentKey segment : chain.segments()) {
            for (Point2i point : List.of(segment.start(), segment.end())) {
                for (SharedSegmentChain neighbor : chainsByPoint.getOrDefault(point, List.of())) {
                    if (neighbor == chain) {
                        continue;
                    }
                    List<Long> order = resolvedOrder.get(neighbor);
                    if (order == null || !order.containsAll(chain.corridorIds())) {
                        continue;
                    }
                    List<Long> filtered = order.stream()
                            .filter(chain.corridorIds()::contains)
                            .toList();
                    if (filtered.size() != chain.corridorIds().size()) {
                        continue;
                    }
                    if (order.size() > bestSourceSize || best == null) {
                        best = filtered;
                        bestSourceSize = order.size();
                    }
                }
            }
        }
        return best;
    }

    private OffsetLine offsetLine(GridSegment segment, Long corridorId, Map<SegmentKey, List<Long>> laneOrderBySegment) {
        SegmentKey canonicalSegment = SegmentKey.of(segment.from(), segment.to());
        double x1 = camera.toScreenX(segment.from().x() + 0.5);
        double y1 = camera.toScreenY(segment.from().y() + 0.5);
        double x2 = camera.toScreenX(segment.to().x() + 0.5);
        double y2 = camera.toScreenY(segment.to().y() + 0.5);
        List<Long> corridorIds = laneOrderBySegment.getOrDefault(canonicalSegment, List.of());
        if (corridorIds.size() < 2 || corridorId == null) {
            return new OffsetLine(x1, y1, x2, y2, canonicalSegment);
        }
        int index = corridorIds.indexOf(corridorId);
        if (index < 0) {
            return new OffsetLine(x1, y1, x2, y2, canonicalSegment);
        }
        double centerOffset = (index - (corridorIds.size() - 1) / 2.0) * laneSpacing(corridorIds.size());
        double canonicalX1 = camera.toScreenX(canonicalSegment.start().x() + 0.5);
        double canonicalY1 = camera.toScreenY(canonicalSegment.start().y() + 0.5);
        double canonicalX2 = camera.toScreenX(canonicalSegment.end().x() + 0.5);
        double canonicalY2 = camera.toScreenY(canonicalSegment.end().y() + 0.5);
        double dx = canonicalX2 - canonicalX1;
        double dy = canonicalY2 - canonicalY1;
        double length = Math.hypot(dx, dy);
        if (length == 0) {
            return new OffsetLine(x1, y1, x2, y2, canonicalSegment);
        }
        double offsetX = -dy / length * centerOffset;
        double offsetY = dx / length * centerOffset;
        return new OffsetLine(x1 + offsetX, y1 + offsetY, x2 + offsetX, y2 + offsetY, canonicalSegment);
    }

    private double laneSpacing(int laneCount) {
        if (laneCount <= 1) {
            return SHARED_SEGMENT_OFFSET;
        }
        return Math.min(SHARED_SEGMENT_OFFSET + (laneCount - 2) * 1.5, MAX_SHARED_OFFSET / Math.max(1.0, (laneCount - 1) / 2.0));
    }

    private MarkerPoint markerPoint(
            DoorSegment door,
            Long corridorId,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker,
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            CorridorDisplayPath displayPath
    ) {
        double centerX = (camera.toScreenX(door.start().x()) + camera.toScreenX(door.end().x())) / 2.0;
        double centerY = (camera.toScreenY(door.start().y()) + camera.toScreenY(door.end().y())) / 2.0;
        List<Long> corridorIds = laneOrderForDoor(door, corridorIdsByDoorMarker, laneOrderBySegment, displayPath);
        if (corridorIds.size() < 2 || corridorId == null) {
            return new MarkerPoint(centerX, centerY);
        }
        int index = corridorIds.indexOf(corridorId);
        if (index < 0) {
            return new MarkerPoint(centerX, centerY);
        }
        double tangentOffset = (index - (corridorIds.size() - 1) / 2.0) * 10.0;
        double doorDx = camera.toScreenX(door.end().x()) - camera.toScreenX(door.start().x());
        double doorDy = camera.toScreenY(door.end().y()) - camera.toScreenY(door.start().y());
        double doorLength = Math.hypot(doorDx, doorDy);
        if (doorLength == 0) {
            return new MarkerPoint(centerX, centerY);
        }
        double offsetX = doorDx / doorLength * tangentOffset;
        double offsetY = doorDy / doorLength * tangentOffset;
        return new MarkerPoint(centerX + offsetX, centerY + offsetY);
    }

    private List<Long> laneOrderForDoor(
            DoorSegment door,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker,
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            CorridorDisplayPath displayPath
    ) {
        List<Long> fallback = corridorIdsByDoorMarker.getOrDefault(DoorMarkerKey.of(door), List.of());
        if (fallback.size() < 2) {
            return fallback;
        }
        SegmentKey nearestSegment = nearestDisplaySegmentForDoor(door, displayPath);
        if (nearestSegment != null) {
            List<Long> laneOrder = laneOrderBySegment.getOrDefault(nearestSegment, List.of());
            List<Long> filtered = laneOrder.stream()
                    .filter(fallback::contains)
                    .toList();
            if (filtered.size() == fallback.size()) {
                return filtered;
            }
        }
        return fallback;
    }

    private SegmentKey nearestDisplaySegmentForDoor(DoorSegment door, CorridorDisplayPath displayPath) {
        if (displayPath == null || displayPath.segments().isEmpty()) {
            return null;
        }
        Point2i outsideCell = outsideCellForDoor(door);
        SegmentKey bestSegment = null;
        int bestDistance = Integer.MAX_VALUE;
        for (OffsetLine segment : displayPath.segments()) {
            SegmentKey canonical = segment.canonicalSegment();
            if (canonical == null) {
                continue;
            }
            int distance = Math.min(manhattan(outsideCell, canonical.start()), manhattan(outsideCell, canonical.end()));
            if (distance < bestDistance) {
                bestDistance = distance;
                bestSegment = canonical;
            }
        }
        return bestDistance <= 1 ? bestSegment : null;
    }

    private Point2i outsideCellForDoor(DoorSegment door) {
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

    private boolean samePoint(double x1, double y1, double x2, double y2) {
        return Math.abs(x1 - x2) < 0.001 && Math.abs(y1 - y2) < 0.001;
    }

    private int manhattan(Point2i a, Point2i b) {
        return Math.abs(a.x() - b.x()) + Math.abs(a.y() - b.y());
    }

    private record SegmentKey(Point2i start, Point2i end) {
        private static SegmentKey of(Point2i a, Point2i b) {
            if (a.x() < b.x() || (a.x() == b.x() && a.y() <= b.y())) {
                return new SegmentKey(a, b);
            }
            return new SegmentKey(b, a);
        }

        private boolean touches(SegmentKey other) {
            return start.equals(other.start())
                    || start.equals(other.end())
                    || end.equals(other.start())
                    || end.equals(other.end());
        }
    }

    private record OffsetLine(double x1, double y1, double x2, double y2, SegmentKey canonicalSegment) {
    }

    private record DoorMarkerKey(Point2i start, Point2i end, long roomId) {
        private static DoorMarkerKey of(DoorSegment door) {
            if (door.start().x() < door.end().x() || (door.start().x() == door.end().x() && door.start().y() <= door.end().y())) {
                return new DoorMarkerKey(door.start(), door.end(), door.roomId());
            }
            return new DoorMarkerKey(door.end(), door.start(), door.roomId());
        }
    }

    private record MarkerPoint(double x, double y) {
    }

    private record CorridorSetKey(List<Long> corridorIds) {
        private CorridorSetKey {
            corridorIds = List.copyOf(corridorIds);
        }
    }

    private record SharedSegmentChain(List<Long> corridorIds, Set<SegmentKey> segments, Point2i sortKey) {
        private SharedSegmentChain {
            corridorIds = List.copyOf(corridorIds);
            segments = Set.copyOf(segments);
            sortKey = Objects.requireNonNull(sortKey, "sortKey");
        }
    }

    private record CorridorDisplayPath(List<OffsetLine> segments) {
        private CorridorDisplayPath {
            segments = List.copyOf(segments);
        }
    }

    private record CorridorRenderState(
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker,
            Map<Long, CorridorDisplayPath> displayPaths
    ) {
    }
}
