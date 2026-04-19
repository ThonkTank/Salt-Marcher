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
import src.domain.creatures.CreaturesApplicationService;
import src.view.views.CreaturesControlsView;
import src.view.views.CreaturesMainView;

public final class CreaturesCatalogTabModel implements ShellContributionModel {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public CreaturesCatalogTabModel() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("creatures"),
                new NavigationGroupSpec("reference", "Reference", 30),
                10,
                false,
                null,
                ShellTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        CreaturesApplicationService creatures = Objects.requireNonNull(runtimeContext, "runtimeContext")
                .services()
                .require(CreaturesApplicationService.class);
        CreaturesControlsView controls = new CreaturesControlsView();
        CreaturesMainView main = new CreaturesMainView();
        Runnable load = () -> main.showSummary(String.valueOf(creatures.loadFilterOptions()));
        controls.onLoad(load);
        load.run();
        return new Binding(controls, main);
    }

    private record Binding(
            Node controls,
            Node main
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Creatures";
        }

        @Override
        public String navigationLabel() {
            return "Creatures";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main);
        }
    }
}
