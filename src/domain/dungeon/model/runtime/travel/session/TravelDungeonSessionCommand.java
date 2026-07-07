package src.domain.dungeon.model.runtime.travel.session;

import java.util.List;
import java.util.Objects;

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
        action = Objects.requireNonNull(action, "action");
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
        SELECT_MAP,
        SET_PROJECTION_LEVEL,
        SHIFT_PROJECTION_LEVEL,
        SET_OVERLAY
    }
}
