package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.Objects;

public record DungeonTravelStatePublishedEvent(
        Kind kind,
        String actionId,
        int projectionLevel,
        String overlayModeKey,
        int overlayRange,
        double overlayOpacity,
        List<Integer> overlayLevels
) {

    public DungeonTravelStatePublishedEvent {
        Objects.requireNonNull(kind, "kind");
        actionId = actionId == null ? "" : actionId.trim();
        overlayModeKey = overlayModeKey == null || overlayModeKey.isBlank() ? "OFF" : overlayModeKey;
        overlayRange = Math.max(0, overlayRange);
        overlayOpacity = Math.max(0.0, Math.min(1.0, overlayOpacity));
        overlayLevels = overlayLevels == null ? List.of() : List.copyOf(overlayLevels);
    }

    static DungeonTravelStatePublishedEvent action(String actionId) {
        return new DungeonTravelStatePublishedEvent(Kind.ACTION, actionId, 0, "OFF", 2, 0.35, List.of());
    }

    static DungeonTravelStatePublishedEvent setProjectionLevel(int projectionLevel) {
        return new DungeonTravelStatePublishedEvent(
                Kind.SET_PROJECTION_LEVEL,
                "",
                projectionLevel,
                "OFF",
                2,
                0.35,
                List.of());
    }

    static DungeonTravelStatePublishedEvent setOverlay(
            String overlayModeKey,
            int overlayRange,
            double overlayOpacity,
            List<Integer> overlayLevels
    ) {
        return new DungeonTravelStatePublishedEvent(
                Kind.SET_OVERLAY,
                "",
                0,
                overlayModeKey,
                overlayRange,
                overlayOpacity,
                overlayLevels);
    }

    enum Kind {
        ACTION,
        SET_PROJECTION_LEVEL,
        SET_OVERLAY
    }
}
