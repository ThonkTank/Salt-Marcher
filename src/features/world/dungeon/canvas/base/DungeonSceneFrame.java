package features.world.dungeon.canvas.base;

import features.world.dungeon.dungoenmap.model.DungeonMap;
import features.world.dungeon.dungoenmap.state.DungeonLevelOverlaySettings;

import java.util.Objects;

public record DungeonSceneFrame(
        DungeonMap layout,
        DungeonMap projectedLayout,
        DungeonCanvasCamera camera,
        boolean editorMode,
        int projectionLevel,
        DungeonLevelOverlaySettings levelOverlaySettings,
        DungeonEditorRenderState editor,
        DungeonRuntimeRenderOverlay runtime
) {
    public DungeonSceneFrame {
        layout = layout == null ? DungeonMap.empty() : layout;
        projectedLayout = projectedLayout == null ? layout.projectedToLevel(projectionLevel) : projectedLayout;
        camera = Objects.requireNonNull(camera, "camera");
        levelOverlaySettings = levelOverlaySettings == null ? DungeonLevelOverlaySettings.defaults() : levelOverlaySettings;
        editor = editor == null ? DungeonEditorRenderState.empty() : editor;
        runtime = runtime == null ? DungeonRuntimeRenderOverlay.empty() : runtime;
    }
}
