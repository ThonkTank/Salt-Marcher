package features.world.dungeonclean.input;

import javafx.scene.Node;

@SuppressWarnings("unused")
public record LoadSurfaceInput() {

    public record SurfaceInput(
            String surfaceId,
            String title,
            String navigationLabel,
            Node controlsContent,
            Node mainContent,
            Node detailsContent,
            Node stateContent,
            Runnable onShow,
            Runnable onHide
    ) {
    }
}
