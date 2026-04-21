package src.domain.dungeon.map.value;

import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.entity.DungeonTransition;

import java.util.ArrayList;
import java.util.List;
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
        return new DungeonMapTopology(result);
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
