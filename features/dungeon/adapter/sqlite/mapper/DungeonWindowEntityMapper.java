package features.dungeon.adapter.sqlite.mapper;

import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorRefRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import features.dungeon.adapter.sqlite.model.DungeonWindowEntityRecord;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.stair.Stair;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Maps exact source-local graphs without constructing a partial DungeonMap. */
public final class DungeonWindowEntityMapper {

    private static final Set<String> BOUNDARY_DIRECTIONS = Set.of("NORTH", "EAST", "SOUTH", "WEST");
    private static final Set<String> BOUNDARY_KINDS = Set.of("WALL", "DOOR", "OPEN");
    private DungeonWindowEntityMapper() {
    }

    public static DungeonEntitySnapshot toSnapshot(DungeonWindowEntityRecord record) {
        if (record instanceof DungeonWindowEntityRecord.Room room) {
            if (room.value().floorCells().isEmpty()) {
                throw incomplete("room has no authored cells");
            }
            return new DungeonEntitySnapshot.Room(
                    DungeonRoomRecordMapperSupport.toRooms(List.of(room.value())).getFirst());
        }
        if (record instanceof DungeonWindowEntityRecord.RoomCluster cluster) {
            if (cluster.memberRooms().isEmpty()
                    || cluster.memberRooms().stream().allMatch(room -> room.floorCells().isEmpty())) {
                throw incomplete("room cluster has no member room cells");
            }
            validateBoundaries(cluster.value().boundaries());
            var rooms = DungeonRoomRecordMapperSupport.toRooms(cluster.memberRooms());
            return new DungeonEntitySnapshot.RoomClusterSnapshot(
                    DungeonClusterRecordMapperSupport.toClusters(List.of(cluster.value()), rooms).getFirst());
        }
        if (record instanceof DungeonWindowEntityRecord.Corridor corridor) {
            validateCorridorClosure(corridor);
            List<DungeonCorridorRecord> graph = new ArrayList<>(corridor.anchorHosts());
            graph.add(corridor.value());
            Map<Long, Corridor> mapped = new HashMap<>();
            DungeonCorridorConnectionReadMapperSupport.toCorridors(graph)
                    .forEach(value -> mapped.put(value.corridorId(), value));
            Corridor value = mapped.get(corridor.value().corridorId());
            if (value == null || !value.isReadable()) {
                throw incomplete("corridor has incomplete endpoint geometry");
            }
            return new DungeonEntitySnapshot.CorridorSnapshot(value);
        }
        if (record instanceof DungeonWindowEntityRecord.Stair stairRecord) {
            DungeonStairRecord source = stairRecord.value();
            validateStairSource(source, stairRecord.boundCorridorPresent());
            Stair stair = DungeonStairRecordMapperSupport.toStairs(List.of(source)).stairs().getFirst();
            if (!stair.isReadable()) {
                throw incomplete("stair path or exits are incomplete");
            }
            return new DungeonEntitySnapshot.StairSnapshot(stair);
        }
        if (record instanceof DungeonWindowEntityRecord.Transition transition) {
            validateTransitionSource(transition.value());
            return new DungeonEntitySnapshot.TransitionSnapshot(
                    DungeonTransitionRecordMapperSupport.toTransitions(List.of(transition.value())).getFirst());
        }
        if (record instanceof DungeonWindowEntityRecord.FeatureMarker marker) {
            return new DungeonEntitySnapshot.FeatureMarkerSnapshot(
                    DungeonFeatureMarkerRecordMapperSupport.toFeatureMarkers(List.of(marker.value()))
                            .markers().getFirst());
        }
        throw malformed("unsupported entity record");
    }

    private static void validateBoundaries(List<DungeonClusterBoundaryRecord> boundaries) {
        for (DungeonClusterBoundaryRecord boundary : boundaries) {
            String direction = normalized(boundary.edgeDirection());
            String kind = normalized(boundary.edgeType());
            if (!BOUNDARY_DIRECTIONS.contains(direction) || !BOUNDARY_KINDS.contains(kind)) {
                throw malformed("cluster boundary kind or direction is invalid");
            }
            if ("OPEN".equals(kind) && boundary.topologyElementId() != null) {
                throw malformed("open cluster boundary owns topology identity");
            }
            if (!"OPEN".equals(kind) && boundary.topologyElementId() == null) {
                throw incomplete("renderable cluster boundary topology identity is missing");
            }
        }
    }

    private static void validateStairSource(DungeonStairRecord source, boolean corridorBindingPresent) {
        try {
            DungeonStairSourceValidation.validate(source, corridorBindingPresent);
        } catch (DungeonStairSourceValidation.Failure failure) {
            throw failure.incomplete() ? incomplete(failure.getMessage()) : malformed(failure.getMessage());
        }
    }

    private static void validateCorridorClosure(DungeonWindowEntityRecord.Corridor corridor) {
        Map<AnchorKey, Long> hostAnchors = new HashMap<>();
        List<DungeonCorridorRecord> all = new ArrayList<>(corridor.anchorHosts());
        all.add(corridor.value());
        for (DungeonCorridorRecord candidate : all) {
            if (candidate.doorBindings().stream().anyMatch(binding -> binding.topologyElementId() == null)) {
                throw incomplete("corridor door topology identity is missing");
            }
            for (DungeonCorridorAnchorBindingRecord anchor : candidate.anchorBindings()) {
                if (anchor.topologyElementId() == null) {
                    throw incomplete("corridor anchor topology identity is missing");
                }
                hostAnchors.put(
                        new AnchorKey(anchor.hostCorridorId(), anchor.topologyElementId()),
                        anchor.anchorId());
            }
        }
        for (DungeonCorridorAnchorRefRecord ref : corridor.value().anchorRefs()) {
            if (ref.topologyElementId() == null) {
                throw incomplete("corridor anchor ref topology identity is missing");
            }
            if (!hostAnchors.containsKey(new AnchorKey(ref.hostCorridorId(), ref.topologyElementId()))) {
                throw incomplete("corridor anchor ref host is missing");
            }
        }
    }

    private static void validateTransitionSource(DungeonTransitionRecord transition) {
        try {
            DungeonTransitionSourceValidation.validate(transition);
        } catch (DungeonTransitionSourceValidation.Failure failure) {
            throw malformed(failure.getMessage());
        }
    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static IllegalArgumentException malformed(String message) {
        return new EntityMappingException(false, message);
    }

    private static IllegalArgumentException incomplete(String message) {
        return new EntityMappingException(true, message);
    }

    public static boolean isIncomplete(IllegalArgumentException exception) {
        return exception instanceof EntityMappingException mapping && mapping.incomplete;
    }

    private record AnchorKey(long hostCorridorId, long topologyElementId) {
    }

    private static final class EntityMappingException extends IllegalArgumentException {
        private final boolean incomplete;

        private EntityMappingException(boolean incomplete, String message) {
            super(message);
            this.incomplete = incomplete;
        }
    }
}
