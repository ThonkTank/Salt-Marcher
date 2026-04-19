package src.view.mapcanvas.View;
import javafx.scene.layout.StackPane;
import org.jspecify.annotations.Nullable;
import src.view.mapcanvas.api.MapCanvasViewport;
import src.view.mapcanvas.api.MapCanvasRenderModel;
import java.util.function.Consumer;
final class MapWorkspaceViewportSupport {
    private static final double DEFAULT_WIDTH = 960.0;
    private static final double DEFAULT_HEIGHT = 640.0;
    private MapWorkspaceViewportSupport() {
    }
    static double width(StackPane contentHost) {
        return contentHost.getWidth() > 1.0 ? contentHost.getWidth() : DEFAULT_WIDTH;
    }
    static double height(StackPane contentHost) {
        return contentHost.getHeight() > 1.0 ? contentHost.getHeight() : DEFAULT_HEIGHT;
    }
    static MapCanvasViewport currentViewport(MapCameraController cameraController, StackPane contentHost) {
        return cameraController.currentViewport(width(contentHost), height(contentHost));
    }
    static void notifyViewportChanged(
            @Nullable MapCanvasRenderModel renderModel,
            Consumer<MapCanvasViewport> viewportListener,
            MapCanvasViewport viewport
    ) {
        if (renderModel != null && renderModel.mapLoaded()) {
            viewportListener.accept(viewport);
        }
    }
}
