package src.domain.dungeon.model.core.structure.corridor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.component.CorridorDoorBinding;

public record CorridorEndpointSemantics(
        Kind kind,
        long stableDoorId,
        @Nullable CorridorDoorBinding doorBinding,
        @Nullable CorridorAnchorRef anchorRef
) {

    public CorridorEndpointSemantics {
        if (kind == null) {
            throw new IllegalArgumentException("corridor endpoint semantics requires a kind");
        }
        switch (kind) {
            case STABLE_DOOR -> {
                if (stableDoorId <= 0L || doorBinding != null || anchorRef != null) {
                    throw new IllegalArgumentException("stable door semantics require only a stable door id");
                }
            }
            case DOOR_LOCATION -> {
                if (doorBinding == null || stableDoorId != 0L || anchorRef != null) {
                    throw new IllegalArgumentException("door location semantics require only a door binding");
                }
            }
            case ANCHOR -> {
                if (anchorRef == null || !anchorRef.present() || stableDoorId != 0L || doorBinding != null) {
                    throw new IllegalArgumentException("anchor semantics require only an anchor ref");
                }
            }
        }
    }

    public static CorridorEndpointSemantics forStableDoor(long stableDoorId) {
        return new CorridorEndpointSemantics(Kind.STABLE_DOOR, stableDoorId, null, null);
    }

    public static CorridorEndpointSemantics forDoor(CorridorDoorBinding binding) {
        return new CorridorEndpointSemantics(Kind.DOOR_LOCATION, 0L, binding, null);
    }

    public static CorridorEndpointSemantics forAnchor(CorridorAnchorRef ref) {
        return new CorridorEndpointSemantics(Kind.ANCHOR, 0L, null, ref);
    }

    public enum Kind {
        STABLE_DOOR,
        DOOR_LOCATION,
        ANCHOR
    }
}
