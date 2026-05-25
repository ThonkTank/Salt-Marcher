package src.domain.dungeon;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorSurface;

final class DungeonEditorMapSurfaceProjectionServiceAssembly {

    private DungeonEditorMapSurfaceProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot snapshot(
            src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionSnapshot.SnapshotData snapshot,
            @Nullable DungeonEditorSurface surface
    ) {
        return new src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot(
                surface,
                DungeonEditorStateProjectionServiceAssembly.selection(snapshot.selection()),
                DungeonEditorStateProjectionServiceAssembly.preview(snapshot.preview()),
                DungeonEditorValueProjectionServiceAssembly.viewMode(snapshot.viewMode()),
                DungeonEditorValueProjectionServiceAssembly.overlay(snapshot.overlaySettings()),
                snapshot.projectionLevel(),
                DungeonEditorValueProjectionServiceAssembly.tool(snapshot.selectedTool()));
    }
}
