package src.data.dungeon.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonGridBoundsRecord;
import src.data.dungeon.model.DungeonMapRecord;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.topology.DungeonMapTopology;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.core.structure.corridor.Corridor;

final class DungeonMapRecordWriteMapperSupport {

    private DungeonMapRecordWriteMapperSupport() {
    }

    static DungeonMapRecord toRecord(DungeonMap dungeonMap) {
        if (dungeonMap == null) {
            return defaultRecord();
        }
        SpatialTopology topology = dungeonMap.topology();
        long mapId = dungeonMap.metadata().mapId().value();
        List<Corridor> corridors = dungeonMap.corridors();
        StairCollection stairs = dungeonMap.stairs();
        List<Transition> transitions = dungeonMap.transitionCatalog().transitions();
        return new DungeonMapRecord(
                mapId,
                dungeonMap.metadata().mapName(),
                dungeonMap.revision(),
                new DungeonGridBoundsRecord(
                        topology.width(),
                        topology.height(),
                        topology.roomAnchorQ(),
                        topology.roomAnchorR()),
                DungeonClusterRecordMapperSupport.toClusterRecords(topology.roomClusters()),
                DungeonRoomRecordMapperSupport.toRoomRecords(dungeonMap.rooms().rooms()),
                DungeonTopologyElementRecordMapperSupport.toTopologyElementRecords(
                        mapId,
                        resolvedTopologyIndex(dungeonMap, topology, corridors, stairs, transitions)),
                DungeonCorridorConnectionWriteMapperSupport.toCorridorRecords(corridors),
                DungeonStairRecordMapperSupport.toStairRecords(stairs),
                DungeonTransitionRecordMapperSupport.toTransitionRecords(transitions),
                DungeonFeatureMarkerRecordMapperSupport.toFeatureMarkerRecords(
                        mapId,
                        dungeonMap.featureMarkers()));
    }

    private static DungeonMapRecord defaultRecord() {
        return new DungeonMapRecord(
                1L,
                "Dungeon Map",
                1L,
                DungeonGridBoundsRecord.defaultGrid(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of());
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
