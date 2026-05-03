package src.view.leftbartabs.dungeontravel;

public record DungeonTravelControlsViewInputEvent(
        boolean refreshRequested,
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
