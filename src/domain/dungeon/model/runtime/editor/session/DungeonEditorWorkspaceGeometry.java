package src.domain.dungeon.model.runtime.editor.session;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Cell;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Edge;

public final class DungeonEditorWorkspaceGeometry {
    private DungeonEditorWorkspaceGeometry() {
    }

    public static Cell movedCell(Cell cell, int deltaQ, int deltaR, int deltaLevel) {
        return new Cell(cell.q() + deltaQ, cell.r() + deltaR, cell.level() + deltaLevel);
    }

    public static Edge movedEdge(Edge edge, int deltaQ, int deltaR, int deltaLevel) {
        return new Edge(
                movedCell(edge.from(), deltaQ, deltaR, deltaLevel),
                movedCell(edge.to(), deltaQ, deltaR, deltaLevel));
    }

    public static Edge movedMatchingCell(Edge edge, Cell source, int deltaQ, int deltaR, int deltaLevel) {
        return new Edge(
                sameCell(edge.from(), source) ? movedCell(edge.from(), deltaQ, deltaR, deltaLevel) : edge.from(),
                sameCell(edge.to(), source) ? movedCell(edge.to(), deltaQ, deltaR, deltaLevel) : edge.to());
    }

    public static boolean edgeHasCell(Edge edge, Cell cell) {
        return sameCell(edge.from(), cell) || sameCell(edge.to(), cell);
    }

    public static boolean sameCell(Cell first, Cell second) {
        return first.q() == second.q() && first.r() == second.r() && first.level() == second.level();
    }

    public static Set<Cell> adjacentFloorCells(List<Edge> edges) {
        Set<Cell> result = new HashSet<>();
        for (Edge edge : edges) {
            result.addAll(adjacentFloorCells(edge));
        }
        return Set.copyOf(result);
    }

    public static Set<Cell> adjacentCornerCells(Cell corner) {
        return Set.of(
                new Cell(corner.q() - 1, corner.r() - 1, corner.level()),
                new Cell(corner.q(), corner.r() - 1, corner.level()),
                new Cell(corner.q() - 1, corner.r(), corner.level()),
                new Cell(corner.q(), corner.r(), corner.level()));
    }

    public static List<Cell> adjacentFloorCells(Edge edge) {
        Cell from = edge.from();
        Cell to = edge.to();
        if (from.level() != to.level()) {
            return List.of();
        }
        if (from.r() == to.r()) {
            int q = Math.min(from.q(), to.q());
            int r = from.r();
            return List.of(new Cell(q, r - 1, from.level()), new Cell(q, r, from.level()));
        }
        if (from.q() == to.q()) {
            int q = from.q();
            int r = Math.min(from.r(), to.r());
            return List.of(new Cell(q - 1, r, from.level()), new Cell(q, r, from.level()));
        }
        return List.of();
    }

    public static Set<EdgeKey> unitEdgeKeys(List<Edge> edges) {
        Set<EdgeKey> result = new HashSet<>();
        for (Edge edge : edges) {
            result.addAll(unitEdgeKeys(edge));
        }
        return Set.copyOf(result);
    }

    private static List<EdgeKey> unitEdgeKeys(Edge edge) {
        Cell from = edge.from();
        Cell to = edge.to();
        if (from.level() != to.level()) {
            return List.of(EdgeKey.of(edge));
        }
        int deltaQ = Integer.compare(to.q(), from.q());
        int deltaR = Integer.compare(to.r(), from.r());
        if (deltaQ != 0 && deltaR != 0) {
            return List.of(EdgeKey.of(edge));
        }
        List<EdgeKey> result = new ArrayList<>();
        for (int q = from.q(), r = from.r(); q != to.q() || r != to.r(); q += deltaQ, r += deltaR) {
            result.add(new EdgeKey(
                    new CellKey(q, r, from.level()),
                    new CellKey(q + deltaQ, r + deltaR, from.level())));
        }
        return List.copyOf(result);
    }

    public record CellKey(int q, int r, int level) {
        static CellKey of(Cell cell) {
            return new CellKey(cell.q(), cell.r(), cell.level());
        }
    }

    public record EdgeKey(CellKey first, CellKey second) {
        public EdgeKey {
            if (compare(second, first) < 0) {
                CellKey originalFirst = first;
                first = second;
                second = originalFirst;
            }
        }

        public static EdgeKey of(Edge edge) {
            return new EdgeKey(CellKey.of(edge.from()), CellKey.of(edge.to()));
        }

        private static int compare(CellKey left, CellKey right) {
            int level = Integer.compare(left.level(), right.level());
            if (level != 0) {
                return level;
            }
            int q = Integer.compare(left.q(), right.q());
            return q != 0 ? q : Integer.compare(left.r(), right.r());
        }
    }
}
