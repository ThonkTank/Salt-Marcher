package src.view.mapcanvas.View;
import org.jspecify.annotations.Nullable;
import src.view.mapcanvas.api.MapCanvasCell;
import src.view.mapcanvas.api.MapCanvasViewport;
import src.view.mapcanvas.api.MapCanvasRenderModel;
final class MapWorkspaceSelectionSupport {
    private MapWorkspaceSelectionSupport() {
    }
    static @Nullable MapCanvasCell findCellAtCanvasPosition(
            @Nullable MapCanvasRenderModel renderModel,
            MapCanvasViewport viewport,
            double canvasX,
            double canvasY,
            double scale
    ) {
        if (renderModel == null || !renderModel.mapLoaded()) {
            return null;
        }
        int q = (int) Math.floor(screenToWorldX(canvasX, viewport, scale));
        int r = (int) Math.floor(screenToWorldY(canvasY, viewport, scale));
        for (MapCanvasCell source : renderModel.scene().cells()) {
            if (source.q() == q && source.r() == r) {
                return source;
            }
        }
        return null;
    }
    static MapCanvasCell highlightedCell(MapCanvasCell source, @Nullable SelectionKey selectedTarget) {
        boolean selected = selectedTarget != null
                && selectedTarget.matches(source.ownerKind(), source.ownerId(), source.partKind());
        if (!selected && !source.current()) {
            return source;
        }
        return new MapCanvasCell(
                source.q(),
                source.r(),
                source.label(),
                source.room(),
                source.corridor(),
                source.blocked(),
                source.interactive(),
                true,
                source.ownerKind(),
                source.ownerId(),
                source.partKind()
        );
    }
    private static double screenToWorldX(double canvasX, MapCanvasViewport viewport, double scale) {
        return viewport.centerX() + (canvasX - viewport.canvasWidth() / 2.0) / scale;
    }
    private static double screenToWorldY(double canvasY, MapCanvasViewport viewport, double scale) {
        return viewport.centerY() + (canvasY - viewport.canvasHeight() / 2.0) / scale;
    }
    record SelectionKey(String ownerKind, long ownerId, String partKind) {
        private boolean matches(String otherKind, long otherId, String otherPartKind) {
            return ownerId == otherId
                    && java.util.Objects.equals(ownerKind, otherKind)
                    && java.util.Objects.equals(partKind, otherPartKind);
        }
    }
}
