package features.world.quarantine.dungeonmap.editor.workspace.pane;

import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.layout.StackPane;

import java.util.Objects;
import java.util.function.Consumer;

public final class DungeonPaneCanvasLifecycle {

    private final Canvas canvas = new Canvas();

    public DungeonPaneCanvasLifecycle(StackPane pane, Runnable renderRequest) {
        Objects.requireNonNull(pane, "pane");
        Objects.requireNonNull(renderRequest, "renderRequest");
        pane.getChildren().add(canvas);
        pane.widthProperty().addListener((obs, oldValue, newValue) -> {
            resize(pane);
            renderRequest.run();
        });
        pane.heightProperty().addListener((obs, oldValue, newValue) -> {
            resize(pane);
            renderRequest.run();
        });
    }

    public Canvas canvas() {
        return canvas;
    }

    public void render(boolean layoutPresent, Consumer<GraphicsContext> contentRenderer) {
        GraphicsContext gc = canvas.getGraphicsContext2D();
        DungeonCanvasTheme.paintBackground(gc, canvas.getWidth(), canvas.getHeight());
        if (layoutPresent) {
            contentRenderer.accept(gc);
        }
    }

    private void resize(StackPane pane) {
        canvas.setWidth(Math.max(160, pane.getWidth()));
        canvas.setHeight(Math.max(160, pane.getHeight()));
    }
}
