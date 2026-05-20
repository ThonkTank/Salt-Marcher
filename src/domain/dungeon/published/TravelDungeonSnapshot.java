package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record TravelDungeonSnapshot(
        @Nullable TravelDungeonWorkspaceState workspaceState,
        @Nullable DungeonTravelSurfaceSnapshot travelSurface,
        DungeonOverlaySettings overlaySettings,
        int projectionLevel
) {

    public TravelDungeonSnapshot {
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
    }

    public static TravelDungeonSnapshot empty() {
        return new TravelDungeonSnapshot(null, null, DungeonOverlaySettings.defaults(), 0);
    }
}
