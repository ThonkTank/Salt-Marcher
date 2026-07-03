package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.data.dungeon.model.DungeonCorridorAnchorBindingRecord;
import src.data.dungeon.model.DungeonCorridorAnchorRefRecord;
import src.data.dungeon.model.DungeonCorridorDoorBindingRecord;
import src.data.dungeon.model.DungeonCorridorRecord;
import src.data.dungeon.model.DungeonCorridorWaypointRecord;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingState;
import src.domain.dungeon.model.core.structure.topology.DungeonMapTopology;

final class DungeonCorridorConnectionWriteMapperSupport {

    private DungeonCorridorConnectionWriteMapperSupport() {
    }

    static List<DungeonCorridorRecord> toCorridorRecords(List<Corridor> corridors, DungeonMapTopology topologyIndex) {
        List<DungeonCorridorRecord> result = new ArrayList<>();
        Map<AnchorKey, Long> topologyIdsByAnchor = topologyIdsByAnchorForCorridors(corridors, topologyIndex);
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            result.add(new DungeonCorridorRecord(
                    corridor.corridorId(),
                    corridor.mapId(),
                    corridor.level(),
                    corridor.roomIds(),
                    toWaypointRecords(corridor.corridorId(), corridor.stateBindings().waypoints()),
                    toDoorBindingRecords(corridor.corridorId(), corridor.stateBindings().doorBindings()),
                    toAnchorBindingRecords(
                            corridor.corridorId(),
                            corridor.stateBindings().anchorBindings(),
                            topologyIdsByAnchor),
                    toAnchorRefRecords(corridor.corridorId(), corridor.stateBindings().anchorRefs(), topologyIdsByAnchor)));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorWaypointRecord> toWaypointRecords(
            long corridorId,
            List<CorridorWaypoint> waypoints
    ) {
        List<DungeonCorridorWaypointRecord> result = new ArrayList<>();
        for (CorridorWaypoint waypoint
                : waypoints == null ? List.<CorridorWaypoint>of() : waypoints) {
            result.add(new DungeonCorridorWaypointRecord(
                    corridorId,
                    waypoint.clusterId(),
                    waypoint.relativeCell().q(),
                    waypoint.relativeCell().r(),
                    waypoint.level()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorDoorBindingRecord> toDoorBindingRecords(
            long corridorId,
            List<CorridorDoorBindingState> doorBindings
    ) {
        List<DungeonCorridorDoorBindingRecord> result = new ArrayList<>();
        for (CorridorDoorBindingState binding
                : doorBindings == null ? List.<CorridorDoorBindingState>of() : doorBindings) {
            result.add(new DungeonCorridorDoorBindingRecord(
                    corridorId,
                    binding.roomId(),
                    binding.clusterId(),
                    binding.relativeCell().q(),
                    binding.relativeCell().r(),
                    binding.direction().name(),
                    binding.topologyRef().present() ? binding.topologyRef().id() : null));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorAnchorBindingRecord> toAnchorBindingRecords(
            long corridorId,
            List<CorridorAnchor> anchorBindings,
            Map<AnchorKey, Long> topologyIdsByAnchor
    ) {
        List<DungeonCorridorAnchorBindingRecord> result = new ArrayList<>();
        for (CorridorAnchor anchor
                : anchorBindings == null ? List.<CorridorAnchor>of() : anchorBindings) {
            result.add(new DungeonCorridorAnchorBindingRecord(
                    corridorId,
                    anchor.anchorId(),
                    anchor.hostCorridorId(),
                    anchor.position().q(),
                    anchor.position().r(),
                    anchor.position().level(),
                    topologyIdsByAnchor.getOrDefault(
                            new AnchorKey(anchor.hostCorridorId(), anchor.anchorId()),
                            topologyId(anchor))));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorAnchorRefRecord> toAnchorRefRecords(
            long corridorId,
            List<CorridorAnchorRef> anchorRefs,
            Map<AnchorKey, Long> topologyIdsByAnchor
    ) {
        List<DungeonCorridorAnchorRefRecord> result = new ArrayList<>();
        for (CorridorAnchorRef ref : anchorRefs == null ? List.<CorridorAnchorRef>of() : anchorRefs) {
            result.add(new DungeonCorridorAnchorRefRecord(
                    corridorId,
                    ref.hostCorridorId(),
                    ref.present()
                            ? topologyIdsByAnchor.getOrDefault(new AnchorKey(ref.hostCorridorId(), ref.anchorId()), ref.anchorId())
                            : null));
        }
        return List.copyOf(result);
    }

    private static Map<AnchorKey, Long> topologyIdsByAnchorForCorridors(
            List<Corridor> corridors,
            DungeonMapTopology topologyIndex
    ) {
        Map<AnchorKey, Long> result = new LinkedHashMap<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor != null) {
                result.putAll(topologyIdsByAnchorForBindings(corridor.stateBindings().anchorBindings(), topologyIndex));
            }
        }
        return Map.copyOf(result);
    }

    private static Map<AnchorKey, Long> topologyIdsByAnchorForBindings(
            List<CorridorAnchor> anchorBindings,
            DungeonMapTopology topologyIndex
    ) {
        Map<AnchorKey, Long> result = new LinkedHashMap<>();
        for (CorridorAnchor anchor : anchorBindings == null ? List.<CorridorAnchor>of() : anchorBindings) {
            if (anchor != null) {
                long topologyId = topologyIndex == null
                        ? topologyId(anchor)
                        : topologyIndex.corridorAnchorRef(anchor.hostCorridorId(), anchor.anchorId()).id();
                result.put(new AnchorKey(anchor.hostCorridorId(), anchor.anchorId()), topologyId);
            }
        }
        return Map.copyOf(result);
    }

    private static long topologyId(CorridorAnchor anchor) {
        return anchor.anchorId();
    }

    private record AnchorKey(long hostCorridorId, long anchorId) {
    }
}
