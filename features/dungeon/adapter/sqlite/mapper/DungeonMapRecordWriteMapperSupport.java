package features.dungeon.adapter.sqlite.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.topology.DungeonMapTopology;
import features.dungeon.domain.core.structure.topology.SpatialTopology;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.corridor.Corridor;

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
                DungeonClusterRecordMapperSupport.toClusterRecords(
                        topology.roomClusters(), dungeonMap.rooms().rooms()),
                DungeonRoomRecordMapperSupport.toRoomRecords(dungeonMap.rooms().rooms()),
                DungeonTopologyElementRecordMapperSupport.toTopologyElementRecords(
                        mapId,
                        resolvedTopologyIndex(dungeonMap, topology, corridors, stairs, transitions)),
                DungeonCorridorConnectionWriteMapperSupport.toCorridorRecords(corridors, dungeonMap.topologyIndex()),
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
