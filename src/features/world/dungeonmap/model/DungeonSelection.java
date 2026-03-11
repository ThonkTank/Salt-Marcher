package features.world.dungeonmap.model;

import java.util.List;

public record DungeonSelection(
        SelectionType type,
        Long id,
        DungeonSquare square,
        DungeonRoom room,
        DungeonArea area,
        DungeonFeature feature,
        List<DungeonFeature> tileFeatures,
        DungeonEndpoint endpoint,
        DungeonLink link,
        DungeonPassage passage
) {
    public enum SelectionType {
        NONE,
        SQUARE,
        ROOM,
        AREA,
        FEATURE,
        ENDPOINT,
        LINK,
        PASSAGE
    }

    public static DungeonSelection none() {
        return new DungeonSelection(SelectionType.NONE, null, null, null, null, null, List.of(), null, null, null);
    }
}
