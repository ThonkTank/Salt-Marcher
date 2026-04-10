package clean.shell.input;

import clean.shell.async.input.ComposeAsyncInput;
import clean.shell.inspector.input.ComposeInspectorInput;
import clean.shell.scene.input.ComposeSceneInput;
import javafx.scene.Node;
import javafx.scene.Parent;

@SuppressWarnings("unused")
public record ComposeShellInput(
        java.util.List<SurfaceInput> surfaces,
        String initialSurfaceId
) {

    public ComposeShellInput {
        surfaces = surfaces == null ? java.util.List.of() : java.util.List.copyOf(surfaces.stream()
                .filter(java.util.Objects::nonNull)
                .toList());
        initialSurfaceId = initialSurfaceId == null ? "" : initialSurfaceId.trim();
    }

    public record SurfaceInput(
            String surfaceId,
            String title,
            String sidebarSectionId,
            String navigationIconText,
            Node navigationGraphic,
            Node toolbarContent,
            Node controlsContent,
            Node mainContent,
            Node detailsContent,
            Node stateContent,
            Runnable onShow,
            Runnable onHide
    ) {
    }

    public record ShellHooksInput(
            ComposeInspectorInput.NavigatorInput inspectorNavigator,
            ComposeSceneInput.RegistryInput sceneRegistry,
            ComposeAsyncInput.AsyncInput async
    ) {
    }

    public record ShellInput(
            Parent root,
            ShellHooksInput hooks
    ) {
    }
}
