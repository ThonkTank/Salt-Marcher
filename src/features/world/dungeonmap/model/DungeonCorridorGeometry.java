package features.world.dungeonmap.model;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.PriorityQueue;
import java.util.Set;

public final class DungeonCorridorGeometry {

    private static final List<Point2i> CARDINAL_NEIGHBORS = List.of(
            new Point2i(1, 0),
            new Point2i(-1, 0),
            new Point2i(0, 1),
            new Point2i(0, -1));

    private DungeonCorridorGeometry() {
        throw new AssertionError("No instances");
    }

    public static CorridorTopology corridorTopology(DungeonLayout layout) {
        LayoutContext context = layoutContext(layout);

        Map<Long, CorridorGeometry> result = new LinkedHashMap<>();
        for (DungeonCorridor corridor : layout.corridors()) {
            List<DungeonRoom> corridorRooms = corridor.roomIds().stream()
                    .map(context.roomsById()::get)
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
            result.put(corridor.corridorId(), layoutCorridorGeometry(
                    layout,
                    corridor,
                    corridorRooms,
                    context.roomCellsById(),
                    context.roomOccupancy()));
        }
        return buildCorridorTopology(layout, result);
    }

    public static LayoutContext layoutContext(DungeonLayout layout) {
        Map<Long, DungeonRoom> roomsById = roomsById(layout.rooms());
        Map<Long, Set<Point2i>> roomCellsById = new LinkedHashMap<>();
        Map<Point2i, Long> roomOccupancy = new HashMap<>();
        for (DungeonRoom room : layout.rooms()) {
            Set<Point2i> roomCells = layout.roomCells(room.roomId());
            roomCellsById.put(room.roomId(), roomCells);
            for (Point2i cell : roomCells) {
                roomOccupancy.put(cell, room.roomId());
            }
        }
        return new LayoutContext(Map.copyOf(roomsById), immutableSetMap(roomCellsById), Map.copyOf(roomOccupancy));
    }

    public static CorridorGeometry corridorGeometry(DungeonLayout layout, DungeonCorridor corridor) {
        return corridorGeometry(layout, corridor, layoutContext(layout));
    }

    public static CorridorGeometry corridorGeometry(DungeonLayout layout, DungeonCorridor corridor, LayoutContext context) {
        if (layout == null || corridor == null || context == null) {
            return null;
        }
        List<DungeonRoom> corridorRooms = corridor.roomIds().stream()
                .map(context.roomsById()::get)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        return layoutCorridorGeometry(layout, corridor, corridorRooms, context.roomCellsById(), context.roomOccupancy());
    }

    public static Point2i suggestNewRoomCenter(Collection<DungeonRoom> rooms) {
        if (rooms.isEmpty()) {
            return new Point2i(0, 0);
        }
        int maxX = rooms.stream().mapToInt(room -> room.componentAnchor().x()).max().orElse(0);
        int minY = rooms.stream().mapToInt(room -> room.componentAnchor().y()).min().orElse(0);
        return new Point2i(maxX + 8, minY);
    }

    private static CorridorTopology buildCorridorTopology(
            DungeonLayout layout,
            Map<Long, CorridorGeometry> baseGeometries
    ) {
        Map<Point2i, Set<Long>> corridorIdsByCell = new HashMap<>();
        Map<DoorKey, Set<Long>> corridorIdsByDoor = new HashMap<>();
        for (CorridorGeometry geometry : baseGeometries.values()) {
            if (!geometry.routable()) {
                continue;
            }
            for (Point2i cell : geometry.cells()) {
                corridorIdsByCell.computeIfAbsent(cell, ignored -> new LinkedHashSet<>()).add(geometry.corridorId());
            }
            for (DoorSegment door : geometry.doors()) {
                corridorIdsByDoor.computeIfAbsent(new DoorKey(door.start(), door.end()), ignored -> new LinkedHashSet<>()).add(geometry.corridorId());
            }
        }

        Map<Long, Set<Long>> adjacentCorridors = new HashMap<>();
        for (Long corridorId : baseGeometries.keySet()) {
            adjacentCorridors.put(corridorId, new LinkedHashSet<>());
        }
        for (Set<Long> overlapping : corridorIdsByCell.values()) {
            linkCorridors(adjacentCorridors, overlapping);
        }
        for (Set<Long> overlapping : corridorIdsByDoor.values()) {
            linkCorridors(adjacentCorridors, overlapping);
        }

        Map<Long, String> componentIdByCorridorId = new LinkedHashMap<>();
        Map<String, CorridorComponent> componentsById = new LinkedHashMap<>();
        Set<Long> unvisited = baseGeometries.values().stream()
                .filter(CorridorGeometry::routable)
                .map(CorridorGeometry::corridorId)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        while (!unvisited.isEmpty()) {
            Long seed = unvisited.iterator().next();
            Set<Long> componentCorridorIds = new LinkedHashSet<>();
            ArrayDeque<Long> queue = new ArrayDeque<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                Long corridorId = queue.removeFirst();
                componentCorridorIds.add(corridorId);
                for (Long neighbor : adjacentCorridors.getOrDefault(corridorId, Set.of())) {
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }

            String componentId = componentIdFor(componentCorridorIds);
            Set<Long> roomIds = new LinkedHashSet<>();
            Set<Point2i> cells = new LinkedHashSet<>();
            Set<DoorSegment> doors = new LinkedHashSet<>();
            for (Long corridorId : componentCorridorIds) {
                CorridorGeometry geometry = baseGeometries.get(corridorId);
                roomIds.addAll(geometry.roomIds());
                cells.addAll(geometry.cells());
                doors.addAll(geometry.doors());
                componentIdByCorridorId.put(corridorId, componentId);
            }

            RoomShape componentShape = cells.isEmpty() ? null : DungeonRoomGeometry.roomShapeForCells(cells);
            List<Point2i> outlineVertices = componentShape == null ? List.of() : componentShape.absoluteVertices();
            componentsById.put(componentId, new CorridorComponent(
                    componentId,
                    layout.map().mapId(),
                    Set.copyOf(componentCorridorIds),
                    Set.copyOf(roomIds),
                    Set.copyOf(cells),
                    List.copyOf(outlineVertices),
                    List.copyOf(doors)));
        }

        Map<Long, CorridorGeometry> resolvedGeometries = new LinkedHashMap<>();
        for (CorridorGeometry geometry : baseGeometries.values()) {
            resolvedGeometries.put(geometry.corridorId(), geometry.withComponentId(componentIdByCorridorId.get(geometry.corridorId())));
        }
        return new CorridorTopology(
                Map.copyOf(resolvedGeometries),
                Map.copyOf(componentsById),
                Map.copyOf(componentIdByCorridorId));
    }

    private static void linkCorridors(Map<Long, Set<Long>> adjacentCorridors, Set<Long> corridorIds) {
        if (corridorIds.size() < 2) {
            return;
        }
        for (Long corridorId : corridorIds) {
            adjacentCorridors.computeIfAbsent(corridorId, ignored -> new LinkedHashSet<>()).addAll(corridorIds);
            adjacentCorridors.get(corridorId).remove(corridorId);
        }
    }

    private static Map<Long, Set<Point2i>> immutableSetMap(Map<Long, Set<Point2i>> source) {
        Map<Long, Set<Point2i>> copy = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<Point2i>> entry : source.entrySet()) {
            copy.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(copy);
    }

    private static String componentIdFor(Set<Long> corridorIds) {
        return "corridor-component:" + corridorIds.stream()
                .sorted()
                .map(String::valueOf)
                .reduce((left, right) -> left + "," + right)
                .orElse("empty");
    }

    // Multi-room corridors stay deterministic and bounded: we build one shared corridor from a stable seed room,
    // then pick each next room by the added pair-travel it contributes into that shared network.
    private static CorridorGeometry layoutCorridorGeometry(
            DungeonLayout layout,
            DungeonCorridor corridor,
            List<DungeonRoom> rooms,
            Map<Long, Set<Point2i>> roomCellsById,
            Map<Point2i, Long> roomOccupancy
    ) {
        Long corridorId = corridor == null ? null : corridor.corridorId();
        List<DungeonRoom> groupRooms = rooms.stream()
                .filter(Objects::nonNull)
                .filter(room -> room.roomId() != null)
                .distinct()
                .toList();
        List<Long> roomIds = groupRooms.stream().map(DungeonRoom::roomId).toList();
        if (groupRooms.size() < 2) {
            return new CorridorGeometry(corridorId, roomIds, List.of(), Set.of(), List.of(), List.of(), false, false, null);
        }

        Map<Long, DungeonRoom> roomsById = roomsById(groupRooms);
        Map<Long, Set<Point2i>> cellsByRoomId = new LinkedHashMap<>();
        for (DungeonRoom room : groupRooms) {
            Set<Point2i> roomCells = roomCellsById.getOrDefault(room.roomId(), Set.of());
            if (roomCells.isEmpty()) {
                throw new IllegalStateException("Raum " + room.roomId() + " hat keine abgeleiteten Zellen fuer Korridor-Geometrie");
            }
            cellsByRoomId.put(room.roomId(), roomCells);
        }

        List<Point2i> waypointCells = resolveWaypointCells(layout, corridor);
        // Auto doors without explicit overrides may move on every recompute so the whole corridor network can
        // shorten after room moves instead of preserving stale local attachments.
        CorridorBuildState bestState = null;
        for (DungeonRoom seedRoom : orderedSeedRooms(layout, corridor, groupRooms, cellsByRoomId, roomOccupancy, waypointCells)) {
            CorridorBuildState candidateState = buildGreedySeedState(
                    layout,
                    corridor,
                    seedRoom,
                    roomIds,
                    groupRooms,
                    roomsById,
                    cellsByRoomId,
                    roomOccupancy,
                    waypointCells);
            if (bestState == null || corridorBuildStateComparator().compare(candidateState, bestState) < 0) {
                bestState = candidateState;
            }
        }

        boolean routable = bestState.connectedRoomCount() == groupRooms.size()
                && (!bestState.segments().isEmpty() || !bestState.doors().isEmpty());
        return new CorridorGeometry(
                corridorId,
                roomIds,
                List.copyOf(bestState.segments()),
                Set.copyOf(bestState.corridorCells()),
                List.copyOf(bestState.doors()),
                List.copyOf(waypointCells),
                bestState.directlyAdjacentOnly(),
                routable,
                null);
    }

    private static CorridorBuildState buildGreedySeedState(
            DungeonLayout layout,
            DungeonCorridor corridor,
            DungeonRoom seedRoom,
            List<Long> targetRoomIds,
            List<DungeonRoom> groupRooms,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, Set<Point2i>> cellsByRoomId,
            Map<Point2i, Long> roomOccupancy,
            List<Point2i> waypointCells
    ) {
        Set<Long> connectedRoomIds = new LinkedHashSet<>();
        connectedRoomIds.add(seedRoom.roomId());
        Set<Point2i> corridorCells = new LinkedHashSet<>();
        Set<GridSegment> segments = new LinkedHashSet<>();
        Set<DoorSegment> doors = new LinkedHashSet<>();
        boolean directlyAdjacentOnly = true;

        if (!waypointCells.isEmpty()) {
            ConnectionCandidate seedCandidate = bestPathFromRoomToTargets(
                    seedRoom,
                    cellsByRoomId.getOrDefault(seedRoom.roomId(), Set.of()),
                    roomOccupancy,
                    waypointCells,
                    false,
                    resolveDoorOverride(layout, corridor, seedRoom));
            if (seedCandidate != null) {
                corridorCells.addAll(seedCandidate.path());
                segments.addAll(segmentsForPath(seedCandidate.path()));
                doors.addAll(seedCandidate.doors());
                directlyAdjacentOnly = seedCandidate.path().isEmpty();
            }
        }

        while (connectedRoomIds.size() < groupRooms.size()) {
            ConnectionCandidate bestCandidate = null;
            CorridorConnectionScorer.GraphSnapshot baseGraph = CorridorConnectionScorer.graphSnapshot(segments, doors);
            for (DungeonRoom room : groupRooms) {
                if (connectedRoomIds.contains(room.roomId())) {
                    continue;
                }
                for (ConnectionCandidate candidate : connectionCandidates(
                        layout,
                        corridor,
                        room,
                        groupRooms.size(),
                        roomsById,
                        cellsByRoomId,
                        connectedRoomIds,
                        corridorCells,
                        roomOccupancy,
                        waypointCells)) {
                    CorridorNetworkScore candidateStepScore = CorridorConnectionScorer.scoreConnection(
                            baseGraph,
                            connectedRoomIds,
                            candidate.roomId(),
                            candidate.path(),
                            candidate.doors());
                    if (candidateStepScore.corridorComponentCount() > 1) {
                        continue;
                    }
                    ConnectionCandidate scoredCandidate = candidate.withNetworkScore(candidateStepScore);
                    if (bestCandidate == null
                            || candidateStepScore.compareTo(bestCandidate.networkScore()) < 0
                            || (candidateStepScore.compareTo(bestCandidate.networkScore()) == 0
                            && connectionCandidateComparator().compare(scoredCandidate, bestCandidate) < 0)) {
                        bestCandidate = scoredCandidate;
                    }
                }
            }
            if (bestCandidate == null) {
                break;
            }
            connectedRoomIds.add(bestCandidate.roomId());
            corridorCells.addAll(bestCandidate.path());
            segments.addAll(segmentsForPath(bestCandidate.path()));
            doors.addAll(bestCandidate.doors());
            directlyAdjacentOnly = directlyAdjacentOnly && bestCandidate.path().isEmpty();
        }

        return new CorridorBuildState(
                Set.copyOf(corridorCells),
                Set.copyOf(segments),
                Set.copyOf(doors),
                directlyAdjacentOnly,
                Set.copyOf(connectedRoomIds),
                CorridorConnectionScorer.scoreNetwork(targetRoomIds, segments, doors));
    }

    private static List<DungeonRoom> orderedSeedRooms(
            DungeonLayout layout,
            DungeonCorridor corridor,
            List<DungeonRoom> groupRooms,
            Map<Long, Set<Point2i>> cellsByRoomId,
            Map<Point2i, Long> roomOccupancy,
            List<Point2i> waypointCells
    ) {
        return groupRooms.stream()
                .sorted(Comparator
                        .comparingInt((DungeonRoom room) -> seedWaypointScore(layout, corridor, room, cellsByRoomId, roomOccupancy, waypointCells))
                        .thenComparingInt(room -> centralityScore(room, groupRooms))
                        .thenComparingLong(room -> room.roomId() == null ? Long.MAX_VALUE : room.roomId()))
                .toList();
    }

    private static Comparator<CorridorBuildState> corridorBuildStateComparator() {
        return Comparator
                .comparingInt(CorridorBuildState::connectedRoomCount).reversed()
                .thenComparing(CorridorBuildState::networkScore)
                .thenComparingInt(state -> state.corridorCells().size())
                .thenComparingInt(state -> state.doors().size())
                .thenComparingInt(state -> state.segments().size());
    }

    private static int seedWaypointScore(
            DungeonLayout layout,
            DungeonCorridor corridor,
            DungeonRoom room,
            Map<Long, Set<Point2i>> cellsByRoomId,
            Map<Point2i, Long> roomOccupancy,
            List<Point2i> waypointCells
    ) {
        if (waypointCells.isEmpty()) {
            return 0;
        }
        ConnectionCandidate candidate = bestPathFromRoomToTargets(
                room,
                cellsByRoomId.getOrDefault(room.roomId(), Set.of()),
                roomOccupancy,
                waypointCells,
                false,
                resolveDoorOverride(layout, corridor, room));
        return candidate == null ? Integer.MAX_VALUE : candidate.routeScore();
    }

    private static int centralityScore(DungeonRoom room, List<DungeonRoom> rooms) {
        int total = 0;
        for (DungeonRoom other : rooms) {
            if (room == other) {
                continue;
            }
            total += manhattan(room.componentAnchor(), other.componentAnchor());
        }
        return total;
    }

    private static Comparator<ConnectionCandidate> connectionCandidateComparator() {
        return Comparator
                .comparingInt(ConnectionCandidate::routeScore)
                .thenComparing(DungeonCorridorGeometry::pathPreference)
                .thenComparing((ConnectionCandidate candidate) -> candidate.joinedExistingCorridor() ? 0 : 1)
                .thenComparingInt(candidate -> candidate.doors().size())
                .thenComparingInt(ConnectionCandidate::anchorTieBreaker)
                .thenComparingLong(ConnectionCandidate::roomId);
    }

    private static PathPreference pathPreference(ConnectionCandidate candidate) {
        List<Point2i> path = candidate == null ? List.of() : candidate.path();
        return new PathPreference(path.size(), cornerCount(path));
    }

    private static List<ConnectionCandidate> connectionCandidates(
            DungeonLayout layout,
            DungeonCorridor corridor,
            DungeonRoom room,
            int totalRoomCount,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, Set<Point2i>> cellsByRoomId,
            Set<Long> connectedRoomIds,
            Set<Point2i> corridorCells,
            Map<Point2i, Long> roomOccupancy,
            List<Point2i> waypointCells
    ) {
        // Explicit door overrides stay pinned. Rooms without overrides may change exits whenever recompute finds
        // a shorter shared network.
        Set<Point2i> roomCells = cellsByRoomId.getOrDefault(room.roomId(), Set.of());
        List<ExitCandidate> roomExits = exposedExits(roomCells, roomOccupancy, room.roomId(), resolveDoorOverride(layout, corridor, room));
        List<ConnectionCandidate> candidates = new ArrayList<>();
        if (waypointCells.isEmpty() && totalRoomCount <= 2) {
            // Shared doors are only valid for pure room-pair corridors. Once a corridor spans 3+ rooms,
            // every attachment must stay in one continuous corridor component instead of chaining through room interiors.
            candidates.addAll(sharedDoorCandidates(room, roomsById, cellsByRoomId, connectedRoomIds, roomCells, layout, corridor));
        }
        candidates.addAll(corridorJoinCandidates(room, corridorCells, roomOccupancy, roomExits));
        candidates.addAll(freshPathCandidates(
                room,
                roomsById,
                cellsByRoomId,
                connectedRoomIds,
                roomOccupancy,
                roomExits,
                waypointCells,
                layout,
                corridor));
        return List.copyOf(candidates);
    }

    private static List<ConnectionCandidate> sharedDoorCandidates(
            DungeonRoom room,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, Set<Point2i>> cellsByRoomId,
            Set<Long> connectedRoomIds,
            Set<Point2i> roomCells,
            DungeonLayout layout,
            DungeonCorridor corridor
    ) {
        List<ConnectionCandidate> candidates = new ArrayList<>();
        for (Long connectedRoomId : connectedRoomIds) {
            DungeonRoom connectedRoom = roomsById.get(connectedRoomId);
            if (connectedRoom == null) {
                continue;
            }
            Set<Point2i> connectedRoomCells = cellsByRoomId.getOrDefault(connectedRoomId, Set.of());
            List<DoorSegment> sharedDoors = sharedDoors(
                    roomCells,
                    connectedRoomCells,
                    room.roomId(),
                    connectedRoomId,
                    resolveDoorOverride(layout, corridor, room),
                    resolveDoorOverride(layout, corridor, connectedRoom));
            if (sharedDoors.isEmpty()) {
                continue;
            }
            for (DoorSegment chosenDoor : sharedDoors) {
                if (chosenDoor.roomId() != room.roomId()) {
                    continue;
                }
                DoorSegment reverseDoor = sharedDoors.stream()
                        .filter(door -> door.roomId() == connectedRoomId)
                        .filter(door -> sameDoorSegment(door, chosenDoor))
                        .findFirst()
                        .orElse(null);
                if (reverseDoor == null) {
                    continue;
                }
                ConnectionCandidate candidate = new ConnectionCandidate(
                        room.roomId(),
                        List.of(),
                        List.of(chosenDoor, reverseDoor),
                        true,
                        sharedDoorRouteScore(chosenDoor, reverseDoor, room, connectedRoom),
                        sharedDoorAnchorTieBreaker(chosenDoor, reverseDoor, room, connectedRoom),
                        null);
                candidates.add(candidate);
            }
        }
        return List.copyOf(candidates);
    }

    private static List<ConnectionCandidate> corridorJoinCandidates(
            DungeonRoom room,
            Set<Point2i> corridorCells,
            Map<Point2i, Long> roomOccupancy,
            List<ExitCandidate> roomExits
    ) {
        if (corridorCells.isEmpty()) {
            return List.of();
        }
        List<ConnectionCandidate> candidates = new ArrayList<>();
        for (ExitCandidate roomExit : roomExits) {
            for (Point2i corridorCell : corridorCells) {
                List<Point2i> path = pathThroughPoints(roomExit.outsideCell(), List.of(corridorCell), roomOccupancy);
                if (path.isEmpty() && !roomExit.outsideCell().equals(corridorCell)) {
                    continue;
                }
                ConnectionCandidate candidate = new ConnectionCandidate(
                        room.roomId(),
                        path,
                        List.of(roomExit.door()),
                        true,
                        corridorJoinRouteScore(roomExit, path, room),
                        corridorJoinAnchorTieBreaker(roomExit, corridorCell),
                        null);
                candidates.add(candidate);
            }
        }
        return List.copyOf(candidates);
    }

    private static List<ConnectionCandidate> freshPathCandidates(
            DungeonRoom room,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, Set<Point2i>> cellsByRoomId,
            Set<Long> connectedRoomIds,
            Map<Point2i, Long> roomOccupancy,
            List<ExitCandidate> roomExits,
            List<Point2i> waypointCells,
            DungeonLayout layout,
            DungeonCorridor corridor
    ) {
        List<ConnectionCandidate> candidates = new ArrayList<>();
        List<ExitCandidate> connectedRoomExits = new ArrayList<>();
        for (Long connectedRoomId : connectedRoomIds) {
            DungeonRoom connectedRoom = roomsById.get(connectedRoomId);
            if (connectedRoom == null) {
                continue;
            }
            connectedRoomExits.addAll(exposedExits(
                    cellsByRoomId.getOrDefault(connectedRoomId, Set.of()),
                    roomOccupancy,
                    connectedRoomId,
                    resolveDoorOverride(layout, corridor, connectedRoom)));
        }
        for (ExitCandidate roomExit : roomExits) {
            for (ExitCandidate targetExit : connectedRoomExits) {
                List<Point2i> targets = waypointCells.isEmpty()
                        ? List.of(targetExit.outsideCell())
                        : append(waypointCells, targetExit.outsideCell());
                List<Point2i> path = pathThroughPoints(roomExit.outsideCell(), targets, roomOccupancy);
                if (path.isEmpty() && !roomExit.outsideCell().equals(targetExit.outsideCell())) {
                    continue;
                }
                DungeonRoom targetRoom = roomsById.get(targetExit.door().roomId());
                if (targetRoom == null) {
                    continue;
                }
                ConnectionCandidate candidate = new ConnectionCandidate(
                        room.roomId(),
                        path,
                        List.of(roomExit.door(), targetExit.door()),
                        false,
                        freshPathRouteScore(roomExit, targetExit, path, room, targetRoom),
                        freshPathAnchorTieBreaker(roomExit, targetExit, room, targetRoom),
                        null);
                candidates.add(candidate);
            }
        }
        return List.copyOf(candidates);
    }

    private static ConnectionCandidate bestCandidate(ConnectionCandidate currentBest, ConnectionCandidate candidate) {
        if (candidate == null) {
            return currentBest;
        }
        if (currentBest == null || connectionCandidateComparator().compare(candidate, currentBest) < 0) {
            return candidate;
        }
        return currentBest;
    }

    private static int sharedDoorRouteScore(
            DoorSegment chosenDoor,
            DoorSegment reverseDoor,
            DungeonRoom room,
            DungeonRoom connectedRoom
    ) {
        return manhattan(room.componentAnchor(), chosenDoor.roomCell())
                + manhattan(connectedRoom.componentAnchor(), reverseDoor.roomCell());
    }

    private static int sharedDoorAnchorTieBreaker(
            DoorSegment chosenDoor,
            DoorSegment reverseDoor,
            DungeonRoom room,
            DungeonRoom connectedRoom
    ) {
        return manhattan(chosenDoor.roomCell(), connectedRoom.componentAnchor())
                + manhattan(reverseDoor.roomCell(), room.componentAnchor());
    }

    private static int corridorJoinRouteScore(ExitCandidate roomExit, List<Point2i> path, DungeonRoom room) {
        return manhattan(room.componentAnchor(), roomExit.roomCell())
                + pathLength(path);
    }

    private static int corridorJoinAnchorTieBreaker(ExitCandidate roomExit, Point2i corridorCell) {
        return manhattan(roomExit.roomCell(), corridorCell);
    }

    private static int freshPathRouteScore(
            ExitCandidate roomExit,
            ExitCandidate targetExit,
            List<Point2i> path,
            DungeonRoom room,
            DungeonRoom targetRoom
    ) {
        return manhattan(room.componentAnchor(), roomExit.roomCell())
                + pathLength(path)
                + manhattan(targetRoom.componentAnchor(), targetExit.roomCell());
    }

    private static int freshPathAnchorTieBreaker(
            ExitCandidate roomExit,
            ExitCandidate targetExit,
            DungeonRoom room,
            DungeonRoom targetRoom
    ) {
        return manhattan(roomExit.roomCell(), targetRoom.componentAnchor())
                + manhattan(targetExit.roomCell(), room.componentAnchor());
    }

    private static int pathLength(List<Point2i> path) {
        return Math.max(0, path.size() - 1);
    }

    private static boolean sameDoorSegment(DoorSegment left, DoorSegment right) {
        return (left.start().equals(right.start()) && left.end().equals(right.end()))
                || (left.start().equals(right.end()) && left.end().equals(right.start()));
    }

    private static List<DoorSegment> sharedDoors(
            Set<Point2i> fromCells,
            Set<Point2i> toCells,
            long fromRoomId,
            long toRoomId,
            ResolvedDoorOverride fromOverride,
            ResolvedDoorOverride toOverride
    ) {
        List<DoorSegment> result = new ArrayList<>();
        for (Point2i cell : fromCells) {
            for (Point2i direction : CARDINAL_NEIGHBORS) {
                Point2i neighbor = cell.add(direction);
                if (!toCells.contains(neighbor)) {
                    continue;
                }
                DoorSegment fromDoor = doorFor(cell, direction, fromRoomId);
                DoorSegment toDoor = doorFor(neighbor, new Point2i(-direction.x(), -direction.y()), toRoomId);
                if (!matchesOverride(fromDoor, fromOverride) || !matchesOverride(toDoor, toOverride)) {
                    continue;
                }
                result.add(fromDoor);
                result.add(toDoor);
            }
        }
        return result;
    }

    private static List<ExitCandidate> exposedExits(
            Set<Point2i> roomCells,
            Map<Point2i, Long> roomOccupancy,
            long roomId,
            ResolvedDoorOverride override
    ) {
        List<ExitCandidate> result = new ArrayList<>();
        for (Point2i cell : roomCells) {
            for (Point2i direction : CARDINAL_NEIGHBORS) {
                Point2i outside = cell.add(direction);
                if (roomCells.contains(outside)) {
                    continue;
                }
                if (roomOccupancy.containsKey(outside)) {
                    continue;
                }
                DoorSegment door = doorFor(cell, direction, roomId);
                if (!matchesOverride(door, override)) {
                    continue;
                }
                result.add(new ExitCandidate(cell, outside, direction, door));
            }
        }
        // Exit ordering is only a deterministic fallback after the anchor-aware connection scoring.
        result.sort(Comparator
                .comparingInt((ExitCandidate candidate) -> candidate.outsideCell().x())
                .thenComparingInt(candidate -> candidate.outsideCell().y())
                .thenComparingInt(candidate -> candidate.direction().x())
                .thenComparingInt(candidate -> candidate.direction().y()));
        return result;
    }

    private static ResolvedDoorOverride resolveDoorOverride(DungeonLayout layout, DungeonCorridor corridor, DungeonRoom room) {
        if (layout == null || corridor == null || room == null || room.roomId() == null) {
            return null;
        }
        return corridor.doorOverrides().stream()
                .filter(override -> override.roomId() == room.roomId())
                .filter(override -> override.clusterId() == room.clusterId())
                .map(override -> {
                    DungeonRoomCluster cluster = layout.clusterById(override.clusterId());
                    if (cluster == null) {
                        return null;
                    }
                    return new ResolvedDoorOverride(override.absoluteCell(cluster.center()), override.edgeDirection());
                })
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private static boolean matchesOverride(DoorSegment door, ResolvedDoorOverride override) {
        if (override == null || door == null) {
            return true;
        }
        return door.roomCell().equals(override.absoluteCell())
                && directionForDoor(door).equals(override.edgeDirection().delta());
    }

    private static List<Point2i> resolveWaypointCells(DungeonLayout layout, DungeonCorridor corridor) {
        if (layout == null || corridor == null || corridor.waypoints().isEmpty()) {
            return List.of();
        }
        List<Point2i> result = new ArrayList<>();
        for (CorridorWaypoint waypoint : corridor.waypoints()) {
            DungeonRoomCluster cluster = layout.clusterById(waypoint.clusterId());
            if (cluster == null) {
                continue;
            }
            result.add(waypoint.absoluteCell(cluster.center()));
        }
        return List.copyOf(result);
    }

    private static ConnectionCandidate bestPathFromRoomToTargets(
            DungeonRoom room,
            Set<Point2i> roomCells,
            Map<Point2i, Long> roomOccupancy,
            List<Point2i> targets,
            boolean joinedExistingCorridor,
            ResolvedDoorOverride override
    ) {
        List<ExitCandidate> roomExits = exposedExits(roomCells, roomOccupancy, room.roomId(), override);
        ConnectionCandidate best = null;
        for (ExitCandidate roomExit : roomExits) {
            List<Point2i> path = pathThroughPoints(roomExit.outsideCell(), targets, roomOccupancy);
            if (path.isEmpty() && !targets.isEmpty() && !roomExit.outsideCell().equals(targets.get(0))) {
                continue;
            }
            ConnectionCandidate candidate = new ConnectionCandidate(
                    room.roomId(),
                    path,
                    List.of(roomExit.door()),
                    joinedExistingCorridor,
                    corridorJoinRouteScore(roomExit, path, room),
                    room.componentAnchor().x() + room.componentAnchor().y(),
                    null);
            best = bestCandidate(best, candidate);
        }
        return best;
    }

    private static List<Point2i> append(List<Point2i> points, Point2i last) {
        List<Point2i> result = new ArrayList<>(points);
        result.add(last);
        return List.copyOf(result);
    }

    private static List<Point2i> pathThroughPoints(Point2i start, List<Point2i> targets, Map<Point2i, Long> roomOccupancy) {
        if (targets == null || targets.isEmpty()) {
            return List.of();
        }
        List<Point2i> result = new ArrayList<>();
        Point2i current = start;
        for (Point2i target : targets) {
            if (target == null) {
                continue;
            }
            if (current.equals(target)) {
                if (result.isEmpty()) {
                    result.add(current);
                }
                continue;
            }
            List<Point2i> leg = shortestPath(current, target, roomOccupancy);
            if (leg.isEmpty()) {
                return List.of();
            }
            if (result.isEmpty()) {
                result.addAll(leg);
            } else {
                result.addAll(leg.subList(1, leg.size()));
            }
            current = target;
        }
        return List.copyOf(result);
    }

    static Point2i directionForDoor(DoorSegment door) {
        if (door.start().x() == door.end().x()) {
            return door.roomCell().x() < door.start().x()
                    ? new Point2i(1, 0)
                    : new Point2i(-1, 0);
        }
        return door.roomCell().y() < door.start().y()
                ? new Point2i(0, 1)
                : new Point2i(0, -1);
    }

    static Point2i outsideCellForDoor(DoorSegment door) {
        return door.roomCell().add(directionForDoor(door));
    }

    private static DoorSegment doorFor(Point2i cell, Point2i direction, long roomId) {
        if (direction.x() == 1) {
            return new DoorSegment(new Point2i(cell.x() + 1, cell.y()), new Point2i(cell.x() + 1, cell.y() + 1), roomId, cell);
        }
        if (direction.x() == -1) {
            return new DoorSegment(new Point2i(cell.x(), cell.y()), new Point2i(cell.x(), cell.y() + 1), roomId, cell);
        }
        if (direction.y() == 1) {
            return new DoorSegment(new Point2i(cell.x(), cell.y() + 1), new Point2i(cell.x() + 1, cell.y() + 1), roomId, cell);
        }
        return new DoorSegment(new Point2i(cell.x(), cell.y()), new Point2i(cell.x() + 1, cell.y()), roomId, cell);
    }

    static List<GridSegment> segmentsForPath(List<Point2i> path) {
        if (path.size() < 2) {
            return List.of();
        }
        List<GridSegment> result = new ArrayList<>();
        for (int i = 1; i < path.size(); i++) {
            result.add(new GridSegment(path.get(i - 1), path.get(i)));
        }
        return List.copyOf(result);
    }

    private static List<Point2i> shortestPath(
            Point2i start,
            Point2i goal,
            Map<Point2i, Long> roomOccupancy
    ) {
        if (roomOccupancy.containsKey(start) || roomOccupancy.containsKey(goal)) {
            return List.of();
        }
        int padding = 6;
        int minX = Math.min(start.x(), goal.x()) - padding;
        int maxX = Math.max(start.x(), goal.x()) + padding;
        int minY = Math.min(start.y(), goal.y()) - padding;
        int maxY = Math.max(start.y(), goal.y()) + padding;
        for (Point2i point : roomOccupancy.keySet()) {
            minX = Math.min(minX, point.x() - 2);
            maxX = Math.max(maxX, point.x() + 2);
            minY = Math.min(minY, point.y() - 2);
            maxY = Math.max(maxY, point.y() + 2);
        }

        PathBounds bounds = new PathBounds(minX, maxX, minY, maxY);
        int shortestDistance = shortestDistance(start, goal, roomOccupancy, bounds);
        if (shortestDistance < 0) {
            return List.of();
        }
        int maxAllowedDistance = shortestDistance + toleratedExtraDistance(shortestDistance);

        record QueueNode(PathStep step, int corners) {}
        PriorityQueue<QueueNode> open = new PriorityQueue<>(Comparator
                .comparingInt(QueueNode::corners)
                .thenComparingInt(node -> node.step().distance())
                .thenComparingInt(node -> manhattan(node.step().point(), goal)));
        Map<PathStep, Integer> bestCornersByStep = new HashMap<>();
        Map<PathStep, PathStep> previous = new HashMap<>();
        PathStep startStep = new PathStep(start, -1, 0);
        open.add(new QueueNode(startStep, 0));
        bestCornersByStep.put(startStep, 0);

        PathStep bestGoalStep = null;
        PathScore bestGoalScore = null;
        while (!open.isEmpty()) {
            QueueNode node = open.poll();
            Integer currentCorners = bestCornersByStep.get(node.step());
            if (currentCorners == null || currentCorners != node.corners()) {
                continue;
            }
            PathScore currentScore = new PathScore(node.step().distance(), node.corners());
            if (node.step().point().equals(goal)) {
                if (bestGoalScore == null || currentScore.compareTo(bestGoalScore) < 0) {
                    bestGoalStep = node.step();
                    bestGoalScore = currentScore;
                }
                continue;
            }
            for (int directionIndex = 0; directionIndex < CARDINAL_NEIGHBORS.size(); directionIndex++) {
                Point2i direction = CARDINAL_NEIGHBORS.get(directionIndex);
                Point2i next = node.step().point().add(direction);
                if (!bounds.contains(next) || roomOccupancy.containsKey(next)) {
                    continue;
                }
                int nextDistance = node.step().distance() + 1;
                if (nextDistance > maxAllowedDistance || nextDistance + manhattan(next, goal) > maxAllowedDistance) {
                    continue;
                }
                int nextCorners = node.step().directionIndex() < 0 || node.step().directionIndex() == directionIndex
                        ? node.corners()
                        : node.corners() + 1;
                PathStep nextStep = new PathStep(next, directionIndex, nextDistance);
                Integer bestKnownCorners = bestCornersByStep.get(nextStep);
                if (bestKnownCorners != null && bestKnownCorners <= nextCorners) {
                    continue;
                }
                bestCornersByStep.put(nextStep, nextCorners);
                previous.put(nextStep, node.step());
                open.add(new QueueNode(nextStep, nextCorners));
            }
        }
        return bestGoalStep == null ? List.of() : reconstructPath(bestGoalStep, previous);
    }

    private static int shortestDistance(
            Point2i start,
            Point2i goal,
            Map<Point2i, Long> roomOccupancy,
            PathBounds bounds
    ) {
        record Node(Point2i point, int cost, int priority) {}
        PriorityQueue<Node> open = new PriorityQueue<>(Comparator.comparingInt(Node::priority));
        Map<Point2i, Integer> costByPoint = new HashMap<>();
        open.add(new Node(start, 0, manhattan(start, goal)));
        costByPoint.put(start, 0);

        while (!open.isEmpty()) {
            Node node = open.poll();
            if (node.point().equals(goal)) {
                return node.cost();
            }
            for (Point2i direction : CARDINAL_NEIGHBORS) {
                Point2i next = node.point().add(direction);
                if (!bounds.contains(next) || roomOccupancy.containsKey(next)) {
                    continue;
                }
                int nextCost = node.cost() + 1;
                Integer existing = costByPoint.get(next);
                if (existing != null && existing <= nextCost) {
                    continue;
                }
                costByPoint.put(next, nextCost);
                open.add(new Node(next, nextCost, nextCost + manhattan(next, goal)));
            }
        }

        return -1;
    }

    private static int manhattan(Point2i a, Point2i b) {
        return Math.abs(a.x() - b.x()) + Math.abs(a.y() - b.y());
    }

    private static int toleratedExtraDistance(int shortestDistance) {
        if (shortestDistance <= 0) {
            return 0;
        }
        return Math.max(1, (int) Math.ceil(shortestDistance * 0.10d));
    }

    private static int cornerCount(List<Point2i> path) {
        if (path == null || path.size() < 3) {
            return 0;
        }
        int corners = 0;
        Point2i previousDirection = path.get(1).subtract(path.get(0));
        for (int i = 2; i < path.size(); i++) {
            Point2i direction = path.get(i).subtract(path.get(i - 1));
            if (!direction.equals(previousDirection)) {
                corners++;
            }
            previousDirection = direction;
        }
        return corners;
    }

    private static List<Point2i> reconstructPath(PathStep goalStep, Map<PathStep, PathStep> previous) {
        ArrayDeque<Point2i> path = new ArrayDeque<>();
        PathStep cursor = goalStep;
        path.addFirst(cursor.point());
        while (previous.containsKey(cursor)) {
            cursor = previous.get(cursor);
            path.addFirst(cursor.point());
        }
        return List.copyOf(path);
    }

    private static Map<Long, DungeonRoom> roomsById(List<DungeonRoom> rooms) {
        Map<Long, DungeonRoom> result = new HashMap<>();
        for (DungeonRoom room : rooms) {
            if (room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return result;
    }

    private record ExitCandidate(
            Point2i roomCell,
            Point2i outsideCell,
            Point2i direction,
            DoorSegment door
    ) {
    }

    private record ConnectionCandidate(
            long roomId,
            List<Point2i> path,
            List<DoorSegment> doors,
            boolean joinedExistingCorridor,
            int routeScore,
            int anchorTieBreaker,
            CorridorNetworkScore networkScore
    ) {
        private ConnectionCandidate withNetworkScore(CorridorNetworkScore score) {
            return new ConnectionCandidate(roomId, path, doors, joinedExistingCorridor, routeScore, anchorTieBreaker, score);
        }
    }

    private record ResolvedDoorOverride(
            Point2i absoluteCell,
            DungeonRoomCluster.EdgeDirection edgeDirection
    ) {
    }

    private record CorridorBuildState(
            Set<Point2i> corridorCells,
            Set<GridSegment> segments,
            Set<DoorSegment> doors,
            boolean directlyAdjacentOnly,
            Set<Long> connectedRoomIds,
            CorridorNetworkScore networkScore
    ) {
        private int connectedRoomCount() {
            return connectedRoomIds.size();
        }
    }

    private record PathPreference(
            int length,
            int corners
    ) implements Comparable<PathPreference> {
        @Override
        public int compareTo(PathPreference other) {
            int shorter = Math.min(length, other.length);
            int toleratedDifference = toleratedExtraDistance(shorter);
            if (Math.abs(length - other.length) <= toleratedDifference && corners != other.corners) {
                return Integer.compare(corners, other.corners);
            }
            int lengthComparison = Integer.compare(length, other.length);
            if (lengthComparison != 0) {
                return lengthComparison;
            }
            return Integer.compare(corners, other.corners);
        }
    }

    private record PathScore(
            int distance,
            int corners
    ) implements Comparable<PathScore> {
        @Override
        public int compareTo(PathScore other) {
            int cornerComparison = Integer.compare(corners, other.corners);
            if (cornerComparison != 0) {
                return cornerComparison;
            }
            return Integer.compare(distance, other.distance);
        }
    }

    private record PathBounds(
            int minX,
            int maxX,
            int minY,
            int maxY
    ) {
        private boolean contains(Point2i point) {
            return point.x() >= minX && point.x() <= maxX && point.y() >= minY && point.y() <= maxY;
        }
    }

    private record PathStep(
            Point2i point,
            int directionIndex,
            int distance
    ) {
    }

    private record DoorKey(Point2i start, Point2i end) {
    }

    public record LayoutContext(
            Map<Long, DungeonRoom> roomsById,
            Map<Long, Set<Point2i>> roomCellsById,
            Map<Point2i, Long> roomOccupancy
    ) {
    }
}
