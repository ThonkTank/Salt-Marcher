package features.dungeon.domain.core.structure.corridor;

import features.dungeon.domain.core.component.CorridorDoorBinding;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.RoomRegion;

/**
 * Owns corridor endpoint equivalence and deduplication semantics.
 */
final class CorridorEndpointMatching {

    boolean sameEndpoint(CorridorResolvedEndpoint left, CorridorResolvedEndpoint right) {
        return semanticsOf(left).equals(semanticsOf(right));
    }

    boolean sameClusterOnly(DungeonMap dungeonMap, DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        if (start == null || end == null || !start.isDoorEndpoint() || !end.isDoorEndpoint()) {
            return false;
        }
        RoomRegion left = CorridorMapLookup.room(dungeonMap, start.roomId());
        RoomRegion right = CorridorMapLookup.room(dungeonMap, end.roomId());
        return left != null && right != null && left.clusterId() == right.clusterId();
    }

    boolean matchingCorridorExists(
            List<Corridor> corridors,
            CorridorResolvedEndpoint start,
            CorridorResolvedEndpoint end
    ) {
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
        for (CorridorDoorBinding binding : corridor.bindings().doorBindings()) {
            result.add(doorSemantics(binding));
        }
        for (CorridorAnchorRef ref : corridor.bindings().anchorRefs()) {
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

    static CorridorEndpointSemantics doorSemantics(CorridorDoorBinding binding) {
        return isDoorTopologyRef(binding.topologyRef())
                ? CorridorEndpointSemantics.forStableDoor(binding.topologyRef().id())
                : CorridorEndpointSemantics.forDoor(binding.withoutTopologyRef());
    }

    private static boolean isDoorTopologyRef(DungeonTopologyRef ref) {
        return ref != null && ref.kind() == DungeonTopologyElementKind.DOOR && ref.id() > 0L;
    }
}
