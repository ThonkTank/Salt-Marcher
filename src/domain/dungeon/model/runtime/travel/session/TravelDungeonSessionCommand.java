package src.domain.dungeon.model.runtime.travel.session;

import java.util.List;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionFacts.SelectedAction;

public final class TravelDungeonSessionCommand {

    private final Variant variant;

    private TravelDungeonSessionCommand(Variant variant) {
        this.variant = variant;
    }

    public static TravelDungeonSessionCommand refresh() {
        return new TravelDungeonSessionCommand(new Refresh());
    }

    public static TravelDungeonSessionCommand travelAction(SelectedAction selectedAction) {
        return new TravelDungeonSessionCommand(new TravelAction(selectedAction));
    }

    public static TravelDungeonSessionCommand selectMap(String mapIdValue) {
        return new TravelDungeonSessionCommand(new SelectMap(mapIdValue));
    }

    public static TravelDungeonSessionCommand setProjectionLevel(int projectionLevel) {
        return new TravelDungeonSessionCommand(new SetProjectionLevel(projectionLevel));
    }

    public static TravelDungeonSessionCommand shiftProjectionLevel(int projectionLevelShift) {
        return new TravelDungeonSessionCommand(new ShiftProjectionLevel(projectionLevelShift));
    }

    public static TravelDungeonSessionCommand setOverlay(
            String overlayModeKey,
            int overlayLevelRange,
            double overlayOpacity,
            List<Integer> overlaySelectedLevels
    ) {
        return new TravelDungeonSessionCommand(
                new SetOverlay(overlayModeKey, overlayLevelRange, overlayOpacity, overlaySelectedLevels));
    }

    public Variant variant() {
        return variant;
    }

    public sealed interface Variant permits Refresh, TravelAction, SelectMap, SetProjectionLevel,
            ShiftProjectionLevel, SetOverlay {
    }

    public record Refresh() implements Variant {
    }

    public record TravelAction(SelectedAction selectedAction) implements Variant {
        public TravelAction {
            selectedAction = SelectedAction.safe(selectedAction);
        }
    }

    public record SelectMap(String mapIdValue) implements Variant {
        public SelectMap {
            mapIdValue = normalizeText(mapIdValue);
        }
    }

    public record SetProjectionLevel(int projectionLevel) implements Variant {
    }

    public record ShiftProjectionLevel(int projectionLevelShift) implements Variant {
    }

    public record SetOverlay(
            String overlayModeKey,
            int overlayLevelRange,
            double overlayOpacity,
            List<Integer> overlaySelectedLevels
    ) implements Variant {
        public SetOverlay {
            overlayModeKey = normalizeText(overlayModeKey);
            overlayLevelRange = Math.max(0, overlayLevelRange);
            overlayOpacity = Math.max(0.0, Math.min(1.0, overlayOpacity));
            overlaySelectedLevels = overlaySelectedLevels == null ? List.of() : List.copyOf(overlaySelectedLevels);
        }

        @Override
        public List<Integer> overlaySelectedLevels() {
            return List.copyOf(overlaySelectedLevels);
        }
    }

    private static String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }
}
