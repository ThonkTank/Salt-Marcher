package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
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
}

record DoorEdge(long roomId, VertexEdge edge, int levelZ) {
    static DoorEdge vertical(long roomId, CubePoint cell) {
        return new DoorEdge(roomId, null, cell == null ? 0 : cell.z());
    }

    boolean isVertical() {
        return edge == null;
    }
}
