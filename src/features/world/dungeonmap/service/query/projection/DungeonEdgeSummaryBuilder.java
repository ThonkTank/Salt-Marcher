package features.world.dungeonmap.service.query.projection;

import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.domain.DungeonWall;
import features.world.dungeonmap.model.projection.edge.DungeonEdgeIndex;
import features.world.dungeonmap.model.projection.edge.DungeonEdgeSummary;
import features.world.dungeonmap.model.rules.DungeonEdgeRules;
import features.world.dungeonmap.model.domain.PassageDirection;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonEdgeSummaryBuilder {

    private DungeonEdgeSummaryBuilder() {
        throw new AssertionError("No instances");
    }

    public static DungeonEdgeIndex buildIndex(
            Collection<DungeonSquare> squares,
            Collection<DungeonWall> walls,
            Collection<DungeonPassage> passages
    ) {
        return buildIndexInternal(squares, walls, passages);
    }

    /*
     * Preview and persisted reads now share the same derived edge model: one-sided boundaries
     * are synthesized from squares, while persisted wall rows represent only interior walls.
     */
    public static DungeonEdgeIndex buildPreviewIndex(
            Collection<DungeonSquare> squares,
            Collection<DungeonWall> walls,
            Collection<DungeonPassage> passages
    ) {
        return buildIndex(squares, walls, passages);
    }

    private static DungeonEdgeIndex buildIndexInternal(
            Collection<DungeonSquare> squares,
            Collection<DungeonWall> walls,
            Collection<DungeonPassage> passages
    ) {
        Map<String, DungeonSquare> squaresByCoord = squaresByCoord(squares);
        Map<String, DungeonWall> wallsByEdge = wallsByEdge(walls);
        Map<String, DungeonPassage> passagesByEdge = passagesByEdge(passages);
        addBoundaryWalls(squaresByCoord, wallsByEdge, passagesByEdge);
        Map<String, DungeonEdgeSummary> edgesByKey = new LinkedHashMap<>();

        List<DungeonSquare> sortedSquares = new ArrayList<>(squares == null ? List.of() : squares);
        sortedSquares.sort(Comparator
                .comparingInt(DungeonSquare::y)
                .thenComparingInt(DungeonSquare::x));
        for (DungeonSquare square : sortedSquares) {
            addEdge(edgesByKey, squaresByCoord, wallsByEdge, passagesByEdge, square.x(), square.y(), PassageDirection.EAST);
            addEdge(edgesByKey, squaresByCoord, wallsByEdge, passagesByEdge, square.x(), square.y(), PassageDirection.SOUTH);
        }

        for (DungeonWall wall : wallsByEdge.values()) {
            edgesByKey.putIfAbsent(wall.edgeKey(), buildEdge(squaresByCoord, wall.x(), wall.y(), wall.direction(), wall, passagesByEdge.get(wall.edgeKey())));
        }
        for (DungeonPassage passage : passagesByEdge.values()) {
            edgesByKey.putIfAbsent(
                    passage.edgeKey(),
                    buildEdge(squaresByCoord, passage.x(), passage.y(), passage.direction(), wallsByEdge.get(passage.edgeKey()), passage));
        }

        return new DungeonEdgeIndex(Map.copyOf(edgesByKey));
    }

    private static void addEdge(
            Map<String, DungeonEdgeSummary> edgesByKey,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> wallsByEdge,
            Map<String, DungeonPassage> passagesByEdge,
            int x,
            int y,
            PassageDirection direction
    ) {
        String edgeKey = direction.edgeKey(x, y);
        edgesByKey.put(edgeKey, buildEdge(squaresByCoord, x, y, direction, wallsByEdge.get(edgeKey), passagesByEdge.get(edgeKey)));
    }

    private static DungeonEdgeSummary buildEdge(
            Map<String, DungeonSquare> squaresByCoord,
            int x,
            int y,
            PassageDirection direction,
            DungeonWall wall,
            DungeonPassage passage
    ) {
        DungeonSquare sideASquare = squaresByCoord.get(coordKey(x, y));
        DungeonSquare sideBSquare = direction == PassageDirection.EAST
                ? squaresByCoord.get(coordKey(x + 1, y))
                : squaresByCoord.get(coordKey(x, y + 1));
        return new DungeonEdgeSummary(
                x,
                y,
                direction,
                wall,
                passage,
                sideASquare,
                sideBSquare);
    }

    private static Map<String, DungeonSquare> squaresByCoord(Collection<DungeonSquare> squares) {
        Map<String, DungeonSquare> result = new LinkedHashMap<>();
        if (squares == null) {
            return result;
        }
        for (DungeonSquare square : squares) {
            result.put(coordKey(square.x(), square.y()), square);
        }
        return result;
    }

    private static Map<String, DungeonWall> wallsByEdge(Collection<DungeonWall> walls) {
        Map<String, DungeonWall> result = new LinkedHashMap<>();
        if (walls == null) {
            return result;
        }
        for (DungeonWall wall : walls) {
            result.put(wall.edgeKey(), wall);
        }
        return result;
    }

    private static Map<String, DungeonPassage> passagesByEdge(Collection<DungeonPassage> passages) {
        Map<String, DungeonPassage> result = new LinkedHashMap<>();
        if (passages == null) {
            return result;
        }
        for (DungeonPassage passage : passages) {
            result.put(passage.edgeKey(), passage);
        }
        return result;
    }

    private static void addBoundaryWalls(
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> wallsByEdge,
            Map<String, DungeonPassage> passagesByEdge
    ) {
        Long mapId = resolveMapId(squaresByCoord, wallsByEdge, passagesByEdge);
        if (mapId == null) {
            return;
        }
        for (DungeonSquare square : squaresByCoord.values()) {
            ensureBoundaryWall(squaresByCoord, wallsByEdge, mapId, square.x(), square.y(), PassageDirection.EAST);
            ensureBoundaryWall(squaresByCoord, wallsByEdge, mapId, square.x() - 1, square.y(), PassageDirection.EAST);
            ensureBoundaryWall(squaresByCoord, wallsByEdge, mapId, square.x(), square.y(), PassageDirection.SOUTH);
            ensureBoundaryWall(squaresByCoord, wallsByEdge, mapId, square.x(), square.y() - 1, PassageDirection.SOUTH);
        }
    }

    private static void ensureBoundaryWall(
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> wallsByEdge,
            long mapId,
            int x,
            int y,
            PassageDirection direction
    ) {
        DungeonSquare sideA = squaresByCoord.get(coordKey(x, y));
        DungeonSquare sideB = direction == PassageDirection.EAST
                ? squaresByCoord.get(coordKey(x + 1, y))
                : squaresByCoord.get(coordKey(x, y + 1));
        if (!DungeonEdgeRules.isBoundary(sideA, sideB)) {
            return;
        }
        String edgeKey = direction.edgeKey(x, y);
        wallsByEdge.putIfAbsent(edgeKey, new DungeonWall(null, mapId, x, y, direction));
    }

    private static Long resolveMapId(
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> wallsByEdge,
            Map<String, DungeonPassage> passagesByEdge
    ) {
        if (!wallsByEdge.isEmpty()) {
            return wallsByEdge.values().iterator().next().mapId();
        }
        if (!passagesByEdge.isEmpty()) {
            return passagesByEdge.values().iterator().next().mapId();
        }
        if (!squaresByCoord.isEmpty()) {
            return squaresByCoord.values().iterator().next().mapId();
        }
        return null;
    }

    private static String coordKey(int x, int y) {
        return x + ":" + y;
    }
}
