package src.view.models;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContributionModel;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import src.domain.dungeon.DungeonApplicationService;
import src.view.views.DungeonTravelControlsView;
import src.view.views.DungeonTravelMainView;
import src.view.views.DungeonTravelStateView;

public final class DungeonTravelTabModel implements ShellContributionModel {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonTravelTabModel() {
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
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        DungeonApplicationService dungeon = new DungeonApplicationService();
        DungeonTravelControlsView controls = new DungeonTravelControlsView();
        DungeonTravelMainView main = new DungeonTravelMainView();
        DungeonTravelStateView state = new DungeonTravelStateView();
        Runnable refresh = () -> {
            main.showStatus(String.valueOf(dungeon.loadSnapshot()));
            state.showState("Travel projection refreshed.");
        };
        controls.onRefresh(refresh);
        refresh.run();
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
