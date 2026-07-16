package features.dungeon.domain.core.component.boundary;

import features.dungeon.domain.core.geometry.Cell;

public record BoundaryCorner(Cell cell) {
    public BoundaryCorner {
        cell = cell == null ? new Cell(0, 0, 0) : cell;
    }
}
