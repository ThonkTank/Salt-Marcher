package src.data.dungeon.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonGridBoundsRecord;
import src.data.dungeon.model.DungeonMapRecord;
import src.domain.dungeon.model.core.geometry.DungeonTopology;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonMapAuthoring;
import src.domain.dungeon.model.worldspace.DungeonMapTopology;
import src.domain.dungeon.model.worldspace.SpatialTopology;

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
        List<Corridor> corridors =
                DungeonCorridorConnectionReadMapperSupport.toCorridors(resolvedRecord.corridors());
        StairCollection stairs = DungeonStairRecordMapperSupport.toStairs(resolvedRecord.stairs());
        List<Transition> transitions = DungeonTransitionRecordMapperSupport.toTransitions(resolvedRecord.transitions());
        DungeonMapTopology topologyIndex =
                DungeonTopologyElementRecordMapperSupport.toTopologyIndex(resolvedRecord.topologyElements());
        return DungeonMapAuthoring.authored(
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
                corridors,
                stairs,
                transitions,
                resolvedRecord.revision());
    }

    public static DungeonMapRecord toRecord(DungeonMap dungeonMap) {
        SpatialTopology topology = resolvedTopology(dungeonMap);
        long mapId = resolvedMapId(dungeonMap);
        List<Corridor> corridors = resolvedCorridors(dungeonMap);
        StairCollection stairs = resolvedStairs(dungeonMap);
        List<Transition> transitions = resolvedTransitions(dungeonMap);
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
                        resolvedTopologyIndex(dungeonMap, topology, corridors, stairs, transitions)),
                DungeonCorridorConnectionWriteMapperSupport.toCorridorRecords(corridors == null ? List.of() : corridors),
                DungeonStairRecordMapperSupport.toStairRecords(stairs),
                DungeonTransitionRecordMapperSupport.toTransitionRecords(
                        transitions == null ? List.of() : transitions));
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

    private static List<Corridor> resolvedCorridors(@Nullable DungeonMap dungeonMap) {
        return dungeonMap == null ? List.of() : dungeonMap.corridors();
    }

    private static StairCollection resolvedStairs(@Nullable DungeonMap dungeonMap) {
        return dungeonMap == null ? new StairCollection(List.of()) : dungeonMap.stairs();
    }

    private static List<Transition> resolvedTransitions(@Nullable DungeonMap dungeonMap) {
        return dungeonMap == null ? List.of() : dungeonMap.transitionCatalog().transitions();
    }

    private static DungeonMapTopology resolvedTopologyIndex(
            @Nullable DungeonMap dungeonMap,
            SpatialTopology topology,
            List<Corridor> corridors,
            StairCollection stairs,
            List<Transition> transitions
    ) {
        if (dungeonMap == null) {
            return DungeonMapTopology.from(
                    topology,
                    RoomCatalog.empty(),
                    corridors,
                    stairs.stairs(),
                    transitions);
        }
        return dungeonMap.topologyIndex();
    }

}
