package features.dungeon.application.editor;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.api.DungeonEditorSurface;

final class DungeonEditorMapSurfaceProjectionServiceAssembly {

    private DungeonEditorMapSurfaceProjectionServiceAssembly() {
    }

    static DungeonEditorSurfaceProjection snapshot(
            features.dungeon.application.editor.session.DungeonEditorSessionSnapshot.SnapshotData snapshot,
            @Nullable DungeonEditorSurface surface
    ) {
        return new DungeonEditorSurfaceProjection(
                surface,
                DungeonEditorStateProjectionServiceAssembly.selection(snapshot.selection()),
                DungeonEditorStateProjectionServiceAssembly.preview(snapshot.preview()),
                DungeonEditorValueProjectionServiceAssembly.viewMode(snapshot.viewMode()),
                DungeonEditorValueProjectionServiceAssembly.overlay(snapshot.overlaySettings()),
                snapshot.projectionLevel(),
                snapshot.toolSelection());
    }

    static DungeonEditorSurfaceProjection snapshot(
            DungeonEditorSessionSnapshot.ViewData frameData,
            DungeonEditorSurfaceProjection current
    ) {
        DungeonEditorSessionSnapshot.ViewData safeFrameData =
                frameData == null ? DungeonEditorSessionSnapshot.viewData(null) : frameData;
        DungeonEditorSurfaceProjection safeCurrent = current == null
                ? DungeonEditorSurfaceProjection.empty()
                : current;
        return new DungeonEditorSurfaceProjection(
                committedSurface(safeCurrent.surface()),
                DungeonEditorStateProjectionServiceAssembly.selection(safeFrameData.selection()),
                DungeonEditorStateProjectionServiceAssembly.preview(safeFrameData.preview()),
                DungeonEditorValueProjectionServiceAssembly.viewMode(safeFrameData.viewMode()),
                DungeonEditorValueProjectionServiceAssembly.overlay(safeFrameData.overlaySettings()),
                safeFrameData.projectionLevel(),
                safeFrameData.toolSelection());
    }

    static DungeonEditorSurfaceProjection snapshotPreservingSurface(
            DungeonEditorSessionSnapshot.ViewData frameData,
            DungeonEditorSurfaceProjection current
    ) {
        DungeonEditorSessionSnapshot.ViewData safeFrameData =
                frameData == null ? DungeonEditorSessionSnapshot.viewData(null) : frameData;
        DungeonEditorSurfaceProjection safeCurrent = current == null
                ? DungeonEditorSurfaceProjection.empty()
                : current;
        return new DungeonEditorSurfaceProjection(
                safeCurrent.surface(),
                DungeonEditorStateProjectionServiceAssembly.selection(safeFrameData.selection()),
                DungeonEditorStateProjectionServiceAssembly.preview(safeFrameData.preview()),
                DungeonEditorValueProjectionServiceAssembly.viewMode(safeFrameData.viewMode()),
                DungeonEditorValueProjectionServiceAssembly.overlay(safeFrameData.overlaySettings()),
                safeFrameData.projectionLevel(),
                safeFrameData.toolSelection());
    }

    private static DungeonEditorSurface committedSurface(DungeonEditorSurface surface) {
        if (surface == null) {
            return null;
        }
        return new DungeonEditorSurface(
                surface.mapName(),
                surface.revision(),
                surface.map(),
                null,
                surface.inspector());
    }
}
