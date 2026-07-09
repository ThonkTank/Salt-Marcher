package src.features.dungeon.runtime;

import java.util.List;
import src.domain.dungeon.published.DungeonOverlaySettings;

public record DungeonEditorOverlaySettings(
        Mode mode,
        int levelRange,
        double opacity,
        List<Integer> selectedLevels
) {
    public DungeonEditorOverlaySettings {
        mode = mode == null ? Mode.OFF : mode;
        levelRange = Math.max(0, levelRange);
        opacity = Math.max(0.0, Math.min(1.0, opacity));
        selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
    }

    public static DungeonEditorOverlaySettings defaults() {
        return new DungeonEditorOverlaySettings(Mode.OFF, 2, 0.35, List.of());
    }

    public static DungeonEditorOverlaySettings fromPublishedSettings(DungeonOverlaySettings overlaySettings) {
        DungeonOverlaySettings safeSettings = overlaySettings == null
                ? DungeonOverlaySettings.defaults()
                : overlaySettings;
        return new DungeonEditorOverlaySettings(
                Mode.fromKey(safeSettings.modeKey()),
                safeSettings.levelRange(),
                safeSettings.opacity(),
                safeSettings.selectedLevels());
    }

    public DungeonOverlaySettings toPublishedSettings() {
        return new DungeonOverlaySettings(mode.name(), levelRange, opacity, selectedLevels);
    }

    public enum Mode {
        OFF,
        NEARBY,
        SELECTED;

        private static Mode fromKey(String modeKey) {
            try {
                return Mode.valueOf(modeKey == null ? "" : modeKey.strip());
            } catch (IllegalArgumentException exception) {
                return OFF;
            }
        }
    }
}
