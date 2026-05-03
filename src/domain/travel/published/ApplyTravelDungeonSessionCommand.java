package src.domain.travel.published;

public record ApplyTravelDungeonSessionCommand(
        Action action,
        String actionId,
        int projectionLevel,
        TravelOverlaySettings overlaySettings
) {

    public ApplyTravelDungeonSessionCommand {
        action = action == null ? Action.REFRESH : action;
        actionId = actionId == null ? "" : actionId.trim();
        overlaySettings = overlaySettings == null ? TravelOverlaySettings.defaults() : overlaySettings;
    }

    public enum Action {
        REFRESH,
        ACTION,
        SET_PROJECTION_LEVEL,
        SET_OVERLAY
    }
}
