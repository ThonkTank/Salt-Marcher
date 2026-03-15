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
        WALL_ERASE_DRAG
    }

    static DungeonEdgeToolPolicy resolve(
            DungeonCanvasTool tool,
            DungeonCanvasWallMode wallMode
    ) {
        DungeonCanvasTool effectiveTool = tool == null ? DungeonCanvasTool.SELECT : tool;
        DungeonCanvasWallMode effectiveWallMode = wallMode == null ? DungeonCanvasWallMode.PAINT_WALL : wallMode;
        return switch (effectiveTool) {
            case WALL -> new DungeonEdgeToolPolicy(
                    true,
                    effectiveWallMode.paintsWalls() ? EdgeInteractionMode.WALL_PAINT_PATH : EdgeInteractionMode.WALL_ERASE_DRAG,
                    effectiveWallMode.erasesWalls());
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

    boolean allowsInteraction(DungeonEdgeSummary edge) {
        if (edge == null) {
            return false;
        }
        return switch (interactionMode) {
            case NONE -> false;
            case WALL_PAINT_PATH -> edge.canCreateManualWall();
            case WALL_ERASE_DRAG -> edge.canEraseManualWall();
        };
    }
}
