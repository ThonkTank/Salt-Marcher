package src.domain.dungeon.model.core.structure.corridor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.component.CorridorDoorBinding;

public record CorridorResolvedEndpoint(
        @Nullable Long roomId,
        CorridorEndpointBinding binding,
        CorridorEndpointSemantics semantics
) {

    public CorridorResolvedEndpoint {
        if (binding == null) {
            throw new IllegalArgumentException("resolved corridor endpoint requires a binding");
        }
        if (semantics == null) {
            throw new IllegalArgumentException("resolved corridor endpoint requires semantics");
        }
        if (binding.doorBinding() != null) {
            if (roomId == null || roomId.longValue() != binding.doorBinding().roomId()) {
                throw new IllegalArgumentException("resolved door endpoint room id must match door binding");
            }
            if (!semantics.matchesDoorBinding(binding.doorBinding())) {
                throw new IllegalArgumentException("resolved door endpoint semantics must match door binding");
            }
        } else if (roomId != null || binding.anchorRef() == null || !binding.anchorRef().present()) {
            throw new IllegalArgumentException("resolved anchor endpoint requires only a present anchor ref");
        } else if (!semantics.matchesAnchorRef(binding.anchorRef())) {
            throw new IllegalArgumentException("resolved anchor endpoint semantics must match anchor ref");
        }
    }

    public static CorridorResolvedEndpoint forDoor(
            CorridorDoorBinding binding,
            CorridorEndpointSemantics semantics
    ) {
        return new CorridorResolvedEndpoint(
                binding.roomId(),
                CorridorEndpointBinding.forDoor(binding),
                semantics);
    }

    public static CorridorResolvedEndpoint forAnchor(CorridorAnchorRef ref) {
        return new CorridorResolvedEndpoint(
                null,
                CorridorEndpointBinding.forAnchor(ref),
                CorridorEndpointSemantics.forAnchor(ref));
    }

    public Corridor applyTo(Corridor corridor) {
        return binding.applyTo(corridor);
    }
}
