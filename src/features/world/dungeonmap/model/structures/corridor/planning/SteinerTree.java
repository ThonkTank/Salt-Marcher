package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

record SteinerTree(
        Set<Long> connectedRoomIds,
        Set<CubePoint> corridorCells,
        Set<DoorEdge> openings,
        Map<Long, Set<CubePoint>> attachmentCellsByRoomId,
        RouteCost totalCost,
        List<StairTraversal> stairTraversals
) {
    SteinerTree {
        stairTraversals = stairTraversals == null ? List.of() : List.copyOf(stairTraversals);
    }

    static SteinerTree empty() {
        return new SteinerTree(Set.of(), Set.of(), Set.of(), Map.of(), new RouteCost(0, 0, 0), List.of());
    }

    List<StairPlacement> stairPlacements() {
        return StairTraversal.toPlacements(stairTraversals);
    }

    boolean isRoutable() {
        return !connectedRoomIds.isEmpty() && (!corridorCells.isEmpty() || !openings.isEmpty());
    }

    TreeSlice branch(long roomId) {
        Set<CubePoint> starts = attachmentCellsByRoomId.get(roomId);
        if (starts == null || starts.isEmpty() || corridorCells.isEmpty()) {
            return TreeSlice.empty();
        }
        Set<CubePoint> branchCells = new LinkedHashSet<>();
        Set<StairTraversal> branchTraversals = new LinkedHashSet<>();
        for (CubePoint start : starts) {
            if (start == null || !corridorCells.contains(start)) {
                continue;
            }
            CubePoint current = start;
            CubePoint previous = null;
            while (current != null && branchCells.add(current)) {
                CubePoint previousCell = previous;
                List<NeighborLink> nextCandidates = neighborLinks(current).stream()
                        .filter(candidate -> !candidate.target().equals(previousCell))
                        .toList();
                if (nextCandidates.size() > 1) {
                    branchCells.remove(current);
                    break;
                }
                if (nextCandidates.isEmpty()) {
                    break;
                }
                NeighborLink next = nextCandidates.getFirst();
                if (next.stairTraversal() != null) {
                    branchTraversals.add(next.stairTraversal());
                }
                previous = current;
                current = next.target();
            }
        }
        return new TreeSlice(Set.copyOf(branchCells), List.copyOf(branchTraversals));
    }

    Set<CubePoint> cellsWithout(Set<CubePoint> removed) {
        Set<CubePoint> result = new LinkedHashSet<>(corridorCells);
        if (removed != null) {
            result.removeAll(removed);
        }
        return Set.copyOf(result);
    }

    TreeSlice connectingSubtree(Set<Long> roomIds) {
        if (roomIds == null || roomIds.isEmpty() || corridorCells.isEmpty()) {
            return TreeSlice.empty();
        }
        List<CubePoint> anchors = roomIds.stream()
                .map(attachmentCellsByRoomId::get)
                .filter(Objects::nonNull)
                .flatMap(Set::stream)
                .distinct()
                .toList();
        if (anchors.size() < 2) {
            return TreeSlice.empty();
        }
        Set<CubePoint> resultCells = new LinkedHashSet<>();
        Set<StairTraversal> resultTraversals = new LinkedHashSet<>();
        CubePoint root = anchors.getFirst();
        resultCells.add(root);
        for (int index = 1; index < anchors.size(); index++) {
            TreeSlice path = findPath(root, anchors.get(index));
            if (path.isEmpty()) {
                return TreeSlice.empty();
            }
            resultCells.addAll(path.corridorCells());
            resultTraversals.addAll(path.stairTraversals());
        }
        return new TreeSlice(Set.copyOf(resultCells), List.copyOf(resultTraversals));
    }

    Set<CubePoint> boundaryCells(Set<CubePoint> subtreeCells) {
        if (subtreeCells == null || subtreeCells.isEmpty()) {
            return Set.of();
        }
        Set<CubePoint> boundaries = new LinkedHashSet<>();
        for (CubePoint cell : subtreeCells) {
            boolean touchesOutside = neighborLinks(cell).stream()
                    .map(NeighborLink::target)
                    .anyMatch(neighbor -> !subtreeCells.contains(neighbor));
            if (touchesOutside) {
                boundaries.add(cell);
            }
        }
        return Set.copyOf(boundaries);
    }

    SteinerTree withReplacedBranch(
            long roomId,
            Set<CubePoint> oldBranch,
            List<CubePoint> newPath,
            DoorEdge newDoorEdge,
            List<StairTraversal> replacementTraversals
    ) {
        Set<CubePoint> updatedCells = new LinkedHashSet<>(corridorCells);
        if (oldBranch != null) {
            updatedCells.removeAll(oldBranch);
        }
        if (newPath != null) {
            updatedCells.addAll(newPath);
        }
        Set<DoorEdge> updatedDoors = new LinkedHashSet<>();
        for (DoorEdge edge : openings) {
            if (edge == null || edge.roomId() != roomId) {
                updatedDoors.add(edge);
            }
        }
        if (newDoorEdge != null) {
            updatedDoors.add(newDoorEdge);
        }
        Map<Long, Set<CubePoint>> updatedAttachments = new LinkedHashMap<>(attachmentCellsByRoomId);
        if (newPath == null || newPath.isEmpty()) {
            updatedAttachments.remove(roomId);
        } else {
            updatedAttachments.put(roomId, Set.of(newPath.getLast()));
        }
        return new SteinerTree(
                Set.copyOf(connectedRoomIds),
                Set.copyOf(updatedCells),
                Set.copyOf(updatedDoors),
                Map.copyOf(updatedAttachments),
                scoreTraversedCells(updatedCells, replacementTraversals),
                replacementTraversals);
    }

    SteinerTree withReplacedSubtree(
            Set<Long> roomIds,
            Set<CubePoint> oldSubtree,
            Set<CubePoint> newSubtree,
            Map<Long, Set<CubePoint>> replacementAttachments,
            Set<DoorEdge> replacementDoorEdges,
            List<StairTraversal> replacementTraversals
    ) {
        Set<Long> replacedRoomIds = roomIds == null ? Set.of() : Set.copyOf(roomIds);
        Set<CubePoint> updatedCells = new LinkedHashSet<>(corridorCells);
        if (oldSubtree != null) {
            updatedCells.removeAll(oldSubtree);
        }
        if (newSubtree != null) {
            updatedCells.addAll(newSubtree);
        }
        Set<DoorEdge> updatedDoors = new LinkedHashSet<>();
        for (DoorEdge edge : openings) {
            if (edge == null || !replacedRoomIds.contains(edge.roomId())) {
                updatedDoors.add(edge);
            }
        }
        if (replacementDoorEdges != null) {
            updatedDoors.addAll(replacementDoorEdges);
        }
        Map<Long, Set<CubePoint>> updatedAttachments = new LinkedHashMap<>(attachmentCellsByRoomId);
        for (Long roomId : replacedRoomIds) {
            updatedAttachments.remove(roomId);
        }
        if (replacementAttachments != null) {
            updatedAttachments.putAll(replacementAttachments);
        }
        return new SteinerTree(
                Set.copyOf(connectedRoomIds),
                Set.copyOf(updatedCells),
                Set.copyOf(updatedDoors),
                Map.copyOf(updatedAttachments),
                scoreTraversedCells(updatedCells, replacementTraversals),
                replacementTraversals);
    }

    static RouteCost scoreCells(Collection<CubePoint> cells) {
        return scoreCells(cells, List.of());
    }

    static RouteCost scoreTraversedCells(Collection<CubePoint> cells, Collection<StairTraversal> stairTraversals) {
        return scoreCells(cells, StairTraversal.toPlacements(stairTraversals));
    }

    static RouteCost scoreCells(Collection<CubePoint> cells, Collection<StairPlacement> stairPlacements) {
        Set<CubePoint> corridorCells = cells == null ? Set.of() : Set.copyOf(cells);
        Set<CubePoint> stairCells = stairCells(stairPlacements);
        Set<CubePoint> scoredCells = new LinkedHashSet<>(corridorCells);
        scoredCells.addAll(stairCells);
        int corners = 0;
        int levelChanges = 0;
        for (CubePoint cell : scoredCells) {
            if (stairCells.contains(cell)) {
                if (scoredCells.contains(cell.add(new CubePoint(0, 0, 1)))) {
                    levelChanges++;
                }
                continue;
            }
            boolean xNeighbor = false;
            boolean yNeighbor = false;
            boolean zNeighbor = false;
            for (CubePoint step : CostField.STEPS) {
                CubePoint neighbor = cell.add(step);
                if (stairCells.contains(neighbor)) {
                    continue;
                }
                if (scoredCells.contains(neighbor)) {
                    if (step.x() != 0) {
                        xNeighbor = true;
                    } else if (step.y() != 0) {
                        yNeighbor = true;
                    } else {
                        zNeighbor = true;
                    }
                }
            }
            if (scoredCells.contains(cell.add(new CubePoint(0, 0, 1)))) {
                levelChanges++;
            }
            if ((xNeighbor ? 1 : 0) + (yNeighbor ? 1 : 0) + (zNeighbor ? 1 : 0) >= 2) {
                corners++;
            }
        }
        return new RouteCost(scoredCells.size(), corners, levelChanges);
    }

    private static Set<CubePoint> stairCells(Collection<StairPlacement> stairPlacements) {
        if (stairPlacements == null || stairPlacements.isEmpty()) {
            return Set.of();
        }
        Set<CubePoint> result = new LinkedHashSet<>();
        for (StairPlacement placement : stairPlacements) {
            if (placement != null) {
                result.addAll(placement.footprint());
            }
        }
        return Set.copyOf(result);
    }

    Set<Point2i> cellsAtLevel(int z) {
        return corridorCells.stream()
                .filter(cell -> cell.z() == z)
                .map(CubePoint::projectedCell)
                .collect(Collectors.toUnmodifiableSet());
    }

    Set<Integer> levels() {
        return corridorCells.stream()
                .map(CubePoint::z)
                .collect(Collectors.toUnmodifiableSet());
    }

    Set<CubePoint> zTransitions() {
        Set<CubePoint> result = new LinkedHashSet<>();
        for (CubePoint cell : corridorCells) {
            boolean directVertical = corridorCells.contains(cell.add(new CubePoint(0, 0, 1)))
                    || corridorCells.contains(cell.add(new CubePoint(0, 0, -1)));
            boolean stairVertical = stairTraversals.stream()
                    .map(traversal -> traversal.oppositeEndpoint(cell))
                    .filter(Objects::nonNull)
                    .anyMatch(target -> target.z() != cell.z());
            if (directVertical || stairVertical) {
                result.add(cell);
            }
        }
        return Set.copyOf(result);
    }

    private List<NeighborLink> neighborLinks(CubePoint cell) {
        LinkedHashMap<CubePoint, NeighborLink> result = new LinkedHashMap<>();
        for (CubePoint step : CostField.STEPS) {
            CubePoint neighbor = cell.add(step);
            if (corridorCells.contains(neighbor)) {
                result.putIfAbsent(neighbor, new NeighborLink(neighbor, null));
            }
        }
        for (StairTraversal traversal : stairTraversals) {
            if (traversal == null) {
                continue;
            }
            CubePoint neighbor = traversal.oppositeEndpoint(cell);
            if (neighbor != null && corridorCells.contains(neighbor)) {
                result.putIfAbsent(neighbor, new NeighborLink(neighbor, traversal));
            }
        }
        return List.copyOf(result.values());
    }

    private TreeSlice findPath(CubePoint start, CubePoint target) {
        if (start == null || target == null || !corridorCells.contains(start) || !corridorCells.contains(target)) {
            return TreeSlice.empty();
        }
        if (start.equals(target)) {
            return new TreeSlice(Set.of(start), List.of());
        }
        ArrayDeque<CubePoint> queue = new ArrayDeque<>();
        Map<CubePoint, CubePoint> previousByCell = new LinkedHashMap<>();
        Map<CubePoint, StairTraversal> incomingTraversalByCell = new LinkedHashMap<>();
        Set<CubePoint> visited = new LinkedHashSet<>();
        queue.add(start);
        visited.add(start);
        while (!queue.isEmpty()) {
            CubePoint current = queue.removeFirst();
            for (NeighborLink link : neighborLinks(current)) {
                CubePoint neighbor = link.target();
                if (!visited.add(neighbor)) {
                    continue;
                }
                previousByCell.put(neighbor, current);
                if (link.stairTraversal() != null) {
                    incomingTraversalByCell.put(neighbor, link.stairTraversal());
                }
                if (neighbor.equals(target)) {
                    return reconstructPath(previousByCell, incomingTraversalByCell, target);
                }
                queue.addLast(neighbor);
            }
        }
        return TreeSlice.empty();
    }

    private static TreeSlice reconstructPath(
            Map<CubePoint, CubePoint> previousByCell,
            Map<CubePoint, StairTraversal> incomingTraversalByCell,
            CubePoint target
    ) {
        ArrayDeque<CubePoint> path = new ArrayDeque<>();
        Set<StairTraversal> traversals = new LinkedHashSet<>();
        CubePoint current = target;
        path.addFirst(current);
        while (previousByCell.containsKey(current)) {
            StairTraversal traversal = incomingTraversalByCell.get(current);
            if (traversal != null) {
                traversals.add(traversal);
            }
            current = previousByCell.get(current);
            path.addFirst(current);
        }
        return new TreeSlice(Set.copyOf(path), List.copyOf(traversals));
    }
}

record TreeSlice(
        Set<CubePoint> corridorCells,
        List<StairTraversal> stairTraversals
) {
    TreeSlice {
        corridorCells = corridorCells == null ? Set.of() : Set.copyOf(corridorCells);
        stairTraversals = stairTraversals == null ? List.of() : List.copyOf(stairTraversals);
    }

    static TreeSlice empty() {
        return new TreeSlice(Set.of(), List.of());
    }

    boolean isEmpty() {
        return corridorCells.isEmpty() && stairTraversals.isEmpty();
    }

    List<StairPlacement> stairPlacements() {
        return StairTraversal.toPlacements(stairTraversals);
    }
}

record DoorEdge(long roomId, VertexEdge edge, int levelZ) {
    static DoorEdge vertical(long roomId, CubePoint cell) {
        return new DoorEdge(roomId, null, cell == null ? 0 : cell.z());
    }

    boolean isVertical() {
        return edge == null;
    }
}

record NeighborLink(CubePoint target, StairTraversal stairTraversal) {
}
