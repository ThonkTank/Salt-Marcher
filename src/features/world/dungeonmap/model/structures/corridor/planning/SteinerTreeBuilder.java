package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class SteinerTreeBuilder {

    private SteinerTreeBuilder() {
    }

    static SteinerTree bestTree(PlannerContext context) {
        if (context == null || context.targetRooms().size() < 2) {
            return SteinerTree.empty();
        }
        context.instrumentation().recordTreeBuild();
        if (context.targetRooms().size() == 2) {
            SteinerTree adjacent = directAdjacency(context.targetRooms().get(0), context.targetRooms().get(1), context);
            if (adjacent != null) {
                return adjacent;
            }
        }
        SteinerTree best = bestGreedyTree(context);
        if (best != null && best.connectedRoomIds().size() > 2) {
            best = ripUpAndReroute(best, context);
        }
        if (best != null && best.connectedRoomIds().size() >= 3) {
            best = zelikovskyImprove(best, context);
        }
        return best == null ? SteinerTree.empty() : best;
    }

    private static SteinerTree bestGreedyTree(PlannerContext context) {
        SteinerTree best = null;
        for (Room root : context.targetRooms()) {
            SteinerTree candidate = greedyTree(root, context);
            if (candidate == null || !candidate.isRoutable()) {
                continue;
            }
            if (best == null || candidate.totalCost().compareTo(best.totalCost()) < 0) {
                best = candidate;
            }
        }
        return best;
    }

    private static SteinerTree greedyTree(Room root, PlannerContext context) {
        if (root == null || root.roomId() == null || context.entryCells(root.roomId()).isEmpty()) {
            return null;
        }
        Set<Long> connected = new LinkedHashSet<>();
        Set<CubePoint> treeCells = new LinkedHashSet<>();
        Set<DoorEdge> openings = new LinkedHashSet<>();
        Map<Long, Set<CubePoint>> attachmentCellsByRoomId = new LinkedHashMap<>();
        List<StairPlacement> allStairPlacements = new ArrayList<>();
        connected.add(root.roomId());
        Set<CubePoint> rootEntryCells = context.entryCells(root.roomId());
        WaypointRouteResult waypointRoute = routeThroughWaypoints(treeCells, rootEntryCells, context);
        if (!waypointRoute.success()) {
            return null;
        }
        allStairPlacements.addAll(waypointRoute.stairPlacements());
        CubePoint rootDoorEntry = waypointRoute.rootEntryCell();
        while (connected.size() < context.targetRooms().size()) {
            Set<CubePoint> targets = context.allTargetEntryCells(connected);
            if (targets.isEmpty()) {
                break;
            }
            Map<PathState, RouteCost> floodSources = treeCells.isEmpty()
                    ? zeroSources(rootEntryCells)
                    : zeroSources(treeCells);
            FloodResult flood = CostField.flood(
                    floodSources,
                    context.searchVolume(),
                    targets,
                    context.targetRoomsByEntryCell(targets),
                    context.instrumentation());
            ReachedRoom nearest = findNearestReached(flood, context, connected);
            if (nearest == null) {
                break;
            }
            ExtractedPath extracted = CostField.extractPathWithStairs(flood, nearest.entryCell());
            List<CubePoint> path = extracted.cells();
            if (path.isEmpty()) {
                break;
            }
            if (rootDoorEntry == null && treeCells.isEmpty()) {
                rootDoorEntry = path.getFirst();
            }
            DoorEdge door = deriveDoorEdge(nearest.entryCell(), nearest.room(), context);
            treeCells.addAll(path);
            allStairPlacements.addAll(extracted.stairPlacements());
            if (door != null) {
                openings.add(door);
            }
            attachmentCellsByRoomId.put(nearest.room().roomId(), Set.of(nearest.entryCell()));
            connected.add(nearest.room().roomId());
        }
        addDoorEdge(openings, connected.size() > 1 ? deriveDoorEdge(rootDoorEntry, root, context) : null);
        if (rootDoorEntry != null) {
            attachmentCellsByRoomId.put(root.roomId(), Set.of(rootDoorEntry));
        }
        return new SteinerTree(
                Set.copyOf(connected),
                Set.copyOf(treeCells),
                Set.copyOf(openings),
                Map.copyOf(attachmentCellsByRoomId),
                SteinerTree.scoreCells(treeCells),
                List.copyOf(allStairPlacements));
    }

    private static SteinerTree ripUpAndReroute(SteinerTree tree, PlannerContext context) {
        SteinerTree current = tree;
        boolean improved = true;
        int roundsRemaining = context.targetRooms().size() * 2;
        while (improved && roundsRemaining-- > 0) {
            improved = false;
            for (Room room : context.targetRooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                Set<CubePoint> branch = current.branchCells(room.roomId());
                if (branch.isEmpty()) {
                    continue;
                }
                context.instrumentation().recordRipUpCycle();
                Set<CubePoint> remaining = current.cellsWithout(branch);
                Map<PathState, RouteCost> sources = zeroSources(remaining);
                if (sources.isEmpty()) {
                    continue;
                }
                FloodResult flood = CostField.flood(
                        sources,
                        context.searchVolume(),
                        context.entryCells(room.roomId()),
                        context.targetRoomsByEntryCell(context.entryCells(room.roomId())),
                        context.instrumentation());
                CubePoint bestEntry = bestReachedEntry(flood, context.entryCells(room.roomId()));
                if (bestEntry == null) {
                    continue;
                }
                ExtractedPath extracted = CostField.extractPathWithStairs(flood, bestEntry);
                List<CubePoint> newPath = extracted.cells();
                if (newPath.isEmpty()) {
                    continue;
                }
                if (SteinerTree.scoreCells(newPath).compareTo(SteinerTree.scoreCells(branch)) < 0) {
                    current = current.withReplacedBranch(
                            room.roomId(),
                            branch,
                            newPath,
                            deriveDoorEdge(bestEntry, room, context),
                            replaceStairPlacements(
                                    current.stairPlacements(),
                                    branch,
                                    extracted.stairPlacements()));
                    improved = true;
                }
            }
        }
        return current;
    }

    private static SteinerTree zelikovskyImprove(SteinerTree tree, PlannerContext context) {
        SteinerTree current = tree;
        List<Room> rooms = context.targetRooms();
        boolean improved = true;
        while (improved) {
            improved = false;
            Map<Long, FloodResult> roomFloods = buildRoomFloods(rooms, context);
            for (int first = 0; first < rooms.size(); first++) {
                for (int second = first + 1; second < rooms.size(); second++) {
                    for (int third = second + 1; third < rooms.size(); third++) {
                        Room firstRoom = rooms.get(first);
                        Room secondRoom = rooms.get(second);
                        Room thirdRoom = rooms.get(third);
                        SteinerTree candidate = tryTripleImprovement(
                                current,
                                firstRoom,
                                secondRoom,
                                thirdRoom,
                                roomFloods.get(firstRoom == null ? null : firstRoom.roomId()),
                                roomFloods.get(secondRoom == null ? null : secondRoom.roomId()),
                                roomFloods.get(thirdRoom == null ? null : thirdRoom.roomId()),
                                context);
                        if (candidate != null && candidate.totalCost().compareTo(current.totalCost()) < 0) {
                            current = candidate;
                            improved = true;
                        }
                    }
                }
            }
        }
        return current;
    }

    private static SteinerTree tryTripleImprovement(
            SteinerTree tree,
            Room first,
            Room second,
            Room third,
            FloodResult floodFirst,
            FloodResult floodSecond,
            FloodResult floodThird,
            PlannerContext context
    ) {
        if (tree == null || first == null || second == null || third == null
                || first.roomId() == null || second.roomId() == null || third.roomId() == null
                || floodFirst == null || floodSecond == null || floodThird == null) {
            return null;
        }
        Set<Long> tripleRoomIds = Set.of(first.roomId(), second.roomId(), third.roomId());
        Set<CubePoint> currentSubtree = tree.connectingSubtreeCells(tripleRoomIds);
        if (currentSubtree.isEmpty()) {
            return null;
        }
        Set<CubePoint> boundaryCells = tree.boundaryCells(currentSubtree);
        if (boundaryCells.size() > 1) {
            return null;
        }
        TripleJunctionResult junction = findTripleJunction(
                floodFirst,
                floodSecond,
                floodThird,
                boundaryCells,
                context);
        if (junction == null) {
            return null;
        }
        return buildTripleReplacement(tree, tripleRoomIds, currentSubtree, junction, first, second, third, context);
    }

    private static Map<Long, FloodResult> buildRoomFloods(List<Room> rooms, PlannerContext context) {
        Map<Long, FloodResult> roomFloods = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null || room.roomId() == null || roomFloods.containsKey(room.roomId())) {
                continue;
            }
            roomFloods.put(
                    room.roomId(),
                    CostField.floodFull(
                            zeroSources(context.entryCells(room.roomId())),
                            context.searchVolume(),
                            context.instrumentation()));
        }
        return Map.copyOf(roomFloods);
    }

    private static TripleJunctionResult findTripleJunction(
            FloodResult floodFirst,
            FloodResult floodSecond,
            FloodResult floodThird,
            Set<CubePoint> boundaryCells,
            PlannerContext context
    ) {
        FloodResult floodBoundary = boundaryCells.isEmpty()
                ? null
                : CostField.floodFull(zeroSources(boundaryCells), context.searchVolume(), context.instrumentation());

        CubePoint junction = bestTripleJunction(floodFirst, floodSecond, floodThird, floodBoundary);
        if (junction == null) {
            return null;
        }

        ExtractedPath firstPath = CostField.extractPathWithStairs(floodFirst, junction);
        ExtractedPath secondPath = CostField.extractPathWithStairs(floodSecond, junction);
        ExtractedPath thirdPath = CostField.extractPathWithStairs(floodThird, junction);
        if (firstPath.cells().isEmpty() || secondPath.cells().isEmpty() || thirdPath.cells().isEmpty()) {
            return null;
        }
        ExtractedPath boundaryPath = floodBoundary == null
                ? ExtractedPath.empty()
                : CostField.extractPathWithStairs(floodBoundary, junction);
        List<StairPlacement> stairPlacements = new ArrayList<>();
        stairPlacements.addAll(firstPath.stairPlacements());
        stairPlacements.addAll(secondPath.stairPlacements());
        stairPlacements.addAll(thirdPath.stairPlacements());
        stairPlacements.addAll(boundaryPath.stairPlacements());
        return new TripleJunctionResult(
                junction,
                firstPath.cells(),
                secondPath.cells(),
                thirdPath.cells(),
                boundaryPath.cells(),
                List.copyOf(stairPlacements));
    }

    private static SteinerTree buildTripleReplacement(
            SteinerTree tree,
            Set<Long> tripleRoomIds,
            Set<CubePoint> currentSubtree,
            TripleJunctionResult junction,
            Room first,
            Room second,
            Room third,
            PlannerContext context
    ) {
        Set<CubePoint> replacementCells = new LinkedHashSet<>();
        replacementCells.addAll(junction.firstPath());
        replacementCells.addAll(junction.secondPath());
        replacementCells.addAll(junction.thirdPath());
        replacementCells.addAll(junction.boundaryPath());
        if (SteinerTree.scoreCells(replacementCells).compareTo(SteinerTree.scoreCells(currentSubtree)) >= 0) {
            return null;
        }

        Map<Long, Set<CubePoint>> replacementAttachments = new LinkedHashMap<>();
        replacementAttachments.put(first.roomId(), Set.of(junction.firstPath().getFirst()));
        replacementAttachments.put(second.roomId(), Set.of(junction.secondPath().getFirst()));
        replacementAttachments.put(third.roomId(), Set.of(junction.thirdPath().getFirst()));

        Set<DoorEdge> replacementDoors = new LinkedHashSet<>();
        addDoorEdge(replacementDoors, deriveDoorEdge(junction.firstPath().getFirst(), first, context));
        addDoorEdge(replacementDoors, deriveDoorEdge(junction.secondPath().getFirst(), second, context));
        addDoorEdge(replacementDoors, deriveDoorEdge(junction.thirdPath().getFirst(), third, context));

        return tree.withReplacedSubtree(
                tripleRoomIds,
                currentSubtree,
                replacementCells,
                replacementAttachments,
                replacementDoors,
                replaceStairPlacements(
                        tree.stairPlacements(),
                        currentSubtree,
                        junction.stairPlacements()));
    }

    private static WaypointRouteResult routeThroughWaypoints(
            Set<CubePoint> treeCells,
            Set<CubePoint> rootEntryCells,
            PlannerContext context
    ) {
        CubePoint rootEntryCell = null;
        List<StairPlacement> stairPlacements = new ArrayList<>();
        for (CubePoint waypoint : context.waypointCells()) {
            if (waypoint == null || !context.searchVolume().isPassable(waypoint)) {
                return new WaypointRouteResult(false, null, List.of());
            }
            Map<PathState, RouteCost> floodSources = treeCells.isEmpty()
                    ? zeroSources(rootEntryCells)
                    : zeroSources(treeCells);
            FloodResult flood = CostField.flood(
                    floodSources,
                    context.searchVolume(),
                    Set.of(waypoint),
                    Map.of(),
                    context.instrumentation());
            CubePoint reachedWaypoint = bestReachedEntry(flood, Set.of(waypoint));
            if (reachedWaypoint == null) {
                return new WaypointRouteResult(false, null, List.of());
            }
            ExtractedPath extracted = CostField.extractPathWithStairs(flood, reachedWaypoint);
            List<CubePoint> path = extracted.cells();
            if (rootEntryCell == null && treeCells.isEmpty() && !path.isEmpty()) {
                rootEntryCell = path.getFirst();
            }
            treeCells.addAll(path);
            stairPlacements.addAll(extracted.stairPlacements());
        }
        return new WaypointRouteResult(true, rootEntryCell, List.copyOf(stairPlacements));
    }

    private static List<StairPlacement> replaceStairPlacements(
            List<StairPlacement> existingPlacements,
            Set<CubePoint> replacedCells,
            List<StairPlacement> newPlacements
    ) {
        List<StairPlacement> updated = new ArrayList<>();
        if (existingPlacements != null) {
            for (StairPlacement placement : existingPlacements) {
                if (placement == null
                        || replacedCells == null
                        || placement.footprint().isEmpty()
                        || !replacedCells.containsAll(placement.footprint())) {
                    updated.add(placement);
                }
            }
        }
        if (newPlacements != null) {
            updated.addAll(newPlacements);
        }
        return List.copyOf(updated);
    }

    private static ReachedRoom findNearestReached(FloodResult flood, PlannerContext context, Set<Long> connected) {
        ReachedRoom best = null;
        for (Room room : context.targetRooms()) {
            if (room == null || room.roomId() == null || connected.contains(room.roomId())) {
                continue;
            }
            CubePoint bestEntry = bestReachedEntry(flood, context.entryCells(room.roomId()));
            if (bestEntry == null) {
                continue;
            }
            RouteCost cost = flood.bestCostAt(bestEntry);
            ReachedRoom candidate = new ReachedRoom(room, bestEntry, cost);
            if (best == null || candidate.cost().compareTo(best.cost()) < 0) {
                best = candidate;
            }
        }
        return best;
    }

    private static CubePoint bestReachedEntry(FloodResult flood, Set<CubePoint> candidates) {
        CubePoint bestEntry = null;
        RouteCost bestCost = null;
        for (CubePoint candidate : candidates) {
            if (!flood.reachedTargets().contains(candidate)) {
                continue;
            }
            RouteCost cost = flood.bestCostAt(candidate);
            if (cost == null) {
                continue;
            }
            if (bestCost == null || cost.compareTo(bestCost) < 0) {
                bestEntry = candidate;
                bestCost = cost;
            }
        }
        return bestEntry;
    }

    private static CubePoint bestTripleJunction(
            FloodResult floodFirst,
            FloodResult floodSecond,
            FloodResult floodThird,
            FloodResult floodBoundary
    ) {
        Set<CubePoint> candidates = new LinkedHashSet<>(floodFirst.bestStateByPoint().keySet());
        candidates.retainAll(floodSecond.bestStateByPoint().keySet());
        candidates.retainAll(floodThird.bestStateByPoint().keySet());
        if (floodBoundary != null) {
            candidates.retainAll(floodBoundary.bestStateByPoint().keySet());
        }
        CubePoint bestJunction = null;
        int bestScore = Integer.MAX_VALUE;
        for (CubePoint candidate : candidates) {
            int score = tripleJunctionScore(candidate, floodFirst, floodSecond, floodThird, floodBoundary);
            if (score < bestScore) {
                bestScore = score;
                bestJunction = candidate;
            }
        }
        return bestJunction;
    }

    private static int tripleJunctionScore(
            CubePoint candidate,
            FloodResult floodFirst,
            FloodResult floodSecond,
            FloodResult floodThird,
            FloodResult floodBoundary
    ) {
        RouteCost firstCost = floodFirst.bestCostAt(candidate);
        RouteCost secondCost = floodSecond.bestCostAt(candidate);
        RouteCost thirdCost = floodThird.bestCostAt(candidate);
        if (firstCost == null || secondCost == null || thirdCost == null) {
            return Integer.MAX_VALUE;
        }
        int score = RouteSearch.routeValue(firstCost.distance(), firstCost.corners(), firstCost.levelChanges())
                + RouteSearch.routeValue(secondCost.distance(), secondCost.corners(), secondCost.levelChanges())
                + RouteSearch.routeValue(thirdCost.distance(), thirdCost.corners(), thirdCost.levelChanges());
        if (floodBoundary != null) {
            RouteCost boundaryCost = floodBoundary.bestCostAt(candidate);
            if (boundaryCost == null) {
                return Integer.MAX_VALUE;
            }
            score += RouteSearch.routeValue(
                    boundaryCost.distance(),
                    boundaryCost.corners(),
                    boundaryCost.levelChanges());
        }
        return score;
    }

    private static void addDoorEdge(Set<DoorEdge> target, DoorEdge edge) {
        if (target != null && edge != null) {
            target.add(edge);
        }
    }

    private static DoorEdge deriveDoorEdge(CubePoint entryCell, Room room, PlannerContext context) {
        if (entryCell == null || room == null || room.roomId() == null) {
            return null;
        }
        int roomZ = context.roomLevel(room.roomId());
        for (Point2i step : Point2i.CARDINAL_STEPS) {
            Point2i projected = entryCell.projectedCell().add(step);
            if (entryCell.z() == roomZ && room.cells().contains(projected)) {
                Point2i boundaryStep = new Point2i(-step.x(), -step.y());
                VertexEdge edge = VertexEdge.betweenCellAndStep(projected, boundaryStep);
                return new DoorEdge(room.roomId(), edge, roomZ);
            }
        }
        return DoorEdge.vertical(room.roomId(), entryCell);
    }

    private static SteinerTree directAdjacency(Room first, Room second, PlannerContext context) {
        if (first == null || second == null || first.roomId() == null || second.roomId() == null) {
            return null;
        }
        if (context.roomLevel(first.roomId()) != context.roomLevel(second.roomId())) {
            return null;
        }
        for (Point2i firstCell : first.cells()) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i secondCell = firstCell.add(step);
                if (!second.cells().contains(secondCell)) {
                    continue;
                }
                int level = context.roomLevel(first.roomId());
                Point2i reverse = new Point2i(-step.x(), -step.y());
                DoorEdge firstDoor = new DoorEdge(
                        first.roomId(),
                        VertexEdge.betweenCellAndStep(firstCell, step),
                        level);
                DoorEdge secondDoor = new DoorEdge(
                        second.roomId(),
                        VertexEdge.betweenCellAndStep(secondCell, reverse),
                        level);
                return new SteinerTree(
                        Set.of(first.roomId(), second.roomId()),
                        Set.of(),
                        Set.of(firstDoor, secondDoor),
                        Map.of(),
                        new RouteCost(0, 0, 0),
                        List.of());
            }
        }
        return null;
    }

    private static Map<PathState, RouteCost> zeroSources(Collection<CubePoint> cells) {
        Map<PathState, RouteCost> sources = new HashMap<>();
        addZeroSources(sources, cells);
        return sources;
    }

    private static void addZeroSources(Map<PathState, RouteCost> sources, Collection<CubePoint> cells) {
        if (sources == null || cells == null) {
            return;
        }
        for (CubePoint cell : cells) {
            if (cell != null) {
                sources.put(new PathState(cell, -1, -1), new RouteCost(0, 0, 0));
            }
        }
    }

}

record ReachedRoom(Room room, CubePoint entryCell, RouteCost cost) {
}

record TripleJunctionResult(
        CubePoint junction,
        List<CubePoint> firstPath,
        List<CubePoint> secondPath,
        List<CubePoint> thirdPath,
        List<CubePoint> boundaryPath,
        List<StairPlacement> stairPlacements
) {
}

record WaypointRouteResult(
        boolean success,
        CubePoint rootEntryCell,
        List<StairPlacement> stairPlacements
) {
}
