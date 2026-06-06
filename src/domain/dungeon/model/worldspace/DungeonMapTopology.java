package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.transition.Transition;

/**
 * Map-owned topology index for authored element refs and semantic bindings.
 */
public record DungeonMapTopology(
        List<DungeonTopologyBinding> bindings
) {

    public DungeonMapTopology {
        bindings = bindings == null ? List.of() : List.copyOf(bindings);
    }

    public static DungeonMapTopology from(
            SpatialTopology topology,
            RoomCatalog rooms,
            List<DungeonCorridor> corridors,
            List<Stair> stairs,
            List<Transition> transitions
    ) {
        List<DungeonTopologyBinding> result = new ArrayList<>();
        appendRoomBindings(result, rooms);
        appendCorridorBindings(result, corridors);
        appendStairBindings(result, stairs);
        appendTransitionBindings(result, transitions);
        appendBoundaryBindings(result, topology);
        return new DungeonMapTopology(result);
    }

    private static void appendRoomBindings(List<DungeonTopologyBinding> result, RoomCatalog rooms) {
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms.rooms()) {
            result.add(new DungeonTopologyBinding(
                    new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                    room.clusterId(),
                    0L,
                    room.name()));
        }
    }

    private static void appendCorridorBindings(List<DungeonTopologyBinding> result, List<DungeonCorridor> corridors) {
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            result.add(new DungeonTopologyBinding(
                    new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, corridor.corridorId()),
                    0L,
                    corridor.corridorId(),
                    "Corridor " + corridor.corridorId()));
            appendDoorBindings(result, corridor);
            appendAnchorBindings(result, corridor);
        }
    }

    private static void appendDoorBindings(List<DungeonTopologyBinding> result, DungeonCorridor corridor) {
        for (DungeonCorridorDoorBinding doorBinding : corridor.bindings().doorBindings()) {
            if (doorBinding.topologyRef().present()) {
                result.add(new DungeonTopologyBinding(
                        doorBinding.topologyRef(),
                        doorBinding.clusterId(),
                        corridor.corridorId(),
                        "Door " + doorBinding.topologyRef().id()));
            }
        }
    }

    private static void appendAnchorBindings(List<DungeonTopologyBinding> result, DungeonCorridor corridor) {
        for (DungeonCorridorAnchorBinding anchorBinding : corridor.bindings().anchorBindings()) {
            if (anchorBinding.topologyRef().present()) {
                result.add(new DungeonTopologyBinding(
                        anchorBinding.topologyRef(),
                        0L,
                        corridor.corridorId(),
                        "Corridor Anchor " + anchorBinding.topologyRef().id()));
            }
        }
    }

    private static void appendStairBindings(List<DungeonTopologyBinding> result, List<Stair> stairs) {
        for (Stair stair : stairs == null ? List.<Stair>of() : stairs) {
            result.add(new DungeonTopologyBinding(
                    new DungeonTopologyRef(DungeonTopologyElementKind.STAIR, stair.stairId()),
                    0L,
                    stair.corridorId() == null ? 0L : stair.corridorId(),
                    stair.name()));
        }
    }

    private static void appendTransitionBindings(List<DungeonTopologyBinding> result, List<Transition> transitions) {
        for (Transition transition : transitions == null ? List.<Transition>of() : transitions) {
            result.add(new DungeonTopologyBinding(
                    new DungeonTopologyRef(DungeonTopologyElementKind.TRANSITION, transition.transitionId()),
                    0L,
                    0L,
                    transition.label()));
        }
    }

    private static void appendBoundaryBindings(List<DungeonTopologyBinding> result, SpatialTopology topology) {
        for (DungeonRoomCluster cluster : topology == null ? List.<DungeonRoomCluster>of() : topology.roomClusters()) {
            for (List<DungeonClusterBoundary> boundaries : cluster.boundariesByLevel().values()) {
                for (DungeonClusterBoundary boundary : boundaries) {
                    if (!boundary.kind().renderable()) {
                        continue;
                    }
                    DungeonTopologyRef ref = boundary.resolvedTopologyRef(cluster.center());
                    result.add(new DungeonTopologyBinding(
                            ref,
                            cluster.clusterId(),
                            0L,
                            labelFor(ref.kind())));
                }
            }
        }
    }

    public static DungeonMapTopology merge(@Nullable DungeonMapTopology primary, DungeonMapTopology fallback) {
        Map<DungeonTopologyRef, DungeonTopologyBinding> result = new LinkedHashMap<>();
        for (DungeonTopologyBinding binding : primary == null ? List.<DungeonTopologyBinding>of() : primary.bindings()) {
            if (binding.ref().present()) {
                result.put(binding.ref(), binding);
            }
        }
        for (DungeonTopologyBinding binding : fallback == null ? List.<DungeonTopologyBinding>of() : fallback.bindings()) {
            if (binding.ref().present()) {
                result.putIfAbsent(binding.ref(), binding);
            }
        }
        return new DungeonMapTopology(new ArrayList<>(result.values()));
    }

    public @Nullable DungeonTopologyBinding binding(DungeonTopologyRef ref) {
        if (ref == null || !ref.present()) {
            return null;
        }
        for (DungeonTopologyBinding binding : bindings) {
            if (binding != null && binding.ref().equals(ref)) {
                return binding;
            }
        }
        return null;
    }

    public long clusterIdOrZero(DungeonTopologyRef ref) {
        DungeonTopologyBinding binding = binding(ref);
        return binding == null || binding.clusterId() <= 0L ? 0L : binding.clusterId();
    }

    private static String labelFor(DungeonTopologyElementKind kind) {
        DungeonTopologyElementKind resolvedKind = kind == null ? DungeonTopologyElementKind.EMPTY : kind;
        if (resolvedKind == DungeonTopologyElementKind.DOOR) {
            return "Door";
        }
        if (resolvedKind == DungeonTopologyElementKind.WALL) {
            return "Wall";
        }
        if (resolvedKind == DungeonTopologyElementKind.ROOM) {
            return "Room";
        }
        if (resolvedKind == DungeonTopologyElementKind.CORRIDOR) {
            return "Corridor";
        }
        if (resolvedKind == DungeonTopologyElementKind.CORRIDOR_ANCHOR) {
            return "Corridor Anchor";
        }
        if (resolvedKind == DungeonTopologyElementKind.STAIR) {
            return "Stair";
        }
        if (resolvedKind == DungeonTopologyElementKind.TRANSITION) {
            return "Transition";
        }
        return "";
    }

    public record DungeonTopologyBinding(
            DungeonTopologyRef ref,
            long clusterId,
            long corridorId,
            String label
    ) {

        public DungeonTopologyBinding {
            ref = ref == null ? DungeonTopologyRef.empty() : ref;
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            label = label == null ? "" : label.trim();
        }
    }
}
