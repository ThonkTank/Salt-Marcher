package src.view.leftbartabs.dungeoneditor;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonApplicationService;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewModel;

final class DungeonEditorBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonEditorBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonApplicationService dungeon = runtimeContext.services().require(DungeonApplicationService.class);
        DungeonEditorViewModel viewModel = new DungeonEditorViewModel(dungeon);
        DungeonMapViewModel mapViewModel = new DungeonMapViewModel("Dungeon workspace", true);
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        DungeonEditorMainView main = new DungeonEditorMainView();
        DungeonEditorStateView state = new DungeonEditorStateView();
        main.renderModelProperty().bind(mapViewModel.displayModelProperty());
        state.stateTextProperty().bind(viewModel.stateProperty());
        controls.onRefresh(viewModel::refresh);
        controls.onViewModeChanged(mode -> viewModel.selectViewMode(toDisplayViewMode(mode)));
        controls.onToolChanged(viewModel::selectTool);
        controls.onPreviousLevel(viewModel::previousLevel);
        controls.onNextLevel(viewModel::nextLevel);
        controls.onOverlayModeChanged(mode -> viewModel.selectOverlayMode(toDisplayOverlayMode(mode)));
        viewModel.snapshotProperty().addListener((ignored, before, after) -> mapViewModel.showSnapshot(after));
        viewModel.viewModeProperty().addListener((ignored, before, after) -> {
            mapViewModel.selectViewMode(after);
            controls.showViewMode(toControlsViewMode(after));
        });
        viewModel.selectedToolProperty().addListener((ignored, before, after) -> {
            mapViewModel.showSelectedTool(after);
            controls.showTool(after);
        });
        viewModel.projectionLevelProperty().addListener((ignored, before, after) -> {
            mapViewModel.showProjectionLevel(after.intValue());
            controls.showLevel(after.intValue());
        });
        viewModel.overlayModeProperty().addListener((ignored, before, after) -> {
            mapViewModel.selectOverlayMode(after);
            controls.showOverlayMode(toControlsOverlayMode(after));
        });
        viewModel.statusProperty().addListener((ignored, before, after) -> controls.showStatus(after));
        controls.showViewMode(toControlsViewMode(viewModel.viewModeProperty().get()));
        controls.showTool(viewModel.selectedToolProperty().get());
        controls.showLevel(viewModel.projectionLevelProperty().get());
        controls.showOverlayMode(toControlsOverlayMode(viewModel.overlayModeProperty().get()));
        controls.showStatus(viewModel.statusProperty().get());
        viewModel.refresh();
        return new Binding(controls, main, state);
    }

    private static DungeonMapDisplayModel.ViewMode toDisplayViewMode(DungeonEditorControlsView.ViewMode viewMode) {
        return viewMode == DungeonEditorControlsView.ViewMode.GRAPH
                ? DungeonMapDisplayModel.ViewMode.GRAPH
                : DungeonMapDisplayModel.ViewMode.GRID;
    }

    private static DungeonEditorControlsView.ViewMode toControlsViewMode(DungeonMapDisplayModel.ViewMode viewMode) {
        return viewMode == DungeonMapDisplayModel.ViewMode.GRAPH
                ? DungeonEditorControlsView.ViewMode.GRAPH
                : DungeonEditorControlsView.ViewMode.GRID;
    }

    private static DungeonMapDisplayModel.OverlayMode toDisplayOverlayMode(
            DungeonEditorControlsView.OverlayMode overlayMode) {
        return switch (overlayMode == null ? DungeonEditorControlsView.OverlayMode.OFF : overlayMode) {
            case OFF -> DungeonMapDisplayModel.OverlayMode.OFF;
            case NEARBY -> DungeonMapDisplayModel.OverlayMode.NEARBY;
            case SELECTED -> DungeonMapDisplayModel.OverlayMode.SELECTED;
        };
    }

    private static DungeonEditorControlsView.OverlayMode toControlsOverlayMode(
            DungeonMapDisplayModel.OverlayMode overlayMode) {
        return switch (overlayMode == null ? DungeonMapDisplayModel.OverlayMode.OFF : overlayMode) {
            case OFF -> DungeonEditorControlsView.OverlayMode.OFF;
            case NEARBY -> DungeonEditorControlsView.OverlayMode.NEARBY;
            case SELECTED -> DungeonEditorControlsView.OverlayMode.SELECTED;
        };
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Dungeon Editor";
        }

        @Override
        public String navigationLabel() {
            return "Dungeon";
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
