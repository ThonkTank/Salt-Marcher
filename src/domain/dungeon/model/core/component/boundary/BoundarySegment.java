package src.domain.dungeon.model.core.component.boundary;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.EdgeKey;

public record BoundarySegment(
        EdgeKey edgeKey,
        BoundaryKind kind
) {
    public BoundarySegment {
        Objects.requireNonNull(edgeKey);
        kind = kind == null ? BoundaryKind.wall() : kind;
    }
}
