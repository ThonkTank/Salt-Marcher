package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;

public record CorridorNetwork(List<Corridor> corridors) {
    private static final long MISSING_CORRIDOR_ID = 0L;

    public CorridorNetwork {
        corridors = nonNullCorridors(corridors);
    }

    @Override
    public List<Corridor> corridors() {
        return List.copyOf(corridors);
    }

    public boolean canDeleteCorridor(long corridorId) {
        Corridor corridor = corridorById(corridorId);
        return corridor != null && !ownedAnchorStillReferenced(corridor);
    }

    public CorridorNetwork withoutCorridor(long corridorId) {
        if (!canDeleteCorridor(corridorId)) {
            return this;
        }
        List<Corridor> result = new ArrayList<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor.corridorId() != corridorId) {
                result.add(corridor);
            }
        }
        return new CorridorNetwork(result);
    }

    public CorridorNetwork withoutDetachedAnchors() {
        AnchorUsage usage = AnchorUsage.from(corridors);
        List<Corridor> result = new ArrayList<>();
        for (Corridor corridor : corridors) {
            result.add(corridor.withBindings(
                    corridor.bindings()
                            .withAnchorBindings(keptBindings(corridor, usage))
                            .withAnchorRefs(keptRefs(corridor, usage))));
        }
        return new CorridorNetwork(result);
    }

    Set<Long> corridorsReferencing(Set<AnchorKey> anchors) {
        if (anchors == null || anchors.isEmpty()) {
            return Set.of();
        }
        Set<Long> result = new LinkedHashSet<>();
        for (Corridor corridor : corridors) {
            if (corridor != null && referencesAny(corridor, anchors)) {
                result.add(corridor.corridorId());
            }
        }
        return Set.copyOf(result);
    }

    private Corridor corridorById(long corridorId) {
        return corridorById(corridors, corridorId);
    }

    private static Corridor corridorById(List<Corridor> corridors, long corridorId) {
        if (corridorId <= MISSING_CORRIDOR_ID) {
            return null;
        }
        for (Corridor corridor : corridors) {
            if (corridor.corridorId() == corridorId) {
                return corridor;
            }
        }
        return null;
    }

    private boolean ownedAnchorStillReferenced(Corridor owner) {
        Set<AnchorKey> ownedAnchors = ownedAnchorKeys(owner);
        if (ownedAnchors.isEmpty()) {
            return false;
        }
        for (Corridor candidate : corridors) {
            if (candidate.corridorId() != owner.corridorId() && referencesAny(candidate, ownedAnchors)) {
                return true;
            }
        }
        return false;
    }

    private static List<CorridorAnchor> keptBindings(Corridor corridor, AnchorUsage usage) {
        List<CorridorAnchor> result = new ArrayList<>();
        for (CorridorAnchor binding : corridor.bindings().anchorBindings()) {
            if (binding != null && usage.referenced().contains(AnchorKey.from(binding))) {
                result.add(binding);
            }
        }
        return List.copyOf(result);
    }

    private static List<CorridorAnchorRef> keptRefs(Corridor corridor, AnchorUsage usage) {
        List<CorridorAnchorRef> result = new ArrayList<>();
        for (CorridorAnchorRef ref : corridor.bindings().anchorRefs()) {
            if (ref != null && ref.present() && usage.hosted().contains(AnchorKey.from(ref))) {
                result.add(ref);
            }
        }
        return List.copyOf(result);
    }

    private static boolean referencesAny(Corridor corridor, Set<AnchorKey> anchors) {
        for (CorridorAnchorRef ref : corridor.bindings().anchorRefs()) {
            if (ref != null && anchors.contains(AnchorKey.from(ref))) {
                return true;
            }
        }
        return false;
    }

    private static Set<AnchorKey> ownedAnchorKeys(Corridor owner) {
        Set<AnchorKey> result = new LinkedHashSet<>();
        for (CorridorAnchor binding : owner.bindings().anchorBindings()) {
            if (binding != null) {
                result.add(AnchorKey.from(binding));
            }
        }
        return Set.copyOf(result);
    }

    private static List<Corridor> nonNullCorridors(List<Corridor> source) {
        List<Corridor> result = new ArrayList<>();
        for (Corridor corridor : source == null ? List.<Corridor>of() : source) {
            if (corridor != null) {
                result.add(corridor);
            }
        }
        return List.copyOf(result);
    }

    private record AnchorUsage(Set<AnchorKey> referenced, Set<AnchorKey> hosted) {
        private AnchorUsage {
            referenced = Set.copyOf(referenced);
            hosted = Set.copyOf(hosted);
        }

        private static AnchorUsage from(List<Corridor> corridors) {
            Set<AnchorKey> referenced = new LinkedHashSet<>();
            Set<AnchorKey> hosted = new LinkedHashSet<>();
            for (Corridor corridor : corridors) {
                for (CorridorAnchor binding : corridor.bindings().anchorBindings()) {
                    if (binding != null) {
                        hosted.add(AnchorKey.from(binding));
                    }
                }
                for (CorridorAnchorRef ref : corridor.bindings().anchorRefs()) {
                    if (ref != null && ref.present()) {
                        referenced.add(AnchorKey.from(ref));
                    }
                }
            }
            return new AnchorUsage(referenced, hosted);
        }
    }

    public record AnchorKey(long hostCorridorId, long anchorId) {
        public static AnchorKey from(CorridorAnchor anchor) {
            return new AnchorKey(anchor.hostCorridorId(), anchor.anchorId());
        }

        public static AnchorKey from(CorridorAnchorRef ref) {
            return new AnchorKey(ref.hostCorridorId(), ref.anchorId());
        }
    }
}
