package src.view.dungeonmap.api;

import java.util.Objects;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import src.view.mapcanvas.api.MapCanvasHandle;

public final class DungeonMapHandle {

    private final Node controls;
    private final Node canvas;
    private final Node state;
    private final @Nullable MapCanvasHandle canvasHandle;

    DungeonMapHandle(Node controls, Node canvas, Node state, @Nullable MapCanvasHandle canvasHandle) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.canvas = Objects.requireNonNull(canvas, "canvas");
        this.state = Objects.requireNonNull(state, "state");
        this.canvasHandle = canvasHandle;
    }

    public Node controls() {
        return controls;
    }

    public Node canvas() {
        return canvas;
    }

    public Node state() {
        return state;
    }

    public @Nullable MapCanvasHandle canvasHandle() {
        return canvasHandle;
    }
}
