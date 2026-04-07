package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.map.model.DungeonLayout;
import features.world.dungeonmap.map.state.DungeonLevelOverlaySettings;

import java.util.Objects;

public record DungeonSceneFrame(
        DungeonLayout layout,
        DungeonLayout projectedLayout,
        DungeonCanvasCamera camera,
        boolean editorMode,
        int projectionLevel,
        DungeonLevelOverlaySettings levelOverlaySettings,
        DungeonEditorRenderState editor,
        DungeonRuntimeRenderOverlay runtime
) {
    public DungeonSceneFrame {
        layout = layout == null ? DungeonLayout.empty() : layout;
        projectedLayout = projectedLayout == null ? layout.projectedToLevel(projectionLevel) : projectedLayout;
        camera = Objects.requireNonNull(camera, "camera");
        levelOverlaySettings = levelOverlaySettings == null ? DungeonLevelOverlaySettings.defaults() : levelOverlaySettings;
        editor = editor == null ? DungeonEditorRenderState.empty() : editor;
        runtime = runtime == null ? DungeonRuntimeRenderOverlay.empty() : runtime;
    }
}
