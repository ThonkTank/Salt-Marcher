package src.domain.dungeon.model.map.model;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import src.domain.dungeon.model.map.model.DungeonCorridor;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpointResolutionLogic.ResolvedCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonCorridorAnchorRef;
import src.domain.dungeon.model.map.model.DungeonCorridorDoorBinding;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

/**
 * Owns corridor endpoint equivalence and deduplication semantics.
 */
public final class DungeonCorridorSemanticsRules {

    public boolean sameEndpoint(ResolvedCorridorEndpoint left, ResolvedCorridorEndpoint right) {
        return semanticsOf(left).equals(semanticsOf(right));
    }

    public boolean matchingCorridorExists(List<DungeonCorridor> corridors, ResolvedCorridorEndpoint start, ResolvedCorridorEndpoint end) {
        Set<CorridorEndpointSemantics> requested = Set.of(semanticsOf(start), semanticsOf(end));
        return (corridors == null ? List.<DungeonCorridor>of() : corridors).stream()
                .anyMatch(corridor -> explicitEndpointSemantics(corridor).equals(requested));
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

    private sealed interface CorridorEndpointSemantics permits DoorByRefSemantics, DoorByLocationSemantics, AnchorSemantics {

        static CorridorEndpointSemantics forDoor(DungeonCorridorDoorBinding binding) {
            if (binding.hasTopologyRef()) {
                return new DoorByRefSemantics(binding.topologyRef());
            }
            return new DoorByLocationSemantics(
                    binding.roomId(),
                    binding.clusterId(),
                    binding.relativeCell(),
                    binding.direction());
        }

        static CorridorEndpointSemantics forAnchor(DungeonCorridorAnchorRef ref) {
            return new AnchorSemantics(ref.hostCorridorId(), ref.topologyRef());
        }
    }

    private record DoorByRefSemantics(DungeonTopologyRef topologyRef) implements CorridorEndpointSemantics {
    }

    private record DoorByLocationSemantics(
            long roomId,
            long clusterId,
            DungeonCell relativeCell,
            DungeonEdgeDirection direction
    ) implements CorridorEndpointSemantics {
    }

    private static final class AnchorSemantics implements CorridorEndpointSemantics {
        private final long hostCorridorId;
        private final DungeonTopologyRef topologyRef;

        private AnchorSemantics(long hostCorridorId, DungeonTopologyRef topologyRef) {
            this.hostCorridorId = hostCorridorId;
            this.topologyRef = topologyRef;
        }

        @Override
        public boolean equals(Object other) {
            return other instanceof AnchorSemantics that
                    && hostCorridorId == that.hostCorridorId
                    && Objects.equals(topologyRef, that.topologyRef);
        }

        @Override
        public int hashCode() {
            return Objects.hash(hostCorridorId, topologyRef);
        }
    }
}
