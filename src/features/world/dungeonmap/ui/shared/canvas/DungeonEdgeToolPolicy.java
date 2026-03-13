package features.world.dungeonmap.ui.shared.canvas;

import features.world.dungeonmap.model.projection.edge.DungeonEdgeSummary;

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
            DungeonCanvasTool tool,
            DungeonCanvasWallMode wallMode,
            DungeonCanvasPassageMode passageMode
    ) {
        DungeonCanvasTool effectiveTool = tool == null ? DungeonCanvasTool.SELECT : tool;
        DungeonCanvasWallMode effectiveWallMode = wallMode == null ? DungeonCanvasWallMode.PAINT_WALL : wallMode;
        DungeonCanvasPassageMode effectivePassageMode = passageMode == null ? DungeonCanvasPassageMode.PLACE_PASSAGE : passageMode;
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
