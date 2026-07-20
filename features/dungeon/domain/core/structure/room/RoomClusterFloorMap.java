package features.dungeon.domain.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import features.dungeon.domain.core.component.floor.FloorCellMap;
import features.dungeon.domain.core.geometry.Cell;

public final class RoomClusterFloorMap {
    private final FloorCellMap delegate;

    public RoomClusterFloorMap(Map<Integer, ? extends Iterable<Cell>> cellsByLevel) {
        this(new FloorCellMap(cellsByLevel));
    }

    public RoomClusterFloorMap(FloorCellMap floorCellMap) {
        this.delegate = floorCellMap == null ? new FloorCellMap(Map.of()) : floorCellMap;
    }

    public static RoomClusterFloorMap fromCells(Iterable<Cell> cells) {
        return new RoomClusterFloorMap(FloorCellMap.fromCells(cells));
    }

    public Map<Integer, List<Cell>> cellsByLevel() {
        return delegate.cellsByLevel();
    }

    public List<Cell> cellsAt(int level) {
        return delegate.cellsAt(level);
    }

    public List<Cell> allCells() {
        return delegate.allCells();
    }

    public Cell preferredCentroidOr(int preferredLevel, Cell fallback) {
        return delegate.preferredCentroidOr(preferredLevel, fallback);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof RoomClusterFloorMap that
                && delegate.equals(that.delegate);
    }

    @Override
    public int hashCode() {
        return Objects.hash(delegate);
    }

}
