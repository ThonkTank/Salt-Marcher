package src.view.dungeonshared.View;
import java.util.Objects;
import java.util.function.Supplier;
import src.view.dungeonshared.ViewModel.DungeonMapSurfaceViewModel;
import src.view.dungeonshared.ViewModel.DungeonViewportViewModel;
public final class DungeonOverlayBindings {
    private DungeonOverlayBindings() {
    }
    public static void bind(
            DungeonOverlayControls overlayControls,
            DungeonMapSurfaceViewModel controller,
            Supplier<DungeonViewportViewModel> viewportSupplier
    ) {
        Objects.requireNonNull(overlayControls, "overlayControls");
        Objects.requireNonNull(controller, "controller");
        Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        overlayControls.setOnModeChanged(mode -> controller.updateOverlay(
                controller.viewState().overlaySettings().withMode(mode),
                viewportSupplier.get()));
        overlayControls.setOnRangeChanged(range -> controller.updateOverlay(
                controller.viewState().overlaySettings().withLevelRange(range),
                viewportSupplier.get()));
        overlayControls.setOnOpacityChanged(opacity -> controller.updateOverlay(
                controller.viewState().overlaySettings().withOpacity(opacity),
                viewportSupplier.get()));
        overlayControls.setOnSelectedLevelsChanged(levels -> controller.updateOverlay(
                controller.viewState().overlaySettings().withSelectedLevels(levels),
                viewportSupplier.get()));
    }
}
