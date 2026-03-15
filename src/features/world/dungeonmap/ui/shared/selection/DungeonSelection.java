package features.world.dungeonmap.ui.shared.selection;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;

import java.util.List;

public record DungeonSelection(
        SelectionType type,
        Long id,
        DungeonSquare square,
        DungeonRoom room,
        DungeonArea area,
        DungeonFeature feature,
        List<DungeonFeature> tileFeatures,
        DungeonConnection connection
) {
    public enum SelectionType {
        NONE,
        SQUARE,
        ROOM,
        AREA,
        FEATURE,
        CONNECTION
    }

    public static DungeonSelection none() {
        return new DungeonSelection(SelectionType.NONE, null, null, null, null, null, List.of(), null);
    }

    public static DungeonSelection square(DungeonSquare square, List<DungeonFeature> tileFeatures) {
        return new DungeonSelection(
                SelectionType.SQUARE,
                null,
                square,
                null,
                null,
                null,
                tileFeatures == null ? List.of() : List.copyOf(tileFeatures),
                null);
    }

    public static DungeonSelection room(DungeonRoom room) {
        return new DungeonSelection(SelectionType.ROOM, room == null ? null : room.roomId(), null, room, null, null, List.of(), null);
    }

    public static DungeonSelection area(DungeonArea area) {
        return new DungeonSelection(SelectionType.AREA, area == null ? null : area.areaId(), null, null, area, null, List.of(), null);
    }

    public static DungeonSelection feature(DungeonFeature feature) {
        return new DungeonSelection(SelectionType.FEATURE, feature == null ? null : feature.featureId(), null, null, null, feature, List.of(), null);
    }

    public static DungeonSelection connection(DungeonConnection connection) {
        return new DungeonSelection(SelectionType.CONNECTION, connection == null ? null : connection.connectionId(), null, null, null, null, List.of(), connection);
    }
}
