package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.List;
import java.util.Objects;

public record DoorConnectionCarrier(
        EdgeShape shape,
        GridSegment2x anchorSegment2x,
        boolean blocksPassage
) implements ConnectionCarrier {

    public DoorConnectionCarrier {
        shape = shape == null ? EdgeShape.empty() : EdgeShape.fromBoundarySegments(shape.segments2x());
        if (shape.isEmpty()) {
            throw new IllegalArgumentException("door connection shape fehlt");
        }
        anchorSegment2x = anchorSegment2x == null
                ? shape.segments2x().stream().sorted(GridSegment2x.ORDER).findFirst().orElse(null)
                : anchorSegment2x;
        anchorSegment2x = Objects.requireNonNull(anchorSegment2x, "anchorSegment2x");
    }

    public List<GridSegment2x> segments2x() {
        return shape.segments2x();
    }
}
