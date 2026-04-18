package src.view.dungeonshared.interactor;

import java.util.Objects;
import java.util.function.Supplier;

public final class DungeonOverlayBindings {

    private DungeonOverlayBindings() {
    }

    public static void bind(
            DungeonOverlayControls overlayControls,
            DungeonMapSurfaceController controller,
            Supplier<src.domain.dungeon.api.Viewport> viewportSupplier
    ) {
        Objects.requireNonNull(overlayControls, "overlayControls");
        Objects.requireNonNull(controller, "controller");
        Objects.requireNonNull(viewportSupplier, "viewportSupplier");
        overlayControls.setOnModeChanged(mode -> controller.updateOverlay(
                controller.state().overlaySettings().withMode(mode),
                viewportSupplier.get()));
        overlayControls.setOnRangeChanged(range -> controller.updateOverlay(
                controller.state().overlaySettings().withLevelRange(range),
                viewportSupplier.get()));
        overlayControls.setOnOpacityChanged(opacity -> controller.updateOverlay(
                controller.state().overlaySettings().withOpacity(opacity),
                viewportSupplier.get()));
        overlayControls.setOnSelectedLevelsChanged(levels -> controller.updateOverlay(
                controller.state().overlaySettings().withSelectedLevels(levels),
                viewportSupplier.get()));
    }
}
