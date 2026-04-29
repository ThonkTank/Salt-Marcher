package src.view.leftbartabs.dungeontravel;

import java.util.List;

public record DungeonTravelControlsViewInputEvent(
        Kind kind,
        String overlayModeKey,
        int overlayRange,
        double overlayOpacity,
        List<Integer> overlayLevels
) {

    public DungeonTravelControlsViewInputEvent {
        kind = kind == null ? Kind.REFRESH : kind;
        overlayModeKey = overlayModeKey == null ? "OFF" : overlayModeKey;
        overlayLevels = overlayLevels == null ? List.of() : List.copyOf(overlayLevels);
    }

    static DungeonTravelControlsViewInputEvent refresh() {
        return new DungeonTravelControlsViewInputEvent(Kind.REFRESH, "OFF", 0, 0.0, List.of());
    }

    static DungeonTravelControlsViewInputEvent resetView() {
        return new DungeonTravelControlsViewInputEvent(Kind.RESET_VIEW, "OFF", 0, 0.0, List.of());
    }

    static DungeonTravelControlsViewInputEvent previousLevel() {
        return new DungeonTravelControlsViewInputEvent(Kind.PREVIOUS_LEVEL, "OFF", 0, 0.0, List.of());
    }

    static DungeonTravelControlsViewInputEvent nextLevel() {
        return new DungeonTravelControlsViewInputEvent(Kind.NEXT_LEVEL, "OFF", 0, 0.0, List.of());
    }

    static DungeonTravelControlsViewInputEvent overlayModeChanged(String modeKey) {
        return new DungeonTravelControlsViewInputEvent(
                Kind.OVERLAY_MODE_CHANGED,
                modeKey == null ? "OFF" : modeKey,
                0,
                0.0,
                List.of());
    }

    static DungeonTravelControlsViewInputEvent overlayRangeChanged(int levelRange) {
        return new DungeonTravelControlsViewInputEvent(Kind.OVERLAY_RANGE_CHANGED, "OFF", levelRange, 0.0, List.of());
    }

    static DungeonTravelControlsViewInputEvent overlayOpacityChanged(double opacity) {
        return new DungeonTravelControlsViewInputEvent(Kind.OVERLAY_OPACITY_CHANGED, "OFF", 0, opacity, List.of());
    }

    static DungeonTravelControlsViewInputEvent overlayLevelsChanged(List<Integer> levels) {
        return new DungeonTravelControlsViewInputEvent(Kind.OVERLAY_LEVELS_CHANGED, "OFF", 0, 0.0, levels);
    }

    enum Kind {
        REFRESH,
        RESET_VIEW,
        PREVIOUS_LEVEL,
        NEXT_LEVEL,
        OVERLAY_MODE_CHANGED,
        OVERLAY_RANGE_CHANGED,
        OVERLAY_OPACITY_CHANGED,
        OVERLAY_LEVELS_CHANGED
    }
}
