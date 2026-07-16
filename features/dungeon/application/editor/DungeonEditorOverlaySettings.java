package features.dungeon.application.editor;

import java.util.List;

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

    public enum Mode {
        OFF,
        NEARBY,
        SELECTED
    }
}
