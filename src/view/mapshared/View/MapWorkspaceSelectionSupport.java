package src.view.mapshared.View;

import org.jspecify.annotations.Nullable;
import src.view.mapshared.ViewModel.MapCellViewModel;
import src.view.mapshared.ViewModel.MapViewport;
import src.view.mapshared.ViewModel.MapWorkspaceRenderModel;

final class MapWorkspaceSelectionSupport {

    private MapWorkspaceSelectionSupport() {
    }

    static @Nullable MapCellViewModel findCellAtCanvasPosition(
            @Nullable MapWorkspaceRenderModel renderModel,
            MapViewport viewport,
            double canvasX,
            double canvasY,
            double scale
    ) {
        if (renderModel == null || !renderModel.mapLoaded()) {
            return null;
        }
        int q = (int) Math.floor(screenToWorldX(canvasX, viewport, scale));
        int r = (int) Math.floor(screenToWorldY(canvasY, viewport, scale));
        for (MapCellViewModel source : renderModel.scene().cells()) {
            if (source.q() == q && source.r() == r) {
                return source;
            }
        }
        return null;
    }

    static MapCellViewModel highlightedCell(MapCellViewModel source, @Nullable SelectionKey selectedTarget) {
        boolean selected = selectedTarget != null
                && selectedTarget.matches(source.ownerKind(), source.ownerId(), source.partKind());
        if (!selected && !source.current()) {
            return source;
        }
        return new MapCellViewModel(
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

    private static double screenToWorldX(double canvasX, MapViewport viewport, double scale) {
        return viewport.centerX() + (canvasX - viewport.canvasWidth() / 2.0) / scale;
    }

    private static double screenToWorldY(double canvasY, MapViewport viewport, double scale) {
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
