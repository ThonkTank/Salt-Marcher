package features.dungeon.domain.core.component;

import features.dungeon.domain.core.geometry.Cell;
import java.util.Objects;

/** One absolute authored corridor waypoint. */
public record CorridorWaypoint(long clusterId, Cell cell) {
    public CorridorWaypoint {
        clusterId = Math.max(0L, clusterId);
        Objects.requireNonNull(cell);
    }

    public int level() {
        return cell.level();
    }
}
