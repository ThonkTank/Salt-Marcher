package src.domain.travel.published;

import org.jspecify.annotations.Nullable;
import src.domain.travel.published.TravelDungeonMapProjectionSnapshot;

public record TravelDungeonSnapshot(
        @Nullable TravelDungeonSurface surface,
        @Nullable TravelDungeonMapProjectionSnapshot mapProjection,
        TravelOverlaySettings overlaySettings,
        int projectionLevel
) {

    public TravelDungeonSnapshot {
        overlaySettings = overlaySettings == null ? TravelOverlaySettings.defaults() : overlaySettings;
    }

    public static TravelDungeonSnapshot empty() {
        return new TravelDungeonSnapshot(null, null, TravelOverlaySettings.defaults(), 0);
    }
}
