package src.domain.dungeon.model.travel.model.session.model;

import java.util.List;

public record TravelDungeonSessionCommand(
        Action action,
        String actionId,
        int projectionLevel,
        String overlayModeKey,
        int overlayLevelRange,
        double overlayOpacity,
        List<Integer> overlaySelectedLevels
) {
    public TravelDungeonSessionCommand {
        action = action == null ? Action.REFRESH : action;
        actionId = actionId == null ? "" : actionId.trim();
        overlayModeKey = overlayModeKey == null ? "" : overlayModeKey.trim();
        overlayLevelRange = Math.max(0, overlayLevelRange);
        overlayOpacity = Math.max(0.0, Math.min(1.0, overlayOpacity));
        overlaySelectedLevels = overlaySelectedLevels == null ? List.of() : List.copyOf(overlaySelectedLevels);
    }

    @Override
    public List<Integer> overlaySelectedLevels() {
        return List.copyOf(overlaySelectedLevels);
    }

    public enum Action {
        REFRESH,
        ACTION,
        SET_PROJECTION_LEVEL,
        SET_OVERLAY;

        public static Action fromName(String name) {
            for (Action candidate : values()) {
                if (candidate.name().equals(name)) {
                    return candidate;
                }
            }
            return REFRESH;
        }
    }
}
