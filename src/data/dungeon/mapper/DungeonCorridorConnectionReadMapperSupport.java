package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.List;
import src.data.dungeon.model.DungeonCorridorAnchorBindingRecord;
import src.data.dungeon.model.DungeonCorridorAnchorRefRecord;
import src.data.dungeon.model.DungeonCorridorDoorBindingRecord;
import src.data.dungeon.model.DungeonCorridorRecord;
import src.data.dungeon.model.DungeonCorridorWaypointRecord;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.worldspace.DungeonCorridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorBinding;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindingState;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingState;

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
                    new CorridorBindingState(
                            toWaypoints(record.waypoints()),
                            toDoorBindings(record.doorBindings()),
                            toAnchorBindings(record.anchorBindings()),
                            toAnchorRefs(record.anchorRefs()))));
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

    private static List<CorridorAnchorBinding> toAnchorBindings(List<DungeonCorridorAnchorBindingRecord> records) {
        List<CorridorAnchorBinding> result = new ArrayList<>();
        for (DungeonCorridorAnchorBindingRecord record
                : records == null ? List.<DungeonCorridorAnchorBindingRecord>of() : records) {
            result.add(new CorridorAnchorBinding(
                    record.anchorId(),
                    record.hostCorridorId(),
                    new Cell(record.cellX(), record.cellY(), record.cellZ()),
                    record.topologyElementId() == null
                            ? new DungeonTopologyRef(
                                    DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                                    record.anchorId())
                            : new DungeonTopologyRef(
                                    DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                                    record.topologyElementId())));
        }
        return List.copyOf(result);
    }

    private static List<CorridorAnchorRef> toAnchorRefs(List<DungeonCorridorAnchorRefRecord> records) {
        List<CorridorAnchorRef> result = new ArrayList<>();
        for (DungeonCorridorAnchorRefRecord record
                : records == null ? List.<DungeonCorridorAnchorRefRecord>of() : records) {
            if (record.topologyElementId() == null) {
                continue;
            }
            result.add(new CorridorAnchorRef(
                    record.hostCorridorId(),
                    record.topologyElementId()));
        }
        return List.copyOf(result);
    }
}
