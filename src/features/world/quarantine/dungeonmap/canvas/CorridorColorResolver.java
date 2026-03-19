package features.world.quarantine.dungeonmap.canvas;

import javafx.scene.paint.Color;

/**
 * Resolves corridor rendering colors based on selection and hover/active state.
 * Callers pass the corridor's ID, the currently selected corridor ID, and the
 * currently hovered-or-active corridor ID (null if none).  The resolver then
 * applies the pattern: selected → active/hovered → default.
 */
public final class CorridorColorResolver {

    private CorridorColorResolver() {
        throw new AssertionError("No instances");
    }

    public static Color fillColor(Long corridorId, Long selectedId, Long hoveredId) {
        if (corridorId != null && corridorId.equals(selectedId)) {
            return DungeonCanvasTheme.Corridor.CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.30);
        }
        if (corridorId != null && corridorId.equals(hoveredId)) {
            return DungeonCanvasTheme.Corridor.CORRIDOR_ACTIVE.deriveColor(0, 1, 1, 0.25);
        }
        return DungeonCanvasTheme.Corridor.CORRIDOR.deriveColor(0, 1, 1, 0.16);
    }

    public static Color doorColor(Long corridorId, Long selectedId, Long hoveredId) {
        if (corridorId != null && corridorId.equals(selectedId)) {
            return DungeonCanvasTheme.Corridor.DOOR_SELECTED;
        }
        if (corridorId != null && corridorId.equals(hoveredId)) {
            return DungeonCanvasTheme.Corridor.DOOR_ACTIVE;
        }
        return DungeonCanvasTheme.Corridor.DOOR;
    }

    public static Color strokeColor(Long corridorId, Long selectedId, Long hoveredId) {
        if (corridorId != null && corridorId.equals(selectedId)) {
            return DungeonCanvasTheme.Corridor.CORRIDOR_SELECTED;
        }
        if (corridorId != null && corridorId.equals(hoveredId)) {
            return DungeonCanvasTheme.Corridor.CORRIDOR_ACTIVE;
        }
        return DungeonCanvasTheme.Corridor.CORRIDOR;
    }
}
