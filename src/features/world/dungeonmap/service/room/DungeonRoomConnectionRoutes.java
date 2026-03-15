package features.world.dungeonmap.service.room;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonConnectionPoint;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonRoomNodeKey;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.projection.DungeonMapConnectionPath;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.projection.index.DungeonMapIndex;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public final class DungeonRoomConnectionRoutes {

    private DungeonRoomConnectionRoutes() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonMapConnectionPath> projectConnections(DungeonMapState state) {
        if (state == null || state.map() == null || state.index() == null) {
            return List.of();
        }
        Map<Long, List<DungeonConnectionPoint>> pointsByConnectionId = pointsByConnectionId(state.connectionPoints());
        List<DungeonMapConnectionPath> result = new ArrayList<>();
        for (DungeonConnection connection : state.connections()) {
            projectConnection(state.map(), state.index(), connection, pointsByConnectionId.getOrDefault(connection.connectionId(), List.of()))
                    .ifPresent(result::add);
        }
        return List.copyOf(result);
    }

    public static Optional<DungeonMapConnectionPath> projectConnection(
            DungeonMap map,
            DungeonMapIndex index,
            DungeonConnection connection,
            List<DungeonConnectionPoint> controlPoints
    ) {
        if (map == null || index == null || connection == null) {
            return Optional.empty();
        }
        Long fromRoomId = roomIdFromNodeKey(connection.leftNodeKey());
        Long toRoomId = roomIdFromNodeKey(connection.rightNodeKey());
        if (fromRoomId == null || toRoomId == null) {
            return Optional.empty();
        }
        DungeonRoom fromRoom = index.findRoom(fromRoomId);
        DungeonRoom toRoom = index.findRoom(toRoomId);
        if (fromRoom == null || toRoom == null) {
            return Optional.empty();
        }
        List<DungeonConnectionPoint> normalizedControlPoints = normalizeControlPoints(connection.connectionId(), controlPoints);
        List<DungeonMapConnectionPath.GridPoint> route = buildRoute(map, index, fromRoom, toRoom, normalizedControlPoints);
        if (route.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new DungeonMapConnectionPath(
                connection.connectionId(),
                fromRoomId,
                toRoomId,
                List.copyOf(route),
                List.copyOf(normalizedControlPoints),
                normalizedControlPoints.isEmpty() && route.size() == 2));
    }

    public static Long roomIdFromNodeKey(String nodeKey) {
        if (!DungeonRoomNodeKey.isRoom(nodeKey)) {
            return null;
        }
        try {
            return DungeonRoomNodeKey.roomId(nodeKey);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    public static List<DungeonConnectionPoint> normalizeControlPoints(Long connectionId, List<DungeonConnectionPoint> points) {
        if (connectionId == null) {
            return List.of();
        }
        List<DungeonConnectionPoint> normalized = new ArrayList<>();
        int sortOrder = 0;
        for (DungeonConnectionPoint point : points == null ? List.<DungeonConnectionPoint>of() : points) {
            if (point == null) {
                continue;
            }
            normalized.add(new DungeonConnectionPoint(null, connectionId, sortOrder, point.x(), point.y()));
            sortOrder += 1;
        }
        return List.copyOf(normalized);
    }

    private static Map<Long, List<DungeonConnectionPoint>> pointsByConnectionId(List<DungeonConnectionPoint> points) {
        Map<Long, List<DungeonConnectionPoint>> result = new LinkedHashMap<>();
        for (DungeonConnectionPoint point : points == null ? List.<DungeonConnectionPoint>of() : points) {
            if (point == null || point.connectionId() == null) {
                continue;
            }
            result.computeIfAbsent(point.connectionId(), ignored -> new ArrayList<>()).add(point);
        }
        for (List<DungeonConnectionPoint> connectionPoints : result.values()) {
            connectionPoints.sort(Comparator.comparingInt(DungeonConnectionPoint::sortOrder));
        }
        return result;
    }

    private static List<DungeonMapConnectionPath.GridPoint> buildRoute(
            DungeonMap map,
            DungeonMapIndex index,
            DungeonRoom fromRoom,
            DungeonRoom toRoom,
            List<DungeonConnectionPoint> controlPoints
    ) {
        List<DungeonSquare> fromSquares = index.squaresForRoom(fromRoom.roomId());
        List<DungeonSquare> toSquares = index.squaresForRoom(toRoom.roomId());
        if (fromSquares.isEmpty() || toSquares.isEmpty()) {
            return List.of();
        }
        RoomAdjacency directDoor = findDirectDoor(fromSquares, toSquares);
        if (directDoor != null && controlPoints.isEmpty()) {
            return List.of(centerPoint(directDoor.sourceSquare()), centerPoint(directDoor.targetSquare()));
        }

        List<DungeonMapConnectionPath.GridPoint> route = new ArrayList<>();
        SegmentStart currentStart = SegmentStart.room(fromSquares);
        for (DungeonConnectionPoint controlPoint : controlPoints) {
            SegmentRoute segment = routeSegment(map, index, currentStart, SegmentTarget.point(controlPoint.x(), controlPoint.y()));
            if (segment == null) {
                return List.of();
            }
            appendSegment(route, segment.points());
            currentStart = SegmentStart.point(controlPoint.x(), controlPoint.y());
        }
        SegmentRoute finalSegment = routeSegment(map, index, currentStart, SegmentTarget.room(toSquares));
        if (finalSegment == null) {
            return List.of();
        }
        appendSegment(route, finalSegment.points());
        return List.copyOf(route);
    }

    private static void appendSegment(List<DungeonMapConnectionPath.GridPoint> route, List<DungeonMapConnectionPath.GridPoint> segment) {
        if (segment == null || segment.isEmpty()) {
            return;
        }
        if (route.isEmpty()) {
            route.addAll(segment);
            return;
        }
        int startIndex = route.get(route.size() - 1).equals(segment.get(0)) ? 1 : 0;
        for (int index = startIndex; index < segment.size(); index++) {
            route.add(segment.get(index));
        }
    }

    private static SegmentRoute routeSegment(
            DungeonMap map,
            DungeonMapIndex index,
            SegmentStart start,
            SegmentTarget target
    ) {
        if (start.isRoom() && target.isRoom()) {
            RoomAdjacency directDoor = findDirectDoor(start.roomSquares(), target.roomSquares());
            if (directDoor != null) {
                return new SegmentRoute(List.of(centerPoint(directDoor.sourceSquare()), centerPoint(directDoor.targetSquare())));
            }
        }

        List<Candidate> starts = startCandidates(map, index, start);
        List<Candidate> targets = targetCandidates(map, index, target);
        if (starts.isEmpty() || targets.isEmpty()) {
            return null;
        }
        Set<Cell> targetCells = new LinkedHashSet<>();
        Map<Cell, Candidate> targetByCell = new LinkedHashMap<>();
        for (Candidate candidate : targets) {
            targetCells.add(candidate.cell());
            targetByCell.put(candidate.cell(), candidate);
        }

        SegmentSolution best = null;
        for (Candidate startCandidate : starts) {
            PathResult path = findShortestPath(map, index, startCandidate.cell(), targetCells);
            if (path == null) {
                continue;
            }
            Candidate endCandidate = targetByCell.get(path.endCell());
            if (endCandidate == null) {
                continue;
            }
            List<DungeonMapConnectionPath.GridPoint> points = new ArrayList<>();
            if (startCandidate.roomSquare() != null) {
                points.add(centerPoint(startCandidate.roomSquare()));
            }
            for (Cell cell : path.cells()) {
                points.add(centerPoint(cell.x(), cell.y()));
            }
            if (endCandidate.roomSquare() != null) {
                points.add(centerPoint(endCandidate.roomSquare()));
            }
            SegmentSolution candidate = new SegmentSolution(points, path.cells().size());
            if (best == null || candidate.pathLength() < best.pathLength()) {
                best = candidate;
            }
        }
        return best == null ? null : new SegmentRoute(best.points());
    }

    private static List<Candidate> startCandidates(DungeonMap map, DungeonMapIndex index, SegmentStart start) {
        if (!start.isRoom()) {
            return List.of(new Candidate(new Cell(start.pointX(), start.pointY()), null));
        }
        return roomExitCandidates(map, index, start.roomSquares());
    }

    private static List<Candidate> targetCandidates(DungeonMap map, DungeonMapIndex index, SegmentTarget target) {
        if (!target.isRoom()) {
            return List.of(new Candidate(new Cell(target.pointX(), target.pointY()), null));
        }
        return roomExitCandidates(map, index, target.roomSquares());
    }

    private static List<Candidate> roomExitCandidates(DungeonMap map, DungeonMapIndex index, List<DungeonSquare> roomSquares) {
        List<Candidate> result = new ArrayList<>();
        Set<Cell> seen = new LinkedHashSet<>();
        for (DungeonSquare roomSquare : roomSquares) {
            addExitCandidate(result, seen, map, index, roomSquare, roomSquare.x() + 1, roomSquare.y());
            addExitCandidate(result, seen, map, index, roomSquare, roomSquare.x() - 1, roomSquare.y());
            addExitCandidate(result, seen, map, index, roomSquare, roomSquare.x(), roomSquare.y() + 1);
            addExitCandidate(result, seen, map, index, roomSquare, roomSquare.x(), roomSquare.y() - 1);
        }
        return result;
    }

    private static void addExitCandidate(
            List<Candidate> result,
            Set<Cell> seen,
            DungeonMap map,
            DungeonMapIndex index,
            DungeonSquare roomSquare,
            int x,
            int y
    ) {
        if (!withinBounds(map, x, y) || index.squareAt(x, y) != null) {
            return;
        }
        Cell cell = new Cell(x, y);
        if (seen.add(cell)) {
            result.add(new Candidate(cell, roomSquare));
        }
    }

    private static PathResult findShortestPath(DungeonMap map, DungeonMapIndex index, Cell start, Set<Cell> targets) {
        if (!withinBounds(map, start.x(), start.y()) || !isWalkable(index, start.x(), start.y())) {
            return null;
        }
        Deque<Cell> queue = new ArrayDeque<>();
        Map<Cell, Cell> previous = new HashMap<>();
        queue.addLast(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            Cell current = queue.removeFirst();
            if (targets.contains(current)) {
                return new PathResult(current, rebuildPath(previous, current));
            }
            enqueueNeighbor(map, index, current.x() + 1, current.y(), current, queue, previous);
            enqueueNeighbor(map, index, current.x() - 1, current.y(), current, queue, previous);
            enqueueNeighbor(map, index, current.x(), current.y() + 1, current, queue, previous);
            enqueueNeighbor(map, index, current.x(), current.y() - 1, current, queue, previous);
        }
        return null;
    }

    private static void enqueueNeighbor(
            DungeonMap map,
            DungeonMapIndex index,
            int x,
            int y,
            Cell previousCell,
            Deque<Cell> queue,
            Map<Cell, Cell> previous
    ) {
        Cell next = new Cell(x, y);
        if (!withinBounds(map, x, y) || previous.containsKey(next) || !isWalkable(index, x, y)) {
            return;
        }
        previous.put(next, previousCell);
        queue.addLast(next);
    }

    private static boolean isWalkable(DungeonMapIndex index, int x, int y) {
        return index.squareAt(x, y) == null;
    }

    private static List<Cell> rebuildPath(Map<Cell, Cell> previous, Cell end) {
        List<Cell> path = new ArrayList<>();
        Cell current = end;
        while (current != null) {
            path.add(0, current);
            current = previous.get(current);
        }
        return path;
    }

    private static RoomAdjacency findDirectDoor(List<DungeonSquare> sourceSquares, List<DungeonSquare> targetSquares) {
        Map<String, DungeonSquare> targetByCoord = new LinkedHashMap<>();
        for (DungeonSquare targetSquare : targetSquares) {
            targetByCoord.put(coordKey(targetSquare.x(), targetSquare.y()), targetSquare);
        }
        for (DungeonSquare sourceSquare : sourceSquares) {
            DungeonSquare east = targetByCoord.get(coordKey(sourceSquare.x() + 1, sourceSquare.y()));
            if (east != null) {
                return new RoomAdjacency(sourceSquare, east);
            }
            DungeonSquare west = targetByCoord.get(coordKey(sourceSquare.x() - 1, sourceSquare.y()));
            if (west != null) {
                return new RoomAdjacency(sourceSquare, west);
            }
            DungeonSquare south = targetByCoord.get(coordKey(sourceSquare.x(), sourceSquare.y() + 1));
            if (south != null) {
                return new RoomAdjacency(sourceSquare, south);
            }
            DungeonSquare north = targetByCoord.get(coordKey(sourceSquare.x(), sourceSquare.y() - 1));
            if (north != null) {
                return new RoomAdjacency(sourceSquare, north);
            }
        }
        return null;
    }

    private static DungeonMapConnectionPath.GridPoint centerPoint(DungeonSquare square) {
        return centerPoint(square.x(), square.y());
    }

    private static DungeonMapConnectionPath.GridPoint centerPoint(int x, int y) {
        return new DungeonMapConnectionPath.GridPoint(x + 0.5, y + 0.5);
    }

    private static boolean withinBounds(DungeonMap map, int x, int y) {
        return map != null && x >= 0 && y >= 0 && x < map.width() && y < map.height();
    }

    private static String coordKey(int x, int y) {
        return x + ":" + y;
    }

    private record Cell(int x, int y) {
    }

    private record Candidate(Cell cell, DungeonSquare roomSquare) {
    }

    private record PathResult(Cell endCell, List<Cell> cells) {
    }

    private record RoomAdjacency(DungeonSquare sourceSquare, DungeonSquare targetSquare) {
    }

    private record SegmentRoute(List<DungeonMapConnectionPath.GridPoint> points) {
    }

    private record SegmentSolution(List<DungeonMapConnectionPath.GridPoint> points, int pathLength) {
    }

    private record SegmentStart(List<DungeonSquare> roomSquares, Integer pointX, Integer pointY) {
        static SegmentStart room(List<DungeonSquare> roomSquares) {
            return new SegmentStart(roomSquares == null ? List.of() : List.copyOf(roomSquares), null, null);
        }

        static SegmentStart point(int x, int y) {
            return new SegmentStart(List.of(), x, y);
        }

        boolean isRoom() {
            return pointX == null || pointY == null;
        }
    }

    private record SegmentTarget(List<DungeonSquare> roomSquares, Integer pointX, Integer pointY) {
        static SegmentTarget room(List<DungeonSquare> roomSquares) {
            return new SegmentTarget(roomSquares == null ? List.of() : List.copyOf(roomSquares), null, null);
        }

        static SegmentTarget point(int x, int y) {
            return new SegmentTarget(List.of(), x, y);
        }

        boolean isRoom() {
            return pointX == null || pointY == null;
        }
    }
}
