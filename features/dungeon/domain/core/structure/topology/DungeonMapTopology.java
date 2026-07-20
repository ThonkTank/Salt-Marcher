package features.dungeon.domain.core.structure.topology;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.transition.Transition;

/**
 * Map-owned topology index for authored element refs and semantic bindings.
 */
public record DungeonMapTopology(
        List<DungeonTopologyBinding> bindings
) {
    private static final Map<String, String> ELEMENT_LABELS = Map.of(
            DungeonTopologyElementKind.DOOR.name(), "Door",
            DungeonTopologyElementKind.WALL.name(), "Wall",
            DungeonTopologyElementKind.ROOM.name(), "Room",
            DungeonTopologyElementKind.CORRIDOR.name(), "Corridor",
            DungeonTopologyElementKind.CORRIDOR_ANCHOR.name(), "Corridor Anchor",
            DungeonTopologyElementKind.STAIR.name(), "Stair",
            DungeonTopologyElementKind.TRANSITION.name(), "Transition",
            DungeonTopologyElementKind.FEATURE_MARKER.name(), "Feature Marker");

    public DungeonMapTopology {
        bindings = bindings == null ? List.of() : List.copyOf(bindings);
    }

    public static DungeonMapTopology from(
            SpatialTopology topology,
            RoomCatalog rooms,
            List<Corridor> corridors,
            List<Stair> stairs,
            List<Transition> transitions,
            List<DungeonTopologyBinding> featureMarkerBindings
    ) {
        List<DungeonTopologyBinding> result = new ArrayList<>();
        appendRoomBindings(result, rooms);
        appendCorridorBindings(result, corridors);
        appendStairBindings(result, stairs);
        appendTransitionBindings(result, transitions);
        appendFeatureMarkerBindings(result, featureMarkerBindings);
        appendBoundaryBindings(result, topology);
        return new DungeonMapTopology(result);
    }

    public static DungeonMapTopology from(
            SpatialTopology topology,
            RoomCatalog rooms,
            List<Corridor> corridors,
            List<Stair> stairs,
            List<Transition> transitions
    ) {
        return from(topology, rooms, corridors, stairs, transitions, List.of());
    }

    private static void appendRoomBindings(List<DungeonTopologyBinding> result, RoomCatalog rooms) {
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms.rooms()) {
            if (room == null) {
                continue;
            }
            result.add(new DungeonTopologyBinding(
                    new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                    room.clusterId(),
                    0L,
                    room.name()));
        }
    }

    private static void appendCorridorBindings(List<DungeonTopologyBinding> result, List<Corridor> corridors) {
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            result.add(new DungeonTopologyBinding(
                    new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, corridor.corridorId()),
                    0L,
                    corridor.corridorId(),
                    "Corridor " + corridor.corridorId()));
            appendDoorBindings(result, corridor);
            appendAnchorBindings(result, corridor);
        }
    }

    private static void appendDoorBindings(List<DungeonTopologyBinding> result, Corridor corridor) {
        for (CorridorDoorBinding doorBinding : corridor.bindings().doorBindings()) {
            if (doorBinding.topologyRef().present()) {
                result.add(new DungeonTopologyBinding(
                        doorBinding.topologyRef(),
                        doorBinding.clusterId(),
                        corridor.corridorId(),
                        "Door " + doorBinding.topologyRef().id()));
            }
        }
    }

    private static void appendAnchorBindings(List<DungeonTopologyBinding> result, Corridor corridor) {
        for (CorridorAnchor anchor : corridor.bindings().anchorBindings()) {
            if (anchor != null && anchor.anchorId() > 0L) {
                DungeonTopologyRef ref = DungeonTopologyRef.corridorAnchor(anchor.anchorId());
                result.add(new DungeonTopologyBinding(
                        ref,
                        0L,
                        corridor.corridorId(),
                        "Corridor Anchor " + ref.id()));
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

    private static void appendFeatureMarkerBindings(
            List<DungeonTopologyBinding> result,
            List<DungeonTopologyBinding> markerBindings
    ) {
        for (DungeonTopologyBinding markerBinding
                : markerBindings == null ? List.<DungeonTopologyBinding>of() : markerBindings) {
            if (markerBinding != null && markerBinding.ref().present()) {
                result.add(markerBinding);
            }
        }
    }

    private static void appendBoundaryBindings(List<DungeonTopologyBinding> result, SpatialTopology topology) {
        for (RoomCluster cluster : topology == null ? List.<RoomCluster>of() : topology.roomClusters()) {
            for (BoundarySegment boundary : cluster.orderedAuthoredBoundaries()) {
                if (!boundary.kind().renderable()) {
                    continue;
                }
                DungeonTopologyRef ref = boundary.resolvedTopologyRef();
                result.add(new DungeonTopologyBinding(
                        ref,
                        cluster.clusterId(),
                        0L,
                        labelFor(ref.kind())));
            }
        }
    }

    public static DungeonMapTopology merge(@Nullable DungeonMapTopology primary, DungeonMapTopology fallback) {
        List<DungeonTopologyBinding> primaryBindings = primary == null ? List.of() : primary.bindings();
        Map<DungeonTopologyRef, DungeonTopologyBinding> previousByRef = new HashMap<>();
        Map<AnchorIdentity, DungeonTopologyBinding> previousAnchors = new HashMap<>();
        for (DungeonTopologyBinding binding : primaryBindings) {
            previousByRef.putIfAbsent(binding.ref(), binding);
            if (binding.ref().kind() == DungeonTopologyElementKind.CORRIDOR_ANCHOR) {
                previousAnchors.putIfAbsent(AnchorIdentity.from(binding), binding);
            }
        }
        List<DungeonTopologyBinding> result = new ArrayList<>();
        for (DungeonTopologyBinding derived
                : fallback == null ? List.<DungeonTopologyBinding>of() : fallback.bindings()) {
            if (!derived.ref().present()) {
                continue;
            }
            DungeonTopologyBinding previous = derived.ref().kind() == DungeonTopologyElementKind.CORRIDOR_ANCHOR
                    ? previousAnchors.get(AnchorIdentity.from(derived))
                    : previousByRef.get(derived.ref());
            result.add(previous == null ? derived : withStableFacts(previous, derived));
        }
        return new DungeonMapTopology(result);
    }

    private static DungeonTopologyBinding withStableFacts(
            DungeonTopologyBinding previous,
            DungeonTopologyBinding derived
    ) {
        boolean corridorAnchor = derived.ref().kind() == DungeonTopologyElementKind.CORRIDOR_ANCHOR;
        return new DungeonTopologyBinding(
                corridorAnchor ? previous.ref() : derived.ref(),
                derived.clusterId(),
                derived.corridorId(),
                corridorAnchor ? previous.localElementId() : derived.localElementId(),
                previous.label());
    }

    private record AnchorIdentity(long corridorId, long localElementId) {
        private static AnchorIdentity from(DungeonTopologyBinding binding) {
            return new AnchorIdentity(binding.corridorId(), binding.localElementId());
        }
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

    public DungeonTopologyRef corridorAnchorRef(long corridorId, long anchorId) {
        if (corridorId <= 0L || anchorId <= 0L) {
            return DungeonTopologyRef.empty();
        }
        for (DungeonTopologyBinding binding : bindings) {
            if (binding != null
                    && binding.ref().kind() == DungeonTopologyElementKind.CORRIDOR_ANCHOR
                    && binding.corridorId() == corridorId
                    && binding.localElementId() == anchorId) {
                return binding.ref();
            }
        }
        return DungeonTopologyRef.corridorAnchor(anchorId);
    }

    private static String labelFor(DungeonTopologyElementKind kind) {
        DungeonTopologyElementKind resolvedKind = kind == null ? DungeonTopologyElementKind.EMPTY : kind;
        return ELEMENT_LABELS.getOrDefault(resolvedKind.name(), "");
    }

    public record DungeonTopologyBinding(
            DungeonTopologyRef ref,
            long clusterId,
            long corridorId,
            long localElementId,
            String label
    ) {

        public DungeonTopologyBinding(
                DungeonTopologyRef ref,
                long clusterId,
                long corridorId,
                String label
        ) {
            this(ref, clusterId, corridorId, ref == null ? 0L : ref.id(), label);
        }

        public DungeonTopologyBinding {
            ref = ref == null ? DungeonTopologyRef.empty() : ref;
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            localElementId = Math.max(0L, localElementId);
            label = label == null ? "" : label.trim();
        }
    }
}
