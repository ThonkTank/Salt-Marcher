package src.domain.dungeon.published;

public record ApplyTravelDungeonSessionCommand(
        Action action,
        int selectedActionRowIndex,
        long mapId,
        int projectionLevel,
        DungeonOverlaySettings overlaySettings
) {

    public static ApplyTravelDungeonSessionCommand projectionLevelShift(int projectionLevelShift) {
        return new ApplyTravelDungeonSessionCommand(
                Action.SHIFT_PROJECTION_LEVEL,
                -1,
                0L,
                projectionLevelShift,
                DungeonOverlaySettings.defaults());
    }

    public static ApplyTravelDungeonSessionCommand overlay(DungeonOverlaySettings overlaySettings) {
        return new ApplyTravelDungeonSessionCommand(
                Action.SET_OVERLAY,
                -1,
                0L,
                0,
                overlaySettings);
    }

    public static ApplyTravelDungeonSessionCommand action(int selectedActionRowIndex) {
        return new ApplyTravelDungeonSessionCommand(
                Action.ACTION,
                selectedActionRowIndex,
                0L,
                0,
                DungeonOverlaySettings.defaults());
    }

    public static ApplyTravelDungeonSessionCommand selectMap(long mapId) {
        return new ApplyTravelDungeonSessionCommand(
                Action.SELECT_MAP,
                -1,
                Math.max(0L, mapId),
                0,
                DungeonOverlaySettings.defaults());
    }

    public ApplyTravelDungeonSessionCommand {
        action = action == null ? Action.REFRESH : action;
        selectedActionRowIndex = Math.max(-1, selectedActionRowIndex);
        mapId = Math.max(0L, mapId);
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
    }

    public int actionCode() {
        return action.code();
    }

    public enum Action {
        REFRESH(0),
        ACTION(1),
        SELECT_MAP(2),
        SET_PROJECTION_LEVEL(3),
        SHIFT_PROJECTION_LEVEL(4),
        SET_OVERLAY(5);

        private final int code;

        Action(int code) {
            this.code = code;
        }

        private int code() {
            return code;
        }
    }
}
