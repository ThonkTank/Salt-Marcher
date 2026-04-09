package features.world.dungeonclean.input;

import javafx.scene.Node;

@SuppressWarnings("unused")
public record LoadSurfaceInput() {

    public record SurfaceInput(
            String title,
            String navigationLabel,
            Node controlsContent,
            Node mainContent,
            Node detailsContent,
            Node stateContent
    ) {
    }
}
