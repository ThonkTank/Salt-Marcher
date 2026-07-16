package features.dungeon.domain.core.structure.corridor;

import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.component.CorridorDoorBinding;

public record CorridorEndpointBinding(
        @Nullable CorridorDoorBinding doorBinding,
        @Nullable CorridorAnchorRef anchorRef
) {

    public CorridorEndpointBinding {
        if (doorBinding != null && anchorRef != null) {
            throw new IllegalArgumentException("corridor endpoint must not combine door binding and anchor ref");
        }
        if (doorBinding == null && (anchorRef == null || !anchorRef.present())) {
            throw new IllegalArgumentException("corridor endpoint requires a door binding or anchor ref");
        }
    }

    public static CorridorEndpointBinding forDoor(CorridorDoorBinding binding) {
        return new CorridorEndpointBinding(binding, null);
    }

    public static CorridorEndpointBinding forAnchor(CorridorAnchorRef ref) {
        return new CorridorEndpointBinding(null, ref);
    }

    public Corridor applyTo(Corridor corridor) {
        Corridor updated = corridor;
        if (doorBinding != null) {
            updated = updated.withDoorBinding(doorBinding);
        }
        if (anchorRef != null && anchorRef.present()) {
            updated = updated.withBindings(updated.coreBindings().withAnchorRef(anchorRef));
        }
        return updated;
    }
}
