package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class DoorExitCatalog {

    private static final Comparator<ExitEdge> EXIT_EDGE_ORDER = Comparator
            .comparing(ExitEdge::direction, Comparator.comparingInt(CardinalDirection::code))
            .thenComparing(ExitEdge::roomCell, CellCoord.ORDER)
            .thenComparing(ExitEdge::segment2x, GridSegment2x.ORDER);

    private DoorExitCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<RoomExitDescriptor> describe(Set<CellCoord> cells, int levelZ, List<? extends Connection> connections) {
        if (cells == null || cells.isEmpty() || connections == null || connections.isEmpty()) {
            return List.of();
        }
        List<ExitEdge> exitEdges = collectExitEdges(cells, levelZ, connections);
        if (exitEdges.isEmpty()) {
            return List.of();
        }
        List<List<ExitEdge>> openings = groupOpenings(exitEdges);
        List<RoomExitDescriptor> result = new ArrayList<>();
        for (int index = 0; index < openings.size(); index++) {
            List<ExitEdge> opening = openings.get(index);
            ExitEdge representative = opening.getFirst();
            int number = index + 1;
            result.add(new RoomExitDescriptor(
                    number,
                    levelZ,
                    representative.roomCell(),
                    representative.roomCell().add(representative.direction().delta()),
                    representative.direction(),
                    "Tür " + number,
                    representative.segment2x(),
                    opening.stream().map(ExitEdge::segment2x).sorted(GridSegment2x.ORDER).toList()));
        }
        return List.copyOf(result);
    }

    private static List<ExitEdge> collectExitEdges(Set<CellCoord> cells, int levelZ, List<? extends Connection> connections) {
        List<ExitEdge> result = new ArrayList<>();
        Set<GridSegment2x> boundarySegments = new LinkedHashSet<>();
        for (Connection connection : connections) {
            if (connection != null && connection.levelZ() == levelZ && connection.door() != null) {
                boundarySegments.addAll(connection.door().segments2x());
            }
        }
        for (GridSegment2x segment2x : boundarySegments) {
            if (segment2x == null) {
                continue;
            }
            Set<CellCoord> touchingCells = segment2x.touchingCells();
            if (touchingCells.size() != 2) {
                continue;
            }
            CellCoord roomCell = touchingCells.stream()
                    .filter(cells::contains)
                    .sorted(CellCoord.ORDER)
                    .findFirst()
                    .orElse(null);
            if (roomCell == null) {
                continue;
            }
            CardinalDirection direction = segment2x.directionFrom(roomCell);
            if (direction == null) {
                continue;
            }
            result.add(new ExitEdge(roomCell, direction, segment2x));
        }
        result.sort(EXIT_EDGE_ORDER);
        return List.copyOf(result);
    }

    private static List<List<ExitEdge>> groupOpenings(List<ExitEdge> exitEdges) {
        List<ExitEdge> remaining = new ArrayList<>(exitEdges);
        List<List<ExitEdge>> result = new ArrayList<>();
        while (!remaining.isEmpty()) {
            ExitEdge seed = remaining.removeFirst();
            List<ExitEdge> opening = new ArrayList<>();
            ArrayDeque<ExitEdge> queue = new ArrayDeque<>();
            queue.add(seed);
            while (!queue.isEmpty()) {
                ExitEdge current = queue.removeFirst();
                opening.add(current);
                for (int index = remaining.size() - 1; index >= 0; index--) {
                    ExitEdge candidate = remaining.get(index);
                    if (!candidate.direction().equals(current.direction())
                            || !candidate.segment2x().sharesEndpoint(current.segment2x())) {
                        continue;
                    }
                    remaining.remove(index);
                    queue.addLast(candidate);
                }
            }
            opening.sort(EXIT_EDGE_ORDER);
            result.add(List.copyOf(opening));
        }
        result.sort(Comparator.comparing((List<ExitEdge> opening) -> opening.getFirst(), EXIT_EDGE_ORDER));
        return List.copyOf(result);
    }

    private record ExitEdge(CellCoord roomCell, CardinalDirection direction, GridSegment2x segment2x) {
    }
}
