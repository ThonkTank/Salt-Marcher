package src.domain.travel.published;

import org.jspecify.annotations.Nullable;

public record TravelDungeonSnapshot(
        @Nullable TravelDungeonSurface surface,
        TravelOverlaySettings overlaySettings,
        int projectionLevel
) {

    public TravelDungeonSnapshot {
        overlaySettings = overlaySettings == null ? TravelOverlaySettings.defaults() : overlaySettings;
    }

    public static TravelDungeonSnapshot empty() {
        return new TravelDungeonSnapshot(null, TravelOverlaySettings.defaults(), 0);
    }
}
