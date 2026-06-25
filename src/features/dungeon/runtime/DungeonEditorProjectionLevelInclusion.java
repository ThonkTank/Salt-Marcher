package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorProjectionLevelInclusion {
    private DungeonEditorProjectionLevelInclusion() {
    }

    static boolean includes(DungeonEditorMapSurfaceSnapshot snapshot, int level) {
        if (level == snapshot.projectionLevel()) {
            return true;
        }
        DungeonOverlaySettings settings = snapshot.overlaySettings();
        return switch (settings.modeKey()) {
            case "NEARBY" -> Math.abs(level - snapshot.projectionLevel()) <= settings.levelRange();
            case "SELECTED" -> settings.selectedLevels().contains(level);
            default -> false;
        };
    }
}
