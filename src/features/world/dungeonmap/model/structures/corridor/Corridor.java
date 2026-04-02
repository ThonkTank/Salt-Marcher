package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.TargetKey;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.PriorityQueue;
import java.util.Set;

/**
 * Corridors are edited and persisted as standalone structures.
 *
 * <p>The behavior to preserve here is: the graph is canonical, shared structure geometry is derived from it, room
 * attachments stay explicit, and callers must get the same corridor behavior without any second aggregate owner.
 */
public final class Corridor {

    private static final String TARGET_KEY_PREFIX = "corridor:";
    private static final int ROUTE_MARGIN = 4;

    private final Long corridorId;
    private final long mapId;
    private final int levelZ;
    private final List<CorridorNode> nodes;
    private final List<CorridorSegment> segments;
    private final StructureObject structure;
    private final List<CorridorRoute> routes;
    private final List<CorridorConnection> connections;

    public static Corridor resolved(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        return new Corridor(corridorId, mapId, levelZ, nodes, segments, roomsById);
    }

    public static Corridor planned(
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        return new Corridor(null, mapId, levelZ, nodes, segments, roomsById);
    }

    private Corridor(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        this.corridorId = corridorId;
        this.mapId = mapId;
        this.levelZ = levelZ;
        this.nodes = normalizeNodes(nodes);
        this.segments = normalizeSegments(segments);
        DerivedProjection projection = deriveProjection(corridorId, mapId, levelZ, this.nodes, this.segments, roomsById);
        this.structure = projection.structure();
        this.routes = projection.routes();
        this.connections = projection.connections();
    }

    public Corridor withIdentity(Long corridorId, long mapId, Map<Long, Room> roomsById) {
        return new Corridor(corridorId, mapId, levelZ, nodes, segments, roomsById);
    }

    public Long corridorId() {
        return corridorId;
    }

    public String targetKey() {
        return targetKey(corridorId);
    }

    public static String targetKey(Long corridorId) {
        return TargetKey.of(TARGET_KEY_PREFIX, corridorId).value();
    }

    public static boolean isTargetKey(String targetKey) {
        return TargetKey.matches(targetKey, TARGET_KEY_PREFIX);
    }

    public static Long corridorIdFromKey(String targetKey) {
        return TargetKey.parseId(targetKey, TARGET_KEY_PREFIX);
    }

    public long mapId() {
        return mapId;
    }

    public int levelZ() {
        return levelZ;
    }

    public List<CorridorNode> nodes() {
        return nodes;
    }

    public List<CorridorSegment> segments() {
        return segments;
    }

    public List<Long> connectedRoomIds() {
        return nodes.stream()
                .filter(CorridorNode::isRoomBound)
                .map(CorridorNode::roomId)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    public StructureObject structure() {
        return structure;
    }

    public List<CorridorRoute> routes() {
        return routes;
    }

    public List<CorridorConnection> connections() {
        return connections;
    }

    public boolean connectsRoom(Long roomId) {
        return roomId != null && connectedRoomIds().contains(roomId);
    }

    public CorridorNode findNode(Long nodeId) {
        if (nodeId == null) {
            return null;
        }
        return nodes.stream()
                .filter(node -> nodeId.equals(node.nodeId()))
                .findFirst()
                .orElse(null);
    }

    public CorridorSegment findSegment(Long segmentId) {
        if (segmentId == null) {
            return null;
        }
        return segments.stream()
                .filter(segment -> segmentId.equals(segment.segmentId()))
                .findFirst()
                .orElse(null);
    }

    public List<CorridorSegment> segmentsForNode(Long nodeId) {
        if (nodeId == null) {
            return List.of();
        }
        return segments.stream()
                .filter(segment -> nodeId.equals(segment.startNodeId()) || nodeId.equals(segment.endNodeId()))
                .toList();
    }

    public List<CorridorNode> persistedManualNodes() {
        return nodes.stream()
                .filter(node -> node.nodeId() != null && !node.isRoomBound())
                .toList();
    }

    private static List<CorridorNode> normalizeNodes(List<CorridorNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least two nodes");
        }
        ArrayList<CorridorNode> result = new ArrayList<>();
        Set<Long> seenIds = new LinkedHashSet<>();
        Set<Long> seenCoordinates = new LinkedHashSet<>();
        for (CorridorNode node : nodes) {
            if (node == null) {
                continue;
            }
            if (node.nodeId() != null && !seenIds.add(node.nodeId())) {
                throw new IllegalArgumentException("Duplicate corridor node id " + node.nodeId());
            }
            long coordinateKey = node.point2x().encodedKey();
            if (!seenCoordinates.add(coordinateKey)) {
                throw new IllegalArgumentException("Duplicate corridor node coordinates");
            }
            result.add(node);
        }
        if (result.size() < 2) {
            throw new IllegalArgumentException("Corridor requires at least two nodes");
        }
        result.sort(Comparator
                .comparing((CorridorNode node) -> node.nodeId() == null ? Long.MAX_VALUE : node.nodeId())
                .thenComparing(CorridorNode::point2x, GridPoint2x.POINT_ORDER));
        return List.copyOf(result);
    }

    private static List<CorridorSegment> normalizeSegments(List<CorridorSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least one segment");
        }
        ArrayList<CorridorSegment> result = new ArrayList<>();
        Set<String> seenEdges = new LinkedHashSet<>();
        for (CorridorSegment segment : segments) {
            if (segment == null) {
                continue;
            }
            String edgeKey = segment.startNodeId() + ":" + segment.endNodeId();
            if (!seenEdges.add(edgeKey)) {
                throw new IllegalArgumentException("Duplicate corridor segment " + edgeKey);
            }
            result.add(segment);
        }
        if (result.isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least one segment");
        }
        result.sort(Comparator
                .comparing((CorridorSegment segment) -> segment.segmentId() == null ? Long.MAX_VALUE : segment.segmentId())
                .thenComparing(CorridorSegment::startNodeId)
                .thenComparing(CorridorSegment::endNodeId));
        return List.copyOf(result);
    }

    private static DerivedProjection deriveProjection(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        // Keep routing/projection semantics centralized in the canonical corridor owner.
        Map<Long, Room> resolvedRooms = roomsById == null ? Map.of() : Map.copyOf(roomsById);
        Map<Long, CorridorNode> nodesById = indexNodes(nodes);
        ArrayList<CorridorRoute> routes = new ArrayList<>();
        for (CorridorSegment segment : segments) {
            CorridorNode start = nodesById.get(segment.startNodeId());
            CorridorNode end = nodesById.get(segment.endNodeId());
            if (start == null || end == null) {
                throw new IllegalArgumentException("Corridor segment references missing node");
            }
            RoutePlan routePlan = findRoute(levelZ, start, end, nodes, resolvedRooms);
            routes.add(new CorridorRoute(segment.segmentId(), segment.startNodeId(), segment.endNodeId(), routePlan.path2x()));
        }
        Set<GridSegment2x> openingSegments2x = corridorOpeningSegments(levelZ, nodes, resolvedRooms);
        return new DerivedProjection(
                compileStructure(levelZ, routes, openingSegments2x),
                routes.isEmpty() ? List.of() : List.copyOf(routes),
                materializeConnections(corridorId, mapId, levelZ, nodes, resolvedRooms));
    }

    private static StructureObject compileStructure(
            int levelZ,
            Collection<CorridorRoute> routes,
            Set<GridSegment2x> openingSegments2x
    ) {
        Set<Point2i> occupiedCells = occupiedCells(routes);
        if (occupiedCells.isEmpty()) {
            return StructureObject.empty();
        }
        Set<GridSegment2x> boundarySegments2x = boundarySegments(occupiedCells);
        LinkedHashSet<GridSegment2x> validOpenings = new LinkedHashSet<>();
        for (GridSegment2x segment2x : openingSegments2x == null ? Set.<GridSegment2x>of() : openingSegments2x) {
            if (segment2x != null && boundarySegments2x.contains(segment2x)) {
                validOpenings.add(segment2x);
            }
        }
        // Corridor descriptor truth is authored directly from routed 2x paths plus room-opening segments; routing still
        // uses cell paths internally, but shared structure geometry no longer round-trips through generic cell import.
        StructureDescriptor descriptor = new StructureDescriptor(Map.of(levelZ, new StructureDescriptor.LevelDescriptor(
                GridPoint2x.fromTileCenter(bestCenterCell(occupiedCells)),
                fillSeeds2x(occupiedCells),
                boundarySegments2x,
                Set.copyOf(validOpenings))));
        return StructureObject.fromDescriptor(descriptor);
    }

    private static Set<GridSegment2x> corridorOpeningSegments(
            int levelZ,
            List<CorridorNode> nodes,
            Map<Long, Room> roomsById
    ) {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (CorridorNode node : nodes) {
            if (node == null || !node.isRoomBound() || node.roomBoundaryDirection() == null) {
                continue;
            }
            Point2i roomCell = absoluteRoomCell(node, levelZ, roomsById);
            if (roomCell == null) {
                continue;
            }
            result.add(GridSegment2x.betweenCellAndStep(roomCell, node.roomBoundaryDirection().delta()));
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Map<Long, CorridorNode> indexNodes(List<CorridorNode> nodes) {
        Map<Long, CorridorNode> result = new LinkedHashMap<>();
        long syntheticId = -1L;
        for (CorridorNode node : nodes) {
            long nodeId = node.nodeId() == null ? syntheticId-- : node.nodeId();
            result.put(nodeId, node);
        }
        return Map.copyOf(result);
    }

    private static RoutePlan findRoute(
            int levelZ,
            CorridorNode start,
            CorridorNode end,
            List<CorridorNode> allNodes,
            Map<Long, Room> roomsById
    ) {
        Set<Point2i> blockedCells = blockedRoomCells(levelZ, roomsById);
        return findAnchoredRoute(levelZ, start, end, blockedCells, roomsById);
    }

    private static Set<Point2i> blockedRoomCells(int levelZ, Map<Long, Room> roomsById) {
        Set<Point2i> blocked = new LinkedHashSet<>();
        for (Room room : roomsById.values()) {
            if (room == null) {
                continue;
            }
            blocked.addAll(room.structure().cellsAtLevel(levelZ));
        }
        return Set.copyOf(blocked);
    }

    private static RoutePlan findAnchoredRoute(
            int levelZ,
            CorridorNode start,
            CorridorNode end,
            Set<Point2i> blockedCells,
            Map<Long, Room> roomsById
    ) {
        List<AnchorAttachment> startAttachments = attachmentsForNode(start, levelZ, blockedCells, roomsById);
        List<AnchorAttachment> endAttachments = attachmentsForNode(end, levelZ, blockedCells, roomsById);
        RoutePlan bestPlan = null;
        for (AnchorAttachment startAttachment : startAttachments) {
            for (AnchorAttachment endAttachment : endAttachments) {
                CellRoute cellRoute = findCellRoute(startAttachment.cell(), endAttachment.cell(), blockedCells);
                if (cellRoute == null) {
                    continue;
                }
                List<GridPoint2x> path2x = assemblePath2x(
                        startAttachment.anchorToCellPath(),
                        cellRoute.cells(),
                        endAttachment.anchorToCellPath());
                double totalCost = cellRoute.cost()
                        + startAttachment.adapterCost()
                        + endAttachment.adapterCost();
                if (bestPlan == null || totalCost < bestPlan.cost()) {
                    bestPlan = new RoutePlan(path2x, totalCost);
                }
            }
        }
        if (bestPlan == null) {
            throw new IllegalArgumentException("Corridor segment could not be routed");
        }
        return bestPlan;
    }

    private static List<AnchorAttachment> attachmentsForNode(
            CorridorNode node,
            int levelZ,
            Set<Point2i> blockedCells,
            Map<Long, Room> roomsById
    ) {
        if (node == null) {
            return List.of();
        }
        GridPoint2x anchorPoint = node.point2x();
        if (node.isRoomBound()) {
            Point2i roomCell = absoluteRoomCell(node, levelZ, roomsById);
            if (roomCell == null || node.roomBoundaryDirection() == null) {
                throw new IllegalArgumentException("Corridor room-bound node could not be resolved");
            }
            Point2i exteriorCell = roomCell.add(node.roomBoundaryDirection().delta());
            return List.of(new AnchorAttachment(
                    exteriorCell,
                    List.of(anchorPoint, GridPoint2x.fromTileCenter(exteriorCell))));
        }
        if (anchorPoint.isTileCenter()) {
            return List.of(new AnchorAttachment(anchorPoint.toCellCenter().orElseThrow(), List.of(anchorPoint)));
        }
        List<Point2i> touchingCells = touchingCells(anchorPoint);
        List<Point2i> preferredCells = touchingCells.stream()
                .filter(cell -> !blockedCells.contains(cell))
                .toList();
        List<Point2i> candidateCells = preferredCells.isEmpty() ? touchingCells : preferredCells;
        ArrayList<AnchorAttachment> attachments = new ArrayList<>();
        for (Point2i cell : candidateCells) {
            for (List<GridPoint2x> adapterPath : adapterPaths(anchorPoint, cell)) {
                attachments.add(new AnchorAttachment(cell, adapterPath));
            }
        }
        return attachments.isEmpty() ? List.of() : List.copyOf(attachments);
    }

    private static CellRoute findCellRoute(Point2i start, Point2i end, Set<Point2i> blockedCells) {
        if (start == null || end == null) {
            return null;
        }
        if (start.equals(end)) {
            return new CellRoute(List.of(start), 0.0d);
        }
        int minX = Math.min(start.x(), end.x());
        int maxX = Math.max(start.x(), end.x());
        int minY = Math.min(start.y(), end.y());
        int maxY = Math.max(start.y(), end.y());
        for (Point2i blocked : blockedCells) {
            minX = Math.min(minX, blocked.x());
            maxX = Math.max(maxX, blocked.x());
            minY = Math.min(minY, blocked.y());
            maxY = Math.max(maxY, blocked.y());
        }
        minX -= ROUTE_MARGIN;
        maxX += ROUTE_MARGIN;
        minY -= ROUTE_MARGIN;
        maxY += ROUTE_MARGIN;

        double turnPenalty = turnPenalty(start, end);
        Set<Point2i> effectiveBlocked = new LinkedHashSet<>(blockedCells);
        effectiveBlocked.remove(start);
        effectiveBlocked.remove(end);

        SearchState startState = new SearchState(start, null);
        PriorityQueue<QueueEntry> frontier = new PriorityQueue<>(Comparator.comparingDouble(QueueEntry::estimatedTotalCost));
        Map<SearchState, Double> bestCosts = new HashMap<>();
        Map<SearchState, SearchState> cameFrom = new HashMap<>();
        frontier.add(new QueueEntry(startState, heuristic(start, end)));
        bestCosts.put(startState, 0.0d);

        while (!frontier.isEmpty()) {
            QueueEntry currentEntry = frontier.poll();
            SearchState current = currentEntry.state();
            double currentCost = bestCosts.getOrDefault(current, Double.POSITIVE_INFINITY);
            if (currentEntry.estimatedTotalCost() - heuristic(current.cell(), end) > currentCost + 1e-9) {
                continue;
            }
            if (current.cell().equals(end)) {
                return new CellRoute(reconstructCellPath(cameFrom, current), currentCost);
            }
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = current.cell().add(step);
                if (neighbor.x() < minX || neighbor.x() > maxX || neighbor.y() < minY || neighbor.y() > maxY) {
                    continue;
                }
                if (effectiveBlocked.contains(neighbor)) {
                    continue;
                }
                double nextCost = currentCost + 1.0d;
                if (current.direction() != null && !current.direction().equals(step)) {
                    nextCost += turnPenalty;
                }
                SearchState next = new SearchState(neighbor, step);
                if (nextCost + 1e-9 >= bestCosts.getOrDefault(next, Double.POSITIVE_INFINITY)) {
                    continue;
                }
                bestCosts.put(next, nextCost);
                cameFrom.put(next, current);
                frontier.add(new QueueEntry(next, nextCost + heuristic(neighbor, end)));
            }
        }
        return null;
    }

    private static List<Point2i> reconstructCellPath(Map<SearchState, SearchState> cameFrom, SearchState endState) {
        ArrayList<Point2i> path = new ArrayList<>();
        SearchState current = endState;
        path.add(current.cell());
        while (cameFrom.containsKey(current)) {
            current = cameFrom.get(current);
            path.add(current.cell());
        }
        Collections.reverse(path);
        return List.copyOf(path);
    }

    private static List<GridPoint2x> assemblePath2x(
            List<GridPoint2x> startAdapter,
            List<Point2i> cellRoute,
            List<GridPoint2x> endAdapter
    ) {
        ArrayList<GridPoint2x> result = new ArrayList<>();
        appendUnique(result, startAdapter);
        appendUnique(result, cellRoute == null ? List.of() : cellRoute.stream().map(GridPoint2x::fromTileCenter).toList());
        ArrayList<GridPoint2x> reversedEnd = new ArrayList<>(endAdapter == null ? List.of() : endAdapter);
        Collections.reverse(reversedEnd);
        appendUnique(result, reversedEnd);
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static void appendUnique(List<GridPoint2x> target, List<GridPoint2x> points) {
        if (target == null || points == null) {
            return;
        }
        for (GridPoint2x point : points) {
            if (point == null) {
                continue;
            }
            if (!target.isEmpty() && target.getLast().equals(point)) {
                continue;
            }
            target.add(point);
        }
    }

    private static List<Point2i> touchingCells(GridPoint2x anchor) {
        if (anchor == null) {
            return List.of();
        }
        int x2 = anchor.x2();
        int y2 = anchor.y2();
        if ((x2 & 1) == 1 && (y2 & 1) == 1) {
            return List.of(anchor.toCellCenter().orElseThrow());
        }
        if ((x2 & 1) == 0 && (y2 & 1) == 1) {
            int y = (y2 - 1) / 2;
            return List.of(new Point2i(x2 / 2 - 1, y), new Point2i(x2 / 2, y));
        }
        if ((x2 & 1) == 1) {
            int x = (x2 - 1) / 2;
            return List.of(new Point2i(x, y2 / 2 - 1), new Point2i(x, y2 / 2));
        }
        return List.of(
                new Point2i(x2 / 2 - 1, y2 / 2 - 1),
                new Point2i(x2 / 2, y2 / 2 - 1),
                new Point2i(x2 / 2 - 1, y2 / 2),
                new Point2i(x2 / 2, y2 / 2));
    }

    private static List<List<GridPoint2x>> adapterPaths(GridPoint2x anchorPoint, Point2i cell) {
        if (anchorPoint == null || cell == null) {
            return List.of();
        }
        GridPoint2x cellCenter = GridPoint2x.fromTileCenter(cell);
        if (anchorPoint.equals(cellCenter)) {
            return List.of(List.of(anchorPoint));
        }
        if (anchorPoint.distanceTo(cellCenter) == 1) {
            return List.of(List.of(anchorPoint, cellCenter));
        }
        GridPoint2x firstMidpoint = GridPoint2x.fromRaw(anchorPoint.x2(), cellCenter.y2());
        GridPoint2x secondMidpoint = GridPoint2x.fromRaw(cellCenter.x2(), anchorPoint.y2());
        return List.of(
                List.of(anchorPoint, firstMidpoint, cellCenter),
                List.of(anchorPoint, secondMidpoint, cellCenter));
    }

    private static double heuristic(Point2i current, Point2i end) {
        return current == null || end == null ? 0.0d : current.distanceTo(end);
    }

    private static double turnPenalty(Point2i start, Point2i end) {
        int cellDistance = Math.max(1, start.distanceTo(end));
        return Math.max(0.15d, Math.min(0.75d, 0.75d / Math.sqrt(cellDistance)));
    }

    private static List<CorridorConnection> materializeConnections(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            Map<Long, Room> roomsById
    ) {
        if (corridorId == null) {
            return List.of();
        }
        ArrayList<CorridorConnection> result = new ArrayList<>();
        for (CorridorNode node : nodes) {
            if (!node.isRoomBound()) {
                continue;
            }
            Point2i roomCell = absoluteRoomCell(node, levelZ, roomsById);
            CardinalDirection direction = node.roomBoundaryDirection();
            if (roomCell == null || direction == null) {
                throw new IllegalArgumentException("Corridor room-bound node could not be resolved");
            }
            result.add(new CorridorConnection(
                    corridorId,
                    mapId,
                    Door.fromSegments(List.of(GridSegment2x.betweenCellAndStep(roomCell, direction.delta())), Door.DoorState.CLOSED),
                    List.of(ConnectionEndpoint.room(node.roomId()), ConnectionEndpoint.corridor(corridorId)),
                    levelZ));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Point2i absoluteRoomCell(CorridorNode node, int levelZ, Map<Long, Room> roomsById) {
        if (node == null || !node.isRoomBound()) {
            return null;
        }
        Room room = roomsById.get(node.roomId());
        if (room == null) {
            throw new IllegalArgumentException("Corridor node references missing room " + node.roomId());
        }
        var floor = room.structure().floorAtLevel(levelZ);
        if (floor == null) {
            throw new IllegalArgumentException("Corridor node references room without floor at level " + levelZ);
        }
        return floor.anchorCell().add(node.roomRelativeCell());
    }

    private static Set<Point2i> occupiedCells(Collection<CorridorRoute> routes) {
        LinkedHashSet<Point2i> result = new LinkedHashSet<>();
        for (CorridorRoute route : routes == null ? List.<CorridorRoute>of() : routes) {
            if (route == null) {
                continue;
            }
            for (GridPoint2x point2x : route.path2x()) {
                if (point2x != null) {
                    point2x.toCellCenter().ifPresent(result::add);
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<GridSegment2x> boundarySegments(Set<Point2i> occupiedCells) {
        if (occupiedCells == null || occupiedCells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (Point2i cell : occupiedCells) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                if (!occupiedCells.contains(cell.add(step))) {
                    result.add(GridSegment2x.betweenCellAndStep(cell, step));
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<GridPoint2x> fillSeeds2x(Set<Point2i> occupiedCells) {
        if (occupiedCells == null || occupiedCells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint2x> result = connectedComponents(occupiedCells).stream()
                .sorted(Comparator.comparing(Corridor::bestCenterCell, Point2i.POINT_ORDER))
                .map(Corridor::bestCenterCell)
                .map(GridPoint2x::fromTileCenter)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<Set<Point2i>> connectedComponents(Set<Point2i> occupiedCells) {
        if (occupiedCells == null || occupiedCells.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Point2i> remaining = new LinkedHashSet<>(occupiedCells);
        ArrayList<Set<Point2i>> result = new ArrayList<>();
        while (!remaining.isEmpty()) {
            Point2i seed = remaining.iterator().next();
            ArrayDeque<Point2i> queue = new ArrayDeque<>();
            LinkedHashSet<Point2i> component = new LinkedHashSet<>();
            queue.add(seed);
            remaining.remove(seed);
            while (!queue.isEmpty()) {
                Point2i current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    Point2i neighbor = current.add(step);
                    if (remaining.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            result.add(Set.copyOf(component));
        }
        return List.copyOf(result);
    }

    private static Point2i bestCenterCell(Set<Point2i> occupiedCells) {
        if (occupiedCells == null || occupiedCells.isEmpty()) {
            return new Point2i(0, 0);
        }
        double averageX = occupiedCells.stream().mapToInt(Point2i::x).average().orElse(0.0);
        double averageY = occupiedCells.stream().mapToInt(Point2i::y).average().orElse(0.0);
        return occupiedCells.stream()
                .min(Comparator
                        .comparingDouble((Point2i cell) -> squaredDistance(cell, averageX, averageY))
                        .thenComparing(Point2i.POINT_ORDER))
                .orElse(new Point2i(0, 0));
    }

    private static double squaredDistance(Point2i cell, double centerX, double centerY) {
        double deltaX = cell.x() - centerX;
        double deltaY = cell.y() - centerY;
        return deltaX * deltaX + deltaY * deltaY;
    }

    private record DerivedProjection(
            StructureObject structure,
            List<CorridorRoute> routes,
            List<CorridorConnection> connections
    ) {
    }

    private record AnchorAttachment(Point2i cell, List<GridPoint2x> anchorToCellPath) {
        private AnchorAttachment {
            cell = Objects.requireNonNull(cell, "cell");
            anchorToCellPath = anchorToCellPath == null ? List.of() : List.copyOf(anchorToCellPath);
        }

        private double adapterCost() {
            return Math.max(0, anchorToCellPath.size() - 1);
        }
    }

    private record SearchState(Point2i cell, Point2i direction) {
        private SearchState {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    private record QueueEntry(SearchState state, double estimatedTotalCost) {
        private QueueEntry {
            state = Objects.requireNonNull(state, "state");
        }
    }

    private record CellRoute(List<Point2i> cells, double cost) {
        private CellRoute {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }
    }

    private record RoutePlan(List<GridPoint2x> path2x, double cost) {
        private RoutePlan {
            path2x = path2x == null ? List.of() : List.copyOf(path2x);
        }
    }

    public record CorridorRoute(
            Long segmentId,
            Long startNodeId,
            Long endNodeId,
            List<GridPoint2x> path2x
    ) {
        public CorridorRoute {
            path2x = path2x == null ? List.of() : List.copyOf(path2x);
        }

        public List<GridSegment2x> segments2x() {
            if (path2x.size() < 2) {
                return List.of();
            }
            ArrayList<GridSegment2x> result = new ArrayList<>();
            for (int index = 1; index < path2x.size(); index++) {
                result.add(new GridSegment2x(path2x.get(index - 1), path2x.get(index)));
            }
            return List.copyOf(result);
        }

        public List<GridPoint2x> cornerPoints2x() {
            if (path2x.size() < 3) {
                return List.of();
            }
            ArrayList<GridPoint2x> result = new ArrayList<>();
            for (int index = 1; index < path2x.size() - 1; index++) {
                GridPoint2x previous = path2x.get(index - 1);
                GridPoint2x current = path2x.get(index);
                GridPoint2x next = path2x.get(index + 1);
                int incomingDx2 = current.x2() - previous.x2();
                int incomingDy2 = current.y2() - previous.y2();
                int outgoingDx2 = next.x2() - current.x2();
                int outgoingDy2 = next.y2() - current.y2();
                if (incomingDx2 != outgoingDx2 || incomingDy2 != outgoingDy2) {
                    result.add(current);
                }
            }
            return List.copyOf(result);
        }
    }
}
