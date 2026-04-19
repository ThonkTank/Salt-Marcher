package src.view.dungeonmap.View;

import java.util.Objects;
import java.util.function.DoubleSupplier;
import java.util.function.Supplier;
import src.view.dungeonmap.api.DungeonMapSurfaceViewModel;
import src.view.dungeonmap.api.DungeonViewportViewModel;

public final class DungeonTravelControls extends AbstractDungeonControlsHost {

    public DungeonTravelControls(
            DungeonMapSurfaceViewModel controller,
            DoubleSupplier zoomSupplier,
            Supplier<DungeonViewportViewModel> viewportSupplier
    ) {
        super(new DungeonControlsPanel(
                DungeonControlsPanel.Mode.TRAVEL,
                Objects.requireNonNull(controller, "controller"),
                Objects.requireNonNull(viewportSupplier, "viewportSupplier"),
                Objects.requireNonNull(zoomSupplier, "zoomSupplier")));
        setFooterContent(MapWorkspaceSupport.muted(
                "Travel-Actions und Party-Token erweitern die generische Dungeon-Oberfläche."));
    }
}
