package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record TravelDungeonSnapshot(
        @Nullable TravelDungeonWorkspaceState workspaceState,
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
