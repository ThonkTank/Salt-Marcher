package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.BoundaryNetwork;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.BoundaryObject;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.persistence.ClusterBoundaryWrite;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

public final class RoomCluster {

    private static final String TARGET_KEY_PREFIX = "cluster:";

    private final Long clusterId;
    private final long mapId;
    private final Point2i center;
    // A cluster manages room grouping/runtime lookup, but room truth lives in the rooms.
    private final List<Room> rooms;
    private final Set<Point2i> cells;
    private final TileShape shape;
    private final Map<Long, Room> roomsById;
    private final Map<Point2i, Room> roomsByCell;
    private final Map<Long, Set<Long>> adjacentRoomIdsByRoomId;
    private final List<Set<Long>> components;
    private final Map<Long, Set<Long>> componentByRoomId;
    private final boolean hasOverlappingRooms;

    public RoomCluster(
            Long clusterId,
            long mapId,
            Point2i center,
            List<Room> rooms
    ) {
        List<Room> resolvedRooms = rooms == null ? List.of() : List.copyOf(rooms);
        Map<Long, Room> resolvedRoomsById = indexRoomsById(resolvedRooms);
        OverlapIndex overlapIndex = indexRoomsByCell(resolvedRooms);
        Set<Point2i> resolvedCells = indexCells(resolvedRooms);
        Map<Long, Set<Long>> resolvedAdjacency = indexAdjacentRoomIds(resolvedRoomsById, overlapIndex.roomsByCell());
        List<Set<Long>> resolvedComponents = components(resolvedRoomsById.keySet(), resolvedAdjacency);

        this.clusterId = clusterId;
        this.mapId = mapId;
        this.center = center == null ? new Point2i(0, 0) : center;
        this.rooms = resolvedRooms;
        this.cells = resolvedCells;
        this.shape = TileShape.fromAbsoluteCells(resolvedCells);
        this.roomsById = resolvedRoomsById;
        this.roomsByCell = overlapIndex.roomsByCell();
        this.adjacentRoomIdsByRoomId = immutableSetMap(resolvedAdjacency);
        this.components = immutableComponents(resolvedComponents);
        this.componentByRoomId = indexComponentByRoomId(this.components);
        this.hasOverlappingRooms = overlapIndex.hasOverlaps();
    }

    public Long clusterId() {
        return clusterId;
    }

    public long mapId() {
        return mapId;
    }

    public Point2i center() {
        return center;
    }

    public List<Room> rooms() {
        return rooms;
    }

    public RoomCluster withRooms(List<Room> rooms) {
        return new RoomCluster(clusterId, mapId, center, rooms);
    }

    public String targetKey() {
        return targetKey(clusterId);
    }

    public static String targetKey(Long clusterId) {
        return clusterId == null ? TARGET_KEY_PREFIX + "unassigned" : TARGET_KEY_PREFIX + clusterId;
    }

    public InteractiveLabelHandle labelHandle() {
        return new InteractiveLabelHandle(
                targetKey(),
                clusterId == null ? "Cluster" : "Cluster " + clusterId,
                shape.centerAnchor());
    }

    public boolean canAbsorbPaintShape(TileShape paintShape) {
        return simplePaintExpansion(paintShape) != null;
    }

    public boolean overlaps(TileShape shape) {
        return shape != null && this.shape.overlaps(shape);
    }

    public Room singleRoom() {
        return rooms.size() == 1 ? rooms.getFirst() : null;
    }

    public SimpleClusterPaintExpansion simplePaintExpansion(TileShape paintShape) {
        if (paintShape == null || paintShape.size() == 0 || rooms.size() != 1) {
            return null;
        }
        Room room = singleRoom();
        if (room == null || room.roomId() == null) {
            return null;
        }
        TileShape mergedShape = absorbedPaintShape(paintShape);
        Point2i roomAnchor = updatedSingleRoomAnchorAfterAbsorb(paintShape);
        return new SimpleClusterPaintExpansion(mergedShape, room.roomId(), roomAnchor);
    }

    public TileShape absorbedPaintShape(TileShape paintShape) {
        return paintShape == null ? shape : shape.union(paintShape);
    }

    public Point2i updatedSingleRoomAnchorAfterAbsorb(TileShape paintShape) {
        Room room = singleRoom();
        if (room == null) {
            throw new IllegalStateException("Cluster hat nicht genau einen Raum");
        }
        TileShape mergedShape = absorbedPaintShape(paintShape);
        Point2i currentAnchor = room.floor().shape().anchor();
        return mergedShape.contains(currentAnchor)
                ? currentAnchor
                : mergedShape.centerCell();
    }

    public SimpleClusterDeleteResult simpleDelete(TileShape deletedShape) {
        if (deletedShape == null || deletedShape.size() == 0 || rooms.size() != 1) {
            return null;
        }
        TileShape remainingShape = shape.subtract(deletedShape);
        if (remainingShape.size() == shape.size()) {
            return new SimpleClusterDeleteResult.Unchanged();
        }
        if (remainingShape.size() == 0) {
            return new SimpleClusterDeleteResult.Deleted();
        }
        List<TileShape> components = remainingShape.connectedComponents();
        Point2i currentAnchor = singleRoom().floor().shape().anchor();
        if (components.size() == 1) {
            TileShape componentShape = components.getFirst();
            return new SimpleClusterDeleteResult.Reduced(componentShape, anchorFor(componentShape, currentAnchor));
        }
        List<SimpleClusterFragment> fragments = components.stream()
                .map(componentShape -> new SimpleClusterFragment(componentShape, anchorFor(componentShape, currentAnchor)))
                .sorted(Comparator
                        .comparing((SimpleClusterFragment fragment) -> !fragment.clusterShape().contains(currentAnchor))
                        .thenComparing(fragment -> fragment.clusterShape().centerCell(), Point2i.POINT_ORDER))
                .toList();
        return new SimpleClusterDeleteResult.Split(fragments);
    }

    public RoomCluster movedBy(Point2i delta) {
        if (delta == null || (delta.x() == 0 && delta.y() == 0)) {
            return this;
        }
        return new RoomCluster(
                clusterId,
                mapId,
                center.add(delta),
                rooms.stream()
                        .map(room -> room == null ? null : room.movedBy(delta))
                        .toList());
    }

    public Set<Point2i> cells() {
        return cells;
    }

    public TileShape shape() {
        return shape;
    }

    public Room findRoom(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public Set<Long> roomIds() {
        return roomsById.keySet();
    }

    public boolean containsRoom(Long roomId) {
        return roomId != null && roomsById.containsKey(roomId);
    }

    public RoomCluster withAddedRoom(Room room) {
        if (room == null) {
            return this;
        }
        List<Room> updated = new ArrayList<>();
        boolean replaced = false;
        for (Room existing : rooms) {
            if (!sameRoomId(existing, room)) {
                updated.add(existing);
                continue;
            }
            updated.add(roomForCluster(room));
            replaced = true;
        }
        if (!replaced) {
            updated.add(roomForCluster(room));
        }
        return withRooms(updated);
    }

    public RoomCluster withRemovedRoom(Long roomId) {
        if (roomId == null || !containsRoom(roomId)) {
            return this;
        }
        return withRooms(rooms.stream()
                .filter(room -> room == null || !roomId.equals(room.roomId()))
                .toList());
    }

    public RoomCluster withReplacedRoom(Room room) {
        return room == null ? this : withAddedRoom(room);
    }

    public Room createRoom(Long roomId, String name, Floor floor) {
        return Room.create(
                roomId,
                mapId,
                clusterId == null ? 0L : clusterId,
                normalizedRoomName(roomId, name),
                floor);
    }

    public RoomCluster withCreatedRoom(Long roomId, String name, Floor floor) {
        return withAddedRoom(createRoom(roomId, name, floor));
    }

    public Room roomAt(Point2i cell) {
        return cell == null ? null : roomsByCell.get(cell);
    }

    public boolean contains(Point2i cell) {
        return cell != null && cells.contains(cell);
    }

    public List<Room> adjacentRooms(Room room) {
        if (room == null || room.roomId() == null) {
            return List.of();
        }
        return adjacentRoomIds(room.roomId()).stream()
                .map(this::findRoom)
                .filter(candidate -> candidate != null)
                .toList();
    }

    public Set<Long> adjacentRoomIds(Long roomId) {
        return roomId == null ? Set.of() : adjacentRoomIdsByRoomId.getOrDefault(roomId, Set.of());
    }

    public List<Set<Long>> components() {
        return components;
    }

    public Set<Long> componentContaining(Long roomId) {
        return roomId == null ? Set.of() : componentByRoomId.getOrDefault(roomId, Set.of());
    }

    public Set<Long> componentContaining(Point2i cell) {
        Room room = roomAt(cell);
        return room == null ? Set.of() : componentContaining(room.roomId());
    }

    public boolean isConnected() {
        return roomsById.isEmpty() || components.size() <= 1;
    }

    public boolean hasOverlappingRooms() {
        return hasOverlappingRooms;
    }

    public boolean coversExactlyKnownCells() {
        return roomsByCell.keySet().equals(cells);
    }

    public boolean isValidPartition() {
        return !hasOverlappingRooms && coversExactlyKnownCells();
    }

    public boolean canMergeRooms(Set<Long> roomIds) {
        Set<Long> selected = normalizedRoomIds(roomIds);
        if (selected.size() < 2 || !roomsById.keySet().containsAll(selected)) {
            return false;
        }
        ArrayDeque<Long> queue = new ArrayDeque<>();
        Set<Long> visited = new LinkedHashSet<>();
        Long seed = selected.iterator().next();
        queue.add(seed);
        while (!queue.isEmpty()) {
            Long current = queue.removeFirst();
            if (!visited.add(current)) {
                continue;
            }
            for (Long neighbor : adjacentRoomIds(current)) {
                if (selected.contains(neighbor) && !visited.contains(neighbor)) {
                    queue.addLast(neighbor);
                }
            }
        }
        return visited.equals(selected);
    }

    public Room mergedRoom(Set<Long> roomIds, Long mergedRoomId, String mergedName) {
        Set<Long> selected = normalizedRoomIds(roomIds);
        if (!canMergeRooms(selected)) {
            throw new IllegalArgumentException("Zu mergende Raeume muessen existieren und im Cluster zusammenhaengend sein");
        }
        TileShape mergedShape = mergedShape(selected);
        Set<VertexEdge> boundaryEdges = mergedShape.boundaryEdges();
        Set<VertexEdge> mergedDoorEdges = collectEdges(selected, true, boundaryEdges);
        Set<VertexEdge> mergedWallEdges = collectEdges(selected, false, boundaryEdges);
        mergedWallEdges.removeAll(mergedDoorEdges);
        Long resolvedRoomId = mergedRoomId != null ? mergedRoomId : selected.iterator().next();
        String resolvedName = mergedName == null || mergedName.isBlank()
                ? findRoom(selected.iterator().next()).name()
                : mergedName.trim();
        return Room.resolved(
                resolvedRoomId,
                mapId,
                clusterId == null ? 0L : clusterId,
                resolvedName,
                new Floor(mergedShape),
                mergedWallEdges.isEmpty() ? List.of() : List.of(new Wall(mergedWallEdges)),
                mergedDoorEdges.isEmpty() ? List.of() : List.of(new Door(mergedDoorEdges)),
                findRoom(selected.iterator().next()).narration());
    }

    public RoomCluster withMergedRooms(Set<Long> roomIds, Long mergedRoomId, String mergedName) {
        Set<Long> selected = normalizedRoomIds(roomIds);
        Room mergedRoom = mergedRoom(selected, mergedRoomId, mergedName);
        List<Room> updated = new ArrayList<>();
        boolean inserted = false;
        for (Room room : rooms) {
            if (room == null || room.roomId() == null || !selected.contains(room.roomId())) {
                updated.add(room);
                continue;
            }
            if (!inserted) {
                updated.add(mergedRoom);
                inserted = true;
            }
        }
        if (!inserted) {
            updated.add(mergedRoom);
        }
        return withRooms(updated);
    }

    public Map<VertexEdge, ClusterBoundaryWrite.Type> internalBoundaryKinds() {
        Map<VertexEdge, ClusterBoundaryWrite.Type> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Wall wall : room.walls()) {
                for (VertexEdge edge : wall.edges()) {
                    if (isInternalEdge(cells, edge)) {
                        result.putIfAbsent(edge, ClusterBoundaryWrite.Type.WALL);
                    }
                }
            }
            for (Door door : room.doors()) {
                for (VertexEdge edge : door.edges()) {
                    if (isInternalEdge(cells, edge)) {
                        result.put(edge, ClusterBoundaryWrite.Type.DOOR);
                    }
                }
            }
        }
        return Map.copyOf(result);
    }

    public List<ClusterBoundaryWrite> persistedInternalBoundaries() {
        return persistedInternalBoundaries(shape, rooms);
    }

    public ClusterRewrite applyPaint(TileShape paintShape, List<RoomCluster> overlappingClusters) {
        if (paintShape == null || paintShape.size() == 0) {
            return unchangedRewrite();
        }
        List<RoomCluster> resolvedClusters = normalizedClusters(overlappingClusters);
        List<Room> touchedRooms = resolvedClusters.stream()
                .flatMap(cluster -> cluster.rooms().stream())
                .filter(room -> room != null && room.roomId() != null && room.floor().shape().overlaps(paintShape))
                .sorted(Comparator.comparing(room -> room.roomId() == null ? Long.MAX_VALUE : room.roomId()))
                .toList();
        if (touchedRooms.isEmpty()) {
            return unchangedRewrite();
        }

        Room retainedRoom = touchedRooms.getFirst();
        Set<Long> mergedRoomIds = touchedRooms.stream()
                .map(Room::roomId)
                .filter(java.util.Objects::nonNull)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        TileShape mergedRoomShape = paintShape;
        for (Room room : touchedRooms) {
            mergedRoomShape = mergedRoomShape.union(room.floor().shape());
        }

        Set<Point2i> mergedClusterCells = new LinkedHashSet<>(paintShape.absoluteCells());
        Map<VertexEdge, ClusterBoundaryWrite.Type> previousBoundaryKinds = new LinkedHashMap<>();
        List<RoomRewriteCandidate> candidates = new ArrayList<>();
        Set<Long> deletedClusterIds = new LinkedHashSet<>();
        for (RoomCluster cluster : resolvedClusters) {
            mergedClusterCells.addAll(cluster.cells());
            previousBoundaryKinds.putAll(cluster.internalBoundaryKinds());
            if (cluster.clusterId() != null && !cluster.clusterId().equals(clusterId)) {
                deletedClusterIds.add(cluster.clusterId());
            }
            for (Room room : cluster.rooms()) {
                if (room == null || room.roomId() == null || mergedRoomIds.contains(room.roomId())) {
                    continue;
                }
                candidates.add(RoomRewriteCandidate.keep(
                        room.roomId(),
                        room.name(),
                        room.floor().shape(),
                        room.floor().shape().anchor()));
            }
        }
        candidates.add(RoomRewriteCandidate.keep(
                retainedRoom.roomId(),
                retainedRoom.name(),
                mergedRoomShape,
                retainedRoom.floor().shape().anchor()));

        TileShape rewrittenClusterShape = TileShape.fromAbsoluteCells(mergedClusterCells);
        List<Room> rewrittenRooms = reconciledRooms(
                rewrittenClusterShape,
                candidates,
                previousBoundaryKinds);
        Map<Long, Long> replacedRoomIds = new LinkedHashMap<>();
        for (Long mergedRoomId : mergedRoomIds) {
            if (!mergedRoomId.equals(retainedRoom.roomId())) {
                replacedRoomIds.put(mergedRoomId, retainedRoom.roomId());
            }
        }
        Set<Long> deletedRoomIds = new LinkedHashSet<>(mergedRoomIds);
        deletedRoomIds.remove(retainedRoom.roomId());
        return new ClusterRewrite(
                clusterId,
                rewrittenClusterShape,
                rewrittenClusterShape.centerCell(),
                rewrittenRooms,
                persistedInternalBoundaries(rewrittenClusterShape, rewrittenRooms),
                deletedRoomIds,
                replacedRoomIds,
                mergedRoomIds.size() > 1 ? mergedRoomIds : Set.of(),
                deletedClusterIds,
                Map.of());
    }

    public ClusterRewrite applyDelete(TileShape deletedShape, Supplier<String> roomNameSupplier) {
        if (deletedShape == null || deletedShape.size() == 0) {
            return unchangedRewrite();
        }
        Set<Point2i> remainingCells = new LinkedHashSet<>(cells);
        if (!remainingCells.removeAll(deletedShape.absoluteCells())) {
            return unchangedRewrite();
        }
        if (remainingCells.isEmpty()) {
            return new ClusterRewrite(
                    clusterId,
                    TileShape.singleCell(center),
                    center,
                    List.of(),
                    List.of(),
                    roomIds(),
                    Map.of(),
                    Set.of(),
                    Set.of(clusterId),
                    Map.of());
        }

        Map<VertexEdge, ClusterBoundaryWrite.Type> previousBoundaryKinds = internalBoundaryKinds();
        List<RoomRewriteCandidate> candidates = new ArrayList<>();
        Set<Long> deletedRoomIds = new LinkedHashSet<>();
        Map<Long, List<RoomRewriteCandidate>> fragmentsBySourceRoomId = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            TileShape remainingShape = room.floor().shape().subtract(deletedShape);
            List<TileShape> components = remainingShape.connectedComponents().stream()
                    .sorted(Comparator
                            .comparing((TileShape component) -> !component.contains(room.floor().shape().anchor()))
                            .thenComparing(TileShape::centerCell, Point2i.POINT_ORDER))
                    .toList();
            if (components.isEmpty()) {
                deletedRoomIds.add(room.roomId());
                continue;
            }
            List<RoomRewriteCandidate> sourceFragments = new ArrayList<>();
            for (int index = 0; index < components.size(); index++) {
                TileShape component = components.get(index);
                String roomName = index == 0
                        ? room.name()
                        : nextGeneratedRoomName(roomNameSupplier, room.name());
                RoomRewriteCandidate candidate = index == 0
                        ? RoomRewriteCandidate.keep(room.roomId(), roomName, component, room.floor().shape().anchor())
                        : RoomRewriteCandidate.create(room.roomId(), roomName, component, room.floor().shape().anchor());
                candidates.add(candidate);
                sourceFragments.add(candidate);
            }
            fragmentsBySourceRoomId.put(room.roomId(), List.copyOf(sourceFragments));
        }

        TileShape rewrittenClusterShape = TileShape.fromAbsoluteCells(remainingCells);
        List<Room> rewrittenRooms = reconciledRooms(
                rewrittenClusterShape,
                candidates,
                previousBoundaryKinds);
        Map<Long, List<Room>> splitFragmentsBySourceRoomId = resolvedFragmentsBySourceRoomId(
                fragmentsBySourceRoomId,
                rewrittenRooms);
        return new ClusterRewrite(
                clusterId,
                rewrittenClusterShape,
                rewrittenClusterShape.centerCell(),
                rewrittenRooms,
                persistedInternalBoundaries(rewrittenClusterShape, rewrittenRooms),
                deletedRoomIds,
                Map.of(),
                Set.of(),
                Set.of(),
                splitFragmentsBySourceRoomId);
    }

    public List<Room> reconciledRooms(
            TileShape clusterShape,
            List<RoomRewriteCandidate> candidates,
            Map<VertexEdge, ClusterBoundaryWrite.Type> previousKinds
    ) {
        if (clusterShape == null || clusterShape.size() == 0) {
            return List.of();
        }
        Set<Point2i> clusterCells = clusterShape.absoluteCells();
        Map<VertexEdge, ClusterBoundaryWrite.Type> boundaryKinds = previousKinds == null ? Map.of() : Map.copyOf(previousKinds);
        List<Room> result = new ArrayList<>();
        for (RoomRewriteCandidate candidate : candidates == null ? List.<RoomRewriteCandidate>of() : candidates) {
            if (candidate == null || candidate.shape() == null || candidate.shape().size() == 0) {
                continue;
            }
            Set<VertexEdge> wallEdges = new LinkedHashSet<>();
            Set<VertexEdge> doorEdges = new LinkedHashSet<>();
            for (Point2i cell : candidate.shape().absoluteCells()) {
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    Point2i neighbor = cell.add(step);
                    if (!clusterCells.contains(neighbor) || candidate.shape().contains(neighbor)) {
                        continue;
                    }
                    VertexEdge edge = VertexEdge.betweenCellAndStep(cell, step);
                    ClusterBoundaryWrite.Type type = boundaryKinds.getOrDefault(edge, ClusterBoundaryWrite.Type.WALL);
                    if (type == ClusterBoundaryWrite.Type.DOOR) {
                        doorEdges.add(edge);
                    } else {
                        wallEdges.add(edge);
                    }
                }
            }
            result.add(Room.resolved(
                    candidate.roomId(),
                    mapId,
                    clusterId == null ? 0L : clusterId,
                    candidate.name(),
                    new Floor(candidate.shape()),
                    wallEdges.isEmpty() ? List.of() : List.of(new Wall(wallEdges)),
                    doorEdges.isEmpty() ? List.of() : List.of(new Door(doorEdges)),
                    narrationFor(candidate.roomId())));
        }
        return List.copyOf(result);
    }

    private static Map<Long, Room> indexRoomsById(List<Room> rooms) {
        Map<Long, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return Map.copyOf(result);
    }

    private static OverlapIndex indexRoomsByCell(List<Room> rooms) {
        Map<Point2i, Room> result = new LinkedHashMap<>();
        boolean hasOverlaps = false;
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Point2i cell : room.cells()) {
                if (result.containsKey(cell)) {
                    hasOverlaps = true;
                }
                result.put(cell, room);
            }
        }
        return new OverlapIndex(Map.copyOf(result), hasOverlaps);
    }

    private static Set<Point2i> indexCells(List<Room> rooms) {
        Set<Point2i> result = new LinkedHashSet<>();
        for (Room room : rooms) {
            if (room != null) {
                result.addAll(room.cells());
            }
        }
        return Set.copyOf(result);
    }

    private static Map<Long, Set<Long>> indexAdjacentRoomIds(Map<Long, Room> roomsById, Map<Point2i, Room> roomsByCell) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Long roomId : roomsById.keySet()) {
            result.put(roomId, new LinkedHashSet<>());
        }
        for (Room room : roomsById.values()) {
            for (Point2i cell : room.cells()) {
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    Room neighbor = roomsByCell.get(cell.add(step));
                    if (neighbor == null || neighbor.roomId() == null || neighbor.roomId().equals(room.roomId())) {
                        continue;
                    }
                    result.get(room.roomId()).add(neighbor.roomId());
                }
            }
        }
        return result;
    }

    private static List<Set<Long>> components(Set<Long> roomIds, Map<Long, Set<Long>> adjacency) {
        Set<Long> unvisited = new LinkedHashSet<>(roomIds);
        List<Set<Long>> result = new ArrayList<>();
        while (!unvisited.isEmpty()) {
            Long seed = unvisited.iterator().next();
            Set<Long> component = new LinkedHashSet<>();
            ArrayDeque<Long> queue = new ArrayDeque<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                Long current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (Long neighbor : adjacency.getOrDefault(current, Set.of())) {
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            result.add(Set.copyOf(component));
        }
        return List.copyOf(result);
    }

    private static Map<Long, Set<Long>> indexComponentByRoomId(List<Set<Long>> components) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Set<Long> component : components) {
            for (Long roomId : component) {
                result.put(roomId, component);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, Set<Long>> immutableSetMap(Map<Long, Set<Long>> mutable) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static List<Set<Long>> immutableComponents(List<Set<Long>> components) {
        return components.stream()
                .map(Set::copyOf)
                .toList();
    }

    private Room roomForCluster(Room room) {
        if (room == null) {
            return null;
        }
        return Room.resolved(
                room.roomId(),
                mapId,
                clusterId == null ? room.clusterId() : clusterId,
                room.name(),
                room.floor(),
                room.walls(),
                room.doors(),
                room.narration());
    }

    private RoomNarration narrationFor(Long roomId) {
        Room room = findRoom(roomId);
        return room == null ? RoomNarration.empty() : room.narration();
    }

    private static boolean sameRoomId(Room left, Room right) {
        return left != null
                && right != null
                && left.roomId() != null
                && left.roomId().equals(right.roomId());
    }

    private static Set<Long> normalizedRoomIds(Set<Long> roomIds) {
        Set<Long> result = new LinkedHashSet<>();
        if (roomIds == null) {
            return result;
        }
        for (Long roomId : roomIds) {
            if (roomId != null) {
                result.add(roomId);
            }
        }
        return Set.copyOf(result);
    }

    private TileShape mergedShape(Set<Long> roomIds) {
        TileShape mergedShape = null;
        for (Long roomId : roomIds) {
            Room room = findRoom(roomId);
            if (room == null) {
                continue;
            }
            mergedShape = mergedShape == null
                    ? room.floor().shape()
                    : mergedShape.union(room.floor().shape());
        }
        return mergedShape == null ? TileShape.singleCell(null) : mergedShape;
    }

    private Set<VertexEdge> collectEdges(Set<Long> roomIds, boolean doors, Set<VertexEdge> boundaryEdges) {
        Set<VertexEdge> result = new LinkedHashSet<>();
        for (Long roomId : roomIds) {
            Room room = findRoom(roomId);
            if (room == null) {
                continue;
            }
            Collection<? extends BoundaryObject> boundaries = doors ? room.doors() : room.walls();
            BoundaryNetwork network = BoundaryNetwork.fromPaths(boundaries.stream()
                    .map(BoundaryObject::path)
                    .toList());
            for (VertexEdge edge : network.edges()) {
                if (boundaryEdges.contains(edge)) {
                    result.add(edge);
                }
            }
        }
        return result;
    }

    private static String normalizedRoomName(Long roomId, String name) {
        return name == null || name.isBlank()
                ? "Raum " + (roomId == null ? "neu" : roomId)
                : name.trim();
    }

    private static Point2i anchorFor(TileShape componentShape, Point2i currentAnchor) {
        return componentShape.contains(currentAnchor)
                ? currentAnchor
                : componentShape.centerCell();
    }

    private ClusterRewrite unchangedRewrite() {
        return new ClusterRewrite(
                clusterId,
                shape,
                center,
                rooms,
                persistedInternalBoundaries(),
                Set.of(),
                Map.of(),
                Set.of(),
                Set.of(),
                Map.of());
    }

    private static List<RoomCluster> normalizedClusters(List<RoomCluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        Map<Long, RoomCluster> result = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            if (cluster != null && cluster.clusterId() != null) {
                result.put(cluster.clusterId(), cluster);
            }
        }
        return List.copyOf(result.values());
    }

    private static boolean isInternalEdge(Set<Point2i> clusterCells, VertexEdge edge) {
        Set<Point2i> touchingCells = edge.touchingCells();
        return touchingCells.size() == 2 && clusterCells.containsAll(touchingCells);
    }

    private static List<ClusterBoundaryWrite> persistedInternalBoundaries(TileShape clusterShape, List<Room> rooms) {
        if (clusterShape == null || clusterShape.size() == 0) {
            return List.of();
        }
        Set<Point2i> clusterCells = clusterShape.absoluteCells();
        Map<VertexEdge, ClusterBoundaryWrite.Type> result = new LinkedHashMap<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null) {
                continue;
            }
            for (Wall wall : room.walls()) {
                for (VertexEdge edge : wall.edges()) {
                    if (isInternalEdge(clusterCells, edge)) {
                        result.putIfAbsent(edge, ClusterBoundaryWrite.Type.WALL);
                    }
                }
            }
            for (Door door : room.doors()) {
                for (VertexEdge edge : door.edges()) {
                    if (isInternalEdge(clusterCells, edge)) {
                        result.put(edge, ClusterBoundaryWrite.Type.DOOR);
                    }
                }
            }
        }
        return result.entrySet().stream()
                .map(entry -> toBoundaryWrite(entry.getKey(), entry.getValue()))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private static ClusterBoundaryWrite toBoundaryWrite(VertexEdge edge, ClusterBoundaryWrite.Type type) {
        List<Point2i> touchingCells = edge.touchingCells().stream()
                .sorted(Point2i.POINT_ORDER)
                .toList();
        if (touchingCells.size() != 2) {
            return null;
        }
        Point2i baseCell = touchingCells.getFirst();
        Point2i direction = baseCell.directionToCardinal(touchingCells.get(1));
        return direction == null ? null : new ClusterBoundaryWrite(baseCell, direction, type);
    }

    private static String nextGeneratedRoomName(Supplier<String> roomNameSupplier, String fallbackName) {
        if (roomNameSupplier == null) {
            return fallbackName;
        }
        String generated = roomNameSupplier.get();
        return generated == null || generated.isBlank() ? fallbackName : generated.trim();
    }

    private static Map<Long, List<Room>> resolvedFragmentsBySourceRoomId(
            Map<Long, List<RoomRewriteCandidate>> candidatesBySourceRoomId,
            List<Room> rooms
    ) {
        if (candidatesBySourceRoomId == null || candidatesBySourceRoomId.isEmpty()) {
            return Map.of();
        }
        Map<String, Room> roomBySignature = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room != null) {
                roomBySignature.put(signature(room.roomId(), room.name(), room.floor().shape()), room);
            }
        }
        Map<Long, List<Room>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<RoomRewriteCandidate>> entry : candidatesBySourceRoomId.entrySet()) {
            List<Room> resolved = entry.getValue().stream()
                    .map(candidate -> roomBySignature.get(signature(candidate.roomId(), candidate.name(), candidate.shape())))
                    .filter(java.util.Objects::nonNull)
                    .toList();
            result.put(entry.getKey(), resolved);
        }
        return Map.copyOf(result);
    }

    private static String signature(Long roomId, String name, TileShape shape) {
        return roomId + "|" + name + "|" + shape;
    }

    private record OverlapIndex(Map<Point2i, Room> roomsByCell, boolean hasOverlaps) {
    }

    record RoomRewriteCandidate(
            Long sourceRoomId,
            Long roomId,
            String name,
            TileShape shape,
            Point2i preferredAnchor
    ) {
        static RoomRewriteCandidate keep(Long roomId, String name, TileShape shape, Point2i preferredAnchor) {
            return new RoomRewriteCandidate(roomId, roomId, name, shape, preferredAnchor);
        }

        static RoomRewriteCandidate create(Long sourceRoomId, String name, TileShape shape, Point2i preferredAnchor) {
            return new RoomRewriteCandidate(sourceRoomId, null, name, shape, preferredAnchor);
        }
    }
}
