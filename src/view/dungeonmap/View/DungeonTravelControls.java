package src.view.dungeonmap.View;

import java.util.Objects;
import java.util.function.DoubleSupplier;
import java.util.function.Supplier;
import javafx.scene.Node;
import src.view.dungeonmap.api.DungeonMapSurfaceViewModel;
import src.view.dungeonmap.api.DungeonViewportViewModel;

public final class DungeonTravelControls {
    private final DungeonControlsPanel controlsPanel;

    public DungeonTravelControls(
            DungeonMapSurfaceViewModel controller,
            DoubleSupplier zoomSupplier,
            Supplier<DungeonViewportViewModel> viewportSupplier
    ) {
        this.controlsPanel = new DungeonControlsPanel(
                DungeonControlsPanel.Mode.TRAVEL,
                Objects.requireNonNull(controller, "controller"),
                Objects.requireNonNull(viewportSupplier, "viewportSupplier"),
                Objects.requireNonNull(zoomSupplier, "zoomSupplier"));
        controlsPanel.setFooterContent(MapWorkspaceSupport.muted(
                "Travel-Actions und Party-Token erweitern die generische Dungeon-Oberfläche."));
    }

    public Node content() {
        return controlsPanel;
    }

    public void refresh() {
        controlsPanel.refresh();
    }
}
