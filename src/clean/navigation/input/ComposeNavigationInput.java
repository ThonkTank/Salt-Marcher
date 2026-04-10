package clean.navigation.input;

import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeNavigationInput(
        SurfaceInput startSurface,
        SurfaceInput encounterSurface,
        SurfaceInput overworldSurface,
        SurfaceInput mapEditorSurface,
        SurfaceInput dungeonSurface,
        SurfaceInput dungeonEditorSurface,
        SurfaceInput tablesSurface,
        SurfaceInput spellsSurface,
        String initialSurfaceId
) {

    public record SurfaceInput(
            String surfaceId,
            String title,
            String navigationLabel,
            Node toolbarContent,
            Node controlsContent,
            Node mainContent,
            Node detailsContent,
            Node stateContent
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
