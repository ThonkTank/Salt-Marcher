package features.world.dungeonmap.ui.editor.workflow.tools;

import features.world.dungeonmap.ui.editor.state.DungeonColorRenderMode;
import features.world.dungeonmap.ui.editor.state.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.state.DungeonPaintMode;
import features.world.dungeonmap.ui.editor.state.WallEditorMode;
import features.world.dungeonmap.ui.shared.canvas.DungeonCanvasColorMode;
import features.world.dungeonmap.ui.shared.canvas.DungeonCanvasPaintMode;
import features.world.dungeonmap.ui.shared.canvas.DungeonCanvasTool;
import features.world.dungeonmap.ui.shared.canvas.DungeonCanvasWallMode;

public final class DungeonCanvasStateMapper {

    private DungeonCanvasStateMapper() {
        throw new AssertionError("No instances");
    }

    public static DungeonCanvasTool toCanvasTool(DungeonEditorTool tool) {
        if (tool == null) {
            return DungeonCanvasTool.SELECT;
        }
        return switch (tool) {
            case SELECT -> DungeonCanvasTool.SELECT;
            case PAINT -> DungeonCanvasTool.PAINT;
            case ERASE -> DungeonCanvasTool.ERASE;
            case WALL -> DungeonCanvasTool.WALL;
            case AREA_ASSIGN -> DungeonCanvasTool.AREA_ASSIGN;
            case FEATURE -> DungeonCanvasTool.FEATURE;
        };
    }

    public static DungeonCanvasColorMode toCanvasColorMode(DungeonColorRenderMode mode) {
        if (mode == null) {
            return DungeonCanvasColorMode.ROOMS;
        }
        return switch (mode) {
            case ROOMS -> DungeonCanvasColorMode.ROOMS;
            case AREAS -> DungeonCanvasColorMode.AREAS;
        };
    }

    public static DungeonCanvasPaintMode toCanvasPaintMode(DungeonPaintMode mode) {
        if (mode == null) {
            return DungeonCanvasPaintMode.BRUSH;
        }
        return switch (mode) {
            case BRUSH -> DungeonCanvasPaintMode.BRUSH;
            case SELECTION -> DungeonCanvasPaintMode.SELECTION;
        };
    }

    public static DungeonCanvasWallMode toCanvasWallMode(WallEditorMode mode) {
        if (mode == null) {
            return DungeonCanvasWallMode.PAINT_WALL;
        }
        return switch (mode) {
            case PAINT_WALL -> DungeonCanvasWallMode.PAINT_WALL;
            case ERASE_WALL -> DungeonCanvasWallMode.ERASE_WALL;
        };
    }

}
