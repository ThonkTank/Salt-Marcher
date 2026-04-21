package src.data.dungeon.mapper;

import org.jspecify.annotations.Nullable;
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
                            toDoorBindings(record.doorBindings()))));
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
                    DungeonEdgeDirection.parse(record.edgeDirection())));
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
}
