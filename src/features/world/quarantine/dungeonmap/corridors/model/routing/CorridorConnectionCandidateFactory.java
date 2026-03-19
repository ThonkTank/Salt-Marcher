package features.world.quarantine.dungeonmap.corridors.model.routing;

import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.topology.ResolvedDoorOverride;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

final class CorridorConnectionCandidateFactory {

    record SharedDoorPair(DoorSegment sourceDoor, DoorSegment targetDoor) {}

    private CorridorConnectionCandidateFactory() {
        throw new AssertionError("No instances");
    }

    static List<ConnectionCandidate> connectionCandidates(
            CorridorPlanningContext context,
            DungeonRoom room,
            Set<Long> connectedRoomIds,
            Set<Point2i> corridorCells
    ) {
        var candidates = new ArrayList<ConnectionCandidate>();
        candidates.addAll(sharedDoorCandidates(context, room, connectedRoomIds));
        candidates.addAll(corridorJoinCandidates(room, corridorCells, context));
        candidates.addAll(freshPathCandidates(context, room, connectedRoomIds));
        return List.copyOf(candidates);
    }

    static ConnectionCandidate bestPathFromRoomToTargets(
            CorridorPlanningContext context,
            DungeonRoom room,
            List<Point2i> targets,
            boolean joinedExistingCorridor
    ) {
        List<CorridorExitFinder.ExitCandidate> roomExits = CorridorExitFinder.exitCandidatesForRoom(room.roomId(), context);
        ConnectionCandidate best = null;
        for (CorridorExitFinder.ExitCandidate roomExit : roomExits) {
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
        // Shared doors are only valid for pure room-pair corridors. Once a corridor spans 3+ rooms,
        // every attachment must stay in one continuous corridor component instead of chaining through room interiors.
        if (!context.waypointCells().isEmpty() || context.totalRoomCount() > 2) {
            return List.of();
        }
        List<ConnectionCandidate> candidates = new ArrayList<>();
        for (Long connectedRoomId : connectedRoomIds) {
            DungeonRoom connectedRoom = context.roomsById().get(connectedRoomId);
            if (connectedRoom == null) {
                continue;
            }
            for (SharedDoorPair pair : findSharedDoors(room.roomId(), connectedRoomId, context)) {
                candidates.add(buildSharedDoorCandidate(pair.sourceDoor(), pair.targetDoor(), room, connectedRoom));
            }
        }
        return List.copyOf(candidates);
    }

    private static List<SharedDoorPair> findSharedDoors(long roomId, long targetRoomId, CorridorPlanningContext context) {
        DungeonRoom room = context.roomsById().get(roomId);
        DungeonRoom targetRoom = context.roomsById().get(targetRoomId);
        if (room == null || targetRoom == null) {
            return List.of();
        }
        List<DoorSegment> sharedDoors = sharedDoors(
                context.roomCells(roomId),
                context.roomCells(targetRoomId),
                roomId,
                targetRoomId,
                context.doorOverride(room),
                context.doorOverride(targetRoom));
        List<SharedDoorPair> pairs = new ArrayList<>();
        for (DoorSegment chosenDoor : sharedDoors) {
            if (chosenDoor.roomId() != roomId) {
                continue;
            }
            DoorSegment reverseDoor = sharedDoors.stream()
                    .filter(door -> door.roomId() == targetRoomId)
                    .filter(door -> CorridorRouteGeometry.sameDoorSegment(door, chosenDoor))
                    .findFirst()
                    .orElse(null);
            if (reverseDoor != null) {
                pairs.add(new SharedDoorPair(chosenDoor, reverseDoor));
            }
        }
        return pairs;
    }

    private static ConnectionCandidate buildSharedDoorCandidate(
            DoorSegment chosenDoor, DoorSegment reverseDoor, DungeonRoom room, DungeonRoom connectedRoom
    ) {
        CorridorExitFinder.ExitCandidate sourceExit = new CorridorExitFinder.ExitCandidate(chosenDoor.roomCell(), null, null, chosenDoor);
        CorridorExitFinder.ExitCandidate targetExit = new CorridorExitFinder.ExitCandidate(reverseDoor.roomCell(), null, null, reverseDoor);
        return new ConnectionCandidate(
                room.roomId(),
                List.of(),
                List.of(chosenDoor, reverseDoor),
                true,
                routeScore(room, sourceExit, List.of(), connectedRoom, targetExit),
                anchorTieBreaker(sourceExit, targetExit, room, connectedRoom),
                null);
    }

    private static List<ConnectionCandidate> corridorJoinCandidates(
            DungeonRoom room,
            Set<Point2i> corridorCells,
            CorridorPlanningContext context
    ) {
        if (corridorCells.isEmpty()) {
            return List.of();
        }
        List<CorridorExitFinder.ExitCandidate> roomExits = CorridorExitFinder.exitCandidatesForRoom(room.roomId(), context);
        List<ConnectionCandidate> candidates = new ArrayList<>();
        for (CorridorExitFinder.ExitCandidate roomExit : roomExits) {
            for (Point2i corridorCell : corridorCells) {
                List<Point2i> path = CorridorPathfinder.pathThroughPoints(roomExit.outsideCell(), List.of(corridorCell), context.roomOccupancy());
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
            Set<Long> connectedRoomIds
    ) {
        // Explicit door overrides stay pinned. Rooms without overrides may change exits whenever recompute finds
        // a shorter shared network.
        List<CorridorExitFinder.ExitCandidate> roomExits = CorridorExitFinder.exitCandidatesForRoom(room.roomId(), context);
        List<CorridorExitFinder.ExitCandidate> connectedRoomExits = new ArrayList<>();
        for (Long connectedRoomId : connectedRoomIds) {
            connectedRoomExits.addAll(CorridorExitFinder.exitCandidatesForRoom(connectedRoomId, context));
        }
        List<ConnectionCandidate> candidates = new ArrayList<>();
        for (CorridorExitFinder.ExitCandidate roomExit : roomExits) {
            for (CorridorExitFinder.ExitCandidate targetExit : connectedRoomExits) {
                ConnectionCandidate candidate = buildFreshPathCandidate(roomExit, targetExit, room, context);
                if (candidate != null) {
                    candidates.add(candidate);
                }
            }
        }
        return List.copyOf(candidates);
    }

    private static ConnectionCandidate buildFreshPathCandidate(
            CorridorExitFinder.ExitCandidate sourceExit, CorridorExitFinder.ExitCandidate targetExit, DungeonRoom room, CorridorPlanningContext context
    ) {
        List<Point2i> targets = context.waypointCells().isEmpty()
                ? List.of(targetExit.outsideCell())
                : append(context.waypointCells(), targetExit.outsideCell());
        List<Point2i> path = CorridorPathfinder.pathThroughPoints(sourceExit.outsideCell(), targets, context.roomOccupancy());
        if (path.isEmpty() && !sourceExit.outsideCell().equals(targetExit.outsideCell())) {
            return null;
        }
        DungeonRoom targetRoom = context.roomsById().get(targetExit.door().roomId());
        if (targetRoom == null) {
            return null;
        }
        return new ConnectionCandidate(
                room.roomId(),
                path,
                List.of(sourceExit.door(), targetExit.door()),
                false,
                routeScore(room, sourceExit, path, targetRoom, targetExit),
                anchorTieBreaker(sourceExit, targetExit, room, targetRoom),
                null);
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

    private static int routeScore(
            DungeonRoom sourceRoom,
            CorridorExitFinder.ExitCandidate sourceExit,
            List<Point2i> path,
            DungeonRoom targetRoom,
            CorridorExitFinder.ExitCandidate targetExit
    ) {
        return sourceRoom.componentAnchor().distanceTo(sourceExit.roomCell())
                + CorridorPathfinder.pathLength(path)
                + targetRoom.componentAnchor().distanceTo(targetExit.roomCell());
    }

    private static int anchorTieBreaker(
            CorridorExitFinder.ExitCandidate sourceExit,
            CorridorExitFinder.ExitCandidate targetExit,
            DungeonRoom sourceRoom,
            DungeonRoom targetRoom
    ) {
        return sourceExit.roomCell().distanceTo(targetRoom.componentAnchor())
                + targetExit.roomCell().distanceTo(sourceRoom.componentAnchor());
    }

    private static int corridorJoinRouteScore(CorridorExitFinder.ExitCandidate roomExit, List<Point2i> path, DungeonRoom room) {
        return room.componentAnchor().distanceTo(roomExit.roomCell())
                + CorridorPathfinder.pathLength(path);
    }

    private static int corridorJoinAnchorTieBreaker(CorridorExitFinder.ExitCandidate roomExit, Point2i corridorCell) {
        return roomExit.roomCell().distanceTo(corridorCell);
    }

    private static List<Point2i> append(List<Point2i> points, Point2i last) {
        List<Point2i> result = new ArrayList<>(points);
        result.add(last);
        return List.copyOf(result);
    }
}
