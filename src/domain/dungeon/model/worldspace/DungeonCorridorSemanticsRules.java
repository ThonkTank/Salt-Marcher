package src.domain.dungeon.model.worldspace;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.structure.corridor.CorridorEndpointSemantics;
import src.domain.dungeon.model.worldspace.DungeonCorridorEndpointResolutionLogic.ResolvedCorridorEndpoint;

/**
 * Owns corridor endpoint equivalence and deduplication semantics.
 */
public final class DungeonCorridorSemanticsRules {

    public boolean sameEndpoint(ResolvedCorridorEndpoint left, ResolvedCorridorEndpoint right) {
        return semanticsOf(left).equals(semanticsOf(right));
    }

    public boolean matchingCorridorExists(List<DungeonCorridor> corridors, ResolvedCorridorEndpoint start, ResolvedCorridorEndpoint end) {
        Set<CorridorEndpointSemantics> requested = Set.of(semanticsOf(start), semanticsOf(end));
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (corridor != null && explicitEndpointSemantics(corridor).equals(requested)) {
                return true;
            }
        }
        return false;
    }

    private static Set<CorridorEndpointSemantics> explicitEndpointSemantics(DungeonCorridor corridor) {
        Set<CorridorEndpointSemantics> result = new LinkedHashSet<>();
        for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
            result.add(doorSemantics(binding));
        }
        for (CorridorAnchorRef ref : corridor.bindings().anchorRefs()) {
            if (ref != null && ref.present()) {
                result.add(CorridorEndpointSemantics.forAnchor(ref));
            }
        }
        return Set.copyOf(result);
    }

    private static CorridorEndpointSemantics semanticsOf(ResolvedCorridorEndpoint endpoint) {
        Objects.requireNonNull(endpoint, "endpoint");
        if (endpoint.doorBinding() != null) {
            return doorSemantics(endpoint.doorBinding());
        }
        if (endpoint.anchorRef() != null) {
            return CorridorEndpointSemantics.forAnchor(endpoint.anchorRef());
        }
        throw new IllegalArgumentException("resolved endpoint must expose door or anchor semantics");
    }

    private static CorridorEndpointSemantics doorSemantics(DungeonCorridorDoorBinding binding) {
        return isDoorTopologyRef(binding.topologyRef())
                ? CorridorEndpointSemantics.forStableDoor(binding.topologyRef().id())
                : CorridorEndpointSemantics.forDoor(binding.toCore());
    }

    private static boolean isDoorTopologyRef(DungeonTopologyRef ref) {
        return ref != null && ref.kind() == DungeonTopologyElementKind.DOOR && ref.id() > 0L;
    }
}
