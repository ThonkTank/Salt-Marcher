package features.world.dungeonmap.corridors.model;

import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.ConnectionCandidate;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.CorridorPlanningContext;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.CorridorPlanningOrdering;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.ExitCandidate;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.ResolvedDoorOverride;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class CorridorConnectionCandidateFactory {

    private CorridorConnectionCandidateFactory() {
        throw new AssertionError("No instances");
    }

    static List<ConnectionCandidate> connectionCandidates(
            CorridorPlanningContext context,
            DungeonRoom room,
            Set<Long> connectedRoomIds,
            Set<Point2i> corridorCells
    ) {
        // Explicit door overrides stay pinned. Rooms without overrides may change exits whenever recompute finds
        // a shorter shared network.
        List<ExitCandidate> roomExits = exposedExits(
                context.roomCells(room.roomId()),
                context.roomOccupancy(),
                room.roomId(),
                context.doorOverride(room));
        List<ConnectionCandidate> candidates = new ArrayList<>();
        if (context.waypointCells().isEmpty() && context.totalRoomCount() <= 2) {
            // Shared doors are only valid for pure room-pair corridors. Once a corridor spans 3+ rooms,
            // every attachment must stay in one continuous corridor component instead of chaining through room interiors.
            candidates.addAll(sharedDoorCandidates(context, room, connectedRoomIds));
        }
        candidates.addAll(corridorJoinCandidates(room, corridorCells, context.roomOccupancy(), roomExits));
        candidates.addAll(freshPathCandidates(context, room, connectedRoomIds, roomExits));
        return List.copyOf(candidates);
    }

    static ConnectionCandidate bestPathFromRoomToTargets(
            CorridorPlanningContext context,
            DungeonRoom room,
            List<Point2i> targets,
            boolean joinedExistingCorridor
    ) {
        List<ExitCandidate> roomExits = exposedExits(
                context.roomCells(room.roomId()),
                context.roomOccupancy(),
                room.roomId(),
                context.doorOverride(room));
        ConnectionCandidate best = null;
        for (ExitCandidate roomExit : roomExits) {
            List<Point2i> path = CorridorPathfinder.pathThroughPoints(roomExit.outsideCell(), targets, context.roomOccupancy());
            if (path.isEmpty() && !targets.isEmpty() && !roomExit.outsideCell().equals(targets.getFirst())) {
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
            best = CorridorPlanningOrdering.betterCandidate(best, candidate);
        }
        return best;
    }

    private static List<ConnectionCandidate> sharedDoorCandidates(
            CorridorPlanningContext context,
            DungeonRoom room,
            Set<Long> connectedRoomIds
    ) {
        List<ConnectionCandidate> candidates = new ArrayList<>();
        for (Long connectedRoomId : connectedRoomIds) {
            DungeonRoom connectedRoom = context.roomsById().get(connectedRoomId);
            if (connectedRoom == null) {
                continue;
            }
            List<DoorSegment> sharedDoors = sharedDoors(
                    context.roomCells(room.roomId()),
                    context.roomCells(connectedRoomId),
                    room.roomId(),
                    connectedRoomId,
                    context.doorOverride(room),
                    context.doorOverride(connectedRoom));
            if (sharedDoors.isEmpty()) {
                continue;
            }
            for (DoorSegment chosenDoor : sharedDoors) {
                if (chosenDoor.roomId() != room.roomId()) {
                    continue;
                }
                DoorSegment reverseDoor = sharedDoors.stream()
                        .filter(door -> door.roomId() == connectedRoomId)
                        .filter(door -> CorridorRouteGeometry.sameDoorSegment(door, chosenDoor))
                        .findFirst()
                        .orElse(null);
                if (reverseDoor == null) {
                    continue;
                }
                ExitCandidate sourceExit = new ExitCandidate(chosenDoor.roomCell(), null, null, chosenDoor);
                ExitCandidate targetExit = new ExitCandidate(reverseDoor.roomCell(), null, null, reverseDoor);
                candidates.add(new ConnectionCandidate(
                        room.roomId(),
                        List.of(),
                        List.of(chosenDoor, reverseDoor),
                        true,
                        routeScore(room, sourceExit, List.of(), connectedRoom, targetExit),
                        anchorTieBreaker(sourceExit, targetExit, room, connectedRoom),
                        null));
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
                List<Point2i> path = CorridorPathfinder.pathThroughPoints(roomExit.outsideCell(), List.of(corridorCell), roomOccupancy);
                if (path.isEmpty() && !roomExit.outsideCell().equals(corridorCell)) {
                    continue;
                }
                candidates.add(new ConnectionCandidate(
                        room.roomId(),
                        path,
                        List.of(roomExit.door()),
                        true,
                        corridorJoinRouteScore(roomExit, path, room),
                        corridorJoinAnchorTieBreaker(roomExit, corridorCell),
                        null));
            }
        }
        return List.copyOf(candidates);
    }

    private static List<ConnectionCandidate> freshPathCandidates(
            CorridorPlanningContext context,
            DungeonRoom room,
            Set<Long> connectedRoomIds,
            List<ExitCandidate> roomExits
    ) {
        List<ConnectionCandidate> candidates = new ArrayList<>();
        List<ExitCandidate> connectedRoomExits = new ArrayList<>();
        for (Long connectedRoomId : connectedRoomIds) {
            DungeonRoom connectedRoom = context.roomsById().get(connectedRoomId);
            if (connectedRoom == null) {
                continue;
            }
            connectedRoomExits.addAll(exposedExits(
                    context.roomCells(connectedRoomId),
                    context.roomOccupancy(),
                    connectedRoomId,
                    context.doorOverride(connectedRoom)));
        }
        for (ExitCandidate roomExit : roomExits) {
            for (ExitCandidate targetExit : connectedRoomExits) {
                List<Point2i> targets = context.waypointCells().isEmpty()
                        ? List.of(targetExit.outsideCell())
                        : append(context.waypointCells(), targetExit.outsideCell());
                List<Point2i> path = CorridorPathfinder.pathThroughPoints(roomExit.outsideCell(), targets, context.roomOccupancy());
                if (path.isEmpty() && !roomExit.outsideCell().equals(targetExit.outsideCell())) {
                    continue;
                }
                DungeonRoom targetRoom = context.roomsById().get(targetExit.door().roomId());
                if (targetRoom == null) {
                    continue;
                }
                candidates.add(new ConnectionCandidate(
                        room.roomId(),
                        path,
                        List.of(roomExit.door(), targetExit.door()),
                        false,
                        routeScore(room, roomExit, path, targetRoom, targetExit),
                        anchorTieBreaker(roomExit, targetExit, room, targetRoom),
                        null));
            }
        }
        return List.copyOf(candidates);
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
            for (Point2i direction : CorridorRouteGeometry.CARDINAL_NEIGHBORS) {
                Point2i neighbor = cell.add(direction);
                if (!toCells.contains(neighbor)) {
                    continue;
                }
                DoorSegment fromDoor = CorridorRouteGeometry.doorFor(cell, direction, fromRoomId);
                DoorSegment toDoor = CorridorRouteGeometry.doorFor(neighbor, new Point2i(-direction.x(), -direction.y()), toRoomId);
                if (!CorridorPlanningResolver.matchesOverride(fromDoor, fromOverride)
                        || !CorridorPlanningResolver.matchesOverride(toDoor, toOverride)) {
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
            for (Point2i direction : CorridorRouteGeometry.CARDINAL_NEIGHBORS) {
                Point2i outside = cell.add(direction);
                if (roomCells.contains(outside)) {
                    continue;
                }
                if (roomOccupancy.containsKey(outside)) {
                    continue;
                }
                DoorSegment door = CorridorRouteGeometry.doorFor(cell, direction, roomId);
                if (!CorridorPlanningResolver.matchesOverride(door, override)) {
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

    private static int routeScore(
            DungeonRoom sourceRoom,
            ExitCandidate sourceExit,
            List<Point2i> path,
            DungeonRoom targetRoom,
            ExitCandidate targetExit
    ) {
        return CorridorPathfinder.manhattan(sourceRoom.componentAnchor(), sourceExit.roomCell())
                + CorridorPathfinder.pathLength(path)
                + CorridorPathfinder.manhattan(targetRoom.componentAnchor(), targetExit.roomCell());
    }

    private static int anchorTieBreaker(
            ExitCandidate sourceExit,
            ExitCandidate targetExit,
            DungeonRoom sourceRoom,
            DungeonRoom targetRoom
    ) {
        return CorridorPathfinder.manhattan(sourceExit.roomCell(), targetRoom.componentAnchor())
                + CorridorPathfinder.manhattan(targetExit.roomCell(), sourceRoom.componentAnchor());
    }

    private static int corridorJoinRouteScore(ExitCandidate roomExit, List<Point2i> path, DungeonRoom room) {
        return CorridorPathfinder.manhattan(room.componentAnchor(), roomExit.roomCell())
                + CorridorPathfinder.pathLength(path);
    }

    private static int corridorJoinAnchorTieBreaker(ExitCandidate roomExit, Point2i corridorCell) {
        return CorridorPathfinder.manhattan(roomExit.roomCell(), corridorCell);
    }

    private static List<Point2i> append(List<Point2i> points, Point2i last) {
        List<Point2i> result = new ArrayList<>(points);
        result.add(last);
        return List.copyOf(result);
    }
}
