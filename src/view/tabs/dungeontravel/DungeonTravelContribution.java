package src.view.tabs.dungeontravel;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import src.domain.dungeon.DungeonApplicationService;

public final class DungeonTravelContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonTravelContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("dungeon-travel"),
                new NavigationGroupSpec("world", "World", 20),
                20,
                false,
                null,
                ShellTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        DungeonApplicationService dungeon = Objects.requireNonNull(runtimeContext, "runtimeContext")
                .services()
                .require(DungeonApplicationService.class);
        DungeonTravelViewModel viewModel = new DungeonTravelViewModel(dungeon);
        DungeonTravelControlsView controls = new DungeonTravelControlsView();
        DungeonTravelMainView main = new DungeonTravelMainView();
        DungeonTravelStateView state = new DungeonTravelStateView();
        main.renderModelProperty().bind(viewModel.displayModelProperty());
        state.stateTextProperty().bind(viewModel.stateProperty());
        controls.onRefresh(viewModel::refresh);
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
