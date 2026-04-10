package features.world.dungeonclean;

import features.world.dungeonclean.cluster.ClusterObject;
import features.world.dungeonclean.cluster.input.LoadClusterRewriteTailStatusInput;
import features.world.dungeonclean.editor.EditorObject;
import features.world.dungeonclean.editor.input.ComposeWorkspaceInput;
import features.world.dungeonclean.input.LoadSurfaceInput;
import features.world.dungeonclean.input.ViewsInput;
import javafx.concurrent.Task;
import javafx.scene.Node;
import ui.async.UiAsyncTasks;
import ui.shell.AppView;
import ui.shell.SceneHandle;

import java.util.concurrent.atomic.AtomicReference;

/**
 * Public clean dungeon rebuild seam. This is now the world-facing dungeon root
 * boundary while clean child owners continue replacing legacy internals.
 */
@SuppressWarnings("unused")
public final class DungeoncleanObject {

    public DungeoncleanObject() {
    }

    public DungeoncleanObject(LoadSurfaceInput input) {
        java.util.Objects.requireNonNull(input, "input");
    }

    public LoadSurfaceInput.SurfaceInput loadSurface(LoadSurfaceInput input) {
        LoadSurfaceInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        ClusterObject clusterObject = new ClusterObject();
        ComposeWorkspaceInput composeWorkspaceInput = new ComposeWorkspaceInput(
                loadRequest -> {
                    if (loadRequest == null) {
                        return;
                    }
                    if (loadRequest.onLoading() != null) {
                        loadRequest.onLoading().run();
                    }
                    if (resolvedInput.submitBackgroundTask() == null) {
                        try {
                            LoadClusterRewriteTailStatusInput.StatusInput status =
                                    clusterObject.loadClusterRewriteTailStatus(new LoadClusterRewriteTailStatusInput());
                            if (loadRequest.onLoaded() != null) {
                                loadRequest.onLoaded().accept(new ComposeWorkspaceInput.StatusSnapshot(
                                        status.roomCount(),
                                        status.roomLevelCount(),
                                        status.roomNarrationCount(),
                                        status.errorMessage()));
                            }
                        } catch (Exception exception) {
                            if (loadRequest.onFailure() != null) {
                                loadRequest.onFailure().accept(exception);
                            }
                        }
                        return;
                    }
                    AtomicReference<ComposeWorkspaceInput.StatusSnapshot> snapshotReference = new AtomicReference<>();
                    resolvedInput.submitBackgroundTask().accept(new LoadSurfaceInput.BackgroundTaskInput(
                            "DungeoncleanObject.loadClusterRewriteTailStatus()",
                            () -> {
                                LoadClusterRewriteTailStatusInput.StatusInput status =
                                        clusterObject.loadClusterRewriteTailStatus(new LoadClusterRewriteTailStatusInput());
                                snapshotReference.set(new ComposeWorkspaceInput.StatusSnapshot(
                                        status.roomCount(),
                                        status.roomLevelCount(),
                                        status.roomNarrationCount(),
                                        status.errorMessage()));
                                return null;
                            },
                            () -> {
                                if (loadRequest.onLoaded() != null) {
                                    loadRequest.onLoaded().accept(snapshotReference.get());
                                }
                            },
                            throwable -> {
                                if (loadRequest.onFailure() != null) {
                                    loadRequest.onFailure().accept(throwable);
                                }
                            },
                            null));
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
                resolvedInput.isInspectorShowing(),
                registration -> {
                    if (resolvedInput.registerScene() == null || registration == null) {
                        return new ComposeWorkspaceInput.SceneHandleInput(content -> { }, () -> { });
                    }
                    LoadSurfaceInput.SceneHandleInput handle = resolvedInput.registerScene().apply(
                            new LoadSurfaceInput.SceneRegistrationInput(
                                    registration.label(),
                                    registration.initialContent()));
                    return new ComposeWorkspaceInput.SceneHandleInput(
                            handle.setContent(),
                            handle.activate());
                });
        ComposeWorkspaceInput.WorkspaceInput workspace =
                new EditorObject(composeWorkspaceInput).composeWorkspace(composeWorkspaceInput);
        return new LoadSurfaceInput.SurfaceInput(
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

    public ViewsInput.LoadedViewsInput views(ViewsInput input) {
        ViewsInput resolvedInput = java.util.Objects.requireNonNull(input, "input");

        features.world.dungeon.DungeonObject legacyDungeon = new features.world.dungeon.DungeonObject(
                new features.world.dungeon.input.ComposeDungeonInput(
                        resolvedInput.detailsNavigator(),
                        resolvedInput.travelSurface()));
        features.world.dungeon.input.ViewsInput legacyViews = legacyDungeon.views(
                new features.world.dungeon.input.ViewsInput(null, null));

        LoadSurfaceInput.SurfaceInput editorSurface = loadSurface(new LoadSurfaceInput(
                info -> resolvedInput.detailsNavigator().showInfo(
                        info.title(),
                        info.entryKey(),
                        info.message()),
                hosted -> resolvedInput.detailsNavigator().showContent(
                        hosted.title(),
                        hosted.entryKey(),
                        hosted.contentSupplier()),
                resolvedInput.detailsNavigator()::clear,
                resolvedInput.detailsNavigator()::isShowing,
                registration -> {
                    SceneHandle handle = resolvedInput.sceneRegistry().registerScene(
                            registration.label(),
                            registration.initialContent());
                    return new LoadSurfaceInput.SceneHandleInput(handle::setContent, handle::activate);
                },
                background -> {
                    Task<Void> task = new Task<>() {
                        @Override
                        protected Void call() throws Exception {
                            if (background.work() != null) {
                                return background.work().call();
                            }
                            return null;
                        }
                    };
                    UiAsyncTasks.submit(
                            task,
                            ignored -> {
                                if (background.onSuccess() != null) {
                                    background.onSuccess().run();
                                }
                            },
                            throwable -> {
                                if (background.onFailure() != null) {
                                    background.onFailure().accept(throwable);
                                }
                            },
                            background.onCancelled());
                }));

        return new ViewsInput.LoadedViewsInput(
                legacyViews.dungeonView(),
                adaptSurface(editorSurface));
    }

    private static AppView adaptSurface(LoadSurfaceInput.SurfaceInput surface) {
        return new AppView() {
            @Override
            public Node getMainContent() {
                return surface.mainContent();
            }

            @Override
            public String getTitle() {
                return surface.title();
            }

            @Override
            public String getIconText() {
                return surface.navigationLabel();
            }

            @Override
            public Node getControlsContent() {
                return surface.controlsContent();
            }

            @Override
            public Node getDetailsContent() {
                return surface.detailsContent();
            }

            @Override
            public Node getStateContent() {
                return surface.stateContent();
            }

            @Override
            public java.util.List<Node> getToolbarItems() {
                return surface.toolbarContent() == null
                        ? java.util.List.of()
                        : java.util.List.of(surface.toolbarContent());
            }

            @Override
            public void onShow() {
                if (surface.onShow() != null) {
                    surface.onShow().run();
                }
            }

            @Override
            public void onHide() {
                if (surface.onHide() != null) {
                    surface.onHide().run();
                }
            }
        };
    }
}
