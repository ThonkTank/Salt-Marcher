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

    public static DungeonSelection square(DungeonSquare square, List<DungeonFeature> tileFeatures) {
        return new DungeonSelection(
                SelectionType.SQUARE,
                null,
                square,
                null,
                null,
                null,
                tileFeatures == null ? List.of() : List.copyOf(tileFeatures),
                null,
                null,
                null);
    }

    public static DungeonSelection room(DungeonRoom room) {
        return new DungeonSelection(SelectionType.ROOM, room == null ? null : room.roomId(), null, room, null, null, List.of(), null, null, null);
    }

    public static DungeonSelection area(DungeonArea area) {
        return new DungeonSelection(SelectionType.AREA, area == null ? null : area.areaId(), null, null, area, null, List.of(), null, null, null);
    }

    public static DungeonSelection feature(DungeonFeature feature) {
        return new DungeonSelection(SelectionType.FEATURE, feature == null ? null : feature.featureId(), null, null, null, feature, List.of(), null, null, null);
    }

    public static DungeonSelection endpoint(DungeonEndpoint endpoint) {
        return new DungeonSelection(SelectionType.ENDPOINT, endpoint == null ? null : endpoint.endpointId(), null, null, null, null, List.of(), endpoint, null, null);
    }

    public static DungeonSelection link(DungeonLink link) {
        return new DungeonSelection(SelectionType.LINK, link == null ? null : link.linkId(), null, null, null, null, List.of(), null, link, null);
    }

    public static DungeonSelection passage(DungeonPassage passage) {
        return new DungeonSelection(SelectionType.PASSAGE, passage == null ? null : passage.passageId(), null, null, null, null, List.of(), null, null, passage);
    }
}
