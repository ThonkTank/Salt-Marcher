package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class ExitCandidateSelector {

    private ExitCandidateSelector() {
    }

    static List<ExitPairCandidate> preselectExitPairs(
            Room room,
            Room connectedRoom,
            PlannerContext context,
            PlannerConfig config
    ) {
        Point2i roomCenter = room.floor().shape().centerCell();
        Point2i connectedRoomCenter = connectedRoom.floor().shape().centerCell();
        ExitSelectionTarget roomTarget = new RoomTarget(connectedRoomCenter);
        ExitSelectionTarget connectedTarget = new RoomTarget(roomCenter);
        List<ExitCandidate> roomExits = roomToRoomCandidates(room, connectedRoomCenter, context, config);
        List<ExitCandidate> connectedExits = roomToRoomCandidates(connectedRoom, roomCenter, context, config);
        if (roomExits.isEmpty() || connectedExits.isEmpty()) {
            return List.of();
        }
        return limitedExitPairs(
                rankedExitPairs(roomExits, connectedExits, roomCenter, connectedRoomCenter, context.waypointCells()),
                exactPairBudget(context, roomTarget, connectedTarget, config));
    }

    static List<ExitCandidate> candidateExitsFor(
            Room room,
            ExitSelectionTarget target,
            PlannerContext context,
            PlannerConfig config
    ) {
        if (room == null || target == null || context == null) {
            return List.of();
        }
        List<ExitCandidate> allExits = context.allExitCandidates(room);
        if (allExits.isEmpty()) {
            return List.of();
        }
        TargetGeometry geometry = TargetGeometry.forSelection(allExits, target);
        int maxCandidates = geometry.hasTargetProjection()
                ? config.maxTargetedExitCandidatesPerRoom()
                : config.maxExitCandidatesPerRoom();
        if (allExits.size() <= maxCandidates) {
            return allExits;
        }
        return sampleExits(allExits, geometry, maxCandidates);
    }

    static List<ExitCandidate> collectExitCandidates(
            Room room,
            Map<Point2i, Long> occupancy,
            Map<Long, ResolvedCorridorDoorBinding> doorBindings
    ) {
        if (room == null || room.roomId() == null) {
            return List.of();
        }
        Set<Point2i> roomCells = room.cells();
        ResolvedCorridorDoorBinding binding = doorBindings.get(room.roomId());
        List<ExitCandidate> result = new ArrayList<>();
        for (Point2i cell : roomCells) {
            for (Point2i direction : Point2i.CARDINAL_STEPS) {
                Point2i outsideCell = cell.add(direction);
                if (roomCells.contains(outsideCell)) {
                    continue;
                }
                if (occupancy.containsKey(outsideCell)) {
                    continue;
                }
                if (binding != null
                        && (!binding.absoluteCell().equals(cell) || !binding.direction().equals(direction))) {
                    continue;
                }
                result.add(new ExitCandidate(
                        cell,
                        outsideCell,
                        direction,
                        VertexEdge.betweenCellAndStep(cell, direction)));
            }
        }
        List<ExitCandidate> sorted = result.stream()
                .sorted(Comparator
                        .comparingInt((ExitCandidate candidate) -> candidate.outsideCell().x())
                        .thenComparingInt(candidate -> candidate.outsideCell().y())
                        .thenComparingInt(candidate -> candidate.direction().x())
                        .thenComparingInt(candidate -> candidate.direction().y()))
                .toList();
        return List.copyOf(sorted);
    }

    private static List<ExitCandidate> roomToRoomCandidates(
            Room room,
            Point2i targetCenter,
            PlannerContext context,
            PlannerConfig config
    ) {
        return candidateExitsFor(room, new RoomTarget(targetCenter), context, config);
    }

    private static List<ExitCandidate> sampleExits(
            List<ExitCandidate> allExits,
            TargetGeometry geometry,
            int maxCandidates
    ) {
        if (allExits == null || allExits.isEmpty() || maxCandidates <= 0) {
            return List.of();
        }
        Point2i targetCenter = geometry == null ? null : geometry.targetCenter();
        Point2i roomCenter = geometry == null ? null : geometry.roomCenter();
        List<Point2i> sidePriority = targetCenter == null || roomCenter == null
                ? List.copyOf(Point2i.CARDINAL_STEPS)
                : preferredTargetDirections(roomCenter, targetCenter);

        // Build segments: group by direction, split into contiguous runs, sort candidates by target proximity
        List<SortedSegment> segments = new ArrayList<>();
        for (Point2i direction : Point2i.CARDINAL_STEPS) {
            List<ExitCandidate> onSide = allExits.stream()
                    .filter(candidate -> candidate.direction().equals(direction))
                    .sorted(exitCandidateSideOrder(direction))
                    .toList();
            for (List<ExitCandidate> segment : contiguousExitSegments(onSide, direction)) {
                List<ExitCandidate> ranked = rankByTargetProximity(segment, direction, targetCenter);
                segments.add(new SortedSegment(direction, ranked));
            }
        }

        // Order segments: target-facing sides first, then best candidate quality, then position
        segments.sort(Comparator
                .comparingInt((SortedSegment segment) -> sidePriorityIndex(sidePriority, segment.direction()))
                .thenComparingInt(segment -> targetCenter != null
                        ? segment.candidates().getFirst().outsideCell().distanceTo(targetCenter) : 0)
                .thenComparing(segment -> segment.candidates().getFirst().outsideCell(), Point2i.POINT_ORDER));

        // Allocate budget: 1 per segment minimum, then proportionally to larger segments
        int totalBudget = Math.min(maxCandidates, allExits.size());
        int[] allocations = new int[segments.size()];
        int allocated = 0;
        for (int index = 0; index < segments.size() && allocated < totalBudget; index++) {
            allocations[index] = 1;
            allocated++;
        }
        while (allocated < totalBudget) {
            int best = -1;
            double bestNeed = Double.NEGATIVE_INFINITY;
            for (int index = 0; index < segments.size(); index++) {
                if (allocations[index] >= segments.get(index).candidates().size()) {
                    continue;
                }
                double need = (double) segments.get(index).candidates().size() / (allocations[index] + 1)
                        - allocations[index];
                need -= sidePriorityIndex(sidePriority, segments.get(index).direction()) * 0.01;
                if (need > bestNeed) {
                    bestNeed = need;
                    best = index;
                }
            }
            if (best < 0) {
                break;
            }
            allocations[best]++;
            allocated++;
        }

        // Collect top candidates from each segment
        Map<Point2i, ExitCandidate> sampled = new LinkedHashMap<>();
        for (int index = 0; index < segments.size(); index++) {
            List<ExitCandidate> candidates = segments.get(index).candidates();
            for (int pick = 0; pick < Math.min(allocations[index], candidates.size()); pick++) {
                ExitCandidate candidate = candidates.get(pick);
                if (sampled.size() >= maxCandidates) {
                    break;
                }
                sampled.putIfAbsent(candidate.outsideCell(), candidate);
            }
        }
        return sampled.values().stream()
                .limit(totalBudget)
                .sorted(Comparator
                        .comparingInt((ExitCandidate candidate) -> candidate.outsideCell().x())
                        .thenComparingInt(candidate -> candidate.outsideCell().y())
                        .thenComparingInt(candidate -> candidate.direction().x())
                        .thenComparingInt(candidate -> candidate.direction().y()))
                .toList();
    }

    private static List<ExitCandidate> rankByTargetProximity(
            List<ExitCandidate> segment,
            Point2i direction,
            Point2i targetCenter
    ) {
        if (segment == null || segment.isEmpty()) {
            return List.of();
        }
        if (targetCenter == null) {
            return rankFromMiddleOut(segment);
        }
        return segment.stream()
                .sorted(Comparator
                        .comparingInt((ExitCandidate candidate) -> crossAxisDistance(candidate, direction, targetCenter))
                        .thenComparingInt(candidate -> candidate.outsideCell().distanceTo(targetCenter))
                        .thenComparing(candidate -> candidate.outsideCell(), Point2i.POINT_ORDER))
                .toList();
    }

    private static int crossAxisDistance(ExitCandidate candidate, Point2i direction, Point2i targetCenter) {
        if (direction.x() != 0) {
            return Math.abs(candidate.roomCell().y() - targetCenter.y());
        }
        return Math.abs(candidate.roomCell().x() - targetCenter.x());
    }

    private static List<ExitCandidate> rankFromMiddleOut(List<ExitCandidate> segment) {
        if (segment.size() <= 1) {
            return List.copyOf(segment);
        }
        int middle = segment.size() / 2;
        List<ExitCandidate> result = new ArrayList<>(segment.size());
        result.add(segment.get(middle));
        for (int offset = 1; result.size() < segment.size(); offset++) {
            int left = middle - offset;
            if (left >= 0) {
                result.add(segment.get(left));
            }
            int right = middle + offset;
            if (right < segment.size()) {
                result.add(segment.get(right));
            }
        }
        return List.copyOf(result);
    }

    private static List<ExitPairCandidate> rankedExitPairs(
            List<ExitCandidate> left,
            List<ExitCandidate> right,
            Point2i leftCenter,
            Point2i rightCenter,
            List<Point2i> waypointCells
    ) {
        if (left.isEmpty() || right.isEmpty()) {
            return List.of();
        }
        List<ExitPairCandidate> rankedPairs = new ArrayList<>();
        for (ExitCandidate exit : left) {
            for (ExitCandidate target : right) {
                rankedPairs.add(new ExitPairCandidate(
                        exit,
                        target,
                        exitPairHeuristic(exit, leftCenter, target, rightCenter, waypointCells)));
            }
        }
        rankedPairs.sort(Comparator
                .comparingInt(ExitPairCandidate::heuristicScore)
                .thenComparingInt(pair -> pair.exit().roomCell().distanceTo(leftCenter) + pair.target().roomCell().distanceTo(rightCenter))
                .thenComparingInt(pair -> pair.exit().outsideCell().distanceTo(rightCenter))
                .thenComparingInt(pair -> pair.target().outsideCell().distanceTo(leftCenter))
                .thenComparing(pair -> pair.exit().outsideCell(), Point2i.POINT_ORDER)
                .thenComparing(pair -> pair.target().outsideCell(), Point2i.POINT_ORDER));
        return List.copyOf(rankedPairs);
    }

    private static List<ExitPairCandidate> limitedExitPairs(List<ExitPairCandidate> ranked, int maxPairs) {
        if (ranked.size() <= maxPairs) {
            return ranked;
        }
        return List.copyOf(ranked.subList(0, maxPairs));
    }

    private static List<Point2i> preferredTargetDirections(Point2i roomCenter, Point2i targetCenter) {
        if (roomCenter == null || targetCenter == null) {
            return List.of();
        }
        List<Point2i> result = new ArrayList<>(4);
        int deltaX = targetCenter.x() - roomCenter.x();
        int deltaY = targetCenter.y() - roomCenter.y();
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            addPreferredDirection(result, new Point2i(Integer.compare(deltaX, 0), 0));
            addPreferredDirection(result, new Point2i(0, Integer.compare(deltaY, 0)));
        } else {
            addPreferredDirection(result, new Point2i(0, Integer.compare(deltaY, 0)));
            addPreferredDirection(result, new Point2i(Integer.compare(deltaX, 0), 0));
        }
        addPreferredDirection(result, new Point2i(-Integer.compare(deltaX, 0), 0));
        addPreferredDirection(result, new Point2i(0, -Integer.compare(deltaY, 0)));
        return List.copyOf(result);
    }

    private static void addPreferredDirection(List<Point2i> directions, Point2i direction) {
        if (direction == null || (direction.x() == 0 && direction.y() == 0) || directions.contains(direction)) {
            return;
        }
        directions.add(direction);
    }

    private static int exitPairHeuristic(
            ExitCandidate exit,
            Point2i roomCenter,
            ExitCandidate target,
            Point2i targetRoomCenter,
            List<Point2i> waypointCells
    ) {
        int directDistance = exit.outsideCell().distanceTo(target.outsideCell());
        int estimatedCorners = estimatedCornersViaWaypoints(exit, target, waypointCells);
        int sidePenalty = exit.direction().equals(target.direction()) ? RouteSearch.cornerPenaltyTiles(directDistance) : 0;
        Point2i reverseTargetDirection = new Point2i(-target.direction().x(), -target.direction().y());
        int approachPenalty = exit.direction().equals(reverseTargetDirection) ? 0 : 1;
        int centerPenalty = exit.roomCell().distanceTo(roomCenter) + target.roomCell().distanceTo(targetRoomCenter);
        int targetAlignmentPenalty = exit.outsideCell().distanceTo(targetRoomCenter) + target.outsideCell().distanceTo(roomCenter);
        int waypointDistance = waypointRouteHeuristic(exit.outsideCell(), target.outsideCell(), waypointCells);
        int estimatedDistance = directDistance + waypointDistance;
        return RouteSearch.routeValue(estimatedDistance, estimatedCorners + approachPenalty)
                + sidePenalty
                + centerPenalty
                + targetAlignmentPenalty;
    }

    private static int exactPairBudget(
            PlannerContext context,
            ExitSelectionTarget left,
            ExitSelectionTarget right,
            PlannerConfig config
    ) {
        Point2i leftCenter = TargetGeometry.targetCenterOf(left);
        Point2i rightCenter = TargetGeometry.targetCenterOf(right);
        if (leftCenter == null || rightCenter == null) {
            return config.baseExactExitPairEvaluations();
        }
        int targetDistance = leftCenter.distanceTo(rightCenter);
        boolean hasWaypoints = context != null && !context.waypointCells().isEmpty();
        boolean roomToRoom = left instanceof RoomTarget && right instanceof RoomTarget;
        if (roomToRoom && (hasWaypoints || targetDistance >= 24)) {
            return config.complexExactExitPairEvaluations();
        }
        if (roomToRoom) {
            return config.roomTargetExactPairEvaluations();
        }
        return hasWaypoints || targetDistance >= 24
                ? config.roomTargetExactPairEvaluations()
                : config.baseExactExitPairEvaluations();
    }

    private static int estimatedCornersViaWaypoints(
            ExitCandidate exit,
            ExitCandidate target,
            List<Point2i> waypointCells
    ) {
        List<Point2i> anchors = new ArrayList<>();
        anchors.add(exit.outsideCell());
        if (waypointCells != null) {
            anchors.addAll(waypointCells);
        }
        anchors.add(target.outsideCell());
        int corners = 0;
        Point2i previousDirection = null;
        for (int index = 1; index < anchors.size(); index++) {
            Point2i from = anchors.get(index - 1);
            Point2i to = anchors.get(index);
            Point2i stepDirection = dominantDirection(from, to);
            if (stepDirection == null) {
                continue;
            }
            if (previousDirection != null && !previousDirection.equals(stepDirection)) {
                corners++;
            }
            previousDirection = stepDirection;
        }
        if (previousDirection != null && !previousDirection.equals(exit.direction())) {
            corners++;
        }
        Point2i reverseTargetDirection = new Point2i(-target.direction().x(), -target.direction().y());
        if (previousDirection != null && !previousDirection.equals(reverseTargetDirection)) {
            corners++;
        }
        return corners;
    }

    private static Point2i dominantDirection(Point2i from, Point2i to) {
        if (from == null || to == null || from.equals(to)) {
            return null;
        }
        int deltaX = to.x() - from.x();
        int deltaY = to.y() - from.y();
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            return new Point2i(Integer.compare(deltaX, 0), 0);
        }
        return new Point2i(0, Integer.compare(deltaY, 0));
    }

    private static int waypointRouteHeuristic(Point2i start, Point2i target, List<Point2i> waypointCells) {
        if (waypointCells == null || waypointCells.isEmpty()) {
            return 0;
        }
        int distance = start.distanceTo(waypointCells.getFirst());
        for (int index = 1; index < waypointCells.size(); index++) {
            distance += waypointCells.get(index - 1).distanceTo(waypointCells.get(index));
        }
        distance += waypointCells.getLast().distanceTo(target);
        return distance;
    }

    private static List<List<ExitCandidate>> contiguousExitSegments(List<ExitCandidate> candidates, Point2i direction) {
        if (candidates.isEmpty()) {
            return List.of();
        }
        List<List<ExitCandidate>> segments = new ArrayList<>();
        List<ExitCandidate> current = new ArrayList<>();
        ExitCandidate previous = null;
        for (ExitCandidate candidate : candidates) {
            if (previous != null && !isAdjacentOnSide(previous, candidate, direction)) {
                segments.add(List.copyOf(current));
                current = new ArrayList<>();
            }
            current.add(candidate);
            previous = candidate;
        }
        segments.add(List.copyOf(current));
        return List.copyOf(segments);
    }

    private static boolean isAdjacentOnSide(ExitCandidate previous, ExitCandidate current, Point2i direction) {
        Point2i delta = current.roomCell().subtract(previous.roomCell());
        if (direction.x() != 0) {
            return delta.x() == 0 && Math.abs(delta.y()) == 1;
        }
        return delta.y() == 0 && Math.abs(delta.x()) == 1;
    }

    private static Comparator<ExitCandidate> exitCandidateSideOrder(Point2i direction) {
        if (direction.x() != 0) {
            return Comparator
                    .comparingInt((ExitCandidate candidate) -> candidate.roomCell().y())
                    .thenComparingInt(candidate -> candidate.roomCell().x());
        }
        return Comparator
                .comparingInt((ExitCandidate candidate) -> candidate.roomCell().x())
                .thenComparingInt(candidate -> candidate.roomCell().y());
    }

    private static int sidePriorityIndex(List<Point2i> sidePriority, Point2i direction) {
        int index = sidePriority.indexOf(direction);
        return index >= 0 ? index : Integer.MAX_VALUE;
    }
}

record SortedSegment(Point2i direction, List<ExitCandidate> candidates) {
}

record ExitPairCandidate(ExitCandidate exit, ExitCandidate target, int heuristicScore) {
}

sealed interface ExitSelectionTarget permits RoomTarget, NetworkTarget, WaypointTarget {
}

record RoomTarget(Point2i centerCell) implements ExitSelectionTarget {
}

record NetworkTarget(Set<Point2i> cells) implements ExitSelectionTarget {
}

record WaypointTarget(List<Point2i> waypoints) implements ExitSelectionTarget {
}

record TargetGeometry(Point2i roomCenter, Point2i targetCenter) {
    static TargetGeometry forSelection(List<ExitCandidate> allExits, ExitSelectionTarget target) {
        List<Point2i> roomCells = allExits == null ? List.of() : allExits.stream()
                .map(ExitCandidate::roomCell)
                .toList();
        return new TargetGeometry(centerOf(roomCells), targetCenterOf(target));
    }

    static Point2i targetCenterOf(ExitSelectionTarget target) {
        if (target == null) {
            return null;
        }
        return switch (target) {
            case RoomTarget(Point2i centerCell) -> centerCell;
            case NetworkTarget(Set<Point2i> cells) -> centerOf(cells);
            case WaypointTarget(List<Point2i> waypoints) -> centerOf(waypoints);
        };
    }

    private static Point2i centerOf(Iterable<Point2i> cells) {
        if (cells == null) {
            return null;
        }
        long sumX = 0L;
        long sumY = 0L;
        int count = 0;
        for (Point2i cell : cells) {
            if (cell == null) {
                continue;
            }
            sumX += cell.x();
            sumY += cell.y();
            count++;
        }
        if (count == 0) {
            return null;
        }
        return new Point2i(
                (int) Math.round(sumX / (double) count),
                (int) Math.round(sumY / (double) count));
    }

    boolean hasTargetProjection() {
        return targetCenter != null;
    }
}

record ExitCandidate(Point2i roomCell, Point2i outsideCell, Point2i direction, VertexEdge doorEdge) {
}
