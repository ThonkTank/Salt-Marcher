package src.data.dungeon.mapper;

import src.data.dungeon.model.DungeonClusterBoundaryRecord;
import src.data.dungeon.model.DungeonCorridorDoorBindingRecord;
import src.data.dungeon.model.DungeonCorridorRecord;
import src.data.dungeon.model.DungeonCorridorWaypointRecord;
import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonRoomClusterRecord;
import src.data.dungeon.model.DungeonRoomClusterVertexRecord;
import src.data.dungeon.model.DungeonRoomExitDescriptionRecord;
import src.data.dungeon.model.DungeonRoomFloorRecord;
import src.data.dungeon.model.DungeonRoomRecord;
import src.data.dungeon.model.DungeonStairExitRecord;
import src.data.dungeon.model.DungeonStairPathNodeRecord;
import src.data.dungeon.model.DungeonStairRecord;
import src.data.dungeon.model.DungeonTopologySeedRecord;
import src.data.dungeon.model.DungeonTransitionRecord;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.entity.DungeonTransition;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonCorridorBindings;
import src.domain.dungeon.map.value.DungeonCorridorDoorBinding;
import src.domain.dungeon.map.value.DungeonCorridorWaypoint;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonStairExit;
import src.domain.dungeon.map.value.DungeonStairShape;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.map.value.DungeonTransitionDestination;
import src.domain.dungeon.map.value.RoomCatalog;
import src.domain.dungeon.map.value.SpatialTopology;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;

/**
 * Maps source-local dungeon rows into the domain aggregate.
 */
public final class DungeonMapRecordMapper {

    private DungeonMapRecordMapper() {
    }

    public static DungeonMap toDomain(DungeonMapRecord record) {
        DungeonMapRecord resolvedRecord = record == null
                ? new DungeonMapRecord(1L, "Dungeon Bastion", 1L, DungeonTopologySeedRecord.demo())
                : record;
        DungeonTopologySeedRecord seed = resolvedRecord.topologySeed();
        List<DungeonRoomCluster> clusters = toClusters(resolvedRecord.roomClusters());
        RoomCatalog rooms = new RoomCatalog(toRooms(resolvedRecord.rooms()));
        ConnectionCatalog connections = new ConnectionCatalog(
                toCorridors(resolvedRecord.corridors()),
                toStairs(resolvedRecord.stairs()),
                toTransitions(resolvedRecord.transitions()));
        return DungeonMap.authored(
                new DungeonMapIdentity(resolvedRecord.mapId()),
                resolvedRecord.name(),
                new SpatialTopology(
                        DungeonTopology.SQUARE,
                        seed.width(),
                        seed.height(),
                        seed.roomAnchorQ(),
                        seed.roomAnchorR(),
                        clusters),
                rooms,
                connections,
                resolvedRecord.revision());
    }

    public static DungeonMapRecord toRecord(DungeonMap dungeonMap) {
        SpatialTopology topology = dungeonMap == null ? SpatialTopology.demo() : dungeonMap.topology();
        return new DungeonMapRecord(
                dungeonMap == null ? 1L : dungeonMap.metadata().mapId().value(),
                dungeonMap == null ? "Dungeon Bastion" : dungeonMap.metadata().mapName(),
                dungeonMap == null ? 1L : dungeonMap.revision(),
                new DungeonTopologySeedRecord(
                        topology.width(),
                        topology.height(),
                        topology.roomAnchorQ(),
                        topology.roomAnchorR()));
    }

    private static List<DungeonRoomCluster> toClusters(List<DungeonRoomClusterRecord> records) {
        List<DungeonRoomCluster> result = new ArrayList<>();
        for (DungeonRoomClusterRecord record : records == null ? List.<DungeonRoomClusterRecord>of() : records) {
            result.add(new DungeonRoomCluster(
                    record.clusterId(),
                    record.mapId(),
                    new DungeonCell(record.centerX(), record.centerY(), record.levelZ()),
                    verticesByLevel(record.vertices()),
                    boundariesByLevel(record.boundaries())));
        }
        return List.copyOf(result);
    }

    private static Map<Integer, List<DungeonCell>> verticesByLevel(List<DungeonRoomClusterVertexRecord> records) {
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (DungeonRoomClusterVertexRecord record
                : records == null ? List.<DungeonRoomClusterVertexRecord>of() : records) {
            result.computeIfAbsent(record.levelZ(), ignored -> new ArrayList<>())
                    .add(new DungeonCell(record.relativeX(), record.relativeY(), record.levelZ()));
        }
        return copyNestedLists(result);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel(
            List<DungeonClusterBoundaryRecord> records
    ) {
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (DungeonClusterBoundaryRecord record
                : records == null ? List.<DungeonClusterBoundaryRecord>of() : records) {
            result.computeIfAbsent(record.levelZ(), ignored -> new ArrayList<>())
                    .add(new DungeonClusterBoundary(
                            record.clusterId(),
                            record.levelZ(),
                            new DungeonCell(record.cellX(), record.cellY(), record.levelZ()),
                            DungeonEdgeDirection.parse(record.edgeDirection()),
                            DungeonClusterBoundaryKind.parse(record.edgeType())));
        }
        return copyNestedLists(result);
    }

    private static List<DungeonRoom> toRooms(List<DungeonRoomRecord> records) {
        List<DungeonRoom> result = new ArrayList<>();
        for (DungeonRoomRecord record : records == null ? List.<DungeonRoomRecord>of() : records) {
            result.add(new DungeonRoom(
                    record.roomId(),
                    record.mapId(),
                    record.clusterId(),
                    record.name(),
                    floorAnchors(record),
                    new DungeonRoomNarration(
                            record.visualDescription(),
                            exitDescriptions(record.levelZ(), record.exitDescriptions()))));
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

    private static Map<Integer, DungeonCell> floorAnchors(DungeonRoomRecord room) {
        Map<Integer, DungeonCell> result = new LinkedHashMap<>();
        result.put(room.levelZ(), new DungeonCell(room.componentX(), room.componentY(), room.levelZ()));
        for (DungeonRoomFloorRecord floor : room.floors()) {
            result.put(floor.levelZ(), new DungeonCell(floor.anchorX(), floor.anchorY(), floor.levelZ()));
        }
        return Collections.unmodifiableMap(result);
    }

    private static List<DungeonRoomExitDescription> exitDescriptions(
            int level,
            List<DungeonRoomExitDescriptionRecord> records
    ) {
        List<DungeonRoomExitDescription> result = new ArrayList<>();
        for (DungeonRoomExitDescriptionRecord record
                : records == null ? List.<DungeonRoomExitDescriptionRecord>of() : records) {
            result.add(new DungeonRoomExitDescription(
                    new DungeonCell(record.cellX(), record.cellY(), level),
                    DungeonEdgeDirection.parse(record.edgeDirection()),
                    record.description()));
        }
        return List.copyOf(result);
    }

    private static <T> Map<Integer, List<T>> copyNestedLists(Map<Integer, List<T>> source) {
        Map<Integer, List<T>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<T>> entry : source.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }
}
