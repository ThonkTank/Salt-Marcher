package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.connection.Connection;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

public final class DoorExitCatalog {

    private static final Comparator<ExitEdge> EXIT_EDGE_ORDER = Comparator
            .comparing(ExitEdge::direction, DoorExitCatalog::compareDirection)
            .thenComparing(ExitEdge::roomCell, Point2i.POINT_ORDER)
            .thenComparing(ExitEdge::edge, VertexEdge.EDGE_ORDER);

    private DoorExitCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<RoomExitDescriptor> describe(Set<Point2i> cells, List<? extends Connection> connections) {
        if (cells == null || cells.isEmpty() || connections == null || connections.isEmpty()) {
            return List.of();
        }
        List<ExitEdge> exitEdges = collectExitEdges(cells, connections);
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
                    representative.roomCell(),
                    representative.roomCell().add(representative.direction()),
                    representative.direction(),
                    "Tür " + number,
                    representative.edge(),
                    opening.stream().map(ExitEdge::edge).sorted(VertexEdge.EDGE_ORDER).toList()));
        }
        return List.copyOf(result);
    }

    private static List<ExitEdge> collectExitEdges(Set<Point2i> cells, List<? extends Connection> connections) {
        List<ExitEdge> result = new ArrayList<>();
        Set<VertexEdge> doorEdges = new java.util.LinkedHashSet<>();
        for (Connection connection : connections) {
            if (connection != null && connection.door() != null) {
                doorEdges.addAll(connection.door().edges());
            }
        }
        for (Point2i cell : cells) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                VertexEdge edge = VertexEdge.betweenCellAndStep(cell, step);
                if (doorEdges.contains(edge)) {
                    result.add(new ExitEdge(cell, step, edge));
                }
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
                    if (!candidate.direction().equals(current.direction()) || !candidate.edge().touches(current.edge())) {
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

    private static int compareDirection(Point2i left, Point2i right) {
        return Integer.compare(directionOrder(left), directionOrder(right));
    }

    private static int directionOrder(Point2i direction) {
        if (direction == null) {
            return 4;
        }
        if (direction.x() == 0 && direction.y() == -1) {
            return 0;
        }
        if (direction.x() == 1 && direction.y() == 0) {
            return 1;
        }
        if (direction.x() == 0 && direction.y() == 1) {
            return 2;
        }
        if (direction.x() == -1 && direction.y() == 0) {
            return 3;
        }
        return 4;
    }

    private record ExitEdge(Point2i roomCell, Point2i direction, VertexEdge edge) {
    }
}
