package features.dungeon.adapter.sqlite.mapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorRefRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorDoorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorWaypointRecord;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.structure.topology.DungeonMapTopology.DungeonTopologyBinding;

final class DungeonCorridorConnectionReadMapperSupport {

    private DungeonCorridorConnectionReadMapperSupport() {
    }

    static List<Corridor> toCorridors(List<DungeonCorridorRecord> records) {
        List<Corridor> result = new ArrayList<>();
        Map<AnchorTopologyKey, Long> anchorIdsByTopologyId = anchorIdsByTopologyIdForCorridors(records);
        for (DungeonCorridorRecord record : records == null ? List.<DungeonCorridorRecord>of() : records) {
            result.add(new Corridor(
                    record.corridorId(),
                    record.mapId(),
                    record.levelZ(),
                    record.roomIds(),
                    new CorridorBindings(
                            toWaypoints(record.waypoints()),
                            toDoorBindings(record.doorBindings()),
                            toAnchorBindings(record.anchorBindings()),
                            toAnchorRefs(record.anchorRefs(), anchorIdsByTopologyId))));
        }
        return List.copyOf(result);
    }

    static List<DungeonTopologyBinding> toAnchorTopologyBindings(List<DungeonCorridorRecord> records) {
        List<DungeonTopologyBinding> result = new ArrayList<>();
        for (DungeonCorridorRecord corridor : records == null ? List.<DungeonCorridorRecord>of() : records) {
            for (DungeonCorridorAnchorBindingRecord anchor
                    : corridor.anchorBindings() == null
                            ? List.<DungeonCorridorAnchorBindingRecord>of()
                            : corridor.anchorBindings()) {
                Long topologyElementId = anchor.topologyElementId();
                if (topologyElementId != null && topologyElementId > 0L) {
                    result.add(new DungeonTopologyBinding(
                            DungeonTopologyRef.corridorAnchor(topologyElementId),
                            0L,
                            corridor.corridorId(),
                            anchor.anchorId(),
                            "Corridor Anchor " + topologyElementId));
                }
            }
        }
        return List.copyOf(result);
    }

    private static List<CorridorWaypoint> toWaypoints(List<DungeonCorridorWaypointRecord> records) {
        List<CorridorWaypoint> result = new ArrayList<>();
        for (DungeonCorridorWaypointRecord record
                : records == null ? List.<DungeonCorridorWaypointRecord>of() : records) {
            result.add(new CorridorWaypoint(
                    record.clusterId(),
                    new Cell(record.relativeX(), record.relativeY(), record.relativeZ()),
                    record.relativeZ()));
        }
        return List.copyOf(result);
    }

    private static List<CorridorDoorBinding> toDoorBindings(List<DungeonCorridorDoorBindingRecord> records) {
        List<CorridorDoorBinding> result = new ArrayList<>();
        for (DungeonCorridorDoorBindingRecord record
                : records == null ? List.<DungeonCorridorDoorBindingRecord>of() : records) {
            result.add(new CorridorDoorBinding(
                    record.roomId(),
                    record.clusterId(),
                    new Cell(record.relativeCellX(), record.relativeCellY(), record.relativeCellZ()),
                    Direction.parse(record.edgeDirection()),
                    record.topologyElementId() == null
                            ? DungeonTopologyRef.empty()
                            : new DungeonTopologyRef(
                                    DungeonTopologyElementKind.DOOR,
                                    record.topologyElementId())));
        }
        return List.copyOf(result);
    }

    private static List<CorridorAnchor> toAnchorBindings(List<DungeonCorridorAnchorBindingRecord> records) {
        List<CorridorAnchor> result = new ArrayList<>();
        for (DungeonCorridorAnchorBindingRecord record
                : records == null ? List.<DungeonCorridorAnchorBindingRecord>of() : records) {
            result.add(new CorridorAnchor(
                    record.anchorId(),
                    record.hostCorridorId(),
                    new Cell(record.cellX(), record.cellY(), record.cellZ())));
        }
        return List.copyOf(result);
    }

    private static List<CorridorAnchorRef> toAnchorRefs(
            List<DungeonCorridorAnchorRefRecord> records,
            Map<AnchorTopologyKey, Long> anchorIdsByTopologyId
    ) {
        List<CorridorAnchorRef> result = new ArrayList<>();
        for (DungeonCorridorAnchorRefRecord record
                : records == null ? List.<DungeonCorridorAnchorRefRecord>of() : records) {
            if (record.topologyElementId() == null) {
                continue;
            }
            long anchorId = anchorIdsByTopologyId.getOrDefault(
                    new AnchorTopologyKey(record.hostCorridorId(), record.topologyElementId()),
                    record.topologyElementId());
            result.add(new CorridorAnchorRef(
                    record.hostCorridorId(),
                    anchorId));
        }
        return List.copyOf(result);
    }

    private static Map<AnchorTopologyKey, Long> anchorIdsByTopologyIdForCorridors(List<DungeonCorridorRecord> records) {
        Map<AnchorTopologyKey, Long> result = new LinkedHashMap<>();
        for (DungeonCorridorRecord record : records == null ? List.<DungeonCorridorRecord>of() : records) {
            result.putAll(anchorIdsByTopologyIdForBindings(record.anchorBindings()));
        }
        return Map.copyOf(result);
    }

    private static Map<AnchorTopologyKey, Long> anchorIdsByTopologyIdForBindings(
            List<DungeonCorridorAnchorBindingRecord> records
    ) {
        Map<AnchorTopologyKey, Long> result = new LinkedHashMap<>();
        for (DungeonCorridorAnchorBindingRecord record
                : records == null ? List.<DungeonCorridorAnchorBindingRecord>of() : records) {
            Long topologyElementId = record.topologyElementId();
            if (topologyElementId != null && topologyElementId > 0L) {
                result.put(new AnchorTopologyKey(record.hostCorridorId(), topologyElementId), record.anchorId());
            }
        }
        return Map.copyOf(result);
    }

    private record AnchorTopologyKey(long hostCorridorId, long topologyElementId) {
    }
}
