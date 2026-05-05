package src.domain.dungeon.map.policy;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonCorridorAnchorRef;
import src.domain.dungeon.map.value.DungeonTopologyRef;

/**
 * Owns authored corridor-anchor ownership and pruning rules.
 */
public final class DungeonCorridorAnchorPruningPolicy {

    public List<DungeonCorridor> pruneDetachedAnchors(List<DungeonCorridor> corridors) {
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
        List<DungeonCorridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            List<DungeonCorridorAnchorBinding> keptBindings = corridor.bindings().anchorBindings().stream()
                    .filter(Objects::nonNull)
                    .filter(binding -> referenced.contains(binding.topologyRef()))
                    .toList();
            List<DungeonCorridorAnchorRef> keptRefs = corridor.bindings().anchorRefs().stream()
                    .filter(Objects::nonNull)
                    .filter(ref -> ref.present() && hosted.containsKey(ref.topologyRef()))
                    .toList();
            result.add(corridor.withBindings(
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
        if (ownedRefs.isEmpty()) {
            return false;
        }
        return (corridors == null ? List.<DungeonCorridor>of() : corridors).stream()
                .filter(candidate -> candidate.corridorId() != owner.corridorId())
                .flatMap(candidate -> candidate.bindings().anchorRefs().stream())
                .filter(Objects::nonNull)
                .map(DungeonCorridorAnchorRef::topologyRef)
                .anyMatch(ownedRefs::contains);
    }
}
