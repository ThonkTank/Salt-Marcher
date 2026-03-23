package features.world.dungeonmap.state;

import java.util.Comparator;
import java.util.List;

public record DungeonLevelOverlaySettings(
        DungeonLevelOverlayMode mode,
        int levelRange,
        double opacity,
        List<Integer> selectedLevels
) {

    private static final int DEFAULT_LEVEL_RANGE = 1;
    private static final int MAX_LEVEL_RANGE = 6;
    private static final double DEFAULT_OPACITY = 0.35;

    public DungeonLevelOverlaySettings {
        mode = mode == null ? DungeonLevelOverlayMode.OFF : mode;
        levelRange = Math.max(1, Math.min(MAX_LEVEL_RANGE, levelRange));
        opacity = Math.max(0.05, Math.min(0.95, opacity));
        selectedLevels = selectedLevels == null ? List.of() : selectedLevels.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    public static DungeonLevelOverlaySettings defaults() {
        return new DungeonLevelOverlaySettings(
                DungeonLevelOverlayMode.OFF,
                DEFAULT_LEVEL_RANGE,
                DEFAULT_OPACITY,
                List.of());
    }
}
