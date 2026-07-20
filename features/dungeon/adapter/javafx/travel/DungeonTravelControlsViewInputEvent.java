package features.dungeon.adapter.javafx.travel;

public record DungeonTravelControlsViewInputEvent(
        boolean resetViewRequested,
        int projectionLevelShift,
        String overlayModeKey,
        int overlayRange,
        double overlayOpacity,
        String overlayLevelsText
) {

    public DungeonTravelControlsViewInputEvent {
        overlayModeKey = overlayModeKey == null ? "" : overlayModeKey;
        overlayLevelsText = overlayLevelsText == null ? "" : overlayLevelsText.strip();
    }
}
