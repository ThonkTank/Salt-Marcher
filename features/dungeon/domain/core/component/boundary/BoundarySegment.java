package features.dungeon.domain.core.component.boundary;

import java.util.Objects;
import features.dungeon.domain.core.geometry.EdgeKey;

public record BoundarySegment(
        EdgeKey edgeKey,
        BoundaryKind kind
) {
    public BoundarySegment {
        Objects.requireNonNull(edgeKey);
        kind = kind == null ? BoundaryKind.wall() : kind;
    }
}
