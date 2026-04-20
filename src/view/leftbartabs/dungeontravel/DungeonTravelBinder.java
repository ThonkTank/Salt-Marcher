package src.view.leftbartabs.dungeontravel;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonApplicationService;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewModel;

final class DungeonTravelBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonTravelBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonApplicationService dungeon = runtimeContext.services().require(DungeonApplicationService.class);
        DungeonTravelViewModel viewModel = new DungeonTravelViewModel(dungeon);
        DungeonMapViewModel mapViewModel = new DungeonMapViewModel("Travel workspace", false);
        DungeonTravelControlsView controls = new DungeonTravelControlsView();
        DungeonTravelMainView main = new DungeonTravelMainView();
        DungeonTravelStateView state = new DungeonTravelStateView();
        main.renderModelProperty().bind(mapViewModel.displayModelProperty());
        state.stateTextProperty().bind(viewModel.stateProperty());
        controls.onRefresh(viewModel::refresh);
        controls.onResetView(main::resetCamera);
        controls.onPreviousLevel(viewModel::previousLevel);
        controls.onNextLevel(viewModel::nextLevel);
        controls.onOverlayModeChanged(viewModel::selectOverlayMode);
        viewModel.snapshotProperty().addListener((ignored, before, after) -> mapViewModel.showSnapshot(after));
        viewModel.overlayModeProperty().addListener((ignored, before, after) -> {
            mapViewModel.selectOverlayMode(after);
            controls.showOverlayMode(after);
        });
        viewModel.projectionLevelProperty().addListener((ignored, before, after) -> {
            mapViewModel.showProjectionLevel(after.intValue());
            controls.showLevel(after.intValue());
        });
        viewModel.mapNameProperty().addListener((ignored, before, after) -> controls.showMapName(after));
        controls.showOverlayMode(viewModel.overlayModeProperty().get());
        controls.showLevel(viewModel.projectionLevelProperty().get());
        controls.showMapName(viewModel.mapNameProperty().get());
        viewModel.refresh();
        return new Binding(controls, main, state);
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Dungeon Travel";
        }

        @Override
        public String navigationLabel() {
            return "Travel";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main,
                    ShellSlot.COCKPIT_STATE, state);
        }
    }
}
