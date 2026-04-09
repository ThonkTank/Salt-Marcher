package features.world.dungeonclean;

import features.world.dungeonclean.cluster.ClusterObject;
import features.world.dungeonclean.cluster.input.LoadClusterRewriteTailStatusInput;
import features.world.dungeonclean.editor.EditorObject;
import features.world.dungeonclean.editor.input.ComposeWorkspaceInput;
import features.world.dungeonclean.input.LoadSurfaceInput;

/**
 * Public clean dungeon rebuild seam. Migrated capabilities live under clean child owners until a stable top-level
 * composition surface is warranted.
 */
@SuppressWarnings("unused")
public final class DungeoncleanObject {

    private final LoadSurfaceInput.SurfaceInput surface;

    public DungeoncleanObject(LoadSurfaceInput input) {
        LoadSurfaceInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        ClusterObject clusterObject = new ClusterObject();
        ComposeWorkspaceInput composeWorkspaceInput = new ComposeWorkspaceInput(
                () -> {
                    LoadClusterRewriteTailStatusInput.StatusInput status =
                            clusterObject.loadClusterRewriteTailStatus(new LoadClusterRewriteTailStatusInput());
                    return new ComposeWorkspaceInput.StatusSnapshot(
                            status.roomCount(),
                            status.roomLevelCount(),
                            status.roomNarrationCount(),
                            status.errorMessage());
                },
                info -> {
                    if (resolvedInput.showInspectorInfo() != null && info != null) {
                        resolvedInput.showInspectorInfo().accept(new LoadSurfaceInput.InspectorInfoInput(
                                info.title(),
                                info.entryKey(),
                                info.message()));
                    }
                },
                hosted -> {
                    if (resolvedInput.showInspectorContent() != null && hosted != null) {
                        resolvedInput.showInspectorContent().accept(new LoadSurfaceInput.HostedInspectorInput(
                                hosted.title(),
                                hosted.entryKey(),
                                hosted.contentSupplier()));
                    }
                },
                resolvedInput.clearInspector(),
                resolvedInput.isInspectorShowing());
        ComposeWorkspaceInput.WorkspaceInput workspace =
                new EditorObject(composeWorkspaceInput).composeWorkspace(composeWorkspaceInput);
        this.surface = new LoadSurfaceInput.SurfaceInput(
                workspace.surfaceId(),
                workspace.title(),
                workspace.navigationLabel(),
                workspace.toolbarContent(),
                workspace.controlsContent(),
                workspace.mainContent(),
                workspace.detailsContent(),
                workspace.stateContent(),
                workspace.onShow(),
                workspace.onHide());
    }

    public LoadSurfaceInput.SurfaceInput loadSurface(LoadSurfaceInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return surface;
    }
}
