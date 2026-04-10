package clean.shell.navigation.input;

import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeNavigationInput(
        java.util.List<SurfaceInput> surfaces,
        String initialSurfaceId,
        Node defaultDetailsContent,
        Node defaultStateContent
) {

    public ComposeNavigationInput {
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

    public record NavigationInput(
            Node toolbarContent,
            Node navigationContent,
            Node controlsContent,
            Node mainContent,
            Node detailsContent,
            Node stateContent
    ) {
    }
}
