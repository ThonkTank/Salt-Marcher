package src.domain.travel.published;

import java.util.List;

public record TravelOverlaySettings(
        String modeKey,
        int levelRange,
        double opacity,
        List<Integer> selectedLevels
) {

    public TravelOverlaySettings {
        modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
        levelRange = Math.max(0, levelRange);
        opacity = Math.max(0.0, Math.min(1.0, opacity));
        selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
    }

    public static TravelOverlaySettings defaults() {
        return new TravelOverlaySettings("OFF", 2, 0.35, List.of());
    }
}
