package src.data.dungeon.mapper;

import src.data.dungeon.model.DungeonGridBoundsRecord;
import src.data.dungeon.model.DungeonMapRecord;
import src.domain.dungeon.model.core.geometry.DungeonTopology;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapAuthoring;
import src.domain.dungeon.model.core.structure.DungeonMapAuthoring.AuthoredContent;
import src.domain.dungeon.model.core.structure.topology.DungeonMapTopology;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerCatalog;
import src.domain.dungeon.model.core.structure.transition.Transition;
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
        List<Corridor> corridors =
                DungeonCorridorConnectionReadMapperSupport.toCorridors(resolvedRecord.corridors());
        StairCollection stairs = DungeonStairRecordMapperSupport.toStairs(resolvedRecord.stairs());
        List<Transition> transitions = DungeonTransitionRecordMapperSupport.toTransitions(resolvedRecord.transitions());
        FeatureMarkerCatalog featureMarkers =
                DungeonFeatureMarkerRecordMapperSupport.toFeatureMarkers(resolvedRecord.featureMarkers());
        DungeonMapTopology topologyIndex =
                DungeonTopologyElementRecordMapperSupport.toTopologyIndex(resolvedRecord.topologyElements());
        return DungeonMapAuthoring.authored(
                new DungeonMapIdentity(resolvedRecord.mapId()),
                resolvedRecord.name(),
                new AuthoredContent(
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
                        featureMarkers),
                resolvedRecord.revision());
    }

    public static DungeonMapRecord toRecord(DungeonMap dungeonMap) {
        return DungeonMapRecordWriteMapperSupport.toRecord(dungeonMap);
    }
}
