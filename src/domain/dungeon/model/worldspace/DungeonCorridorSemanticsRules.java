package src.domain.dungeon.model.worldspace;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.DungeonMapLookupAdapter;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingState;
import src.domain.dungeon.model.core.structure.corridor.CorridorEndpointSemantics;
import src.domain.dungeon.model.core.structure.corridor.CorridorResolvedEndpoint;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;

/**
 * Owns corridor endpoint equivalence and deduplication semantics.
 */
public final class DungeonCorridorSemanticsRules {

    private static final DungeonMapLookupAdapter LOOKUP_ADAPTER = new DungeonMapLookupAdapter();

    public boolean sameEndpoint(CorridorResolvedEndpoint left, CorridorResolvedEndpoint right) {
        return semanticsOf(left).equals(semanticsOf(right));
    }

    public boolean sameClusterOnly(DungeonMap dungeonMap, DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        if (start == null || end == null || !start.isDoorEndpoint() || !end.isDoorEndpoint()) {
            return false;
        }
        DungeonRoom left = LOOKUP_ADAPTER.room(dungeonMap, start.roomId());
        DungeonRoom right = LOOKUP_ADAPTER.room(dungeonMap, end.roomId());
        return left != null && right != null && left.clusterId() == right.clusterId();
    }

    public boolean matchingCorridorExists(List<Corridor> corridors, CorridorResolvedEndpoint start, CorridorResolvedEndpoint end) {
        Set<CorridorEndpointSemantics> requested = Set.of(semanticsOf(start), semanticsOf(end));
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor != null && explicitEndpointSemantics(corridor).equals(requested)) {
                return true;
            }
        }
        return false;
    }

    private static Set<CorridorEndpointSemantics> explicitEndpointSemantics(Corridor corridor) {
        Set<CorridorEndpointSemantics> result = new LinkedHashSet<>();
        for (CorridorDoorBindingState binding : corridor.stateBindings().doorBindings()) {
            result.add(doorSemantics(binding));
        }
        for (CorridorAnchorRef ref : corridor.stateBindings().anchorRefs()) {
            if (ref != null && ref.present()) {
                result.add(CorridorEndpointSemantics.forAnchor(ref));
            }
        }
        return Set.copyOf(result);
    }

    private static CorridorEndpointSemantics semanticsOf(CorridorResolvedEndpoint endpoint) {
        Objects.requireNonNull(endpoint, "endpoint");
        return endpoint.semantics();
    }

    static CorridorEndpointSemantics doorSemantics(CorridorDoorBindingState binding) {
        return isDoorTopologyRef(binding.topologyRef())
                ? CorridorEndpointSemantics.forStableDoor(binding.topologyRef().id())
                : CorridorEndpointSemantics.forDoor(binding.toCore());
    }

    private static boolean isDoorTopologyRef(DungeonTopologyRef ref) {
        return ref != null && ref.kind() == DungeonTopologyElementKind.DOOR && ref.id() > 0L;
    }
}
