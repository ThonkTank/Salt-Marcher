package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.geometry.Point2i;

import java.util.List;

public record RoomNarration(
        RoomWallFinish wallFinish,
        RoomLightLevel lightLevel,
        RoomAtmosphere atmosphere,
        String notes,
        String visualDescriptionOverride,
        List<RoomExitNarration> exitNarrations
) {
    private static final RoomNarration EMPTY = new RoomNarration(
            RoomWallFinish.UNSPECIFIED,
            RoomLightLevel.UNSPECIFIED,
            RoomAtmosphere.UNSPECIFIED,
            "",
            "",
            List.of());

    public RoomNarration {
        wallFinish = wallFinish == null ? RoomWallFinish.UNSPECIFIED : wallFinish;
        lightLevel = lightLevel == null ? RoomLightLevel.UNSPECIFIED : lightLevel;
        atmosphere = atmosphere == null ? RoomAtmosphere.UNSPECIFIED : atmosphere;
        notes = notes == null ? "" : notes.trim();
        visualDescriptionOverride = visualDescriptionOverride == null ? "" : visualDescriptionOverride.trim();
        exitNarrations = exitNarrations == null ? List.of() : List.copyOf(exitNarrations.stream()
                .filter(java.util.Objects::nonNull)
                .toList());
    }

    public static RoomNarration empty() {
        return EMPTY;
    }

    public String exitDescription(Point2i roomCell, Point2i direction) {
        return exitNarrations.stream()
                .filter(exit -> exit.roomCell().equals(roomCell) && exit.direction().equals(direction))
                .map(RoomExitNarration::description)
                .findFirst()
                .orElse("");
    }

    public boolean hasVisualDescriptionOverride() {
        return !visualDescriptionOverride.isBlank();
    }
}
