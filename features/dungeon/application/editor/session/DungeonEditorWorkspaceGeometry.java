package features.dungeon.application.editor.session;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;

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

    public static List<Edge> unitEdges(List<Edge> edges) {
        List<Edge> result = new ArrayList<>();
        for (Edge edge : edges == null ? List.<Edge>of() : edges) {
            result.addAll(unitEdges(edge));
        }
        return List.copyOf(result);
    }

    private static List<Edge> unitEdges(Edge edge) {
        Cell from = edge.from();
        Cell to = edge.to();
        if (from.level() != to.level()) {
            return List.of(edge);
        }
        int deltaQ = Integer.compare(to.q(), from.q());
        int deltaR = Integer.compare(to.r(), from.r());
        if (deltaQ != 0 && deltaR != 0) {
            return List.of(edge);
        }
        List<Edge> result = new ArrayList<>();
        for (int q = from.q(), r = from.r(); q != to.q() || r != to.r(); q += deltaQ, r += deltaR) {
            result.add(new Edge(
                    new Cell(q, r, from.level()),
                    new Cell(q + deltaQ, r + deltaR, from.level())));
        }
        return List.copyOf(result);
    }

    private static List<EdgeKey> unitEdgeKeys(Edge edge) {
        Cell from = edge.from();
        Cell to = edge.to();
        if (from.level() != to.level()) {
            return List.of(EdgeKey.from(edge));
        }
        int deltaQ = Integer.compare(to.q(), from.q());
        int deltaR = Integer.compare(to.r(), from.r());
        if (deltaQ != 0 && deltaR != 0) {
            return List.of(EdgeKey.from(edge));
        }
        List<EdgeKey> result = new ArrayList<>();
        for (int q = from.q(), r = from.r(); q != to.q() || r != to.r(); q += deltaQ, r += deltaR) {
            result.add(new EdgeKey(
                    new Cell(q, r, from.level()),
                    new Cell(q + deltaQ, r + deltaR, from.level())));
        }
        return List.copyOf(result);
    }

}
