package features.appshell.input;

import javafx.scene.Node;
import javafx.scene.layout.BorderPane;

@SuppressWarnings("unused")
public record ComposeShellInput(
        java.util.List<SurfaceInput> surfaces,
        String initialSurfaceId,
        Node defaultDetailsContent
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
            String navigationLabel,
            Node toolbarContent,
            Node controlsContent,
            Node mainContent,
            Node detailsContent,
            Node stateContent,
            Runnable onShow,
            Runnable onHide
    ) {
    }

    public record ShellInput(
            BorderPane root
    ) {
    }
}
