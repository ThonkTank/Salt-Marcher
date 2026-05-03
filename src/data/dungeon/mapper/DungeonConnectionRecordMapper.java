package src.data.dungeon.mapper;

import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonCorridorAnchorBindingRecord;
import src.data.dungeon.model.DungeonCorridorAnchorRefRecord;
import src.data.dungeon.model.DungeonCorridorDoorBindingRecord;
import src.data.dungeon.model.DungeonCorridorRecord;
import src.data.dungeon.model.DungeonCorridorWaypointRecord;
import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonStairExitRecord;
import src.data.dungeon.model.DungeonStairPathNodeRecord;
import src.data.dungeon.model.DungeonStairRecord;
import src.data.dungeon.model.DungeonTransitionRecord;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.entity.DungeonTransition;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonCorridorAnchorRef;
import src.domain.dungeon.map.value.DungeonCorridorBindings;
import src.domain.dungeon.map.value.DungeonCorridorDoorBinding;
import src.domain.dungeon.map.value.DungeonCorridorWaypoint;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonStairExit;
import src.domain.dungeon.map.value.DungeonStairShape;
import src.domain.dungeon.map.value.DungeonTransitionDestination;

import java.util.ArrayList;
import java.util.List;

final class DungeonConnectionRecordMapper {

    private DungeonConnectionRecordMapper() {
    }

    static ConnectionCatalog toConnectionCatalog(DungeonMapRecord record) {
        return new ConnectionCatalog(
                toCorridors(record.corridors()),
                toStairs(record.stairs()),
                toTransitions(record.transitions()));
    }

    static List<DungeonCorridorRecord> toCorridorRecords(ConnectionCatalog connections) {
        List<DungeonCorridorRecord> result = new ArrayList<>();
        for (DungeonCorridor corridor : connections == null ? List.<DungeonCorridor>of() : connections.corridors()) {
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

    static List<DungeonStairRecord> toStairRecords(ConnectionCatalog connections) {
        List<DungeonStairRecord> result = new ArrayList<>();
        for (DungeonStair stair : connections == null ? List.<DungeonStair>of() : connections.stairs()) {
            result.add(new DungeonStairRecord(
                    stair.stairId(),
                    stair.mapId(),
                    stair.name(),
                    stair.shape().name(),
                    directionCode(stair.direction()),
                    stair.dimension1(),
                    stair.dimension2(),
                    stair.corridorId(),
                    toStairPathRecords(stair.stairId(), stair.path()),
                    toStairExitRecords(stair.stairId(), stair.exits())));
        }
        return List.copyOf(result);
    }

    static List<DungeonTransitionRecord> toTransitionRecords(ConnectionCatalog connections) {
        List<DungeonTransitionRecord> result = new ArrayList<>();
        for (DungeonTransition transition
                : connections == null ? List.<DungeonTransition>of() : connections.transitions()) {
            result.add(toTransitionRecord(transition));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridor> toCorridors(List<DungeonCorridorRecord> records) {
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

    private static List<DungeonStair> toStairs(List<DungeonStairRecord> records) {
        List<DungeonStair> result = new ArrayList<>();
        for (DungeonStairRecord record : records == null ? List.<DungeonStairRecord>of() : records) {
            result.add(new DungeonStair(
                    record.stairId(),
                    record.mapId(),
                    record.name(),
                    DungeonStairShape.parse(record.shape()),
                    DungeonEdgeDirection.fromCode(record.direction()),
                    record.dimension1(),
                    record.dimension2(),
                    toStairPath(record.pathNodes()),
                    toStairExits(record.exits()),
                    record.corridorId()));
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

    private static List<DungeonCell> toStairPath(List<DungeonStairPathNodeRecord> records) {
        List<DungeonCell> result = new ArrayList<>();
        for (DungeonStairPathNodeRecord record
                : records == null ? List.<DungeonStairPathNodeRecord>of() : records) {
            result.add(new DungeonCell(record.cellX(), record.cellY(), record.cellZ()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonStairExit> toStairExits(List<DungeonStairExitRecord> records) {
        List<DungeonStairExit> result = new ArrayList<>();
        for (DungeonStairExitRecord record : records == null ? List.<DungeonStairExitRecord>of() : records) {
            result.add(new DungeonStairExit(
                    record.exitId(),
                    new DungeonCell(record.cellX(), record.cellY(), record.cellZ()),
                    record.label()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonTransition> toTransitions(List<DungeonTransitionRecord> records) {
        List<DungeonTransition> result = new ArrayList<>();
        for (DungeonTransitionRecord record : records == null ? List.<DungeonTransitionRecord>of() : records) {
            result.add(new DungeonTransition(
                    record.transitionId(),
                    record.mapId(),
                    record.description(),
                    transitionAnchor(record),
                    transitionDestination(record),
                    record.linkedTransitionId()));
        }
        return List.copyOf(result);
    }

    private static @Nullable DungeonCell transitionAnchor(DungeonTransitionRecord record) {
        if (record.cellX() == null) {
            return null;
        }
        return new DungeonCell(
                record.cellX(),
                record.cellY() == null ? 0 : record.cellY(),
                record.levelZ() == null ? 0 : record.levelZ());
    }

    private static DungeonTransitionDestination transitionDestination(DungeonTransitionRecord record) {
        if ("DUNGEON_MAP".equalsIgnoreCase(record.destinationType())) {
            return new DungeonTransitionDestination.DungeonMapDestination(
                    record.targetDungeonMapId() == null ? 0L : record.targetDungeonMapId(),
                    record.targetTransitionId());
        }
        return new DungeonTransitionDestination.OverworldTileDestination(
                record.targetOverworldMapId() == null ? 0L : record.targetOverworldMapId(),
                record.targetOverworldTileId() == null ? 0L : record.targetOverworldTileId());
    }

    private static List<DungeonCorridorWaypointRecord> toWaypointRecords(
            long corridorId,
            List<DungeonCorridorWaypoint> waypoints
    ) {
        List<DungeonCorridorWaypointRecord> result = new ArrayList<>();
        for (DungeonCorridorWaypoint waypoint
                : waypoints == null ? List.<DungeonCorridorWaypoint>of() : waypoints) {
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

    private static List<DungeonStairPathNodeRecord> toStairPathRecords(long stairId, List<DungeonCell> path) {
        List<DungeonStairPathNodeRecord> result = new ArrayList<>();
        for (DungeonCell cell : path == null ? List.<DungeonCell>of() : path) {
            result.add(new DungeonStairPathNodeRecord(stairId, cell.q(), cell.r(), cell.level()));
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
            List<DungeonCorridorAnchorRef> anchorRefs
    ) {
        List<DungeonCorridorAnchorRefRecord> result = new ArrayList<>();
        for (DungeonCorridorAnchorRef ref : anchorRefs == null ? List.<DungeonCorridorAnchorRef>of() : anchorRefs) {
            result.add(new DungeonCorridorAnchorRefRecord(
                    corridorId,
                    ref.hostCorridorId(),
                    ref.topologyRef().present() ? ref.topologyRef().id() : null));
        }
        return List.copyOf(result);
    }

    private static List<DungeonStairExitRecord> toStairExitRecords(long stairId, List<DungeonStairExit> exits) {
        List<DungeonStairExitRecord> result = new ArrayList<>();
        for (DungeonStairExit exit : exits == null ? List.<DungeonStairExit>of() : exits) {
            result.add(new DungeonStairExitRecord(
                    stairId,
                    exit.exitId(),
                    exit.position().q(),
                    exit.position().r(),
                    exit.position().level(),
                    exit.label()));
        }
        return List.copyOf(result);
    }

    private static DungeonTransitionRecord toTransitionRecord(DungeonTransition transition) {
        DungeonCell anchor = transition.anchor();
        DestinationRecord destination = destinationRecord(transition.destination());
        return new DungeonTransitionRecord(
                transition.transitionId(),
                transition.mapId(),
                transition.description(),
                anchor == null ? null : anchor.q(),
                anchor == null ? null : anchor.r(),
                anchor == null ? null : anchor.level(),
                destination.destinationType(),
                destination.targetOverworldMapId(),
                destination.targetOverworldTileId(),
                destination.targetDungeonMapId(),
                destination.targetTransitionId(),
                transition.linkedTransitionId());
    }

    private static DestinationRecord destinationRecord(DungeonTransitionDestination destination) {
        if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            return new DestinationRecord(
                    "DUNGEON_MAP",
                    null,
                    null,
                    dungeon.mapId(),
                    dungeon.transitionId());
        }
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            return new DestinationRecord(
                    "OVERWORLD_TILE",
                    overworld.mapId(),
                    overworld.tileId(),
                    null,
                    null);
        }
        return new DestinationRecord("OVERWORLD_TILE", 0L, 0L, null, null);
    }

    private static int directionCode(DungeonEdgeDirection direction) {
        return switch (direction == null ? DungeonEdgeDirection.NORTH : direction) {
            case EAST -> 1;
            case SOUTH -> 2;
            case WEST -> 3;
            case NORTH -> 0;
        };
    }

    private record DestinationRecord(
            String destinationType,
            @Nullable Long targetOverworldMapId,
            @Nullable Long targetOverworldTileId,
            @Nullable Long targetDungeonMapId,
            @Nullable Long targetTransitionId
    ) {
    }
}
