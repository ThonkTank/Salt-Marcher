package features.dungeon.adapter.sqlite.mapper;

import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapAuthoring.AuthoredContent;
import features.dungeon.domain.core.structure.topology.DungeonMapTopology;
import features.dungeon.domain.core.structure.topology.SpatialTopology;
import features.dungeon.domain.core.structure.feature.FeatureMarkerCatalog;
import features.dungeon.domain.core.structure.transition.Transition;
import java.util.ArrayList;
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
        var roomValues = DungeonRoomRecordMapperSupport.toRooms(resolvedRecord.rooms());
        RoomCatalog rooms = new RoomCatalog(roomValues);
        var clusters = DungeonClusterRecordMapperSupport.toClusters(
                resolvedRecord.roomClusters(),
                roomValues);
        List<Corridor> corridors =
                DungeonCorridorConnectionReadMapperSupport.toCorridors(resolvedRecord.corridors());
        StairCollection stairs = DungeonStairRecordMapperSupport.toStairs(resolvedRecord.stairs());
        List<Transition> transitions = DungeonTransitionRecordMapperSupport.toTransitions(resolvedRecord.transitions());
        FeatureMarkerCatalog featureMarkers =
                DungeonFeatureMarkerRecordMapperSupport.toFeatureMarkers(resolvedRecord.featureMarkers());
        DungeonMapTopology storedTopology =
                DungeonTopologyElementRecordMapperSupport.toTopologyIndex(resolvedRecord.topologyElements());
        List<DungeonMapTopology.DungeonTopologyBinding> topologyBindings = new ArrayList<>();
        for (DungeonMapTopology.DungeonTopologyBinding anchorBinding
                : DungeonCorridorConnectionReadMapperSupport.toAnchorTopologyBindings(resolvedRecord.corridors())) {
            DungeonMapTopology.DungeonTopologyBinding storedBinding = storedTopology.binding(anchorBinding.ref());
            topologyBindings.add(storedBinding == null
                    ? anchorBinding
                    : new DungeonMapTopology.DungeonTopologyBinding(
                            anchorBinding.ref(),
                            anchorBinding.clusterId(),
                            anchorBinding.corridorId(),
                            anchorBinding.localElementId(),
                            storedBinding.label()));
        }
        topologyBindings.addAll(storedTopology.bindings());
        DungeonMapTopology topologyIndex = new DungeonMapTopology(topologyBindings);
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

}
