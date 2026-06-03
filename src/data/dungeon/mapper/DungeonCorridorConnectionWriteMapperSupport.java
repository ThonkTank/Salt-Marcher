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
import src.domain.dungeon.model.worldspace.DungeonCorridor;
import src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding;
import src.domain.dungeon.model.worldspace.DungeonCorridorDoorBinding;

final class DungeonCorridorConnectionWriteMapperSupport {

    private DungeonCorridorConnectionWriteMapperSupport() {
    }

    static List<DungeonCorridorRecord> toCorridorRecords(List<DungeonCorridor> corridors) {
        List<DungeonCorridorRecord> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            result.add(new DungeonCorridorRecord(
                    corridor.corridorId(),
                    corridor.mapId(),
                    corridor.level(),
                    corridor.roomIds(),
                    toWaypointRecords(corridor.corridorId(), corridor.bindings().waypoints()),
                    toDoorBindingRecords(corridor.corridorId(), corridor.bindings().doorBindings()),
                    toAnchorBindingRecords(corridor.corridorId(), corridor.bindings().anchorBindings()),
                    toAnchorRefRecords(corridor.corridorId(), corridor.bindings().anchorRefs())));
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
            List<DungeonCorridorDoorBinding> doorBindings
    ) {
        List<DungeonCorridorDoorBindingRecord> result = new ArrayList<>();
        for (DungeonCorridorDoorBinding binding
                : doorBindings == null ? List.<DungeonCorridorDoorBinding>of() : doorBindings) {
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
            List<DungeonCorridorAnchorBinding> anchorBindings
    ) {
        List<DungeonCorridorAnchorBindingRecord> result = new ArrayList<>();
        for (DungeonCorridorAnchorBinding binding
                : anchorBindings == null ? List.<DungeonCorridorAnchorBinding>of() : anchorBindings) {
            result.add(new DungeonCorridorAnchorBindingRecord(
                    corridorId,
                    binding.anchorId(),
                    binding.hostCorridorId(),
                    binding.absoluteCell().q(),
                    binding.absoluteCell().r(),
                    binding.absoluteCell().level(),
                    binding.topologyRef().present() ? binding.topologyRef().id() : null));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorAnchorRefRecord> toAnchorRefRecords(
            long corridorId,
            List<CorridorAnchorRef> anchorRefs
    ) {
        List<DungeonCorridorAnchorRefRecord> result = new ArrayList<>();
        for (CorridorAnchorRef ref : anchorRefs == null ? List.<CorridorAnchorRef>of() : anchorRefs) {
            result.add(new DungeonCorridorAnchorRefRecord(
                    corridorId,
                    ref.hostCorridorId(),
                    ref.present() ? ref.anchorId() : null));
        }
        return List.copyOf(result);
    }
}
