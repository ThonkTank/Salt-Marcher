package src.domain.dungeon.map.value;

import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.entity.DungeonTransition;
import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalLong;

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
            RoomCatalog rooms,
            ConnectionCatalog connections
    ) {
        return from(SpatialTopology.empty(), rooms, connections);
    }

    public static DungeonMapTopology from(
            SpatialTopology topology,
            RoomCatalog rooms,
            ConnectionCatalog connections
    ) {
        List<DungeonTopologyBinding> result = new ArrayList<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms.rooms()) {
            result.add(new DungeonTopologyBinding(
                    new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                    room.clusterId(),
                    0L,
                    room.name()));
        }
        for (DungeonCorridor corridor : connections == null ? List.<DungeonCorridor>of() : connections.corridors()) {
            result.add(new DungeonTopologyBinding(
                    new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, corridor.corridorId()),
                    0L,
                    corridor.corridorId(),
                    "Corridor " + corridor.corridorId()));
            for (DungeonCorridorDoorBinding doorBinding : corridor.bindings().doorBindings()) {
                if (doorBinding.topologyRef().present()) {
                    result.add(new DungeonTopologyBinding(
                            doorBinding.topologyRef(),
                            doorBinding.clusterId(),
                            corridor.corridorId(),
                            "Door " + doorBinding.topologyRef().id()));
                }
            }
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
        for (DungeonStair stair : connections == null ? List.<DungeonStair>of() : connections.stairs()) {
            result.add(new DungeonTopologyBinding(
                    new DungeonTopologyRef(DungeonTopologyElementKind.STAIR, stair.stairId()),
                    0L,
                    stair.corridorId() == null ? 0L : stair.corridorId(),
                    stair.name()));
        }
        for (DungeonTransition transition : connections == null ? List.<DungeonTransition>of() : connections.transitions()) {
            result.add(new DungeonTopologyBinding(
                    new DungeonTopologyRef(DungeonTopologyElementKind.TRANSITION, transition.transitionId()),
                    0L,
                    0L,
                    transition.label()));
        }
        for (DungeonRoomCluster cluster : topology == null ? List.<DungeonRoomCluster>of() : topology.roomClusters()) {
            for (List<DungeonClusterBoundary> boundaries : cluster.boundariesByLevel().values()) {
                for (DungeonClusterBoundary boundary : boundaries) {
                    DungeonTopologyRef ref = boundary.resolvedTopologyRef(cluster.center());
                    result.add(new DungeonTopologyBinding(
                            ref,
                            cluster.clusterId(),
                            0L,
                            labelFor(ref.kind())));
                }
            }
        }
        return new DungeonMapTopology(result);
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

    public Optional<DungeonTopologyBinding> find(DungeonTopologyRef ref) {
        if (ref == null || !ref.present()) {
            return Optional.empty();
        }
        return bindings.stream()
                .filter(binding -> binding.ref().equals(ref))
                .findFirst();
    }

    public OptionalLong clusterIdFor(DungeonTopologyRef ref) {
        return find(ref)
                .map(DungeonTopologyBinding::clusterId)
                .filter(clusterId -> clusterId > 0L)
                .map(OptionalLong::of)
                .orElseGet(OptionalLong::empty);
    }

    public OptionalLong corridorIdFor(DungeonTopologyRef ref) {
        return find(ref)
                .map(DungeonTopologyBinding::corridorId)
                .filter(corridorId -> corridorId > 0L)
                .map(OptionalLong::of)
                .orElseGet(OptionalLong::empty);
    }

    public boolean isEmpty() {
        return bindings.isEmpty();
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
