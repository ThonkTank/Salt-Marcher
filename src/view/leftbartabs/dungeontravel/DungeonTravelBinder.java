package src.view.leftbartabs.dungeontravel;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonApplicationService;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;
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
        controls.onOverlayModeChanged(mode -> viewModel.selectOverlayMode(toDisplayOverlayMode(mode)));
        viewModel.snapshotProperty().addListener((ignored, before, after) -> mapViewModel.showSnapshot(after));
        viewModel.overlayModeProperty().addListener((ignored, before, after) -> {
            mapViewModel.selectOverlayMode(after);
            controls.showOverlayMode(toControlsOverlayMode(after));
        });
        viewModel.projectionLevelProperty().addListener((ignored, before, after) -> {
            mapViewModel.showProjectionLevel(after.intValue());
            controls.showLevel(after.intValue());
        });
        viewModel.mapNameProperty().addListener((ignored, before, after) -> controls.showMapName(after));
        controls.showOverlayMode(toControlsOverlayMode(viewModel.overlayModeProperty().get()));
        controls.showLevel(viewModel.projectionLevelProperty().get());
        controls.showMapName(viewModel.mapNameProperty().get());
        viewModel.refresh();
        return new Binding(controls, main, state);
    }

    private static DungeonMapDisplayModel.OverlayMode toDisplayOverlayMode(
            DungeonTravelControlsView.OverlayMode overlayMode) {
        return switch (overlayMode == null ? DungeonTravelControlsView.OverlayMode.OFF : overlayMode) {
            case OFF -> DungeonMapDisplayModel.OverlayMode.OFF;
            case NEARBY -> DungeonMapDisplayModel.OverlayMode.NEARBY;
            case SELECTED -> DungeonMapDisplayModel.OverlayMode.SELECTED;
        };
    }

    private static DungeonTravelControlsView.OverlayMode toControlsOverlayMode(
            DungeonMapDisplayModel.OverlayMode overlayMode) {
        return switch (overlayMode == null ? DungeonMapDisplayModel.OverlayMode.OFF : overlayMode) {
            case OFF -> DungeonTravelControlsView.OverlayMode.OFF;
            case NEARBY -> DungeonTravelControlsView.OverlayMode.NEARBY;
            case SELECTED -> DungeonTravelControlsView.OverlayMode.SELECTED;
        };
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
