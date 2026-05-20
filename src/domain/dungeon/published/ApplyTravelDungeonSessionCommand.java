package src.domain.dungeon.published;

public record ApplyTravelDungeonSessionCommand(
        Action action,
        String actionId,
        int projectionLevel,
        DungeonOverlaySettings overlaySettings
) {

    public ApplyTravelDungeonSessionCommand {
        action = action == null ? Action.REFRESH : action;
        actionId = actionId == null ? "" : actionId.trim();
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
    }

    public enum Action {
        REFRESH,
        ACTION,
        SET_PROJECTION_LEVEL,
        SET_OVERLAY
    }
}
