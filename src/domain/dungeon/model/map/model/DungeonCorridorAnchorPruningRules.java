package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Owns authored corridor-anchor ownership and pruning rules.
 */
public final class DungeonCorridorAnchorPruningRules {

    public List<DungeonCorridor> pruneDetachedAnchors(List<DungeonCorridor> corridors) {
        AnchorUsage usage = AnchorUsage.from(corridors);
        List<DungeonCorridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            result.add(DungeonCorridorOps.withBindings(
                    corridor,
                    corridor.bindings()
                            .replaceAnchorBindings(keptBindings(corridor, usage))
                            .replaceAnchorRefs(keptRefs(corridor, usage))));
        }
        return List.copyOf(result);
    }

    public boolean ownedAnchorStillReferenced(List<DungeonCorridor> corridors, DungeonCorridor owner) {
        if (owner == null) {
            return false;
        }
        Set<DungeonTopologyRef> ownedRefs = ownedAnchorRefs(owner);
        if (ownedRefs.isEmpty()) {
            return false;
        }
        for (DungeonCorridor candidate : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (candidateReferencesOwnedAnchor(candidate, owner, ownedRefs)) {
                return false;
            }
        }
        return true;
    }

    private List<DungeonCorridorAnchorBinding> keptBindings(DungeonCorridor corridor, AnchorUsage usage) {
        List<DungeonCorridorAnchorBinding> keptBindings = new ArrayList<>();
        for (DungeonCorridorAnchorBinding binding : corridor.bindings().anchorBindings()) {
            if (binding != null && usage.referenced().contains(binding.topologyRef())) {
                keptBindings.add(binding);
            }
        }
        return keptBindings;
    }

    private List<DungeonCorridorAnchorRef> keptRefs(DungeonCorridor corridor, AnchorUsage usage) {
        List<DungeonCorridorAnchorRef> keptRefs = new ArrayList<>();
        for (DungeonCorridorAnchorRef ref : corridor.bindings().anchorRefs()) {
            if (ref != null && ref.present() && usage.hosted().containsKey(ref.topologyRef())) {
                keptRefs.add(ref);
            }
        }
        return keptRefs;
    }

    private Set<DungeonTopologyRef> ownedAnchorRefs(DungeonCorridor owner) {
        Set<DungeonTopologyRef> ownedRefs = new LinkedHashSet<>();
        for (DungeonCorridorAnchorBinding binding : owner.bindings().anchorBindings()) {
            if (binding != null) {
                ownedRefs.add(binding.topologyRef());
            }
        }
        return ownedRefs;
    }

    private boolean candidateReferencesOwnedAnchor(
            DungeonCorridor candidate,
            DungeonCorridor owner,
            Set<DungeonTopologyRef> ownedRefs
    ) {
        if (candidate == null || candidate.corridorId() == owner.corridorId()) {
            return false;
        }
        for (DungeonCorridorAnchorRef ref : candidate.bindings().anchorRefs()) {
            if (ref != null && ownedRefs.contains(ref.topologyRef())) {
                return true;
            }
        }
        return false;
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
