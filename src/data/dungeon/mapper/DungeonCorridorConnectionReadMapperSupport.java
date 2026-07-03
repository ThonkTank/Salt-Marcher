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
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindingState;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingState;
import src.domain.dungeon.model.core.structure.topology.DungeonMapTopology.DungeonTopologyBinding;

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
                    new CorridorBindingState(
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

    private static List<CorridorDoorBindingState> toDoorBindings(List<DungeonCorridorDoorBindingRecord> records) {
        List<CorridorDoorBindingState> result = new ArrayList<>();
        for (DungeonCorridorDoorBindingRecord record
                : records == null ? List.<DungeonCorridorDoorBindingRecord>of() : records) {
            result.add(new CorridorDoorBindingState(
                    record.roomId(),
                    record.clusterId(),
                    new Cell(record.relativeCellX(), record.relativeCellY(), 0),
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
