package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.room.Room;

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
        Set<DoorEdge> doorEdges = new LinkedHashSet<>();
        Map<Long, Set<CubePoint>> attachmentCellsByRoomId = new LinkedHashMap<>();
        connected.add(root.roomId());
        Map<PathState, RouteCost> sources = zeroSources(context.entryCells(root.roomId()));
        if (!routeThroughWaypoints(treeCells, sources, context)) {
            return null;
        }
        while (connected.size() < context.targetRooms().size()) {
            Set<CubePoint> targets = context.allTargetEntryCells(connected);
            if (targets.isEmpty()) {
                break;
            }
            FloodResult flood = CostField.flood(
                    sources,
                    context.searchVolume(),
                    targets,
                    context.targetRoomsByEntryCell(targets),
                    context.instrumentation());
            ReachedRoom nearest = findNearestReached(flood, context, connected);
            if (nearest == null) {
                break;
            }
            List<CubePoint> path = CostField.extractPath(flood, nearest.entryCell());
            if (path.isEmpty()) {
                break;
            }
            DoorEdge door = deriveDoorEdge(nearest.entryCell(), nearest.room(), context);
            treeCells.addAll(path);
            if (door != null) {
                doorEdges.add(door);
            }
            attachmentCellsByRoomId.put(nearest.room().roomId(), Set.of(nearest.entryCell()));
            connected.add(nearest.room().roomId());
            addZeroSources(sources, path);
            addZeroSources(sources, context.entryCells(nearest.room().roomId()));
        }
        return new SteinerTree(
                Set.copyOf(connected),
                Set.copyOf(treeCells),
                Set.copyOf(doorEdges),
                Map.copyOf(attachmentCellsByRoomId),
                scoreCells(treeCells));
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
                for (Long connectedRoomId : current.connectedRoomIds()) {
                    if (!connectedRoomId.equals(room.roomId())) {
                        addZeroSources(sources, context.entryCells(connectedRoomId));
                    }
                }
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
                List<CubePoint> newPath = CostField.extractPath(flood, bestEntry);
                if (newPath.isEmpty()) {
                    continue;
                }
                if (scoreCells(newPath).compareTo(scoreCells(branch)) < 0) {
                    current = current.withReplacedBranch(
                            room.roomId(),
                            branch,
                            newPath,
                            deriveDoorEdge(bestEntry, room, context));
                    improved = true;
                }
            }
        }
        return current;
    }

    private static boolean routeThroughWaypoints(
            Set<CubePoint> treeCells,
            Map<PathState, RouteCost> sources,
            PlannerContext context
    ) {
        for (Point2i waypoint : context.waypointCells()) {
            Set<CubePoint> waypointTargets = waypointTargets(waypoint, context.searchVolume());
            if (waypointTargets.isEmpty()) {
                return false;
            }
            FloodResult flood = CostField.flood(
                    sources,
                    context.searchVolume(),
                    waypointTargets,
                    Map.of(),
                    context.instrumentation());
            CubePoint reachedWaypoint = bestReachedEntry(flood, waypointTargets);
            if (reachedWaypoint == null) {
                return false;
            }
            List<CubePoint> path = CostField.extractPath(flood, reachedWaypoint);
            treeCells.addAll(path);
            addZeroSources(sources, path);
        }
        return true;
    }

    private static Set<CubePoint> waypointTargets(Point2i waypoint, SearchVolume volume) {
        if (waypoint == null || volume == null) {
            return Set.of();
        }
        Set<CubePoint> result = new LinkedHashSet<>();
        for (int z = volume.minZ(); z <= volume.maxZ(); z++) {
            CubePoint point = CubePoint.at(waypoint, z);
            if (volume.isPassable(point)) {
                result.add(point);
            }
        }
        return Set.copyOf(result);
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

    private static DoorEdge deriveDoorEdge(CubePoint entryCell, Room room, PlannerContext context) {
        if (entryCell == null || room == null || room.roomId() == null) {
            return null;
        }
        int roomZ = context.roomLevel(room.roomId());
        for (Point2i step : Point2i.CARDINAL_STEPS) {
            Point2i projected = entryCell.projectedCell().add(step);
            if (entryCell.z() == roomZ && room.cells().contains(projected)) {
                VertexEdge edge = VertexEdge.betweenCellAndStep(projected, step);
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
                        new RouteCost(0, 0));
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
                sources.put(new PathState(cell, -1), new RouteCost(0, 0));
            }
        }
    }

    static RouteCost scoreCells(Collection<CubePoint> cells) {
        Set<CubePoint> unique = cells == null ? Set.of() : Set.copyOf(cells);
        int corners = 0;
        for (CubePoint cell : unique) {
            boolean hasX = unique.contains(cell.add(new CubePoint(-1, 0, 0)))
                    || unique.contains(cell.add(new CubePoint(1, 0, 0)));
            boolean hasY = unique.contains(cell.add(new CubePoint(0, -1, 0)))
                    || unique.contains(cell.add(new CubePoint(0, 1, 0)));
            boolean hasZ = unique.contains(cell.add(new CubePoint(0, 0, -1)))
                    || unique.contains(cell.add(new CubePoint(0, 0, 1)));
            int axes = (hasX ? 1 : 0) + (hasY ? 1 : 0) + (hasZ ? 1 : 0);
            if (axes >= 2) {
                corners++;
            }
        }
        return new RouteCost(unique.size(), corners);
    }
}

record ReachedRoom(Room room, CubePoint entryCell, RouteCost cost) {
}
