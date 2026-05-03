package src.domain.dungeon.published;

import java.util.List;

public record DungeonOverlaySettings(
        String modeKey,
        int levelRange,
        double opacity,
        List<Integer> selectedLevels
) {

    public DungeonOverlaySettings {
        modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
        levelRange = Math.max(0, levelRange);
        opacity = Math.max(0.0, Math.min(1.0, opacity));
        selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
    }

    public static DungeonOverlaySettings defaults() {
        return new DungeonOverlaySettings("OFF", 2, 0.35, List.of());
    }
}
