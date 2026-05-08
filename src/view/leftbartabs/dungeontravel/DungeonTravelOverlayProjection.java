package src.view.leftbartabs.dungeontravel;

import java.util.List;
import src.domain.travel.published.TravelOverlaySettings;

record DungeonTravelOverlayProjection(
        DungeonTravelOverlayMode mode,
        int levelRange,
        double opacity,
        List<Integer> selectedLevels
) {

    DungeonTravelOverlayProjection {
        mode = mode == null ? DungeonTravelOverlayMode.OFF : mode;
        levelRange = Math.max(0, levelRange);
        opacity = Math.max(0.0, Math.min(1.0, opacity));
        selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
    }

    static DungeonTravelOverlayProjection defaults() {
        return new DungeonTravelOverlayProjection(DungeonTravelOverlayMode.OFF, 2, 0.35, List.of());
    }

    static DungeonTravelOverlayProjection from(TravelOverlaySettings overlaySettings) {
        TravelOverlaySettings safeOverlay =
                overlaySettings == null ? TravelOverlaySettings.defaults() : overlaySettings;
        return new DungeonTravelOverlayProjection(
                DungeonTravelOverlayMode.fromKey(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    String modeKey() {
        return mode.key();
    }

    String overlayLabel() {
        return mode.label();
    }
}
