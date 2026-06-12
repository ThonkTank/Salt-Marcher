package src.domain.dungeon.model.core.component.boundary;

import src.domain.dungeon.model.core.geometry.Cell;

public record BoundaryCorner(Cell cell) {
    public BoundaryCorner {
        cell = cell == null ? new Cell(0, 0, 0) : cell;
    }
}
