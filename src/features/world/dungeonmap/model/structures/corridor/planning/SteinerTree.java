package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;

import java.util.ArrayDeque;
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
        Set<DoorEdge> doorEdges,
        Map<Long, Set<CubePoint>> attachmentCellsByRoomId,
        RouteCost totalCost
) {
    static SteinerTree empty() {
        return new SteinerTree(Set.of(), Set.of(), Set.of(), Map.of(), new RouteCost(0, 0));
    }

    boolean isRoutable() {
        return !connectedRoomIds.isEmpty() && (!corridorCells.isEmpty() || !doorEdges.isEmpty());
    }

    Set<CubePoint> branchCells(long roomId) {
        Set<CubePoint> starts = attachmentCellsByRoomId.get(roomId);
        if (starts == null || starts.isEmpty() || corridorCells.isEmpty()) {
            return Set.of();
        }
        Set<CubePoint> branch = new LinkedHashSet<>();
        for (CubePoint start : starts) {
            if (start == null || !corridorCells.contains(start)) {
                continue;
            }
            CubePoint current = start;
            CubePoint previous = null;
            while (current != null && branch.add(current)) {
                CubePoint previousCell = previous;
                List<CubePoint> nextCandidates = neighbors(current).stream()
                        .filter(candidate -> !candidate.equals(previousCell))
                        .toList();
                if (nextCandidates.size() != 1) {
                    break;
                }
                previous = current;
                current = nextCandidates.getFirst();
            }
        }
        return Set.copyOf(branch);
    }

    Set<CubePoint> cellsWithout(Set<CubePoint> removed) {
        Set<CubePoint> result = new LinkedHashSet<>(corridorCells);
        if (removed != null) {
            result.removeAll(removed);
        }
        return Set.copyOf(result);
    }

    Set<CubePoint> connectingSubtreeCells(Set<Long> roomIds) {
        if (roomIds == null || roomIds.isEmpty() || corridorCells.isEmpty()) {
            return Set.of();
        }
        List<CubePoint> anchors = roomIds.stream()
                .map(attachmentCellsByRoomId::get)
                .filter(Objects::nonNull)
                .flatMap(Set::stream)
                .distinct()
                .toList();
        if (anchors.size() < 2) {
            return Set.of();
        }
        Set<CubePoint> result = new LinkedHashSet<>();
        CubePoint root = anchors.getFirst();
        result.add(root);
        for (int index = 1; index < anchors.size(); index++) {
            List<CubePoint> path = findPath(root, anchors.get(index));
            if (path.isEmpty()) {
                return Set.of();
            }
            result.addAll(path);
        }
        return Set.copyOf(result);
    }

    Set<CubePoint> boundaryCells(Set<CubePoint> subtreeCells) {
        if (subtreeCells == null || subtreeCells.isEmpty()) {
            return Set.of();
        }
        Set<CubePoint> boundaries = new LinkedHashSet<>();
        for (CubePoint cell : subtreeCells) {
            boolean touchesOutside = CostField.STEPS.stream()
                    .map(cell::add)
                    .anyMatch(neighbor -> corridorCells.contains(neighbor) && !subtreeCells.contains(neighbor));
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
            DoorEdge newDoorEdge
    ) {
        Set<CubePoint> updatedCells = new LinkedHashSet<>(corridorCells);
        if (oldBranch != null) {
            updatedCells.removeAll(oldBranch);
        }
        if (newPath != null) {
            updatedCells.addAll(newPath);
        }
        Set<DoorEdge> updatedDoors = new LinkedHashSet<>();
        for (DoorEdge edge : doorEdges) {
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
                SteinerTreeBuilder.scoreCells(updatedCells));
    }

    SteinerTree withReplacedSubtree(
            Set<Long> roomIds,
            Set<CubePoint> oldSubtree,
            Set<CubePoint> newSubtree,
            Map<Long, Set<CubePoint>> replacementAttachments,
            Set<DoorEdge> replacementDoorEdges
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
        for (DoorEdge edge : doorEdges) {
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
                SteinerTreeBuilder.scoreCells(updatedCells));
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
            if (corridorCells.contains(cell.add(new CubePoint(0, 0, 1)))
                    || corridorCells.contains(cell.add(new CubePoint(0, 0, -1)))) {
                result.add(cell);
            }
        }
        return Set.copyOf(result);
    }

    private List<CubePoint> neighbors(CubePoint cell) {
        return CostField.STEPS.stream()
                .map(cell::add)
                .filter(corridorCells::contains)
                .toList();
    }

    private List<CubePoint> findPath(CubePoint start, CubePoint target) {
        if (start == null || target == null || !corridorCells.contains(start) || !corridorCells.contains(target)) {
            return List.of();
        }
        if (start.equals(target)) {
            return List.of(start);
        }
        ArrayDeque<CubePoint> queue = new ArrayDeque<>();
        Map<CubePoint, CubePoint> previousByCell = new LinkedHashMap<>();
        Set<CubePoint> visited = new LinkedHashSet<>();
        queue.add(start);
        visited.add(start);
        while (!queue.isEmpty()) {
            CubePoint current = queue.removeFirst();
            for (CubePoint neighbor : neighbors(current)) {
                if (!visited.add(neighbor)) {
                    continue;
                }
                previousByCell.put(neighbor, current);
                if (neighbor.equals(target)) {
                    return reconstructPath(previousByCell, target);
                }
                queue.addLast(neighbor);
            }
        }
        return List.of();
    }

    private static List<CubePoint> reconstructPath(Map<CubePoint, CubePoint> previousByCell, CubePoint target) {
        ArrayDeque<CubePoint> path = new ArrayDeque<>();
        CubePoint current = target;
        path.addFirst(current);
        while (previousByCell.containsKey(current)) {
            current = previousByCell.get(current);
            path.addFirst(current);
        }
        return List.copyOf(path);
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
