package features.dungeon.application.editor;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.api.DungeonEditorMapSurfaceSnapshot;
import features.dungeon.api.DungeonEditorSurface;

final class DungeonEditorMapSurfaceProjectionServiceAssembly {

    private DungeonEditorMapSurfaceProjectionServiceAssembly() {
    }

    static features.dungeon.api.DungeonEditorMapSurfaceSnapshot snapshot(
            features.dungeon.application.editor.session.DungeonEditorSessionSnapshot.SnapshotData snapshot,
            @Nullable DungeonEditorSurface surface
    ) {
        return new features.dungeon.api.DungeonEditorMapSurfaceSnapshot(
                surface,
                DungeonEditorStateProjectionServiceAssembly.selection(snapshot.selection()),
                DungeonEditorStateProjectionServiceAssembly.preview(snapshot.preview()),
                DungeonEditorValueProjectionServiceAssembly.viewMode(snapshot.viewMode()),
                DungeonEditorValueProjectionServiceAssembly.overlay(snapshot.overlaySettings()),
                snapshot.projectionLevel(),
                DungeonEditorValueProjectionServiceAssembly.tool(snapshot.selectedTool()));
    }

    static DungeonEditorMapSurfaceSnapshot snapshot(
            DungeonEditorSessionSnapshot.SessionFrameData frameData,
            DungeonEditorMapSurfaceSnapshot current
    ) {
        DungeonEditorSessionSnapshot.SessionFrameData safeFrameData =
                frameData == null ? DungeonEditorSessionSnapshot.sessionFrameData(null) : frameData;
        DungeonEditorMapSurfaceSnapshot safeCurrent = current == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : current;
        return new DungeonEditorMapSurfaceSnapshot(
                committedSurface(safeCurrent.surface()),
                DungeonEditorStateProjectionServiceAssembly.selection(safeFrameData.selection()),
                DungeonEditorStateProjectionServiceAssembly.preview(safeFrameData.preview()),
                DungeonEditorValueProjectionServiceAssembly.viewMode(safeFrameData.viewMode()),
                DungeonEditorValueProjectionServiceAssembly.overlay(safeFrameData.overlaySettings()),
                safeFrameData.projectionLevel(),
                DungeonEditorValueProjectionServiceAssembly.tool(safeFrameData.selectedTool()));
    }

    static DungeonEditorMapSurfaceSnapshot snapshotPreservingSurface(
            DungeonEditorSessionSnapshot.SessionFrameData frameData,
            DungeonEditorMapSurfaceSnapshot current
    ) {
        DungeonEditorSessionSnapshot.SessionFrameData safeFrameData =
                frameData == null ? DungeonEditorSessionSnapshot.sessionFrameData(null) : frameData;
        DungeonEditorMapSurfaceSnapshot safeCurrent = current == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : current;
        return new DungeonEditorMapSurfaceSnapshot(
                safeCurrent.surface(),
                DungeonEditorStateProjectionServiceAssembly.selection(safeFrameData.selection()),
                DungeonEditorStateProjectionServiceAssembly.preview(safeFrameData.preview()),
                DungeonEditorValueProjectionServiceAssembly.viewMode(safeFrameData.viewMode()),
                DungeonEditorValueProjectionServiceAssembly.overlay(safeFrameData.overlaySettings()),
                safeFrameData.projectionLevel(),
                DungeonEditorValueProjectionServiceAssembly.tool(safeFrameData.selectedTool()));
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
