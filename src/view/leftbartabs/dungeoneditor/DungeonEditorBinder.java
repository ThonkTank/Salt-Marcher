package src.view.leftbartabs.dungeoneditor;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonApplicationService;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewModel;

final class DungeonEditorBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonEditorBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonApplicationService dungeon = runtimeContext.services().require(DungeonApplicationService.class);
        DungeonEditorViewModel viewModel = new DungeonEditorViewModel(dungeon);
        DungeonMapViewModel mapViewModel = new DungeonMapViewModel("Dungeon workspace");
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        DungeonEditorMainView main = new DungeonEditorMainView();
        DungeonEditorStateView state = new DungeonEditorStateView();
        main.renderModelProperty().bind(mapViewModel.displayModelProperty());
        state.stateTextProperty().bind(viewModel.stateProperty());
        controls.onCreateMap(viewModel::refresh);
        viewModel.snapshotProperty().addListener((ignored, before, after) -> mapViewModel.showSnapshot(after));
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
