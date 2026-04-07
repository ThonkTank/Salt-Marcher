package features.world.dungeon.model.structures.connection;

import features.world.dungeon.dungoenmap.model.DungeonMap;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.dungoenmap.structure.model.boundary.door.DoorRef;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class DoorExitCatalog {

    private static final Comparator<ExitEdge> EXIT_EDGE_ORDER = Comparator
            .comparing(ExitEdge::direction, Comparator.comparingInt(CardinalDirection::code))
            .thenComparing(ExitEdge::roomCell, GridPoint.ORDER)
            .thenComparing(ExitEdge::segment2x, GridSegment.ORDER);

    private DoorExitCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<DoorExitDescriptor> describe(
            DungeonMap layout,
            Set<GridPoint> cells,
            int levelZ,
            List<? extends Connection> connections
    ) {
        if (cells == null || cells.isEmpty() || connections == null || connections.isEmpty()) {
            return List.of();
        }
        List<ExitEdge> exitEdges = collectExitEdges(layout, cells, levelZ, connections);
        if (exitEdges.isEmpty()) {
            return List.of();
        }
        List<List<ExitEdge>> openings = groupOpenings(exitEdges);
        List<DoorExitDescriptor> result = new ArrayList<>();
        for (int index = 0; index < openings.size(); index++) {
            List<ExitEdge> opening = openings.get(index);
            ExitEdge representative = opening.getFirst();
            int number = index + 1;
            result.add(new DoorExitDescriptor(
                    representative.doorRef(),
                    number,
                    levelZ,
                    representative.roomCell(),
                    representative.roomCell().step(representative.direction()),
                    representative.direction(),
                    "Tür " + number));
        }
        return List.copyOf(result);
    }

    private static List<ExitEdge> collectExitEdges(
            DungeonMap layout,
            Set<GridPoint> cells,
            int levelZ,
            List<? extends Connection> connections
    ) {
        List<ExitEdge> result = new ArrayList<>();
        for (Connection connection : connections) {
            if (connection == null || connection.levelZ() != levelZ || connection.doorCarrier() == null) {
                continue;
            }
            DoorRef doorRef = connection.doorRef();
            if (doorRef == null) {
                continue;
            }
            Set<GridSegment> boundarySegments = new LinkedHashSet<>(connection.boundarySegments(layout));
            for (GridSegment segment2x : boundarySegments) {
                if (segment2x == null) {
                    continue;
                }
                Set<GridPoint> touchingCells = segment2x.touchingCells().cells();
                if (touchingCells.size() != 2) {
                    continue;
                }
                GridPoint roomCell = touchingCells.stream()
                        .filter(cells::contains)
                        .sorted(GridPoint.ORDER)
                        .findFirst()
                        .orElse(null);
                if (roomCell == null) {
                    continue;
                }
                CardinalDirection direction = segment2x.directionFrom(roomCell);
                if (direction == null) {
                    continue;
                }
                result.add(new ExitEdge(roomCell, direction, segment2x, doorRef));
            }
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
                            || current.segment2x().sharedEndpoint(candidate.segment2x()).isEmpty()) {
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

    private record ExitEdge(GridPoint roomCell, CardinalDirection direction, GridSegment segment2x, DoorRef doorRef) {
    }
}
