package features.dungeon.domain.core.component;

import java.util.Objects;
import features.dungeon.domain.core.geometry.Cell;

public record CorridorAnchor(long anchorId, long hostCorridorId, Cell position) {

    public CorridorAnchor {
        anchorId = Math.max(0L, anchorId);
        hostCorridorId = Math.max(0L, hostCorridorId);
        Objects.requireNonNull(position);
    }

    public CorridorAnchor withPosition(Cell nextPosition) {
        return new CorridorAnchor(anchorId, hostCorridorId, nextPosition);
    }

    public boolean matchesPosition(Cell candidate) {
        return position.equals(candidate);
    }
}
