package src.domain.dungeon.map.policy;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.service.DungeonCorridorOps;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonCorridorAnchorRef;
import src.domain.dungeon.map.value.DungeonTopologyRef;

/**
 * Owns authored corridor-anchor ownership and pruning rules.
 */
public final class DungeonCorridorAnchorPruningPolicy {

    public List<DungeonCorridor> pruneDetachedAnchors(List<DungeonCorridor> corridors) {
        AnchorUsage usage = AnchorUsage.from(corridors);
        List<DungeonCorridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            List<DungeonCorridorAnchorBinding> keptBindings = corridor.bindings().anchorBindings().stream()
                    .filter(Objects::nonNull)
                    .filter(binding -> usage.referenced().contains(binding.topologyRef()))
                    .toList();
            List<DungeonCorridorAnchorRef> keptRefs = corridor.bindings().anchorRefs().stream()
                    .filter(Objects::nonNull)
                    .filter(ref -> ref.present() && usage.hosted().containsKey(ref.topologyRef()))
                    .toList();
            result.add(DungeonCorridorOps.withBindings(
                    corridor,
                    corridor.bindings()
                            .replaceAnchorBindings(keptBindings)
                            .replaceAnchorRefs(keptRefs)));
        }
        return List.copyOf(result);
    }

    public boolean ownedAnchorStillReferenced(List<DungeonCorridor> corridors, DungeonCorridor owner) {
        if (owner == null) {
            return false;
        }
        Set<DungeonTopologyRef> ownedRefs = owner.bindings().anchorBindings().stream()
                .filter(Objects::nonNull)
                .map(DungeonCorridorAnchorBinding::topologyRef)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        return !ownedRefs.isEmpty() && (corridors == null ? List.<DungeonCorridor>of() : corridors).stream()
                .filter(candidate -> candidate.corridorId() != owner.corridorId())
                .flatMap(candidate -> candidate.bindings().anchorRefs().stream())
                .filter(Objects::nonNull)
                .map(DungeonCorridorAnchorRef::topologyRef)
                .noneMatch(ownedRefs::contains);
    }

    private record AnchorUsage(
            Set<DungeonTopologyRef> referenced,
            Map<DungeonTopologyRef, Long> hosted
    ) {
        private AnchorUsage {
            referenced = Set.copyOf(referenced);
            hosted = Map.copyOf(hosted);
        }

        private static AnchorUsage from(List<DungeonCorridor> corridors) {
            Set<DungeonTopologyRef> referenced = new LinkedHashSet<>();
            Map<DungeonTopologyRef, Long> hosted = new LinkedHashMap<>();
            for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
                for (DungeonCorridorAnchorBinding binding : corridor.bindings().anchorBindings()) {
                    if (binding != null) {
                        hosted.put(binding.topologyRef(), corridor.corridorId());
                    }
                }
                for (DungeonCorridorAnchorRef ref : corridor.bindings().anchorRefs()) {
                    if (ref != null && ref.present()) {
                        referenced.add(ref.topologyRef());
                    }
                }
            }
            return new AnchorUsage(referenced, hosted);
        }
    }
}
