package features.dungeon.adapter.sqlite.mapper;

import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerCatalog;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.transition.Transition;
import java.util.List;

/** Maps one patch-owned entity without constructing a full-map persistence carrier. */
public final class DungeonPatchRecordMapper {

    private DungeonPatchRecordMapper() {
    }

    public static DungeonRoomRecord room(RoomRegion room) {
        return DungeonRoomRecordMapperSupport.toRoomRecords(List.of(room)).getFirst();
    }

    public static DungeonRoomClusterRecord cluster(RoomCluster cluster) {
        return DungeonClusterRecordMapperSupport.toClusterRecords(List.of(cluster), List.of()).getFirst();
    }

    public static DungeonCorridorRecord corridor(Corridor corridor) {
        return DungeonCorridorConnectionWriteMapperSupport.toCorridorRecords(List.of(corridor), null).getFirst();
    }

    public static DungeonStairRecord stair(Stair stair) {
        return DungeonStairRecordMapperSupport.toStairRecords(new StairCollection(List.of(stair))).getFirst();
    }

    public static DungeonTransitionRecord transition(Transition transition) {
        return DungeonTransitionRecordMapperSupport.toTransitionRecords(List.of(transition)).getFirst();
    }

    public static DungeonFeatureMarkerRecord featureMarker(FeatureMarker marker) {
        return DungeonFeatureMarkerRecordMapperSupport.toFeatureMarkerRecords(
                marker.mapId().value(), new FeatureMarkerCatalog(List.of(marker))).getFirst();
    }
}
