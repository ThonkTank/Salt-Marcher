package src.data.dungeon.mapper;

import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonGridBoundsRecord;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonMapTopology;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.map.value.RoomCatalog;
import src.domain.dungeon.map.value.SpatialTopology;

import java.util.List;

/**
 * Maps source-local dungeon rows into the domain aggregate.
 */
public final class DungeonMapRecordMapper {

    private DungeonMapRecordMapper() {
    }

    public static DungeonMap toDomain(DungeonMapRecord record) {
        DungeonMapRecord resolvedRecord = record == null
                ? new DungeonMapRecord(1L, "Dungeon Map", 1L, DungeonGridBoundsRecord.defaultGrid())
                : record;
        DungeonGridBoundsRecord gridBounds = resolvedRecord.gridBounds();
        var clusters = DungeonClusterRecordMapperSupport.toClusters(resolvedRecord.roomClusters());
        RoomCatalog rooms = new RoomCatalog(DungeonRoomRecordMapperSupport.toRooms(resolvedRecord.rooms()));
        ConnectionCatalog connections = DungeonConnectionRecordMapper.toConnectionCatalog(resolvedRecord);
        DungeonMapTopology topologyIndex =
                DungeonTopologyElementRecordMapperSupport.toTopologyIndex(resolvedRecord.topologyElements());
        return DungeonMap.authored(
                new DungeonMapIdentity(resolvedRecord.mapId()),
                resolvedRecord.name(),
                new SpatialTopology(
                        DungeonTopology.SQUARE,
                        gridBounds.width(),
                        gridBounds.height(),
                        gridBounds.roomAnchorQ(),
                        gridBounds.roomAnchorR(),
                        clusters),
                topologyIndex,
                rooms,
                connections,
                resolvedRecord.revision());
    }

    public static DungeonMapRecord toRecord(DungeonMap dungeonMap) {
        SpatialTopology topology = resolvedTopology(dungeonMap);
        long mapId = resolvedMapId(dungeonMap);
        ConnectionCatalog connections = resolvedConnections(dungeonMap);
        return new DungeonMapRecord(
                mapId,
                resolvedMapName(dungeonMap),
                resolvedRevision(dungeonMap),
                new DungeonGridBoundsRecord(
                        topology.width(),
                        topology.height(),
                        topology.roomAnchorQ(),
                        topology.roomAnchorR()),
                DungeonClusterRecordMapperSupport.toClusterRecords(topology.roomClusters()),
                DungeonRoomRecordMapperSupport.toRoomRecords(dungeonMap == null ? List.of() : dungeonMap.rooms().rooms()),
                DungeonTopologyElementRecordMapperSupport.toTopologyElementRecords(
                        mapId,
                        resolvedTopologyIndex(dungeonMap, topology, connections)),
                DungeonConnectionRecordMapper.toCorridorRecords(connections),
                DungeonConnectionRecordMapper.toStairRecords(connections),
                DungeonConnectionRecordMapper.toTransitionRecords(connections));
    }

    private static SpatialTopology resolvedTopology(@Nullable DungeonMap dungeonMap) {
        return dungeonMap == null ? SpatialTopology.empty() : dungeonMap.topology();
    }

    private static long resolvedMapId(@Nullable DungeonMap dungeonMap) {
        return dungeonMap == null ? 1L : dungeonMap.metadata().mapId().value();
    }

    private static String resolvedMapName(@Nullable DungeonMap dungeonMap) {
        return dungeonMap == null ? "Dungeon Map" : dungeonMap.metadata().mapName();
    }

    private static long resolvedRevision(@Nullable DungeonMap dungeonMap) {
        return dungeonMap == null ? 1L : dungeonMap.revision();
    }

    private static ConnectionCatalog resolvedConnections(@Nullable DungeonMap dungeonMap) {
        return dungeonMap == null ? ConnectionCatalog.empty() : dungeonMap.connections();
    }

    private static DungeonMapTopology resolvedTopologyIndex(
            @Nullable DungeonMap dungeonMap,
            SpatialTopology topology,
            ConnectionCatalog connections
    ) {
        if (dungeonMap == null) {
            return DungeonMapTopology.from(topology, RoomCatalog.empty(), connections);
        }
        return dungeonMap.topologyIndex();
    }

}
