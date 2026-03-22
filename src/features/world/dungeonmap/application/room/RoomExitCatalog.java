package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class RoomExitCatalog {

    private static final Comparator<ExitEdge> EXIT_EDGE_ORDER = Comparator
            .comparing(ExitEdge::direction, RoomExitCatalog::compareDirection)
            .thenComparing(ExitEdge::roomCell, Point2i.POINT_ORDER)
            .thenComparing(ExitEdge::edge, VertexEdge.EDGE_ORDER);

    private RoomExitCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<RoomExitDescriptor> describe(Room room) {
        if (room == null || room.doors().isEmpty()) {
            return List.of();
        }
        List<ExitEdge> exitEdges = collectExitEdges(room);
        if (exitEdges.isEmpty()) {
            return List.of();
        }
        List<List<ExitEdge>> openings = groupOpenings(exitEdges);
        Map<String, Integer> countsBySide = new LinkedHashMap<>();
        List<RoomExitDescriptor> result = new ArrayList<>();
        for (List<ExitEdge> opening : openings) {
            ExitEdge representative = opening.getFirst();
            String side = sideLabel(representative.direction());
            int ordinal = countsBySide.merge(side, 1, Integer::sum);
            result.add(new RoomExitDescriptor(
                    representative.roomCell(),
                    representative.direction(),
                    "Ausgang " + side + " " + ordinal,
                    opening.stream().map(ExitEdge::edge).sorted(VertexEdge.EDGE_ORDER).toList()));
        }
        return List.copyOf(result);
    }

    private static List<ExitEdge> collectExitEdges(Room room) {
        List<ExitEdge> result = new ArrayList<>();
        Set<VertexEdge> doorEdges = new LinkedHashSet<>();
        for (Door door : room.doors()) {
            if (door != null) {
                doorEdges.addAll(door.edges());
            }
        }
        for (Point2i cell : room.cells()) {
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

    private static String sideLabel(Point2i direction) {
        return switch (direction.x() + "," + direction.y()) {
            case "0,-1" -> "Nord";
            case "1,0" -> "Ost";
            case "0,1" -> "Sued";
            case "-1,0" -> "West";
            default -> "Unbekannt";
        };
    }

    private static int compareDirection(Point2i left, Point2i right) {
        return Integer.compare(directionOrder(left), directionOrder(right));
    }

    private static int directionOrder(Point2i direction) {
        return switch (direction.x() + "," + direction.y()) {
            case "0,-1" -> 0;
            case "1,0" -> 1;
            case "0,1" -> 2;
            case "-1,0" -> 3;
            default -> 4;
        };
    }

    private record ExitEdge(Point2i roomCell, Point2i direction, VertexEdge edge) {
    }
}
