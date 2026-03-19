package features.world.dungeonmap.model.geometry;

public abstract class VertexPath {

    private final Point2i roomCell;
    private final Point2i delta;

    protected VertexPath(Point2i roomCell, Point2i delta) {
        this.roomCell = roomCell == null ? new Point2i(0, 0) : roomCell;
        this.delta = delta == null ? new Point2i(0, 0) : delta;
    }

    public final Point2i roomCell() {
        return roomCell;
    }

    public final Point2i delta() {
        return delta;
    }

    public final Point2i neighborCell() {
        return roomCell.add(delta);
    }

    public final boolean blocks(Point2i fromCell, Point2i stepDelta) {
        if (fromCell == null || stepDelta == null || !isBlocking()) {
            return false;
        }
        if (roomCell.equals(fromCell) && delta.equals(stepDelta)) {
            return true;
        }
        return neighborCell().equals(fromCell)
                && new Point2i(-delta.x(), -delta.y()).equals(stepDelta);
    }

    protected boolean isBlocking() {
        return true;
    }
}
