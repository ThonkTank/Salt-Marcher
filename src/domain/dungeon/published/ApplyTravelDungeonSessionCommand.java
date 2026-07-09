package src.domain.dungeon.published;

public record ApplyTravelDungeonSessionCommand(
        Action action,
        String actionId,
        int projectionLevel,
        DungeonOverlaySettings overlaySettings
) {

    public static ApplyTravelDungeonSessionCommand projectionLevelShift(int projectionLevelShift) {
        return new ApplyTravelDungeonSessionCommand(
                Action.SHIFT_PROJECTION_LEVEL,
                "",
                projectionLevelShift,
                DungeonOverlaySettings.defaults());
    }

    public static ApplyTravelDungeonSessionCommand overlay(DungeonOverlaySettings overlaySettings) {
        return new ApplyTravelDungeonSessionCommand(
                Action.SET_OVERLAY,
                "",
                0,
                overlaySettings);
    }

    public static ApplyTravelDungeonSessionCommand action(String actionId) {
        return new ApplyTravelDungeonSessionCommand(
                Action.ACTION,
                actionId,
                0,
                DungeonOverlaySettings.defaults());
    }

    public static ApplyTravelDungeonSessionCommand selectMap(long mapId) {
        return new ApplyTravelDungeonSessionCommand(
                Action.SELECT_MAP,
                Long.toString(Math.max(0L, mapId)),
                0,
                DungeonOverlaySettings.defaults());
    }

    public ApplyTravelDungeonSessionCommand {
        action = action == null ? Action.REFRESH : action;
        actionId = actionId == null ? "" : actionId.trim();
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
    }

    public enum Action {
        REFRESH,
        ACTION,
        SELECT_MAP,
        SET_PROJECTION_LEVEL,
        SHIFT_PROJECTION_LEVEL,
        SET_OVERLAY
    }
}
