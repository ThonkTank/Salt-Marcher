package features.dungeon.api;

import org.jspecify.annotations.Nullable;

public record TravelDungeonSnapshot(
        @Nullable TravelDungeonWorkspaceState workspaceState,
        @Nullable DungeonTravelSurfaceSnapshot travelSurface,
        DungeonOverlaySettings overlaySettings,
        int projectionLevel,
        DungeonTravelMoveOutcome moveOutcome
) {

    public TravelDungeonSnapshot(
            @Nullable TravelDungeonWorkspaceState workspaceState,
            @Nullable DungeonTravelSurfaceSnapshot travelSurface,
            DungeonOverlaySettings overlaySettings,
            int projectionLevel
    ) {
        this(workspaceState, travelSurface, overlaySettings, projectionLevel, DungeonTravelMoveOutcome.idle());
    }

    public TravelDungeonSnapshot {
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        moveOutcome = moveOutcome == null ? DungeonTravelMoveOutcome.idle() : moveOutcome;
    }

    public static TravelDungeonSnapshot empty() {
        return new TravelDungeonSnapshot(
                null, null, DungeonOverlaySettings.defaults(), 0, DungeonTravelMoveOutcome.idle());
    }
}
