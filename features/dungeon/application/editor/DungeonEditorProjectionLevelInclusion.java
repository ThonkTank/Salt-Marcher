package features.dungeon.application.editor;

import features.dungeon.api.DungeonOverlaySettings;

final class DungeonEditorProjectionLevelInclusion {
    private DungeonEditorProjectionLevelInclusion() {
    }

    static boolean includes(DungeonEditorSurfaceProjection snapshot, int level) {
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
