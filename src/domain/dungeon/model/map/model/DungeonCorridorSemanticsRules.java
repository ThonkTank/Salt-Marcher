package src.domain.dungeon.model.map.model;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpointResolutionLogic.ResolvedCorridorEndpoint;

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

    public boolean equivalent(DungeonCorridor left, DungeonCorridor right) {
        return left != null
                && right != null
                && left.roomIds().equals(right.roomIds())
                && explicitEndpointSemantics(left).equals(explicitEndpointSemantics(right))
                && left.bindings().waypoints().equals(right.bindings().waypoints())
                && left.bindings().anchorBindings().equals(right.bindings().anchorBindings());
    }

    private static Set<CorridorEndpointSemantics> explicitEndpointSemantics(DungeonCorridor corridor) {
        LinkedHashSet<CorridorEndpointSemantics> result = new LinkedHashSet<>();
        for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
            result.add(CorridorEndpointSemantics.forDoor(binding));
        }
        for (DungeonCorridorAnchorRef ref : corridor.bindings().anchorRefs()) {
            if (ref != null && ref.present()) {
                result.add(CorridorEndpointSemantics.forAnchor(ref));
            }
        }
        return Set.copyOf(result);
    }

    private static CorridorEndpointSemantics semanticsOf(ResolvedCorridorEndpoint endpoint) {
        Objects.requireNonNull(endpoint, "endpoint");
        if (endpoint.doorBinding() != null) {
            return CorridorEndpointSemantics.forDoor(endpoint.doorBinding());
        }
        if (endpoint.anchorRef() != null) {
            return CorridorEndpointSemantics.forAnchor(endpoint.anchorRef());
        }
        throw new IllegalArgumentException("resolved endpoint must expose door or anchor semantics");
    }

    private record CorridorEndpointSemantics(
            String kind,
            long roomId,
            long clusterId,
            DungeonCell relativeCell,
            DungeonEdgeDirection direction,
            long hostCorridorId,
            DungeonTopologyRef topologyRef
    ) {
        private static final String DOOR_REF = "DOOR_REF";
        private static final String DOOR_LOCATION = "DOOR_LOCATION";
        private static final String ANCHOR = "ANCHOR";

        private CorridorEndpointSemantics {
            kind = kind == null ? "" : kind;
            relativeCell = relativeCell == null ? new DungeonCell(0, 0, 0) : relativeCell;
            direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }

        private static CorridorEndpointSemantics forDoor(DungeonCorridorDoorBinding binding) {
            if (binding.hasTopologyRef()) {
                return new CorridorEndpointSemantics(
                        DOOR_REF,
                        0L,
                        0L,
                        null,
                        null,
                        0L,
                        binding.topologyRef());
            }
            return new CorridorEndpointSemantics(
                    DOOR_LOCATION,
                    binding.roomId(),
                    binding.clusterId(),
                    binding.relativeCell(),
                    binding.direction(),
                    0L,
                    DungeonTopologyRef.empty());
        }

        private static CorridorEndpointSemantics forAnchor(DungeonCorridorAnchorRef ref) {
            return new CorridorEndpointSemantics(
                    ANCHOR,
                    0L,
                    0L,
                    null,
                    null,
                    ref.hostCorridorId(),
                    ref.topologyRef());
        }
    }
}
