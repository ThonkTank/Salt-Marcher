package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonEdgeSummary;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.controls.PassageEditorMode;
import features.world.dungeonmap.ui.editor.controls.WallEditorMode;

record DungeonEdgeToolPolicy(
        boolean edgeHoverEnabled,
        EdgeInteractionMode interactionMode,
        boolean destructiveHover
) {

    enum EdgeInteractionMode {
        NONE,
        WALL_PAINT_PATH,
        WALL_ERASE_DRAG,
        PASSAGE_CREATE_CLICK,
        PASSAGE_DELETE_CLICK,
        LINK_PASSAGE_CLICK
    }

    static DungeonEdgeToolPolicy resolve(
            DungeonEditorTool tool,
            WallEditorMode wallMode,
            PassageEditorMode passageMode
    ) {
        DungeonEditorTool effectiveTool = tool == null ? DungeonEditorTool.SELECT : tool;
        WallEditorMode effectiveWallMode = wallMode == null ? WallEditorMode.PAINT_WALL : wallMode;
        PassageEditorMode effectivePassageMode = passageMode == null ? PassageEditorMode.PLACE_PASSAGE : passageMode;
        return switch (effectiveTool) {
            case WALL -> new DungeonEdgeToolPolicy(
                    true,
                    effectiveWallMode.paintsWalls() ? EdgeInteractionMode.WALL_PAINT_PATH : EdgeInteractionMode.WALL_ERASE_DRAG,
                    effectiveWallMode.erasesWalls());
            case PASSAGE -> new DungeonEdgeToolPolicy(
                    true,
                    effectivePassageMode.deletesPassages()
                            ? EdgeInteractionMode.PASSAGE_DELETE_CLICK
                            : EdgeInteractionMode.PASSAGE_CREATE_CLICK,
                    effectivePassageMode.deletesPassages());
            case LINK -> new DungeonEdgeToolPolicy(
                    true,
                    EdgeInteractionMode.LINK_PASSAGE_CLICK,
                    false);
            default -> new DungeonEdgeToolPolicy(
                    effectiveTool.edgeHoverEnabled(),
                    EdgeInteractionMode.NONE,
                    false);
        };
    }

    boolean usesWallPaintPath() {
        return interactionMode == EdgeInteractionMode.WALL_PAINT_PATH;
    }

    boolean usesWallEraseDrag() {
        return interactionMode == EdgeInteractionMode.WALL_ERASE_DRAG;
    }

    boolean usesPassageClick() {
        return switch (interactionMode) {
            case PASSAGE_CREATE_CLICK, PASSAGE_DELETE_CLICK, LINK_PASSAGE_CLICK -> true;
            default -> false;
        };
    }

    boolean allowsInteraction(DungeonEdgeSummary edge) {
        if (edge == null) {
            return false;
        }
        return switch (interactionMode) {
            case NONE -> false;
            case WALL_PAINT_PATH -> edge.canCreateManualWall();
            case WALL_ERASE_DRAG -> edge.canEraseManualWall();
            case PASSAGE_CREATE_CLICK -> edge.canCreatePassage();
            case PASSAGE_DELETE_CLICK, LINK_PASSAGE_CLICK -> edge.passage() != null;
        };
    }
}
