package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.model.geometry.Cell;
import src.domain.dungeon.model.core.model.geometry.Edge;

public final class DungeonEdge {
    private final DungeonCell from;
    private final DungeonCell to;

    public DungeonEdge(
            DungeonCell from,
            DungeonCell to
    ) {
        this.from = from;
        this.to = to;
    }

    public DungeonCell from() {
        return from;
    }

    public DungeonCell to() {
        return to;
    }

    public static DungeonEdge sideOf(DungeonCell cell, DungeonEdgeDirection direction) {
        Edge edge =
                Edge.sideOf(
                        cell == null ? new Cell(0, 0, 0) : cell.geometry(),
                        direction == null ? DungeonEdgeDirection.NORTH.geometry() : direction.geometry());
        return fromGeometry(edge);
    }

    public List<DungeonCell> touchingCells() {
        if (from == null || to == null) {
            return List.of();
        }
        List<DungeonCell> result = new ArrayList<>();
        for (Cell cell : geometry().touchingCells()) {
            result.add(DungeonCell.fromGeometry(cell));
        }
        return List.copyOf(result);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonEdge that
                && Objects.equals(from, that.from)
                && Objects.equals(to, that.to);
    }

    @Override
    public int hashCode() {
        return Objects.hash(from, to);
    }

    @Override
    public String toString() {
        return "DungeonEdge[from=" + from + ", to=" + to + "]";
    }

    private Edge geometry() {
        return new Edge(from.geometry(), to.geometry());
    }

    private static DungeonEdge fromGeometry(Edge edge) {
        return new DungeonEdge(
                DungeonCell.fromGeometry(edge.from()),
                DungeonCell.fromGeometry(edge.to()));
    }
}
