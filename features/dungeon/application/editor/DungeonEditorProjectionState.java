package features.dungeon.application.editor;

import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;

/** Internal projection state replaced atomically before the public editor state is assembled. */
final class DungeonEditorProjectionState {
    private volatile Projection current = Projection.empty();

    Projection current() {
        return current;
    }

    void publishSnapshot(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
        DungeonEditorSessionSnapshot.SnapshotData safeSnapshot = snapshot == null
                ? DungeonEditorSessionSnapshot.empty("")
                : snapshot;
        DungeonEditorSurfaceContextServiceAssembly.SurfaceContext surfaceContext =
                DungeonEditorSurfaceContextServiceAssembly.surfaceContext(
                        safeSnapshot.surface(), safeSnapshot.projectionLevel());
        current = new Projection(
                DungeonEditorControlsProjectionServiceAssembly.snapshot(safeSnapshot, surfaceContext),
                DungeonEditorMapSurfaceProjectionServiceAssembly.snapshot(
                        safeSnapshot, surfaceContext.surface()),
                DungeonEditorStateProjectionServiceAssembly.snapshot(
                        safeSnapshot, surfaceContext.surface()));
    }

    void publishControls(DungeonEditorSessionSnapshot.ControlsData controlsData) {
        Projection before = current;
        current = new Projection(
                DungeonEditorControlsProjectionServiceAssembly.snapshot(controlsData, before.controls()),
                before.mapSurface(),
                before.state());
    }

    void publishView(
            DungeonEditorSessionSnapshot.ViewData view,
            boolean preserveSurface
    ) {
        DungeonEditorSessionSnapshot.ViewData safeView = view == null
                ? DungeonEditorSessionSnapshot.viewData(null)
                : view;
        Projection before = current;
        current = new Projection(
                DungeonEditorControlsProjectionServiceAssembly.snapshot(
                        safeView.controlsData(), before.controls()),
                preserveSurface
                        ? DungeonEditorMapSurfaceProjectionServiceAssembly.snapshotPreservingSurface(
                                safeView, before.mapSurface())
                        : DungeonEditorMapSurfaceProjectionServiceAssembly.snapshot(
                                safeView, before.mapSurface()),
                DungeonEditorStateProjectionServiceAssembly.snapshot(safeView, before.state()));
    }

    record Projection(
            DungeonEditorControlProjection controls,
            DungeonEditorSurfaceProjection mapSurface,
            DungeonEditorInspectorProjection state
    ) {
        private static Projection empty() {
            return new Projection(
                    DungeonEditorControlProjection.empty(""),
                    DungeonEditorSurfaceProjection.empty(),
                    DungeonEditorInspectorProjection.empty(""));
        }
    }
}
