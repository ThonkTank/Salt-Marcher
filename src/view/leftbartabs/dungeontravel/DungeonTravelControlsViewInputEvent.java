package src.view.leftbartabs.dungeontravel;

import java.util.List;

public record DungeonTravelControlsViewInputEvent(
        Source source,
        String overlayModeKey,
        int overlayRange,
        double overlayOpacity,
        List<Integer> overlayLevels
) {

    public DungeonTravelControlsViewInputEvent {
        source = source == null ? Source.REFRESH_BUTTON : source;
        overlayModeKey = overlayModeKey == null ? "OFF" : overlayModeKey;
        overlayLevels = overlayLevels == null ? List.of() : List.copyOf(overlayLevels);
    }

    enum Source {
        REFRESH_BUTTON,
        RESET_VIEW_BUTTON,
        PREVIOUS_LEVEL_BUTTON,
        NEXT_LEVEL_BUTTON,
        OVERLAY_MODE_CONTROL,
        OVERLAY_RANGE_CONTROL,
        OVERLAY_OPACITY_CONTROL,
        OVERLAY_LEVEL_SELECTION
    }
}
