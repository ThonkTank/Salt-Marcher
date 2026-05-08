package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.List;
import src.data.dungeon.model.DungeonCorridorAnchorBindingRecord;
import src.data.dungeon.model.DungeonCorridorAnchorRefRecord;
import src.data.dungeon.model.DungeonCorridorDoorBindingRecord;
import src.data.dungeon.model.DungeonCorridorRecord;
import src.data.dungeon.model.DungeonCorridorWaypointRecord;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonCorridorAnchorRef;
import src.domain.dungeon.map.value.DungeonCorridorBindings;
import src.domain.dungeon.map.value.DungeonCorridorDoorBinding;
import src.domain.dungeon.map.value.DungeonCorridorWaypoint;
import src.domain.dungeon.map.value.DungeonEdgeDirection;

final class DungeonCorridorConnectionReadMapperSupport {

    private DungeonCorridorConnectionReadMapperSupport() {
    }

    static List<DungeonCorridor> toCorridors(List<DungeonCorridorRecord> records) {
        List<DungeonCorridor> result = new ArrayList<>();
        for (DungeonCorridorRecord record : records == null ? List.<DungeonCorridorRecord>of() : records) {
            result.add(new DungeonCorridor(
                    record.corridorId(),
                    record.mapId(),
                    record.levelZ(),
                    record.roomIds(),
                    new DungeonCorridorBindings(
                            toWaypoints(record.waypoints()),
                            toDoorBindings(record.doorBindings()),
                            toAnchorBindings(record.anchorBindings()),
                            toAnchorRefs(record.anchorRefs()))));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorWaypoint> toWaypoints(List<DungeonCorridorWaypointRecord> records) {
        List<DungeonCorridorWaypoint> result = new ArrayList<>();
        for (DungeonCorridorWaypointRecord record
                : records == null ? List.<DungeonCorridorWaypointRecord>of() : records) {
            result.add(new DungeonCorridorWaypoint(
                    record.clusterId(),
                    new DungeonCell(record.relativeX(), record.relativeY(), record.relativeZ()),
                    record.relativeZ()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorDoorBinding> toDoorBindings(List<DungeonCorridorDoorBindingRecord> records) {
        List<DungeonCorridorDoorBinding> result = new ArrayList<>();
        for (DungeonCorridorDoorBindingRecord record
                : records == null ? List.<DungeonCorridorDoorBindingRecord>of() : records) {
            result.add(new DungeonCorridorDoorBinding(
                    record.roomId(),
                    record.clusterId(),
                    new DungeonCell(record.relativeCellX(), record.relativeCellY(), 0),
                    DungeonEdgeDirection.parse(record.edgeDirection()),
                    record.topologyElementId() == null
                            ? src.domain.dungeon.map.value.DungeonTopologyRef.empty()
                            : new src.domain.dungeon.map.value.DungeonTopologyRef(
                                    src.domain.dungeon.map.value.DungeonTopologyElementKind.DOOR,
                                    record.topologyElementId())));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorAnchorBinding> toAnchorBindings(List<DungeonCorridorAnchorBindingRecord> records) {
        List<DungeonCorridorAnchorBinding> result = new ArrayList<>();
        for (DungeonCorridorAnchorBindingRecord record
                : records == null ? List.<DungeonCorridorAnchorBindingRecord>of() : records) {
            result.add(new DungeonCorridorAnchorBinding(
                    record.anchorId(),
                    record.hostCorridorId(),
                    new DungeonCell(record.cellX(), record.cellY(), record.cellZ()),
                    record.topologyElementId() == null
                            ? new src.domain.dungeon.map.value.DungeonTopologyRef(
                                    src.domain.dungeon.map.value.DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                                    record.anchorId())
                            : new src.domain.dungeon.map.value.DungeonTopologyRef(
                                    src.domain.dungeon.map.value.DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                                    record.topologyElementId())));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorAnchorRef> toAnchorRefs(List<DungeonCorridorAnchorRefRecord> records) {
        List<DungeonCorridorAnchorRef> result = new ArrayList<>();
        for (DungeonCorridorAnchorRefRecord record
                : records == null ? List.<DungeonCorridorAnchorRefRecord>of() : records) {
            if (record.topologyElementId() == null) {
                continue;
            }
            result.add(new DungeonCorridorAnchorRef(
                    record.hostCorridorId(),
                    new src.domain.dungeon.map.value.DungeonTopologyRef(
                            src.domain.dungeon.map.value.DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                            record.topologyElementId())));
        }
        return List.copyOf(result);
    }
}
